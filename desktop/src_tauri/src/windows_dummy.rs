//! Windows UI-only adapter: no filesystem or process maintenance.
#![allow(unused_variables)]
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, State};
const UNAVAILABLE: &str = "Windows: bản giao diện, chức năng engine chưa được triển khai.";
#[derive(Default)]
pub struct EngineState {
    updating: AtomicBool,
}
impl EngineState {
    pub(crate) fn is_mutating(&self) -> bool {
        false
    }
    pub(crate) fn is_busy(&self) -> bool {
        false
    }
    pub(crate) fn shutdown(&self) {
        self.updating.store(true, Ordering::SeqCst);
    }
}
fn main_only(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("scope_mismatch".into())
    }
}
fn unavailable<T>() -> Result<T, String> {
    Err(UNAVAILABLE.into())
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn get_operation_status(state: State<'_, EngineState>) -> Value {
    json!({"mutation_active":false,"read_active":false})
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn prepare_for_update(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
) -> Result<(), String> {
    main_only(&window)?;
    state.shutdown();
    Ok(())
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn resume_after_update_error(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
) -> Result<(), String> {
    main_only(&window)?;
    state.updating.store(false, Ordering::SeqCst);
    Ok(())
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn restart_after_update(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
) -> Result<(), String> {
    main_only(&window)?;
    if !state.updating.load(Ordering::SeqCst) {
        return Err("Cần chuẩn bị cập nhật trước restart".into());
    }
    app.restart()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn get_operation_history(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
) -> Result<Value, String> {
    main_only(&window)?;
    Ok(json!([]))
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn acknowledge_operation(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    operation_id: String,
) -> Result<(), String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn start_scan(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    operation_id: String,
    include_empty: Option<bool>,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn cancel_scan(state: State<'_, EngineState>, operation_id: String) {}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn clean_items(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    payload: Value,
    operation_id: String,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn prepare_cleanup_apps(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    payload: Value,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn finish_cleanup_apps(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    operation_id: String,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn get_installed_apps(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn uninstall_app(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    payload: Value,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn get_orphans(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn clean_orphans(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    selected_paths: Vec<String>,
    confirm_direct_delete: bool,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn analyze_space_lens(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    path: String,
    operation_id: Option<String>,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn get_lens_folder(
    window: tauri::WebviewWindow,
    state: State<'_, EngineState>,
    lens_id: String,
    path: String,
) -> Result<Option<Value>, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn choose_scan_folder(app: AppHandle) -> Result<Option<String>, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn get_scan_access_status(
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<Value, String> {
    main_only(&window)?;
    Ok(crate::scan_access::status())
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn open_full_disk_access_settings() -> Result<(), String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub async fn trash_lens_item(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, EngineState>,
    lens_id: String,
    path: String,
) -> Result<Value, String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    unavailable()
}
#[cfg_attr(target_os = "windows", tauri::command)]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    unavailable()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_engine_result_can_claim_success() {
        assert!(unavailable::<Value>()
            .unwrap_err()
            .contains("chưa được triển khai"));
        assert!(unavailable::<()>().is_err());
    }
    #[test]
    fn update_state_has_no_engine_or_mutation() {
        let state = EngineState::default();
        assert!(!state.is_busy());
        assert!(!state.is_mutating());
        assert!(!state.updating.load(Ordering::SeqCst));
        state.shutdown();
        assert!(state.updating.load(Ordering::SeqCst));
        assert!(!state.is_mutating());
    }
}
