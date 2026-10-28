use crate::engine_bridge::resolve_engine_path;
use serde_json::{json, Value};
use std::{collections::{HashMap, HashSet}, io::{BufRead, BufReader, Read, Write}, process::{Command, Stdio}, sync::{Arc, Mutex, atomic::{AtomicBool, AtomicUsize, Ordering}}, time::{Duration, Instant}};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct EngineState {
    grants: Mutex<HashMap<String, (Instant, Value)>>,
    lens_trees: Arc<Mutex<HashMap<String, (Instant, Arc<crate::lens_scanner::TreeSnapshot>)>>>,
    identities: Mutex<HashMap<String, HashMap<String, (u64, u64)>>>,
    cancellations: Mutex<HashMap<String, Arc<AtomicBool>>>,
    mutation: tokio::sync::Mutex<()>,
    mutation_active: AtomicBool,
    active_children: Arc<AtomicUsize>,
    shutting_down: Arc<AtomicBool>,
    manifests: Mutex<HashMap<String, HashMap<String, Value>>>,
    latest: Mutex<HashMap<String, String>>,
    completed: Mutex<HashMap<String, HashSet<String>>>,
    operation_dirs: Mutex<HashMap<String, std::path::PathBuf>>,
}
impl EngineState {
    pub(crate) fn is_busy(&self) -> bool { self.active_children.load(Ordering::SeqCst)>0 || self.is_mutating() }
    pub(crate) fn is_mutating(&self) -> bool { self.mutation_active.load(Ordering::SeqCst) }
    pub(crate) fn shutdown(&self) {
        self.shutting_down.store(true, Ordering::SeqCst);
        for flag in self.cancellations.lock().unwrap().values() { flag.store(true, Ordering::SeqCst); }
        for dir in self.operation_dirs.lock().unwrap().values() { let _ = std::fs::write(dir.join("cancel"), b"cancel"); }
    }
    fn key(&self, key: &str) -> String { self.latest.lock().unwrap().get(key).cloned().unwrap_or_else(||key.into()) }
}
struct MutationLease<'a>(&'a EngineState);
impl<'a> MutationLease<'a> { fn new(state: &'a EngineState) -> Result<Self,String> { if state.shutting_down.load(Ordering::SeqCst) { return Err("cancelled: app đang thoát".into()); } state.mutation_active.store(true,Ordering::SeqCst); state.lens_trees.lock().unwrap().clear(); Ok(Self(state)) } }
impl Drop for MutationLease<'_> { fn drop(&mut self) { self.0.mutation_active.store(false,Ordering::SeqCst); } }
#[tauri::command]
pub fn get_operation_status(state: State<'_, EngineState>) -> Value {
    json!({"mutation_active":state.is_mutating(), "read_active":!state.cancellations.lock().unwrap().is_empty()})
}
fn main_only(window: &tauri::WebviewWindow) -> Result<(),String> { if window.label() == "main" { Ok(()) } else { Err("scope_mismatch: mutation chỉ ở cửa sổ chính".into()) } }
#[tauri::command]
pub async fn prepare_for_update(window: tauri::WebviewWindow, app: AppHandle, state: State<'_,EngineState>) -> Result<(),String> {
    main_only(&window)?;
    if state.is_mutating() { return Err("Đang dọn/đóng ứng dụng; hãy chờ thao tác hoàn tất".into()); }
    let _guard=state.mutation.lock().await;
    let history=read_reconciled_history(&app).await?;
    if let Some(reason)=crate::journal_history::update_block_reason(&history) {return Err(reason);}
    state.shutdown(); app.state::<crate::engine_bridge::MetricsService>().shutdown();
    let start=Instant::now();
    while state.is_busy() || app.state::<crate::engine_bridge::MetricsService>().is_busy() {
        if start.elapsed()>Duration::from_secs(12) { state.shutting_down.store(false,Ordering::SeqCst);app.state::<crate::engine_bridge::MetricsService>().resume(); return Err("Không thể kết thúc engine; chưa cài bản cập nhật".into()); }
        tokio::time::sleep(Duration::from_millis(40)).await;
    }
    Ok(())
}
#[tauri::command]
pub fn resume_after_update_error(window: tauri::WebviewWindow, app: AppHandle, state: State<'_,EngineState>) -> Result<(),String> {
    main_only(&window)?;
    if state.is_busy() { return Err("Engine chưa kết thúc".into()); }
    state.shutting_down.store(false,Ordering::SeqCst);app.state::<crate::engine_bridge::MetricsService>().resume(); Ok(())
}
#[tauri::command]
pub fn restart_after_update(window: tauri::WebviewWindow, app: AppHandle, state: State<'_,EngineState>) -> Result<(),String> {
    main_only(&window)?;
    if !state.shutting_down.load(Ordering::SeqCst) || state.is_busy() || app.state::<crate::engine_bridge::MetricsService>().is_busy() { return Err("Cần kết thúc engine trước restart".into()); }
    app.restart()
}
fn request_version(payload: &mut Value) {
    payload["protocol_version"] = json!("2.0"); payload["policy_version"] = json!("1.0.0"); payload["platform"] = json!("macos");
}
fn validate_scan(value: &Value) -> Result<(),String> {
    if value["protocol_version"] != "2.0" || value["policy_version"] != "1.0.0" || value["platform"] != "macos"
        || !["quick_cleanup","detailed_cleanup"].contains(&value["operation_scope"].as_str().unwrap_or(""))
        || value["categories"].as_array().is_none() || value["scan_id"].as_str().is_none() {
        return Err("protocol_mismatch: không cấp quyền từ DTO chưa xác thực".into());
    }
    for category in value["categories"].as_array().unwrap() {
        let items = category["items"].as_array().ok_or("invalid_request: items")?;
        for item in items {
            if item["path"].as_str().is_none() || item["size_bytes"].as_i64().is_none_or(|n| n<0) || item["is_cleanable"].as_bool().is_none() || item["rule_id"].as_str().is_none() { return Err("invalid_request: item".into()); }
        }
    }
    Ok(())
}
#[cfg(unix)]
fn manifest(path: &str) -> Result<Value,String> { manifest_policy(path, false) }
#[cfg(unix)]
fn manifest_policy(path: &str, mclean_system: bool) -> Result<Value,String> { manifest_authority(path,mclean_system,false) }
#[cfg(unix)]
fn manifest_authority(path: &str, mclean_system: bool, root_unit:bool) -> Result<Value,String> {
    use std::os::unix::fs::MetadataExt;
    let mut pending=vec![std::path::PathBuf::from(path)]; let mut rows=Vec::new(); let started=Instant::now();
    while let Some(p)=pending.pop() {
        if rows.len()>=20000 || started.elapsed()>Duration::from_secs(4) { return Err("scope_changed: partial manifest".into()); }
        let m=std::fs::symlink_metadata(&p).map_err(|e|e.to_string())?;
        let boundary=if m.is_symlink() {p.parent().unwrap().to_path_buf()} else {p.clone()};
        // Match the native scanner's fixed macOS aliases without accepting arbitrary symlinks.
        let text=boundary.to_string_lossy();
        let native_boundary=if ["/tmp", "/var/log", "/var/tmp"].iter().any(|root| text.as_ref()==*root || text.starts_with(&format!("{root}/"))) {
            std::path::PathBuf::from(format!("/private{text}"))
        } else { boundary.clone() };
        if std::fs::canonicalize(&boundary).map_err(|e|e.to_string())? != native_boundary { return Err("path_changed".into()); }
        if !mclean_system && ((!m.is_file() && !m.is_dir() && !m.is_symlink()) || (m.is_file() && m.nlink()!=1)) { return Err("protected_target: link/special file".into()); }
        rows.push(json!({"path":p.to_string_lossy(),"device":m.dev(),"inode":m.ino(),"mode":m.mode(),"size":m.size(),"modified_s":m.mtime(),"modified_ns":m.mtime_nsec(),"changed_s":m.ctime(),"changed_ns":m.ctime_nsec()}));
        if m.is_dir() && !mclean_system && !root_unit { for entry in std::fs::read_dir(&p).map_err(|e|e.to_string())? { pending.push(entry.map_err(|e|e.to_string())?.path()); } }
    }
    rows.sort_by(|a,b|a["path"].as_str().cmp(&b["path"].as_str())); Ok(json!(rows))
}
#[cfg(not(unix))]
fn manifest(_: &str) -> Result<Value,String> { Err("unsupported platform".into()) }
#[cfg(not(unix))]
fn manifest_policy(path: &str, _: bool) -> Result<Value,String> { manifest(path) }
fn collect_manifests(value:&Value,output:&mut HashMap<String,Value>){collect_manifests_scope(value,output,value["operation_scope"]=="uninstall");}
fn collect_manifests_scope(value:&Value,output:&mut HashMap<String,Value>,uninstall:bool){
 match value {
  Value::Object(map)=>{
   if map.get("is_cleanable").and_then(Value::as_bool)!=Some(false) && map.get("can_trash").and_then(Value::as_bool)!=Some(false){
    if let Some(path)=map.get("path").and_then(Value::as_str){
     let system=map.get("rule_id").and_then(Value::as_str)==Some("mclean_system_junk") || map.get("deletion_method").and_then(Value::as_str)==Some("pnpm_prune");
     if let Ok(proof)=manifest_authority(path,system,uninstall || map.get("execution_mode").and_then(Value::as_str)==Some("live_cache_root")){output.insert(path.into(),proof);}
    }
   }
   for child in map.values(){collect_manifests_scope(child,output,uninstall);}
  },Value::Array(rows)=>for row in rows{collect_manifests_scope(row,output,uninstall);},_=>{}
 }
}
#[cfg(not(unix))]
fn manifest_authority(path:&str,system:bool,_:bool)->Result<Value,String>{manifest_policy(path,system)}
fn operation_uuid() -> String {
    let mut b=[0u8;16]; std::fs::File::open("/dev/urandom").and_then(|mut f|f.read_exact(&mut b)).expect("OS random unavailable");
    b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
    let h=b.iter().map(|n|format!("{n:02x}")).collect::<String>(); format!("{}-{}-{}-{}-{}",&h[0..8],&h[8..12],&h[12..16],&h[16..20],&h[20..32])
}
fn prepare_operation(app: &AppHandle,state: &EngineState,payload: &mut Value, requested: &str) -> Result<String,String> {
    let valid=requested.len()==36 && requested.bytes().enumerate().all(|(i,b)| if [8,13,18,23].contains(&i) {b==b'-'} else {b.is_ascii_hexdigit()});
    if !requested.is_empty() && !valid { return Err("invalid_request: operation_id".into()); }
    let id=if valid { requested.to_string() } else { operation_uuid() };
    let root=app.path().app_data_dir().map_err(|e|e.to_string())?.join("operations");
    std::fs::create_dir_all(&root).map_err(|e|e.to_string())?;
    if std::fs::canonicalize(&root).map_err(|e|e.to_string())? != root { return Err("path_changed: journal".into()); }
    let dir=root.join(&id); if dir.exists() { return Err("invalid_request: operation replay".into()); }
    std::fs::create_dir(&dir).map_err(|e|e.to_string())?;
    #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&dir,std::fs::Permissions::from_mode(0o700)).map_err(|e|e.to_string())?; }
    let intent=json!({"operation_id":id,"operation_scope":payload["operation_scope"],"status":"planned","automatic_replay":false});
    std::fs::write(dir.join("host.json"),intent.to_string()).map_err(|e|e.to_string())?;
    state.operation_dirs.lock().unwrap().insert(id.clone(),dir);
    payload["operation_id"]=json!(id); request_version(payload); Ok(id)
}
fn record_result(state: &EngineState,id: &str,result: &Result<Value,String>) {
    if let Some(dir)=state.operation_dirs.lock().unwrap().remove(id) {
        let value=match result { Ok(v)=>json!({"status":"returned","result":v}),Err(e)=>json!({"status":"interrupted","error":e,"native_journal":"result.json","automatic_replay":false}) };
        let tmp=dir.join("host_next.json"); if std::fs::write(&tmp,value.to_string()).is_ok() { let _=std::fs::rename(tmp,dir.join("host.json")); }
    }
}
fn remember(state: &EngineState, key: String, mut value: Value) {
    if key=="apps" {value["operation_scope"]=json!("uninstall");}
    let key = if ["apps","orphans"].contains(&key.as_str()) {
        let ticket=operation_uuid(); state.latest.lock().unwrap().insert(key,ticket.clone()); ticket
    } else {key};
    let mut snapshots=HashMap::new();
    let proof_value = if value["lens_id"].is_string() {
        let mut shallow=value.clone();
        if let Some(children)=shallow["root_node"]["children"].as_array_mut() {
            for child in children { child.as_object_mut().unwrap().remove("children"); }
        }
        shallow
    } else {value.clone()};
    collect_manifests(&proof_value,&mut snapshots);
    let mut grants = state.grants.lock().unwrap();
    grants.retain(|_, (time, _)| time.elapsed() < Duration::from_secs(900));
    if grants.len() >= 32 { grants.clear(); }
    let mut paths = HashMap::new(); collect_identities(&value, &mut paths);
    let mut identities = state.identities.lock().unwrap();
    identities.retain(|key, _| grants.contains_key(key));
    identities.insert(key.clone(), paths);
    { let mut stored=state.manifests.lock().unwrap(); stored.retain(|key,_|grants.contains_key(key)); stored.insert(key.clone(),snapshots); }
    state.completed.lock().unwrap().retain(|key,_|grants.contains_key(key));
    grants.insert(key, (Instant::now(), value));
}
fn recalled(state: &EngineState, key: &str) -> Result<Value, String> {
    state.grants.lock().unwrap().get(&state.key(key)).filter(|(time, _)| time.elapsed() < Duration::from_secs(900)).map(|(_, value)| value.clone()).ok_or_else(|| "Kết quả đã hết hạn; hãy quét lại.".into())
}
#[cfg(unix)]
fn identity(path: &str) -> Result<(u64, u64), String> {
    use std::os::unix::fs::MetadataExt;
    let metadata = std::fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink() { return Err("Từ chối symlink".into()); }
    Ok((metadata.dev(), metadata.ino()))
}
#[cfg(not(unix))]
fn identity(_: &str) -> Result<(u64, u64), String> { Err("Native engine chỉ hỗ trợ macOS".into()) }
fn collect_identities(value: &Value, output: &mut HashMap<String, (u64, u64)>) {
    match value {
        Value::Object(map) => {
            if let Some(path) = map.get("path").and_then(Value::as_str) { if let Ok(stamp) = identity(path) { output.insert(path.into(), stamp); } }
            for child in map.values() { collect_identities(child, output); }
        }
        Value::Array(list) => for child in list { collect_identities(child, output); },
        _ => {}
    }
}
fn bind_identities(state: &EngineState, key: &str, payload: &mut Value, paths: &[String]) -> Result<(), String> {
    let key=state.key(key);
    let scan = recalled(state, &key)?;
    let identities = state.identities.lock().unwrap();
    let known = identities.get(&key).ok_or("Thiếu danh sách định danh tệp; hãy quét lại")?;
    let mut stamps = serde_json::Map::new();
    for path in paths {
        let expected = known.get(path).ok_or("Mục không còn hợp lệ; hãy quét lại")?;
        if identity(path)? != *expected { return Err("Tệp đã thay đổi định danh sau khi quét; hãy quét lại".into()); }
        if std::env::current_exe().ok().is_some_and(|exe| exe.starts_with(path)) { return Err("Không được xóa ứng dụng đang chạy".into()); }
        stamps.insert(path.clone(), json!([expected.0, expected.1]));
    }
    let manifests=state.manifests.lock().unwrap();
    let known=manifests.get(&key).ok_or("scope_changed: missing manifest")?;
    let mut snapshots=serde_json::Map::new();
    for path in paths {
        let before=known.get(path).ok_or_else(||format!("Không xác minh được mục {}. Chưa gỡ/dọn mục nào; hãy quét lại và kiểm tra quyền truy cập.",path))?;
        let mclean_system = scan["operation_scope"] == "quick_cleanup" && scan["categories"].as_array().is_some_and(|cats| cats.iter().any(|cat| cat["category"] == "system_junk" && cat["items"].as_array().is_some_and(|items| items.iter().any(|item| item["path"] == path.as_str() && item["rule_id"] == "mclean_system_junk"))));
        let manager_prune = scan["categories"].as_array().is_some_and(|cats| cats.iter().any(|cat| cat["items"].as_array().is_some_and(|items| items.iter().any(|item| item["path"] == path.as_str() && item["deletion_method"] == "pnpm_prune"))));
        let live_cache = scan["operation_scope"] == "quick_cleanup" && scan["categories"].as_array().is_some_and(|cats| cats.iter().any(|cat| cat["category"] == "user_caches" && cat["items"].as_array().is_some_and(|items| items.iter().any(|item| item["path"] == path.as_str() && item["execution_mode"] == "live_cache_root" && item["is_cleanable"] == true))));
        if !live_cache && manifest_authority(path, mclean_system || manager_prune, scan["operation_scope"]=="uninstall")? != *before { return Err("scope_changed: nội dung thay đổi, hãy quét lại".into()); }
        snapshots.insert(path.clone(),before.clone());
    }
    payload["identities"] = Value::Object(stamps); payload["content_snapshots"]=Value::Object(snapshots); Ok(())
}
fn bind_quick_targets(state: &EngineState, key: &str, payload: &mut Value) -> Result<Vec<Value>,String> {
    let original=payload["targets"].as_array().ok_or("invalid_request: targets")?.clone();
    let mut targets=Vec::new();let mut identities=serde_json::Map::new();let mut snapshots=serde_json::Map::new();let mut skipped=Vec::new();
    for target in original {
        let path=target["path"].as_str().ok_or("invalid_request: path")?.to_string();
        let mut proof=json!({});
        match bind_identities(state,key,&mut proof,std::slice::from_ref(&path)) {
            Ok(())=>{identities.insert(path.clone(),proof["identities"][&path].clone());snapshots.insert(path.clone(),proof["content_snapshots"][&path].clone());targets.push(target);}
            Err(reason)=>skipped.push(json!({"path":path,"status":"skipped","affected_bytes":0,"method_used":target["deletion_method"],"error_message":reason})),
        }
    }
    payload["targets"]=json!(targets);payload["identities"]=Value::Object(identities);payload["content_snapshots"]=Value::Object(snapshots);Ok(skipped)
}
fn bind_cleanup_scope(scan: &Value, payload: &mut Value) -> Result<(), String> {
    let scope = scan["operation_scope"].as_str().ok_or("scope_mismatch: hãy quét lại")?;
    if !["quick_cleanup", "detailed_cleanup"].contains(&scope)
        || payload.get("operation_scope").is_some_and(|requested| requested != scope)
        || payload.get("authorized_app").is_some() {
        return Err("scope_mismatch: không dùng kết quả gỡ app để dọn rác".into());
    }
    payload["operation_scope"] = json!(scope);
    Ok(())
}
fn validate_targets(targets: &Value, allowed: &HashMap<String, String>) -> Result<(), String> {
    let list = targets.as_array().ok_or("Danh sách mục không hợp lệ")?;
    if list.is_empty() || list.len() > 10000 { return Err("Số mục không hợp lệ".into()); }
    let mut seen = HashSet::new();
    for item in list {
        let path = item["path"].as_str().ok_or("Thiếu đường dẫn")?;
        let method = item["deletion_method"].as_str().ok_or("Thiếu phương thức xóa")?;
        if allowed.get(path).map(String::as_str) != Some(method) || !seen.insert(path) { return Err("Mục chưa được quét hoặc phương thức xóa không khớp".into()); }
    }
    Ok(())
}
fn gather(value: &Value, output: &mut HashMap<String, String>) {
    match value {
        Value::Object(map) => {
            if map.get("is_cleanable").and_then(Value::as_bool) != Some(false) {
            if let (Some(path), Some(method)) = (map.get("path").and_then(Value::as_str), map.get("deletion_method").and_then(Value::as_str)) { output.insert(path.into(), method.into()); }
            }
            for child in map.values() { gather(child, output); }
        }
        Value::Array(list) => for child in list { gather(child, output); },
        _ => {}
    }
}
fn kill_owned_group(child: &mut std::process::Child) {
    #[cfg(unix)] { unsafe extern "C" { fn kill(pid:i32,signal:i32)->i32; } unsafe { kill(-(child.id() as i32),9); } }
    let _=child.kill();
}
#[tauri::command]
pub async fn get_operation_history(window: tauri::WebviewWindow, app: AppHandle, state: State<'_,EngineState>) -> Result<Value,String> {
    main_only(&window)?;
    let _guard=state.mutation.lock().await;
    read_reconciled_history(&app).await
}
async fn read_reconciled_history(app:&AppHandle)->Result<Value,String>{
    let root=app.path().app_data_dir().map_err(|e|e.to_string())?.join("operations");
    let history=crate::journal_history::read(&root,std::time::SystemTime::now())?;
    for row in history.as_array().unwrap() {
        if row["journal_unverified"]!=true && crate::journal_history::pending_apps(row) {
            let id=row["operation_id"].as_str().ok_or("invalid journal id")?;
            // Native only observes already-running applications. No launch, Quit,
            // or replay happens when the UI reads history or checks updater gates.
            let result=execute(app.clone(),vec!["finish_apps".into(),"--stdin".into()],Some(json!({"operation_id":id,"reconcile_only":true})),operation_uuid(),Arc::new(AtomicBool::new(false))).await;
            if let Err(reason)=result {return Err(format!("Không đối soát được lịch sử: {}",reason));}
        }
    }
    crate::journal_history::read(&root,std::time::SystemTime::now())
}
#[tauri::command]
pub async fn acknowledge_operation(window:tauri::WebviewWindow,app:AppHandle,state:State<'_,EngineState>,operation_id:String)->Result<(),String>{
    main_only(&window)?;let _guard=state.mutation.lock().await;
    crate::journal_history::acknowledge(&app.path().app_data_dir().map_err(|e|e.to_string())?.join("operations"),&operation_id)
}

async fn execute(app:AppHandle,args:Vec<String>,payload:Option<Value>,operation_id:String,cancel:Arc<AtomicBool>)->Result<Value,String>{
    execute_as(app,args,payload,operation_id,cancel).await
}
async fn execute_as<T:serde::de::DeserializeOwned+Send+'static>(app: AppHandle, args: Vec<String>, payload: Option<Value>, operation_id: String, cancel: Arc<AtomicBool>) -> Result<T, String> {
    let rust_lens=args.first().is_some_and(|arg|arg=="--lens-scan");
    let access_probe=args.first().is_some_and(|arg|arg=="--access-probe");
    let engine = if rust_lens || access_probe {std::env::current_exe().map_err(|e|e.to_string())?}else{resolve_engine_path(&app)?};
    let shutting_down=app.state::<EngineState>().shutting_down.clone();
    let active=app.state::<EngineState>().active_children.clone();
    let mutating=payload.is_some();
    if payload.as_ref().map(serialized_bytes).transpose()?.is_some_and(|n|n>=CLEANUP_REQUEST_LIMIT) { return Err("invalid_request: target manifest quá lớn; chọn ít mục hơn".into()); }
    active.fetch_add(1,Ordering::SeqCst);
    tokio::task::spawn_blocking(move || {
        struct Lease(Arc<AtomicUsize>);impl Drop for Lease {fn drop(&mut self){self.0.fetch_sub(1,Ordering::SeqCst);}}
        let _owned=Lease(active);
        let mut command=Command::new(engine);
        command.args(args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(unix)] { use std::os::unix::process::CommandExt; unsafe { command.pre_exec(|| { unsafe extern "C" { fn setpgid(pid:i32,pgid:i32)->i32; } if setpgid(0,0)==0 { Ok(()) } else { Err(std::io::Error::last_os_error()) } }); } }
        let mut child=command.spawn().map_err(|e|e.to_string())?;
        let stdout = child.stdout.take().unwrap(); let stderr = child.stderr.take().unwrap(); let mut stdin = child.stdin.take().unwrap();
        let writer = std::thread::spawn(move || -> std::io::Result<()> { if let Some(value) = payload { serde_json::to_writer(&mut stdin,&value).map_err(std::io::Error::other)?; } Ok(()) });
        // Drain both pipes concurrently, including outputs larger than the OS pipe buffer.
        let reader = std::thread::spawn(move || -> Result<Vec<u8>, String> {
            let mut data = Vec::new(); stdout.take(32*1024*1024+1).read_to_end(&mut data).map_err(|e| e.to_string())?;
            if data.len() > 32*1024*1024 { return Err("Kết quả engine quá lớn".into()); } Ok(data)
        });
        let events = std::thread::spawn(move || {
            let mut errors = String::new();
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    if let Some(name) = value["event"].as_str().filter(|n| ["scan_progress", "clean_progress", "lens_progress"].contains(n)) {
                        let _ = app.emit(name, json!({"operation_id": operation_id, "data": value["payload"]})); continue;
                    }
                }
                if errors.len() < 8192 { errors.push_str(&line); }
            } errors
        });
        let start = Instant::now(); let mut failure = None; let mut shutdown_since=None;
        let status = loop {
            if shutting_down.load(Ordering::SeqCst) && shutdown_since.is_none() { shutdown_since=Some(Instant::now()); }
            if cancel.load(Ordering::Relaxed) || start.elapsed() > Duration::from_secs(if mutating {600} else if access_probe {4} else {120}) || shutdown_since.is_some_and(|t| !mutating || t.elapsed()>Duration::from_secs(8)) {
                failure = Some(if cancel.load(Ordering::Relaxed) { "Đã hủy thao tác" } else { "Engine quá thời gian chờ" }.to_string());
                kill_owned_group(&mut child); break child.wait().map_err(|e| e.to_string());
            }
            match child.try_wait() { Ok(Some(status)) => break Ok(status), Ok(None) => std::thread::sleep(Duration::from_millis(40)), Err(e) => { kill_owned_group(&mut child); let _ = child.wait(); break Err(e.to_string()); } }
        };
        let write_result = writer.join().map_err(|_| "Lỗi luồng stdin")?;
        let data = reader.join().map_err(|_| "Lỗi luồng stdout")?;
        let errors = events.join().map_err(|_| "Lỗi luồng stderr")?;
        if let Some(error) = failure { return Err(error); }
        if !status?.success() { return Err(format!("Engine: {errors}")); }
        write_result.map_err(|e| e.to_string())?;
        let data=data?;
        if rust_lens {serde_json::from_reader(flate2::read::GzDecoder::new(data.as_slice())).map_err(|e|format!("Lens snapshot không hợp lệ: {e}"))}
        else {serde_json::from_slice(&data).map_err(|e| format!("JSON engine không hợp lệ: {e}"))}
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn start_scan(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, operation_id: String, include_empty: Option<bool>) -> Result<Value, String> {
    main_only(&window)?;
    let cancel = Arc::new(AtomicBool::new(false));
    state.cancellations.lock().unwrap().insert(operation_id.clone(), cancel.clone());
    let scope = if include_empty == Some(true) { "detailed_cleanup" } else { "quick_cleanup" };
    let mut args = vec!["scan".into(), "--scope".into(), scope.into()];
    if include_empty == Some(true) { args.push("--include-empty".into()); }
    let result = execute(app, args, None, operation_id.clone(), cancel).await;
    state.cancellations.lock().unwrap().remove(&operation_id);
    if let Ok(value) = &result { validate_scan(value)?; remember(&state, value["scan_id"].as_str().ok_or("Thiếu scan_id")?.into(), value.clone()); }
    result
}
#[tauri::command]
pub fn cancel_scan(state: State<'_, EngineState>, operation_id: String) { if let Some(flag) = state.cancellations.lock().unwrap().get(&operation_id) { flag.store(true, Ordering::Relaxed); } }
// Keep one native process for a cleanup, including its single admin pass.
const CLEANUP_REQUEST_LIMIT: usize = 64 * 1024 * 1024;
fn validate_cleanup_request(payload:&Value)->Result<(),String>{
    let targets=payload["targets"].as_array().ok_or("invalid_request: targets")?;
    for target in targets {let path=target["path"].as_str().ok_or("invalid_request: path")?;for field in ["identities","content_snapshots"] {payload[field].get(path).ok_or("scope_changed: missing proof")?;}}
    if serialized_bytes(payload)? >= CLEANUP_REQUEST_LIMIT-1024 {return Err("invalid_request: proof vượt giới hạn64MiB; chưa dọn mục nào".into());}Ok(())
}
fn serialized_bytes(payload:&Value)->Result<usize,String>{
    // Count without allocating another full JSON string; execution streams stdin.
    struct Counter(usize);impl std::io::Write for Counter {fn write(&mut self,b:&[u8])->std::io::Result<usize>{self.0+=b.len();Ok(b.len())}fn flush(&mut self)->std::io::Result<()>{Ok(())}}
    let mut counter=Counter(0);serde_json::to_writer(&mut counter,payload).map_err(|e|e.to_string())?;Ok(counter.0)
}

#[tauri::command]
pub async fn clean_items(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, payload: Value, operation_id: String) -> Result<Value, String> {
    main_only(&window)?;
    let _guard = state.mutation.lock().await;
    let _lease=MutationLease::new(&state)?;
    let scan = recalled(&state, payload["scan_id"].as_str().ok_or("Thiếu scan_id")?)?;
    let mut allowed = HashMap::new(); gather(&scan, &mut allowed); validate_targets(&payload["targets"], &allowed)?;
    let key = payload["scan_id"].as_str().unwrap().to_string();
    let paths: Vec<String> = payload["targets"].as_array().unwrap().iter().map(|v| v["path"].as_str().unwrap().into()).collect();
    let mut payload = payload;
    bind_cleanup_scope(&scan, &mut payload)?;
    let skipped=if payload["operation_scope"]=="quick_cleanup" {bind_quick_targets(&state,&key,&mut payload)?} else {bind_identities(&state,&key,&mut payload,&paths)?;Vec::new()};
    validate_cleanup_request(&payload)?;
    let op=prepare_operation(&app,&state,&mut payload,&operation_id)?;
    let result=if payload["targets"].as_array().unwrap().is_empty(){
        let mut result=json!({"native_execution":"not_started","permanently_freed_bytes":0,"trashed_bytes":0,"total_affected_bytes":0,"success_count":0,"failure_count":0,"duration_ms":0,"details":[],"operation_id":op,"operation_scope":payload["operation_scope"],"size_kind":"logical_estimate"});request_version(&mut result);Ok(result)
    } else {
        execute(app.clone(),vec!["clean".into(),"--stdin".into()],Some(payload),operation_id,Arc::new(AtomicBool::new(false))).await
    };
    let result=result.map(|mut result|{
        result["operation_ids"]=json!([op]);
        if !skipped.is_empty(){result["host_preflight_skipped"]=json!(skipped);result["details"].as_array_mut().unwrap().extend(skipped);result["failure_count"]=json!(result["details"].as_array().unwrap().iter().filter(|d|d["status"]!="success").count());}
        result
    });
    record_result(&state,&op,&result);result
}
#[tauri::command]
pub async fn prepare_cleanup_apps(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, payload: Value) -> Result<Value,String> {
    main_only(&window)?;
    let _guard=state.mutation.lock().await; let _lease=MutationLease::new(&state)?;
    if payload["confirm_app_quit"] != true { return Err("invalid_request: cần xác nhận đóng app".into()); }
    let key=payload["scan_id"].as_str().ok_or("missing scan_id")?;
    let scan=recalled(&state,key)?;
    let scope = scan["operation_scope"].as_str().ok_or("scope_mismatch")?;
    if !["quick_cleanup", "detailed_cleanup"].contains(&scope) { return Err("scope_mismatch".into()); }
    let mut allowed=HashMap::new(); gather(&scan,&mut allowed); validate_targets(&payload["targets"],&allowed)?;
    let mut native_targets=Vec::new();
    for target in payload["targets"].as_array().unwrap() {
        let path=target["path"].as_str().unwrap();
        let row=scan["categories"].as_array().unwrap().iter().flat_map(|c|c["items"].as_array().into_iter().flatten()).find(|r|r["path"]==path).ok_or("unknown target")?;
        if row["requires_app_quit"] != true { continue; }
        native_targets.push(json!({"path":path,"category":row["category"]}));
    }
    if native_targets.is_empty() { return Ok(json!({"status":"not_needed","apps":[]})); }
    let mut request=json!({"operation_scope":scope,"confirm_app_quit":true,"targets":native_targets});
    let op=prepare_operation(&app,&state,&mut request,"")?;
    let result=execute(app,vec!["prepare_apps".into(),"--stdin".into()],Some(request),op.clone(),Arc::new(AtomicBool::new(false))).await;
    record_result(&state,&op,&result); result
}
#[tauri::command]
pub async fn finish_cleanup_apps(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, operation_id: String) -> Result<Value,String> {
    main_only(&window)?;
    if operation_id.len()!=36 || operation_id.bytes().enumerate().any(|(i,b)|if [8,13,18,23].contains(&i){b!=b'-'}else{!b.is_ascii_hexdigit()}) { return Err("invalid_request".into()); }
    let _guard=state.mutation.lock().await; let _lease=MutationLease::new(&state)?;
    execute(app,vec!["finish_apps".into(),"--stdin".into()],Some(json!({"operation_id":operation_id})),String::new(),Arc::new(AtomicBool::new(false))).await
}
#[tauri::command]
pub async fn get_installed_apps(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>) -> Result<Value, String> {
    main_only(&window)?;
    let value = execute(app, vec!["apps".into(), "--include-residuals".into()], None, String::new(), Arc::new(AtomicBool::new(false))).await?;
    remember(&state, "apps".into(), value.clone()); Ok(value)
}
#[tauri::command]
pub async fn uninstall_app(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, payload: Value) -> Result<Value, String> {
    main_only(&window)?;
    let _guard = state.mutation.lock().await;
    let _lease=MutationLease::new(&state)?;
    let apps = recalled(&state, "apps")?;
    let selected = apps["apps"].as_array().and_then(|list| list.iter().find(|a| a["id"] == payload["app_id"])).ok_or("Ứng dụng chưa được quét")?;
    if selected["is_system_protected"] != false || selected["is_self_app"] != false { return Err("Ứng dụng được bảo vệ".into()); }
    let mut allowed = HashMap::new(); gather(selected, &mut allowed);
    let targets: Vec<Value> = payload["selected_paths"].as_array().ok_or("Thiếu danh sách đường dẫn")?.iter().map(|path| json!({"path":path,"deletion_method":"trash"})).collect();
    validate_targets(&json!(targets), &allowed)?;
    let mut payload = payload;
    payload["operation_scope"] = json!("uninstall");
    payload["authorized_app"] = selected.clone();
    let paths: Vec<String> = payload["selected_paths"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().into()).collect();
    bind_identities(&state, "apps", &mut payload, &paths)?;
    let key=state.key("apps");
    let finished=state.completed.lock().unwrap().get(&key).cloned().unwrap_or_default();
    let bundle=selected["bundle_path"].as_str().ok_or("missing bundle")?;
    payload["remaining_only"]=json!(!std::path::Path::new(bundle).exists() && finished.contains(bundle));
    let op=prepare_operation(&app,&state,&mut payload,"")?;
    let result=execute(app, vec!["uninstall".into(), "--stdin".into()], Some(payload), op.clone(), Arc::new(AtomicBool::new(false))).await;
    if let Ok(v)=&result { for row in v["details"].as_array().into_iter().flatten().filter(|v|v["status"]=="success") { if let Some(p)=row["path"].as_str() { state.completed.lock().unwrap().entry(key.clone()).or_default().insert(p.into()); } } }
    record_result(&state,&op,&result); result
}
#[tauri::command]
pub async fn get_orphans(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>) -> Result<Value, String> {
    main_only(&window)?;
    let value = execute(app, vec!["orphans".into()], None, String::new(), Arc::new(AtomicBool::new(false))).await?;
    remember(&state, "orphans".into(), value.clone()); Ok(value)
}
fn orphan_payload(state:&EngineState,selected_paths:&[String],confirm:bool)->Result<Value,String> {
    let groups=recalled(state,"orphans")?;
    let mut allowed=HashMap::new();
    for group in groups["orphans"].as_array().ok_or("Sai kết quả orphans")? { for item in group["items"].as_array().ok_or("Sai mục orphan")? { if item["is_safe_candidate"]==true {allowed.insert(item["path"].as_str().ok_or("missing path")?.into(),"remove_item".into());} } }
    let targets:Vec<Value>=selected_paths.iter().map(|path|json!({"path":path,"deletion_method":"remove_item"})).collect();
    validate_targets(&json!(targets),&allowed)?;
    let mut payload=json!({"operation_scope":"orphan_cleanup","targets":targets,"confirm_direct_delete":confirm});
    bind_identities(state,"orphans",&mut payload,selected_paths)?; request_version(&mut payload); Ok(payload)
}
#[tauri::command]
pub async fn clean_orphans(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, selected_paths: Vec<String>, confirm_direct_delete: bool) -> Result<Value, String> {
    main_only(&window)?;
    let _guard = state.mutation.lock().await;
    let _lease=MutationLease::new(&state)?;
    let mut payload=orphan_payload(&state,&selected_paths,confirm_direct_delete)?;
    let op=prepare_operation(&app,&state,&mut payload,"")?;
    let result=execute(app, vec!["clean_orphans".into(), "--stdin".into()], Some(payload), op.clone(), Arc::new(AtomicBool::new(false))).await;
    record_result(&state,&op,&result); result
}
fn unique_ticket(prefix: &str) -> String {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    format!("{}_{}_{}", prefix, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(), NEXT.fetch_add(1, Ordering::Relaxed))
}
#[tauri::command]
pub async fn analyze_space_lens(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, path: String, operation_id: Option<String>) -> Result<Value, String> {
    let operation = operation_id.unwrap_or_else(|| unique_ticket("lens_op"));
    main_only(&window)?;
    let cancel = Arc::new(AtomicBool::new(false));
    state.cancellations.lock().unwrap().insert(operation.clone(), cancel.clone());
    // Full compact snapshot remains in Rust; UI receives only the visible folder.
    let result:Result<crate::lens_scanner::TreeSnapshot,String>=execute_as(app,vec!["--lens-scan".into(),"--path".into(),path],None,operation.clone(),cancel).await;
    state.cancellations.lock().unwrap().remove(&operation);
    let mut tree=result?;tree.index()?;
    let ticket=unique_ticket("lens");
    let value=tree.response(&tree.root_path.to_string_lossy(),&ticket).ok_or("Invalid lens root")?;
    remember(&state,ticket.clone(),value.clone());
    let trees=state.lens_trees.clone();
    {let mut cache=trees.lock().unwrap();cache.retain(|_,(time,_)|time.elapsed()<Duration::from_secs(300));
     if cache.len()>=2{if let Some(oldest)=cache.iter().min_by_key(|(_, (time,_))|*time).map(|(key,_)|key.clone()){cache.remove(&oldest);}}
     cache.insert(ticket.clone(),(Instant::now(),Arc::new(tree)));}
    tokio::spawn(async move {tokio::time::sleep(Duration::from_secs(300)).await;let mut cache=trees.lock().unwrap();
        if cache.get(&ticket).is_some_and(|(time,_)|time.elapsed()>=Duration::from_secs(300)){cache.remove(&ticket);}});
    Ok(value)
}
#[tauri::command]
pub async fn get_lens_folder(window:tauri::WebviewWindow,state:State<'_,EngineState>,lens_id:String,path:String)->Result<Option<Value>,String>{
    main_only(&window)?;
    Ok(cached_lens_folder(&state,&lens_id,&path))
}
fn cached_lens_folder(state:&EngineState,lens_id:&str,path:&str)->Option<Value>{
    let tree={let mut cache=state.lens_trees.lock().unwrap();cache.retain(|_,(time,_)|time.elapsed()<Duration::from_secs(300));cache.get(lens_id).map(|(_,tree)|tree.clone())};
    tree.and_then(|tree|tree.response(path,lens_id))
}
#[tauri::command]
pub async fn choose_scan_folder(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(any(target_os = "macos",target_os = "windows"))]
    {
    let window = app.get_webview_window("main").ok_or("Không tìm thấy cửa sổ VXClean")?;
    let mut dialog = rfd::AsyncFileDialog::new()
        .set_title("Chọn thư mục để phân tích dung lượng")
        .set_parent(&window);
    if let Some(home) = std::env::var_os(if cfg!(windows){"USERPROFILE"}else{"HOME"}) { dialog = dialog.set_directory(home); }
    Ok(dialog.pick_folder().await.map(|folder| folder.path().to_string_lossy().into_owned()))
    }
    #[cfg(not(any(target_os = "macos",target_os = "windows")))]
    { let _ = app; Err("Folder picker của maintenance hiện chỉ hỗ trợ macOS".into()) }
}
#[tauri::command]
pub async fn get_scan_access_status(window:tauri::WebviewWindow,app:AppHandle)->Result<Value,String>{
    main_only(&window)?;
    #[cfg(target_os="macos")]{Ok(execute(app,vec!["--access-probe".into()],None,unique_ticket("access"),Arc::new(AtomicBool::new(false))).await.unwrap_or_else(crate::scan_access::unverified_status))}
    #[cfg(not(target_os="macos"))]{let _=app;Ok(crate::scan_access::status())}
}
#[tauri::command]
pub fn open_full_disk_access_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { Command::new("/usr/bin/open").arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles").status().map_err(|e| e.to_string()).and_then(|s| if s.success() { Ok(()) } else { Err("Không mở được Full Disk Access".into()) }) }
    #[cfg(not(target_os = "macos"))]
    { Err("Full Disk Access chỉ có trên macOS".into()) }
}
fn lens_contains(node: &Value, path: &str) -> bool {
    node["path"] == path && node["is_access_denied"] == false && node["can_trash"] == true || node["children"].as_array().is_some_and(|list| list.iter().any(|child| lens_contains(child, path)))
}
#[tauri::command]
pub async fn trash_lens_item(window: tauri::WebviewWindow, app: AppHandle, state: State<'_, EngineState>, lens_id: String, path: String) -> Result<Value, String> {
    main_only(&window)?;
    let _guard = state.mutation.lock().await;
    let _lease=MutationLease::new(&state)?;
    let scan = recalled(&state, &lens_id)?;
    if scan["root_path"] == path || !lens_contains(&scan["root_node"], &path) { return Err("Mục không thuộc kết quả phân tích hoặc là thư mục gốc".into()); }
    let mut payload = json!({"operation_scope":"lens_trash","targets":[{"path":path,"deletion_method":"trash"}]});
    bind_identities(&state, &lens_id, &mut payload, &[path])?;
    let op=prepare_operation(&app,&state,&mut payload,"")?;
    let result=execute(app, vec!["trash_lens".into(), "--stdin".into()], Some(payload), op.clone(), Arc::new(AtomicBool::new(false))).await;
    record_result(&state,&op,&result); result
}
#[tauri::command]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> { open_path(path, false) }
#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> { open_path(path, true) }
fn open_path(path: String, terminal: bool) -> Result<(), String> {
    let path = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
    let mut command = Command::new("/usr/bin/open");
    if terminal { if !path.is_dir() { return Err("Terminal cần đường dẫn thư mục".into()); } command.args(["-a", "Terminal"]); } else { command.arg("-R"); }
    command.arg(path).status().map_err(|e| e.to_string()).and_then(|s| if s.success() { Ok(()) } else { Err("Không thể mở đường dẫn".into()) })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn quick_changed_target_is_skipped_without_blocking_unchanged_sibling() {
        let root=std::env::temp_dir().join(format!("vxclean_preflight_{}",operation_uuid()));std::fs::create_dir(&root).unwrap();
        let root=std::fs::canonicalize(root).unwrap();let changed=root.join("changed");let kept=root.join("kept");
        std::fs::write(&changed,b"old").unwrap();std::fs::write(&kept,b"keep").unwrap();
        let state=EngineState::default();let rows=vec![changed.clone(),kept.clone()].into_iter().map(|path|json!({"path":path,"is_cleanable":true,"deletion_method":"remove_item","rule_id":"cache"})).collect::<Vec<_>>();
        remember(&state,"live".into(),json!({"operation_scope":"quick_cleanup","categories":[{"category":"user_caches","items":rows}]}));
        std::fs::write(&changed,b"new content").unwrap();
        let mut payload=json!({"targets":[{"path":changed,"deletion_method":"remove_item"},{"path":kept,"deletion_method":"remove_item"}]});
        let skipped=bind_quick_targets(&state,"live",&mut payload).unwrap();assert_eq!(skipped.len(),1);assert_eq!(skipped[0]["path"],json!(changed));
        assert_eq!(payload["targets"].as_array().unwrap().len(),1);assert_eq!(payload["targets"][0]["path"],json!(kept));assert_eq!(std::fs::read(changed).unwrap(),b"new content");
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test] fn quick_chrome_content_changes_keep_original_root_grant() {
        let root=std::env::temp_dir().join(format!("vxclean_chrome_{}",operation_uuid()));std::fs::create_dir(&root).unwrap();
        let root=std::fs::canonicalize(root).unwrap();let data=root.join("data");std::fs::write(&data,b"old").unwrap();
        let state=EngineState::default();remember(&state,"chrome".into(),json!({"operation_scope":"quick_cleanup","categories":[{"category":"user_caches","items":[{"path":root,"rule_id":"chrome_quick_cache","execution_mode":"live_cache_root","is_cleanable":true,"deletion_method":"remove_item"}]}]}));
        std::fs::write(&data,b"new content").unwrap();std::fs::write(root.join("new"),b"new").unwrap();
        let mut payload=json!({"targets":[{"path":root,"deletion_method":"remove_item"}]});
        assert!(bind_quick_targets(&state,"chrome",&mut payload).unwrap().is_empty());
        assert_eq!(payload["content_snapshots"][root.to_str().unwrap()].as_array().unwrap().len(),1); // Root-only authority, no subtree payload.
        let moved=root.with_extension("old");std::fs::rename(&root,&moved).unwrap();std::fs::create_dir(&root).unwrap();
        let mut changed=json!({"targets":[{"path":root,"deletion_method":"remove_item"}]});assert_eq!(bind_quick_targets(&state,"chrome",&mut changed).unwrap().len(),1);
        std::fs::remove_dir_all(root).unwrap();std::fs::remove_dir_all(moved).unwrap();
    }
    #[test] fn quick_codex_content_changes_keep_identity_grant() {
        for (category,rule) in [("user_caches","ai_frontend_quick_cache")] {
            let root=std::env::temp_dir().join(format!("vxclean_live_{}",operation_uuid()));std::fs::create_dir(&root).unwrap();let root=std::fs::canonicalize(root).unwrap();
            let path=root.join("selected");std::fs::write(&path,b"old").unwrap();let state=EngineState::default();
            remember(&state,"live".into(),json!({"operation_scope":"quick_cleanup","categories":[{"category":category,"items":[{"path":path,"rule_id":rule,"execution_mode":"live_cache_root","is_cleanable":true,"deletion_method":"remove_item"}]}]}));
            std::fs::write(&path,b"new content").unwrap();let mut payload=json!({"targets":[{"path":path,"deletion_method":"remove_item"}]});assert!(bind_quick_targets(&state,"live",&mut payload).unwrap().is_empty());
            let moved=root.join("old_inode");std::fs::rename(&path,&moved).unwrap();std::fs::write(&path,b"replacement").unwrap();let mut changed=json!({"targets":[{"path":path,"deletion_method":"remove_item"}]});assert_eq!(bind_quick_targets(&state,"live",&mut changed).unwrap().len(),1);
            std::fs::remove_dir_all(root).unwrap();
        }
    }
    #[test] fn macos_tmp_alias_manifest_binds_but_custom_symlink_is_rejected() {
        #[cfg(target_os="macos")] {
            let path=format!("/tmp/vxclean_alias_fixture_{}",operation_uuid());
            std::fs::create_dir(&path).unwrap();
            std::fs::write(format!("{path}/keep"),vec![42u8;4096]).unwrap();
            let state=EngineState::default();
            let scan=json!({"operation_scope":"quick_cleanup","categories":[{"category":"system_junk","items":[{"path":path,"deletion_method":"remove_item","rule_id":"mclean_system_junk","is_cleanable":true}]}]});
            remember(&state,"alias".into(),scan);
            let mut payload=json!({});bind_identities(&state,"alias",&mut payload,std::slice::from_ref(&path)).unwrap();
            assert_eq!(payload["content_snapshots"][&path][0]["path"],path);
            let link=format!("{path}_link");std::os::unix::fs::symlink(&path,&link).unwrap();
            assert!(manifest_policy(&format!("{link}/keep"),true).is_err());
            std::fs::remove_file(link).unwrap();
            if let Ok(binary)=std::env::var("VXCLEAN_ALIAS_NATIVE_BINARY") {
                payload["operation_scope"]=json!("quick_cleanup");payload["confirm_direct_delete"]=json!(true);
                payload["targets"]=json!([{"path":path,"deletion_method":"remove_item"}]);request_version(&mut payload);
                payload["operation_id"]=json!(operation_uuid());
                if std::env::var_os("VXCLEAN_LARGE_PAYLOAD_PROBE").is_some() {
                    payload["transport_probe"]=json!("x".repeat(5*1024*1024));
                    validate_cleanup_request(&payload).unwrap();
                }
                let mut child=Command::new(binary).args(["clean","--stdin"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
                child.stdin.take().unwrap().write_all(payload.to_string().as_bytes()).unwrap();
                let out=child.wait_with_output().unwrap();assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
                let result:Value=serde_json::from_slice(&out.stdout).unwrap();assert_eq!(result["success_count"],1,"{result}");assert!(!std::path::Path::new(&path).exists());
            } else {std::fs::remove_dir_all(path).unwrap();}
        }
    }
    #[test] fn production_scan_manifest_probe() {
        let Ok(path)=std::env::var("VXCLEAN_SCAN_PROBE") else {return};
        let scan:Value=serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        let mut failures=Vec::new();
        for cat in scan["categories"].as_array().unwrap() {
            for item in cat["items"].as_array().unwrap() {
                if item["is_cleanable"]!=true {continue;}
                let path=item["path"].as_str().unwrap();
                if let Err(error)=manifest_policy(path,item["rule_id"]=="mclean_system_junk" || item["deletion_method"]=="pnpm_prune") {failures.push(json!({"path":path,"error":error}));}
            }
        }
        println!("manifest_probe_failures={}",json!(failures));
        assert!(failures.is_empty(),"Scanner granted targets without usable host proof");
    }
    #[test] fn quick_payload_native_roundtrip() {
        let Ok(binary)=std::env::var("VXCLEAN_FIXTURE_BINARY") else {return};
        let home=std::env::var("VXCLEAN_TEST_HOME").unwrap();
        let path=std::path::PathBuf::from(&home).join("Library/Caches/org.fixture.host_quick");
        std::fs::create_dir_all(&path).unwrap();std::fs::write(path.join("payload"),vec![42u8;4096]).unwrap();
        let system_path=std::path::PathBuf::from(&home).join("system/tmp/host_system_profile");
        std::fs::create_dir_all(&system_path).unwrap();
        let alias=std::path::PathBuf::from(&home).join("host_alias");std::fs::write(&alias,vec![7u8;4096]).unwrap();
        std::fs::hard_link(&alias,system_path.join("Bookmarks")).unwrap();
        let out=Command::new(&binary).args(["scan","--scope","quick_cleanup"]).output().unwrap();assert!(out.status.success());
        let scan:Value=serde_json::from_slice(&out.stdout).unwrap();
        let state=EngineState::default();remember(&state,"quick_cleanup".into(),scan);
        let name=path.to_string_lossy().to_string();
        let mut payload=json!({"protocol_version":"2.0","platform":"macos","policy_version":"1.0.0","targets":[{"path":name,"deletion_method":"remove_item"},{"path":system_path.to_string_lossy(),"deletion_method":"remove_item"}],"confirm_direct_delete":true});
        let mut allowed=HashMap::new();gather(&recalled(&state,"quick_cleanup").unwrap(),&mut allowed);validate_targets(&payload["targets"],&allowed).unwrap();
        let scan=recalled(&state,"quick_cleanup").unwrap(); bind_cleanup_scope(&scan,&mut payload).unwrap(); bind_identities(&state,"quick_cleanup",&mut payload,&[name,system_path.to_string_lossy().to_string()]).unwrap();
        validate_cleanup_request(&payload).unwrap();
        payload["operation_id"]=json!(operation_uuid());
        let mut child=Command::new(&binary).args(["clean","--stdin"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
        child.stdin.take().unwrap().write_all(payload.to_string().as_bytes()).unwrap();let out=child.wait_with_output().unwrap();assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
        let result:Value=serde_json::from_slice(&out.stdout).unwrap();assert_eq!(result["success_count"],2);assert!(!path.join("payload").exists());assert!(!system_path.exists());assert_eq!(std::fs::read(alias).unwrap(),vec![7u8;4096]);
    }
    #[cfg(unix)]
    #[test] fn uninstall_unit_root_preserves_external_links_and_rejects_replacement() {
      use std::os::unix::fs::symlink;
      let base=std::env::temp_dir().join(format!("vxclean_uninstall_{}",operation_uuid()));std::fs::create_dir_all(&base).unwrap();let base=base.canonicalize().unwrap();
      let app=base.join("Fixture.app");std::fs::create_dir(&app).unwrap();let outside=base.join("external");std::fs::write(&outside,b"keep").unwrap();symlink(&outside,app.join("framework")).unwrap();
      assert_eq!(manifest_policy(app.to_str().unwrap(),false).unwrap().as_array().unwrap().len(),2);
      let state=EngineState::default();remember(&state,"apps".into(),json!({"apps":[{"associated_files":[{"path":app,"deletion_method":"trash","file_type":"bundle"}]}]}));
      let mut proof=json!({});bind_identities(&state,"apps",&mut proof,&[app.to_string_lossy().into()]).unwrap();assert_eq!(proof["content_snapshots"][app.to_str().unwrap()].as_array().unwrap().len(),1);
      assert_eq!(std::fs::read(&outside).unwrap(),b"keep");
      std::fs::rename(&app,base.join("old.app")).unwrap();std::fs::create_dir(&app).unwrap();assert!(bind_identities(&state,"apps",&mut json!({}),&[app.to_string_lossy().into()]).is_err());std::fs::remove_dir_all(base).unwrap();
    }
    #[cfg(target_os="macos")]
    #[test] fn installed_app_uninstall_preflight_probe() {
      let Ok(binary)=std::env::var("VXCLEAN_APP_PROBE_BINARY") else{return};let target=std::env::var("VXCLEAN_APP_PROBE_PATH").unwrap();
      let out=Command::new(binary).args(["apps","--include-residuals"]).output().unwrap();assert!(out.status.success());let scan:Value=serde_json::from_slice(&out.stdout).unwrap();
      let app=scan["apps"].as_array().unwrap().iter().find(|a|a["bundle_path"]==target).unwrap();let paths:Vec<String>=app["associated_files"].as_array().unwrap().iter().map(|f|f["path"].as_str().unwrap().into()).collect();
      let state=EngineState::default();remember(&state,"apps".into(),scan.clone());let mut payload=json!({});bind_identities(&state,"apps",&mut payload,&paths).unwrap();println!("Read-only uninstall preflight passed for {} roots",paths.len());
    }
    #[cfg(target_os="macos")]
    #[test] fn uninstall_payload_native_roundtrip() {
      use std::os::unix::fs::symlink;
      let Ok(binary)=std::env::var("VXCLEAN_FIXTURE_BINARY") else{return};let home=std::env::var("VXCLEAN_TEST_HOME").unwrap();
      let app=std::path::PathBuf::from(&home).join(format!("Applications/vxclean_host_uninstall_{}.app",operation_uuid()));std::fs::create_dir_all(app.join("Contents")).unwrap();
      std::fs::write(app.join("Contents/Info.plist"),b"<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>CFBundleIdentifier</key><string>org.fixture.host.uninstall</string><key>CFBundleShortVersionString</key><string>1</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>").unwrap();
      let marker=std::path::PathBuf::from(&home).join(format!("external_{}",operation_uuid()));std::fs::write(&marker,b"preserve").unwrap();symlink(&marker,app.join("Contents/external")).unwrap();
      let out=Command::new(&binary).args(["apps","--include-residuals"]).output().unwrap();assert!(out.status.success());let scan:Value=serde_json::from_slice(&out.stdout).unwrap();let selected=scan["apps"].as_array().unwrap().iter().find(|a|a["bundle_path"]==app.to_str().unwrap()).unwrap().clone();
      let state=EngineState::default();remember(&state,"apps".into(),scan);let paths=vec![app.to_string_lossy().into_owned()];let mut payload=json!({"app_id":selected["id"],"authorized_app":selected,"selected_paths":paths,"operation_scope":"uninstall","allow_admin_fallback":false,"operation_id":operation_uuid()});request_version(&mut payload);bind_identities(&state,"apps",&mut payload,&paths).unwrap();
      let mut child=Command::new(binary).args(["uninstall","--stdin"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();serde_json::to_writer(child.stdin.take().unwrap(),&payload).unwrap();let out=child.wait_with_output().unwrap();assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));let result:Value=serde_json::from_slice(&out.stdout).unwrap();
      assert_eq!(std::fs::read(&marker).unwrap(),b"preserve");
      if result["success_count"]==1 {
        assert!(!app.exists());let recycled=std::path::PathBuf::from(result["details"][0]["test_trash_path"].as_str().unwrap());assert_eq!(recycled.file_name(),app.file_name());assert!(!std::fs::symlink_metadata(&recycled).unwrap().file_type().is_symlink());std::fs::remove_dir_all(recycled).unwrap();
      } else {assert_eq!(result["details"][0]["status"],"permission_denied");std::fs::remove_dir_all(app).unwrap();}
      assert_eq!(std::fs::read(&marker).unwrap(),b"preserve");std::fs::remove_file(marker).unwrap();
    }
    #[test] fn orphan_payload_native_roundtrip() {
        let Ok(binary)=std::env::var("VXCLEAN_FIXTURE_BINARY") else {return};
        let home=std::env::var("VXCLEAN_TEST_HOME").unwrap();
        let path=std::path::PathBuf::from(&home).join("Library/Caches/org.fixture.safe");
        let output=Command::new(&binary).arg("orphans").output().unwrap(); assert!(output.status.success());
        let scan:Value=serde_json::from_slice(&output.stdout).unwrap();
        let state=EngineState::default();remember(&state,"orphans".into(),scan);
        let mut payload=orphan_payload(&state,&[path.to_string_lossy().to_string()],true).unwrap();payload["operation_id"]=json!(operation_uuid());
        assert!(payload["identities"].is_object());assert!(payload["content_snapshots"].is_object());
        let mut child=Command::new(&binary).args(["clean_orphans","--stdin"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
        child.stdin.take().unwrap().write_all(payload.to_string().as_bytes()).unwrap();let result=child.wait_with_output().unwrap();assert!(result.status.success(),"{}",String::from_utf8_lossy(&result.stderr));
        let result:Value=serde_json::from_slice(&result.stdout).unwrap();assert_eq!(result["success_count"],1);assert!(!path.join("host_native_fixture").exists());
    }
    #[test] fn manifest_rejects_new_children_same_inode_and_hardlinks() {
        let dir=std::env::temp_dir().join(format!("vxclean_manifest_{}",operation_uuid()));
        std::fs::create_dir(&dir).unwrap(); let p=dir.join("cache"); std::fs::create_dir(&p).unwrap();
        std::fs::write(p.join("safe"),b"safe").unwrap();
        let text=std::fs::canonicalize(&p).unwrap().to_string_lossy().to_string();
        let state=EngineState::default(); remember(&state,"manifest".into(),json!({"path":text,"deletion_method":"remove_item"}));
        let before=identity(&text).unwrap(); std::fs::write(p.join("project"),b"must stay").unwrap();
        assert_eq!(before,identity(&text).unwrap());
        assert!(bind_identities(&state,"manifest",&mut json!({}),std::slice::from_ref(&text)).is_err());
        std::fs::hard_link(p.join("safe"),dir.join("protected_alias")).unwrap(); assert!(manifest(&text).is_err());
        assert_eq!(std::fs::read(p.join("project")).unwrap(),b"must stay");
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[test] fn invalid_protocol_never_grants_a_scan() {
        for value in [json!({}),json!({"protocol_version":"1.0","platform":"macos","policy_version":"1.0.0","operation_scope":"quick_cleanup","categories":[],"scan_id":"x"}),json!({"protocol_version":"2.0","platform":"windows","policy_version":"1.0.0","operation_scope":"quick_cleanup","categories":[],"scan_id":"x"})] { assert!(validate_scan(&value).is_err()); }
    }
    #[test] fn cleanup_scope_cannot_be_changed_or_borrow_app_authority() {
        let scan = json!({"operation_scope":"quick_cleanup"});
        let mut payload = json!({});
        assert!(bind_cleanup_scope(&scan, &mut payload).is_ok());
        assert_eq!(payload["operation_scope"], "quick_cleanup");
        for mut invalid in [json!({"operation_scope":"uninstall"}), json!({"operation_scope":"detailed_cleanup"}), json!({"authorized_app":{}})] {
            assert!(bind_cleanup_scope(&scan, &mut invalid).is_err());
        }
        assert!(bind_cleanup_scope(&json!({"operation_scope":"uninstall"}), &mut json!({})).is_err());
        assert!(bind_cleanup_scope(&json!({}), &mut json!({})).is_err());
    }
    #[test] fn informational_scan_items_are_not_deletion_grants() {
        let mut allowed = HashMap::new();
        gather(&json!({"items":[
            {"path":"/usr/local/bin/docker","deletion_method":"remove_item","is_cleanable":false},
            {"path":"/tmp/cache","deletion_method":"remove_item","is_cleanable":true}
        ]}), &mut allowed);
        assert!(!allowed.contains_key("/usr/local/bin/docker"));
        assert!(allowed.contains_key("/tmp/cache"));
    }
    #[test] fn lens_tickets_do_not_reuse_a_previous_scan() {
        assert_ne!(unique_ticket("lens"), unique_ticket("lens"));
        assert!(!lens_contains(&json!({"path":"/Volumes/data/file","is_access_denied":false,"can_trash":false}), "/Volumes/data/file"));
        assert!(lens_contains(&json!({"path":"/Users/test/Downloads/file","is_access_denied":false,"can_trash":true}), "/Users/test/Downloads/file"));
    }
    #[test] fn deletion_requires_exact_grant() {
        let allowed = HashMap::from([("/tmp/known".into(), "trash".into())]);
        assert!(validate_targets(&json!([{"path":"/tmp/known","deletion_method":"trash"}]), &allowed).is_ok());
        for targets in [json!([]), json!([{"path":"/tmp/other","deletion_method":"trash"}]), json!([{"path":"/tmp/known","deletion_method":"remove_item"}]), json!([{"path":"/tmp/known","deletion_method":"trash"},{"path":"/tmp/known","deletion_method":"trash"}])] { assert!(validate_targets(&targets, &allowed).is_err()); }
    }
    #[test]
    fn replaced_file_is_rejected() {
        let dir = std::env::temp_dir().join(format!("vxclean_identity_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir(&dir).unwrap();
        let path = dir.join("fixture"); std::fs::write(&path, b"old").unwrap();
        let path_text = std::fs::canonicalize(&path).unwrap().to_string_lossy().to_string();
        let state = EngineState::default();
        remember(&state, "scan".into(), json!({"path":path_text,"deletion_method":"remove_item"}));
        let mut payload = json!({});
        assert!(bind_identities(&state,"scan", &mut payload, std::slice::from_ref(&path_text)).is_ok());
        std::fs::rename(&path, dir.join("old_fixture")).unwrap();
        std::fs::write(&path, b"replacement").unwrap();
        assert!(bind_identities(&state,"scan", &mut payload, std::slice::from_ref(&path_text)).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn lens_grants_exclude_denied_and_unknown_nodes() {
        let node = json!({"path":"/root", "is_access_denied":false, "children":[{"path":"/root/file","is_access_denied":false,"can_trash":true},{"path":"/root/denied","is_access_denied":true,"can_trash":true},{"path":"/root/unknown","is_access_denied":false}]});
        assert!(lens_contains(&node,"/root/file"));
        assert!(!lens_contains(&node,"/root/denied"));
        assert!(!lens_contains(&node,"/other"));
        assert!(!lens_contains(&node,"/root/unknown"));
    }
    #[test] fn expired_grants_fail_closed() { let state = EngineState::default(); state.grants.lock().unwrap().insert("old".into(), (Instant::now()-Duration::from_secs(901), json!({}))); assert!(recalled(&state,"old").is_err()); }
}

#[cfg(test)]
mod cleanup_request_tests {
    use super::*;
    #[test]
    fn large_combined_proofs_fit_single_request_without_copying() {
        let proof=json!({"proof":"x".repeat(2300000)});
        let p=json!({"targets":[{"path":"/a"},{"path":"/b"}],"identities":{"/a":[1,2],"/b":[3,4]},"content_snapshots":{"/a":proof,"/b":proof},"operation_scope":"detailed_cleanup","confirm_direct_delete":true});
        assert!(serialized_bytes(&p).unwrap()>4*1024*1024);
        validate_cleanup_request(&p).unwrap(); // Both full proofs fit one native request.
    }
    #[test]
    fn small_request_keeps_all_proofs() {
        let p=json!({"targets":[{"path":"/a"},{"path":"/b"}],"identities":{"/a":[1,2],"/b":[3,4]},"content_snapshots":{"/a":[],"/b":[]},"operation_scope":"detailed_cleanup"});
        validate_cleanup_request(&p).unwrap();
        assert!(p["content_snapshots"].is_object());
    }
    #[test]
    fn oversize_request_is_rejected_before_execution() {
        let p=json!({"targets":[{"path":"/a"},{"path":"/b"}],"identities":{"/a":[1,2],"/b":[3,4]},"content_snapshots":{"/a":[],"/b":"x".repeat(CLEANUP_REQUEST_LIMIT)}});
        assert!(validate_cleanup_request(&p).is_err());
    }
}

#[cfg(test)]mod lens_navigation_tests {
    use super::*;
    #[test]fn query_reads_snapshot_without_filesystem_or_mutation_grants(){
        let root=std::env::temp_dir().join(operation_uuid());std::fs::create_dir_all(root.join("child/deep")).unwrap();std::fs::write(root.join("child/deep/file"),b"original").unwrap();
        let mut tree=crate::lens_scanner::scan(root.clone(),&AtomicBool::new(false),|_|{}).unwrap();tree.index().unwrap();let path=tree.root_path.join("child/deep").to_string_lossy().into_owned();
        let state=EngineState::default();state.lens_trees.lock().unwrap().insert("ticket".into(),(Instant::now(),Arc::new(tree)));
        // Removing the fixture proves navigation performs no re-read, not merely a fast scan.
        std::fs::remove_dir_all(root).unwrap();
        assert_eq!(cached_lens_folder(&state,"ticket",&path).unwrap()["root_node"]["children"][0]["name"],"file");
        assert!(cached_lens_folder(&state,"ticket","/outside").is_none());assert!(cached_lens_folder(&state,"missing",&path).is_none());
        assert!(state.grants.lock().unwrap().is_empty());assert!(state.manifests.lock().unwrap().is_empty());assert!(state.identities.lock().unwrap().is_empty());
        state.lens_trees.lock().unwrap().get_mut("ticket").unwrap().0=Instant::now()-Duration::from_secs(301);
        assert!(cached_lens_folder(&state,"ticket",&path).is_none());assert!(state.lens_trees.lock().unwrap().is_empty());
    }
    #[test]fn mutation_invalidates_navigation_snapshot(){
        let root=std::env::temp_dir().join(operation_uuid());std::fs::create_dir_all(&root).unwrap();let mut tree=crate::lens_scanner::scan(root.clone(),&AtomicBool::new(false),|_|{}).unwrap();tree.index().unwrap();
        let state=EngineState::default();state.lens_trees.lock().unwrap().insert("ticket".into(),(Instant::now(),Arc::new(tree)));
        {let _lease=MutationLease::new(&state).unwrap();assert!(state.lens_trees.lock().unwrap().is_empty());}
        std::fs::remove_dir_all(root).unwrap();
    }
}
