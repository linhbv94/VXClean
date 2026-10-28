use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::Write,
    path::Path,
    time::{Duration, SystemTime},
};
const MAX_ENTRIES: usize = 5000;
const MAX_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
const MAX_EVENT_BYTES:u64 = 128 * 1024 * 1024;
const KEEP_FOR: Duration = Duration::from_secs(180 * 24 * 60 * 60);
const FILES: [(&str, &str); 4] = [
    ("host.json", "host"),
    ("result.json", "native"),
    ("lifecycle.json", "lifecycle"),
    ("acknowledgement.json", "acknowledgement"),
];
fn uuid(name: &str) -> bool {
    name.len() == 36
        && name.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}
pub(crate) fn pending_apps(row: &Value) -> bool {
    row["lifecycle"]["status"] == "reopen_pending"
        || row["lifecycle"]["status"] != "reopened"
            && row["lifecycle"]["apps"].as_array().is_some_and(|apps| {
                apps.iter()
                    .any(|a| a["quit_requested"] == true && a["reopened"] != true)
            })
}
pub(crate) fn update_block_reason(history: &Value) -> Option<String> {
    let rows = history.as_array()?;
    if rows.iter().any(|r| r["journal_unverified"] == true) {
        return Some("Có journal chưa xác minh được; xem Lịch sử thao tác trong Cài đặt".into());
    }
    if rows.iter().any(pending_apps) {
        return Some("Có ứng dụng chưa được mở lại; xem Lịch sử thao tác trong Cài đặt".into());
    }
    None
}
fn terminal(row: &Value) -> bool {
    row["host"]["status"] == "returned"
        && (row["host"]["result"]["native_execution"] == "not_started"
            && !row["native"].is_object()
            || row["lifecycle"]["status"] == "reopened" && !row["native"].is_object()
            || ["completed", "partial", "cancelled"]
                .contains(&row["native"]["status"].as_str().unwrap_or("")))
}
fn recovery_required(row: &Value) -> bool {
    row["recovery_required"] == true
        || row["journal_unverified"] == true
        || pending_apps(row)
        || row["native"]["targets"].as_array().is_some_and(|ts| {
            ts.iter().any(|t| {
                t["status"] == "outcome_unknown" || t["prior_removal_may_be_partial"] == true
            })
        })
        || !terminal(row)
            && ["planned", "interrupted", "returned"]
                .contains(&row["host"]["status"].as_str().unwrap_or(""))
        || ["mutating", "revalidating"].contains(&row["native"]["status"].as_str().unwrap_or(""))
}
fn complete(row: &Value) -> bool {
    terminal(row) && !recovery_required(row)
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn summary(row: &Value) -> Value {
    let mut out = row.clone();
    // Full exact evidence remains in the archive. The UI only needs failed or
    // uncertain paths, not thousands of successful per-file journal records.
    if let Some(ts) = out["native"]["targets"].as_array_mut() {
        ts.retain(|t| t["status"] != "success");
        let count = ts.len();
        ts.truncate(200);
        out["retained_targets_count"] = json!(count);
    }
    for section in ["host", "native"] {
        if let Some(ds) = out[section]["result"]["details"].as_array_mut() {
            ds.retain(|d| d["status"] != "success");
            ds.truncate(200);
        }
    }
    out["recovery_required"] = json!(recovery_required(row));
    out
}
fn safe_file(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|m| m.is_file())
        && std::fs::canonicalize(path).ok().as_deref() == Some(path)
}
fn atomic_new(dir: &Path, name: &str, bytes: &[u8]) -> Result<(), String> {
    let tmp = dir.join(format!("{}.next", name));
    let mut f = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        f.set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    f.write_all(bytes)
        .and_then(|_| f.sync_all())
        .map_err(|e| e.to_string())?;
    std::fs::rename(tmp, dir.join(name)).map_err(|e| e.to_string())?;
    std::fs::File::open(dir)
        .and_then(|f| f.sync_all())
        .map_err(|e| e.to_string())
}
fn compact(dir: &Path, row: &Value) -> Result<Value, String> {
    let mut originals = serde_json::Map::new();
    let mut exact_files = serde_json::Map::new();
    for name in [
        "host.json",
        "result.json",
        "lifecycle.json",
        "events.jsonl",
        "cancel",
    ] {
        let f = dir.join(name);
        if f.exists() {
            if !safe_file(&f) {
                return Err("path_changed: journal archive".into());
            }
            let bytes = std::fs::read(f).map_err(|e| e.to_string())?;
            originals.insert(name.into(), json!(hash(&bytes)));
            // Preserve exact UTF-8 event streams without expanding each byte to a number.
            let exact = match String::from_utf8(bytes) {
                Ok(text) => json!({"utf8":text}),
                Err(e) => json!({"bytes":e.into_bytes()}),
            };
            exact_files.insert(name.into(), exact);
        }
    }
    let mut compressed = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    serde_json::to_writer(&mut compressed, &json!({"row":row,"files":exact_files}))
        .map_err(|e| e.to_string())?;
    let bytes = compressed.finish().map_err(|e| e.to_string())?;
    let mut out = summary(row);
    out["archive_sha256"] = json!(hash(&bytes));
    out["original_files"] = Value::Object(originals);
    out["summary_sha256"] = json!(hash(&serde_json::to_vec(&out).unwrap()));
    // Commit evidence first, summary second. On restart, any leftover originals
    // are only removed if their digest matches this committed snapshot.
    atomic_new(dir, "evidence.json.gz", &bytes)?;
    atomic_new(
        dir,
        "history_summary.json",
        &serde_json::to_vec(&out).unwrap(),
    )?;
    cleanup_originals(dir, &out)?;
    Ok(out)
}
fn cleanup_originals(dir: &Path, row: &Value) -> Result<(), String> {
    if let Some(files) = row["original_files"].as_object() {
        for (name, digest) in files {
            if ![
                "host.json",
                "result.json",
                "lifecycle.json",
                "events.jsonl",
                "cancel",
            ]
            .contains(&name.as_str())
            {
                return Err("invalid archive file".into());
            }
            let p = dir.join(name);
            if p.exists() {
                if !safe_file(&p)
                    || hash(&std::fs::read(&p).map_err(|e| e.to_string())?)
                        != digest.as_str().unwrap_or("")
                {
                    return Err("journal_changed: archive originals".into());
                }
                std::fs::remove_file(p).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}
fn archived(dir: &Path) -> Result<Value, String> {
    let p = dir.join("history_summary.json");
    let evidence = dir.join("evidence.json.gz");
    if !safe_file(&p)
        || !safe_file(&evidence)
        || std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > 4 * 1024 * 1024
        || std::fs::metadata(&evidence)
            .map_err(|e| e.to_string())?
            .len()
            > 32 * 1024 * 1024
    {
        return Err("invalid archive".into());
    }
    let mut row: Value = serde_json::from_slice(&std::fs::read(p).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let digest = row["summary_sha256"].as_str().unwrap_or("").to_string();
    row.as_object_mut()
        .ok_or("invalid archive summary")?
        .remove("summary_sha256");
    if hash(&serde_json::to_vec(&row).unwrap()) != digest
        || hash(&std::fs::read(evidence).map_err(|e| e.to_string())?)
            != row["archive_sha256"].as_str().unwrap_or("")
    {
        return Err("journal_changed: archive checksum".into());
    }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !safe_file(&entry.path())
            || ![
                "history_summary.json",
                "evidence.json.gz",
                "acknowledgement.json",
            ]
            .contains(&name.as_str())
                && row["original_files"].get(&name).is_none()
        {
            return Err("unexpected archive file".into());
        }
    }
    row["summary_sha256"] = json!(digest);
    cleanup_originals(dir, &row)?;
    Ok(row)
}
pub(crate) fn acknowledge(root: &Path, id: &str) -> Result<(), String> {
    if !uuid(id) || std::fs::canonicalize(root).ok().as_deref() != Some(root) {
        return Err("path_changed: journal".into());
    }
    let dir = root.join(id);
    if std::fs::canonicalize(&dir).ok().as_ref() != Some(&dir) {
        return Err("path_changed: journal".into());
    }
    let p = dir.join("acknowledgement.json");
    if p.exists() && !safe_file(&p) {
        return Err("path_changed: acknowledgement".into());
    }
    let data = serde_json::to_vec(&json!({"acknowledged":true})).unwrap();
    atomic_new(&dir, "acknowledgement.json", &data)
}
fn apply_events(row: &mut Value, data: &[u8]) -> bool {
    if !data.is_empty() && !data.ends_with(b"\n") {
        return false;
    }
    let mut targets = std::collections::BTreeMap::new();
    if let Some(existing) = row["native"]["targets"].as_array() {
        for target in existing {
            if let Some(path) = target["path"].as_str() {
                targets.insert(path.to_string(), target.clone());
            }
        }
    }
    for line in data.split(|b| *b == b'\n').filter(|l| !l.is_empty()) {
        let Ok(event) = serde_json::from_slice::<Value>(line) else {
            return false;
        };
        let target = &event["target"];
        let Some(path) = target["path"].as_str().filter(|p| p.starts_with('/')) else {
            return false;
        };
        let status = target["status"].as_str().unwrap_or("");
        if !(event["phase"] == "intent" && status == "outcome_unknown"
            || event["phase"] == "outcome"
                && [
                    "success",
                    "skipped",
                    "permission_denied",
                    "file_in_use",
                    "outcome_unknown",
                    "partial",
                    "guard_rejected",
                    "admin_not_started",
                ]
                .contains(&status))
        {
            return false;
        }
        // Bound successful samples while retaining all unresolved/error paths.
        // The complete ordered record remains in events.jsonl and its archive.
        if status == "success" && !targets.contains_key(path) && targets.values().filter(|v|v["status"]=="success").count() >= 200 {
            let oldest=targets.iter().find(|(_,v)|v["status"]=="success").map(|(p,_)|p.clone());
            if let Some(key)=oldest {targets.remove(&key);}
        }
        if targets.len() >= 20200 && !targets.contains_key(path) {
            return false;
        }
        targets.insert(path.to_string(), target.clone());
        if status == "success" && targets.values().filter(|v|v["status"]=="success").count() > 200 {
            let oldest=targets.iter().find(|(_,v)|v["status"]=="success").map(|(p,_)|p.clone());
            if let Some(key)=oldest {targets.remove(&key);}
        }
    }
    if !row["native"].is_object() {
        return false;
    }
    row["native"]["targets"] = json!(targets.into_values().collect::<Vec<_>>());
    true
}
/// Only completed, recognized journals expire. Pending/unknown recovery is never silently discarded.
pub(crate) fn read(root: &Path, now: SystemTime) -> Result<Value, String> {
    if !root.exists() {
        return Ok(json!([]));
    }
    if std::fs::canonicalize(root).map_err(|e| e.to_string())? != root {
        return Err("path_changed: journal root".into());
    }
    let entries = std::fs::read_dir(root)
        .map_err(|e| e.to_string())?
        .take(MAX_ENTRIES + 1)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    if entries.len() > MAX_ENTRIES {
        return Err(
            "Lịch sử vượt giới hạn kiểm tra an toàn; cần rà journal trước khi cập nhật.".into(),
        );
    }
    let mut output_bytes = 0;
    let mut rows = Vec::new();
    for entry in entries {
        let dir = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if !uuid(&name)
            || !entry.file_type().map_err(|e| e.to_string())?.is_dir()
            || std::fs::canonicalize(&dir).ok().as_ref() != Some(&dir)
        {
            continue;
        }
        if dir.join("history_summary.json").exists() {
            let latest = std::fs::metadata(dir.join("history_summary.json"))
                .and_then(|m| m.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            let mut row=archived(&dir).unwrap_or_else(|e|json!({"operation_id":name,"journal_unverified":true,"recovery_required":true,"host":{"error":e}}));
            let latest = row["history_updated_at_ms"]
                .as_u64()
                .map(|ms| SystemTime::UNIX_EPOCH + Duration::from_millis(ms))
                .unwrap_or(latest);
            let ack = dir.join("acknowledgement.json");
            if ack.exists() {
                let value =
                    if safe_file(&ack) && std::fs::metadata(&ack).is_ok_and(|m| m.len() < 4096) {
                        std::fs::read(&ack)
                            .ok()
                            .and_then(|data| serde_json::from_slice::<Value>(&data).ok())
                    } else {
                        None
                    };
                if let Some(value) = value.filter(|v| v["acknowledged"].is_boolean()) {
                    row["acknowledgement"] = value;
                } else {
                    row["journal_unverified"] = json!(true);
                    row["recovery_required"] = json!(true);
                }
            }
            if complete(&row) && now.duration_since(latest).is_ok_and(|age| age > KEEP_FOR) {
                let files = std::fs::read_dir(&dir)
                    .map_err(|e| e.to_string())?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?;
                if files.iter().all(|f| {
                    safe_file(&f.path())
                        && [
                            "history_summary.json",
                            "evidence.json.gz",
                            "acknowledgement.json",
                        ]
                        .contains(&f.file_name().to_string_lossy().as_ref())
                }) {
                    for f in files {
                        std::fs::remove_file(f.path()).map_err(|e| e.to_string())?;
                    }
                    std::fs::remove_dir(&dir).map_err(|e| e.to_string())?;
                    continue;
                }
            }
            output_bytes += row.to_string().len();
            if output_bytes > MAX_TOTAL_BYTES as usize {
                return Err("Lịch sử summary vượt giới hạn; chưa cho phép cập nhật".into());
            }
            rows.push((latest, row));
            continue;
        }
        let mut total = 0;
        let mut row = json!({"operation_id":name,"automatic_replay":false});
        let mut latest = SystemTime::UNIX_EPOCH;
        let mut recognized = true;
        for (file, key) in FILES {
            let p = dir.join(file);
            if !p.exists() {
                continue;
            }
            let meta = std::fs::symlink_metadata(&p).map_err(|e| e.to_string())?;
            if !meta.is_file() || std::fs::canonicalize(&p).ok().as_ref() != Some(&p) {
                recognized = false;
                continue;
            }
            if file != "acknowledgement.json" {
                latest = latest.max(meta.modified().map_err(|e| e.to_string())?);
            }
            total += meta.len();
            if meta.len() > 4 * 1024 * 1024 || total > MAX_TOTAL_BYTES {
                return Err("Journal vượt giới hạn đọc an toàn; chưa cho phép cập nhật.".into());
            }
            match serde_json::from_slice::<Value>(&std::fs::read(&p).map_err(|e| e.to_string())?) {
                Ok(v) => row[key] = v,
                Err(_) => recognized = false,
            }
        }
        let events = dir.join("events.jsonl");
        if events.exists() {
            let meta = std::fs::symlink_metadata(&events).map_err(|e| e.to_string())?;
            if !meta.is_file() || std::fs::canonicalize(&events).ok().as_ref() != Some(&events) {
                recognized = false;
            } else {
                latest = latest.max(meta.modified().map_err(|e| e.to_string())?);
                total += meta.len();
                if meta.len() > MAX_EVENT_BYTES || total > MAX_TOTAL_BYTES {
                    return Err("Journal vượt giới hạn đọc an toàn; chưa cho phép cập nhật.".into());
                }
                recognized &= apply_events(
                    &mut row,
                    &std::fs::read(&events).map_err(|e| e.to_string())?,
                );
            }
        }
        let files = std::fs::read_dir(&dir)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        recognized &= files.iter().all(|f| {
            f.file_type().is_ok_and(|t| t.is_file())
                && [
                    "host.json",
                    "result.json",
                    "lifecycle.json",
                    "events.jsonl",
                    "cancel",
                    "acknowledgement.json",
                    "evidence.json.gz",
                ]
                .contains(&f.file_name().to_string_lossy().as_ref())
        });
        row["journal_unverified"] = json!(!recognized);
        row["history_updated_at_ms"] = json!(latest
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64);
        if recognized
            && complete(&row)
            && now.duration_since(latest).is_ok_and(|age| age > KEEP_FOR)
        {
            for file in files {
                std::fs::remove_file(file.path()).map_err(|e| e.to_string())?;
            }
            std::fs::remove_dir(&dir).map_err(|e| e.to_string())?;
        } else {
            let display = if recognized && terminal(&row) && !pending_apps(&row) {
                compact(&dir, &row)?
            } else {
                summary(&row)
            };
            output_bytes += display.to_string().len();
            if output_bytes > MAX_TOTAL_BYTES as usize {
                return Err("Lịch sử summary vượt giới hạn; chưa cho phép cập nhật".into());
            }
            rows.push((latest, display));
        }
    }
    rows.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(json!(rows
        .into_iter()
        .map(|(_, row)| row)
        .collect::<Vec<_>>()))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(kind: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!(
            "vxclean_journal_{}_{}_{}",
            kind,
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p.canonicalize().unwrap()
    }
    fn put(root: &Path, id: &str, host: Value, native: Value) {
        let d = root.join(id);
        std::fs::create_dir(&d).unwrap();
        for (name, v) in [("host.json", host), ("result.json", native)] {
            std::fs::write(d.join(name), v.to_string()).unwrap();
        }
    }
    #[test]
    fn completed_journals_expire_pending_and_unknown_survive() {
        let r = fixture("retention");
        let a = "00000000-0000-4000-8000-000000000001";
        let b = "00000000-0000-4000-8000-000000000002";
        let c = "00000000-0000-4000-8000-000000000003";
        put(
            &r,
            a,
            json!({"status":"returned"}),
            json!({"status":"completed","targets":[{"status":"success"}]}),
        );
        put(
            &r,
            b,
            json!({"status":"interrupted"}),
            json!({"status":"mutating","targets":[{"status":"outcome_unknown"}]}),
        );
        put(
            &r,
            c,
            json!({"status":"returned"}),
            json!({"status":"completed","targets":[]}),
        );
        std::fs::write(r.join(c).join("unknown.bin"), b"keep").unwrap();
        let rows = read(&r, SystemTime::now() + KEEP_FOR + Duration::from_secs(60)).unwrap();
        assert!(!r.join(a).exists());
        assert!(r.join(b).exists() && r.join(c).join("unknown.bin").exists());
        assert_eq!(rows.as_array().unwrap().len(), 2);
        std::fs::remove_dir_all(r).unwrap();
    }
    #[test]
    fn reopen_obligations_and_unrecognized_outcomes_never_expire() {
        assert!(!complete(
            &json!({"host":{"status":"returned"},"lifecycle":{"status":"reopen_pending"}})
        ));
        assert!(!complete(
            &json!({"host":{"status":"returned"},"native":{"status":"completed","targets":[{"status":"outcome_unknown"}]}})
        ));
        assert!(!complete(&json!({"host":{"status":"returned"}})));
        assert!(!complete(
            &json!({"host":{"status":"returned"},"lifecycle":{"status":"reopened"},"native":{"status":"completed","targets":[{"status":"outcome_unknown"}]}})
        ));
        assert!(complete(
            &json!({"host":{"status":"returned"},"lifecycle":{"status":"reopened"}})
        ));
    }
    #[test]
    fn corrupt_lifecycle_is_exposed_and_never_expires() {
        let r = fixture("corrupt");
        let id = "00000000-0000-4000-8000-000000000005";
        put(
            &r,
            id,
            json!({"status":"returned"}),
            json!({"status":"completed","targets":[]}),
        );
        std::fs::write(r.join(id).join("lifecycle.json"), b"{broken").unwrap();
        let rows = read(&r, SystemTime::now() + KEEP_FOR + Duration::from_secs(60)).unwrap();
        assert_eq!(rows[0]["journal_unverified"], true);
        assert!(r.join(id).exists());
        std::fs::remove_dir_all(r).unwrap();
    }
    #[test]
    fn host_preflight_without_native_execution_is_terminal_not_recovery() {
        let row = json!({"host":{"status":"returned","result":{"native_execution":"not_started","success_count":0,"failure_count":2,"details":[{"status":"skipped"},{"status":"skipped"}]}}});
        assert!(complete(&row));
        assert!(!recovery_required(&row));
        assert!(!complete(&json!({"host":{"status":"returned"}})));
    }
    #[test]
    fn history_order_and_age_survive_compaction_and_acknowledgement() {
        let root = fixture("chronology");
        let old = "00000000-0000-4000-8000-000000000012";
        let recent = "00000000-0000-4000-8000-000000000013";
        put(
            &root,
            old,
            json!({"status":"interrupted"}),
            json!({"status":"mutating","targets":[{"status":"outcome_unknown"}]}),
        );
        std::thread::sleep(Duration::from_millis(20));
        put(
            &root,
            recent,
            json!({"status":"returned"}),
            json!({"status":"completed","targets":[]}),
        );
        let first = read(&root, SystemTime::now()).unwrap();
        assert_eq!(first[0]["operation_id"], recent);
        acknowledge(&root, old).unwrap();
        let again = read(&root, SystemTime::now()).unwrap();
        assert_eq!(again[0]["operation_id"], recent);
        assert_eq!(
            first[0]["history_updated_at_ms"],
            again[0]["history_updated_at_ms"]
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn archives_preserve_exact_events_and_unknown_outcomes() {
        use std::io::Read;
        let r = fixture("archive");
        let id = "00000000-0000-4000-8000-000000000008";
        put(
            &r,
            id,
            json!({"status":"returned"}),
            json!({"status":"partial","targets":[]}),
        );
        let events=b"{\"phase\":\"intent\",\"target\":{\"path\":\"/cache/a\",\"status\":\"outcome_unknown\"}}\n{\"phase\":\"outcome\",\"target\":{\"path\":\"/cache/a\",\"status\":\"success\"}}\n{\"phase\":\"intent\",\"target\":{\"path\":\"/cache/b\",\"status\":\"outcome_unknown\"}}\n";
        std::fs::write(r.join(id).join("events.jsonl"), events).unwrap();
        let rows = read(&r, SystemTime::now()).unwrap();
        assert_eq!(rows[0]["recovery_required"], true);
        assert_eq!(rows[0]["native"]["targets"].as_array().unwrap().len(), 1);
        let mut raw = String::new();
        flate2::read::GzDecoder::new(
            std::fs::File::open(r.join(id).join("evidence.json.gz")).unwrap(),
        )
        .read_to_string(&mut raw)
        .unwrap();
        let evidence: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            evidence["files"]["events.jsonl"]["utf8"]
                .as_str()
                .unwrap()
                .as_bytes(),
            events
        );
        assert!(!r.join(id).join("events.jsonl").exists());
        acknowledge(&r, id).unwrap();
        let rows = read(&r, SystemTime::now() + KEEP_FOR + Duration::from_secs(60)).unwrap();
        assert_eq!(rows[0]["acknowledgement"]["acknowledged"], true);
        assert_eq!(rows[0]["recovery_required"], true);
        assert!(r.join(id).exists());
        std::fs::write(r.join(id).join("acknowledgement.json"), b"broken").unwrap();
        assert_eq!(
            read(&r, SystemTime::now()).unwrap()[0]["journal_unverified"],
            true
        );
        std::fs::remove_dir_all(r).unwrap();
    }
    #[test]
    fn archived_checksum_and_unexpected_files_block_update() {
        let r = fixture("tamper");
        let id = "00000000-0000-4000-8000-000000000009";
        put(
            &r,
            id,
            json!({"status":"returned"}),
            json!({"status":"completed","targets":[]}),
        );
        read(&r, SystemTime::now()).unwrap();
        std::fs::write(r.join(id).join("unexpected"), b"keep").unwrap();
        let rows = read(&r, SystemTime::now() + KEEP_FOR + Duration::from_secs(60)).unwrap();
        assert!(update_block_reason(&rows).is_some());
        assert!(r.join(id).join("unexpected").exists());
        std::fs::remove_file(r.join(id).join("unexpected")).unwrap();
        std::fs::write(r.join(id).join("evidence.json.gz"), b"tamper").unwrap();
        assert!(update_block_reason(&read(&r, SystemTime::now()).unwrap()).is_some());
        std::fs::remove_dir_all(r).unwrap();
    }
    #[test]
    fn old_pending_is_not_hidden_by_new_success_or_acknowledgement() {
        let pending = json!({"host":{"status":"returned"},"native":{"status":"partial"},"lifecycle":{"status":"reopen_pending","apps":[{"quit_requested":true,"reopened":false}]},"acknowledgement":{"acknowledged":true}});
        let success =
            json!({"host":{"status":"returned"},"native":{"status":"completed","targets":[]}});
        assert!(update_block_reason(&json!([success, pending])).is_some());
    }
    #[test]
    fn known_partial_expires_but_unknown_does_not() {
        let r = fixture("partial");
        let id = "00000000-0000-4000-8000-000000000010";
        put(
            &r,
            id,
            json!({"status":"returned"}),
            json!({"status":"partial","targets":[{"status":"permission_denied","path":"/cache/a"}]}),
        );
        read(&r, SystemTime::now()).unwrap();
        assert!(
            read(&r, SystemTime::now() + KEEP_FOR + Duration::from_secs(60))
                .unwrap()
                .as_array()
                .unwrap()
                .is_empty()
        );
        assert!(!r.join(id).exists());
        std::fs::remove_dir_all(r).unwrap();
    }
    #[test]
    fn committed_archive_cleans_only_matching_crash_leftovers() {
        let r = fixture("crash");
        let id = "00000000-0000-4000-8000-000000000011";
        let host = json!({"status":"returned"});
        put(
            &r,
            id,
            host.clone(),
            json!({"status":"completed","targets":[]}),
        );
        read(&r, SystemTime::now()).unwrap();
        std::fs::write(r.join(id).join("host.json"), host.to_string()).unwrap();
        assert_eq!(
            read(&r, SystemTime::now()).unwrap()[0]["journal_unverified"],
            false
        );
        assert!(!r.join(id).join("host.json").exists());
        std::fs::write(r.join(id).join("host.json"), b"changed").unwrap();
        assert_eq!(
            read(&r, SystemTime::now()).unwrap()[0]["journal_unverified"],
            true
        );
        assert!(r.join(id).join("host.json").exists());
        std::fs::remove_dir_all(r).unwrap();
    }
    #[test]
    fn large_history_is_bounded_per_operation_and_compacted() {
        let r = fixture("large");
        let padding = "x".repeat(3 * 1024 * 1024);
        for n in 20..32 {
            let id = format!("00000000-0000-4000-8000-{:012}", n);
            put(
                &r,
                &id,
                json!({"status":"returned","result":{"details":[{"status":"success","padding":padding}]}}),
                json!({"status":"completed","targets":[]}),
            );
        }
        let rows = read(&r, SystemTime::now()).unwrap();
        assert_eq!(rows.as_array().unwrap().len(), 12);
        assert!(rows.to_string().len() < 16000);
        let bytes: u64 = std::fs::read_dir(&r)
            .unwrap()
            .map(|d| {
                std::fs::read_dir(d.unwrap().path())
                    .unwrap()
                    .map(|f| f.unwrap().metadata().unwrap().len())
                    .sum::<u64>()
            })
            .sum();
        assert!(bytes < 1024 * 1024);
        std::fs::remove_dir_all(r).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn symlink_journal_preserves_external_file() {
        use std::os::unix::fs::symlink;
        let r = fixture("links");
        let outside = r.join("keep");
        std::fs::write(&outside, b"marker").unwrap();
        let d = r.join("00000000-0000-4000-8000-000000000004");
        std::fs::create_dir(&d).unwrap();
        symlink(&outside, d.join("host.json")).unwrap();
        read(&r, SystemTime::now() + KEEP_FOR + Duration::from_secs(60)).unwrap();
        assert_eq!(std::fs::read(outside).unwrap(), b"marker");
        assert!(d.exists());
        std::fs::remove_dir_all(r).unwrap();
    }
}

#[cfg(test)]
mod event_tests {
    use super::*;
    #[test]
    fn events_recover_exact_outcomes_and_keep_missing_outcome_unknown() {
        let mut row =
            json!({"host":{"status":"interrupted"},"native":{"status":"mutating","targets":[]}});
        let log=b"{\"phase\":\"intent\",\"target\":{\"path\":\"/a\",\"status\":\"outcome_unknown\"}}\n{\"phase\":\"outcome\",\"target\":{\"path\":\"/a\",\"status\":\"success\",\"affected_bytes\":5}}\n{\"phase\":\"intent\",\"target\":{\"path\":\"/b\",\"status\":\"outcome_unknown\"}}\n";
        assert!(apply_events(&mut row, log));
        assert_eq!(row["native"]["targets"][0]["affected_bytes"], 5);
        assert_eq!(row["native"]["targets"][1]["status"], "outcome_unknown");
        assert!(!complete(&row));
    }
    #[test]
    fn truncated_or_unknown_events_fail_closed() {
        let mut row = json!({"native":{"status":"mutating","targets":[]}});
        assert!(!apply_events(&mut row, b"{broken"));
        assert!(!apply_events(
            &mut row,
            b"{\"phase\":\"garbage\",\"target\":{\"path\":\"/a\",\"status\":\"success\"}}\n"
        ));
    }
    #[test]
    fn large_completed_event_stream_keeps_bounded_samples_and_unresolved_paths() {
        let mut data=Vec::new();
        for n in 0..25001 {
            let path=format!("/cache/{n:05}");
            for (phase,status) in [("intent","outcome_unknown"),("outcome","success")] {
                serde_json::to_writer(&mut data,&json!({"phase":phase,"target":{"path":path,"status":status}})).unwrap();
                data.push(b'\n');
            }
        }
        serde_json::to_writer(&mut data,&json!({"phase":"intent","target":{"path":"/unfinished","status":"outcome_unknown"}})).unwrap();data.push(b'\n');
        let mut row=json!({"native":{"status":"mutating","targets":[]}});
        assert!(apply_events(&mut row,&data));
        let targets=row["native"]["targets"].as_array().unwrap();
        assert_eq!(targets.iter().filter(|t|t["status"]=="success").count(),200);
        assert!(targets.iter().any(|t|t["path"]=="/unfinished"&&t["status"]=="outcome_unknown"));
        assert!(!complete(&row));
        let root=std::env::temp_dir().join(format!("vxclean_large_history_{}",SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir(&root).unwrap();let root=std::fs::canonicalize(root).unwrap();
        let dir=root.join("01234567-89ab-cdef-0123-456789abcdef");std::fs::create_dir(&dir).unwrap();
        std::fs::write(dir.join("result.json"),br#"{"status":"completed","targets":[]}"#).unwrap();
        std::fs::write(dir.join("host.json"),br#"{"status":"returned"}"#).unwrap();
        let last=data[..data.len()-1].iter().rposition(|b|*b==b'\n').unwrap();
        std::fs::write(dir.join("events.jsonl"),&data[..last+1]).unwrap();
        let history=read(&root,SystemTime::now()).unwrap();
        assert_eq!(history.as_array().unwrap().len(),1);assert_eq!(history[0]["journal_unverified"],false);
        assert!(dir.join("evidence.json.gz").exists());
        let reread=read(&root,SystemTime::now()).unwrap();assert_eq!(reread[0]["journal_unverified"],false);
        std::fs::remove_dir_all(root).unwrap();

    }

}
