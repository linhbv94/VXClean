use crate::models::{Capabilities, FeatureCapabilities, SystemSnapshot};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use std::sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}};

#[derive(Default)]
pub struct MetricsService {
    single:tokio::sync::Mutex<()>,
    cache:Mutex<Option<(std::time::Instant,SystemSnapshot)>>,
    stopping:Arc<AtomicBool>,
    child:Arc<Mutex<Option<u32>>>,
}
impl MetricsService {
    pub(crate) fn shutdown(&self){self.stopping.store(true,Ordering::SeqCst);}
    pub(crate) fn resume(&self){self.stopping.store(false,Ordering::SeqCst);}
    pub(crate) fn is_busy(&self)->bool{self.child.lock().unwrap().is_some()}
}
/// Truy vấn năng lực hệ thống hiện tại của ứng dụng.
/// Quyết định giao diện kích hoạt chức năng nào theo nền tảng thực tế.
#[tauri::command]
pub fn get_capabilities(app: AppHandle) -> Capabilities {
    let is_macos = cfg!(target_os = "macos") && resolve_engine_path(&app).is_ok();
    Capabilities {
        platform: std::env::consts::OS.to_string(),
        has_native_engine: is_macos,
        can_monitor_system: is_macos,
        features: FeatureCapabilities {
            system_monitor: is_macos,
            smart_scan: is_macos,
            cleanup: is_macos,
            uninstaller: is_macos,
            space_lens: is_macos,
            menu_bar_monitor: crate::menubar::is_ready(&app),
            orphans: is_macos,
        },
        engine_status: if is_macos {
            "Swift native engine sẵn sàng (macOS)".to_string()
        } else if cfg!(target_os="windows") {
            "Windows UI-only: dummy engine, chưa có chức năng hệ thống".to_string()
        } else {
            "Chưa hỗ trợ nền tảng này".to_string()
        },
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn resolve_engine_path(app: &AppHandle) -> Result<PathBuf, String> {
    // 1. Kiểm tra trong tài nguyên đóng gói của ứng dụng (Tauri Resource Directory)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join("vxclean_engine");
        if path.is_file() {
            return Ok(path);
        }
    }

    // 2. Chế độ phát triển nội bộ cục bộ (chỉ kích hoạt khi debug_assertions bật)
    #[cfg(debug_assertions)]
    {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let dev_path = manifest_dir.join("../native/vxclean_engine");
        if dev_path.is_file() {
            if let Ok(canonical) = dev_path.canonicalize() {
                return Ok(canonical);
            }
            return Ok(dev_path);
        }
    }

    Err("Không tìm thấy tệp nhị phân vxclean_engine trong app resources.".to_string())
}

/// Lấy snapshot viễn trắc hệ thống thật từ Swift native engine.
/// Chặn tuyệt đối shell injection: chỉ chấp nhận gọi tệp thực thi định danh với argv cố định ["metrics"].
#[tauri::command]
pub async fn get_system_snapshot(app: AppHandle, state:State<'_,MetricsService>) -> Result<SystemSnapshot, String> {
    let _single=state.single.lock().await;
    if state.stopping.load(Ordering::SeqCst){return Err("VXClean đang thoát".into());}
    if let Some((at,snapshot))=state.cache.lock().unwrap().as_ref().filter(|(at,_)|at.elapsed()<Duration::from_secs(5)){let _=at;return Ok(snapshot.clone());}
    let result=sample_system_snapshot(app,state.stopping.clone(),state.child.clone()).await;
    if let Ok(snapshot)=&result{*state.cache.lock().unwrap()=Some((std::time::Instant::now(),snapshot.clone()));}
    result
}
async fn sample_system_snapshot(app:AppHandle, stopping:Arc<AtomicBool>, tracked:Arc<Mutex<Option<u32>>>) -> Result<SystemSnapshot,String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("Chức năng giám sát hệ thống chưa được hỗ trợ trên nền tảng này. Bản Windows hiện chỉ có giao diện.".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        let engine_path = resolve_engine_path(&app)?;

        // Chạy tiến trình con trong worker thread riêng để không block luồng chính
        let task = tokio::task::spawn_blocking(move || {
            struct Lease(Arc<Mutex<Option<u32>>>);impl Drop for Lease{fn drop(&mut self){*self.0.lock().unwrap()=None;}}
            let _lease=Lease(tracked.clone());
            let mut child = Command::new(&engine_path)
                .arg("metrics")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Không thể khởi tạo tiến trình Swift engine: {e}"))?;

            *tracked.lock().unwrap()=Some(child.id());
            let start_time = std::time::Instant::now();
            let timeout = Duration::from_secs(6);

            loop {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let output = child
                            .wait_with_output()
                            .map_err(|e| format!("Lỗi khi thu thập kết quả engine: {e}"))?;

                        if !status.success() {
                            let stderr_text = String::from_utf8_lossy(&output.stderr);
                            return Err(format!("Swift engine kết thúc với lỗi (mã {status}): {stderr_text}"));
                        }

                        let stdout_text = String::from_utf8_lossy(&output.stdout);
                        let snapshot: SystemSnapshot = serde_json::from_str(&stdout_text)
                            .map_err(|e| format!("Lỗi phân giải JSON từ engine: {e} | Dữ liệu nhận: {stdout_text}"))?;

                        // Xác thực protocol_version và platform trước khi trả về
                        if snapshot.protocol_version != "1.0" {
                            return Err(format!(
                                "Phiên bản giao thức không khớp: kỳ vọng '1.0', nhận '{}'",
                                snapshot.protocol_version
                            ));
                        }
                        if snapshot.platform != "macos" {
                            return Err(format!(
                                "Nền tảng viễn trắc không khớp: kỳ vọng 'macos', nhận '{}'",
                                snapshot.platform
                            ));
                        }

                        return Ok(snapshot);
                    }
                    Ok(None) => {
                        if stopping.load(Ordering::SeqCst) || start_time.elapsed() > timeout {
                            let _ = child.kill();
                            let _ = child.wait(); // reap zombie process
                            return Err("Quá thời gian chờ phản hồi từ Swift engine (timeout 6 giây). Đã hủy tiến trình.".to_string());
                        }
                        std::thread::sleep(Duration::from_millis(50));
                    }
                    Err(e) => {
                        let _ = child.kill();
                        let _ = child.wait(); // reap zombie process
                        return Err(format!("Lỗi thăm dò trạng thái tiến trình: {e}"));
                    }
                }
            }
        });

        match task.await {
            Ok(result) => result,
            Err(e) => Err(format!("Lỗi luồng bất đồng bộ: {e}")),
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn resolve_engine_path(_: &AppHandle) -> Result<PathBuf, String> { Err("Native engine chỉ hỗ trợ macOS".into()) }
