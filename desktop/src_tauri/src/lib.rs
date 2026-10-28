#[cfg(all(test,not(target_os="windows")))]
mod windows_dummy;
mod journal_history;
pub mod engine_bridge;
pub mod models;
#[cfg(not(target_os="windows"))]
pub mod maintenance_bridge;
#[cfg(target_os="windows")]
#[path="windows_dummy.rs"]
pub mod maintenance_bridge;
mod lens_scanner;
mod scan_access;
pub mod menubar;

pub use engine_bridge::*;
pub use models::*;
use tauri::Emitter;
#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};

pub fn run() {
    let builder=tauri::Builder::default();
    #[cfg(target_os="macos")]
    let builder=builder.plugin(tauri_plugin_single_instance::init(|app,_,_| { let _=menubar::open_main(app,"open"); }));
    builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(maintenance_bridge::EngineState::default())
        .manage(engine_bridge::MetricsService::default())
        .manage(menubar::MenubarState::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let about_metadata = AboutMetadataBuilder::new()
                    .name(Some("VXClean"))
                    .version(Some(env!("CARGO_PKG_VERSION")))
                    .copyright(Some("by Viet Linh Bui"))
                    .authors(Some(vec!["Viet Linh Bui".into()]))
                    .comments(Some("Tiện ích giám sát tài nguyên CPU, RAM, Disk siêu nhẹ"))
                    .build();

                let settings_item = MenuItemBuilder::with_id("open_settings", "Cài đặt...")
                    .accelerator("CmdOrCtrl+,")
                    .build(app)?;

                let app_submenu = SubmenuBuilder::new(app, "VXClean")
                    .about(Some(about_metadata))
                    .separator()
                    .item(&settings_item)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;

                let refresh_item = MenuItemBuilder::with_id("refresh_data", "Làm mới dữ liệu")
                    .accelerator("CmdOrCtrl+R")
                    .build(app)?;

                let file_submenu = SubmenuBuilder::new(app, "Tệp")
                    .item(&refresh_item)
                    .separator()
                    .close_window()
                    .build()?;

                let toggle_theme_item = MenuItemBuilder::with_id("toggle_theme", "Chuyển giao diện sáng/tối")
                    .build(app)?;

                let resource_panel_item = MenuItemBuilder::with_id("resource_panel", "Bảng tài nguyên (menubar)").build(app)?;
                let view_submenu = SubmenuBuilder::new(app, "Xem")
                    .item(&resource_panel_item)
                    .item(&toggle_theme_item)
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&app_submenu)
                    .item(&file_submenu)
                    .item(&view_submenu)
                    .build()?;

                let _ = app.set_menu(menu);
            }

            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Some(main_win) = app.get_webview_window("main") {
                    let _ = main_win.set_decorations(false);
                }
            }
            if let Err(error)=menubar::setup(app){eprintln!("Menubar initialization failed: {error}");}
            Ok(())
        })
        .on_window_event(menubar::window_event)
        .on_menu_event(|app_handle, event| match event.id().as_ref() {
            "refresh_data" => {
                let _ = app_handle.emit("trigger-refresh", ());
            }
            "open_settings" => {
                let _ = app_handle.emit("trigger-open-settings", ());
            }
            "resource_panel" => { menubar::show_panel(app_handle); }
            "toggle_theme" => {
                let _ = app_handle.emit("trigger-toggle-theme", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            maintenance_bridge::prepare_for_update, maintenance_bridge::resume_after_update_error, maintenance_bridge::restart_after_update, menubar::menubar_action, maintenance_bridge::prepare_cleanup_apps, maintenance_bridge::finish_cleanup_apps, maintenance_bridge::get_operation_status, maintenance_bridge::get_operation_history, maintenance_bridge::acknowledge_operation,
            engine_bridge::get_capabilities,
            engine_bridge::get_system_snapshot,
            maintenance_bridge::start_scan, maintenance_bridge::cancel_scan,
            maintenance_bridge::clean_items, maintenance_bridge::get_installed_apps,
            maintenance_bridge::uninstall_app, maintenance_bridge::get_orphans,
            maintenance_bridge::trash_lens_item, maintenance_bridge::clean_orphans, maintenance_bridge::analyze_space_lens, maintenance_bridge::get_lens_folder,
            maintenance_bridge::choose_scan_folder, maintenance_bridge::open_full_disk_access_settings, maintenance_bridge::get_scan_access_status,
            maintenance_bridge::reveal_in_file_manager, maintenance_bridge::open_in_terminal,
        ])
        .build(tauri::generate_context!())
        .expect("Lỗi khi khởi chạy ứng dụng Tauri VXClean")
        .run(|app,event|match event {
            tauri::RunEvent::ExitRequested{code:None,api,..}=>{api.prevent_exit();menubar::quit(app);},
            #[cfg(target_os="macos")]
            tauri::RunEvent::Reopen{..}=>{let _=menubar::open_main(app,"open");},
            _=>{}
        });
}

/// Internal read-only worker mode, before creating any windows or Tauri services.
pub fn run_lens_cli()->bool {
    if cfg!(target_os="windows"){return false;}
    let args:Vec<_>=std::env::args().skip(1).collect();
    if args.first().is_none_or(|a|a!="--lens-scan"){return false}
    if args.len()!=3 || args[1]!="--path"{eprintln!("Invalid lens worker arguments");std::process::exit(2)}
    let latest=std::sync::Arc::new(std::sync::Mutex::new(serde_json::Value::Null));
    let done=std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let reporter_latest=latest.clone();let reporter_done=done.clone();
    let reporter=std::thread::spawn(move || {
        while !reporter_done.load(std::sync::atomic::Ordering::Relaxed){
            let data=reporter_latest.lock().unwrap().clone();
            if !data.is_null(){eprintln!("{}",serde_json::json!({"event":"lens_progress","payload":data}));}
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
    let result=lens_scanner::scan(args[2].clone().into(),&std::sync::atomic::AtomicBool::new(false),|value|{*latest.lock().unwrap()=value;});
    done.store(true,std::sync::atomic::Ordering::Relaxed);let _=reporter.join();
    match result{Ok(value)=>{let output=std::io::BufWriter::new(std::io::stdout());
        let mut encoder=flate2::write::GzEncoder::new(output,flate2::Compression::fast());
        if serde_json::to_writer(&mut encoder,&value).is_err() || encoder.finish().is_err(){std::process::exit(1)}},Err(error)=>{eprintln!("{}",error);std::process::exit(1)}}
    true
}

/// Read-only access worker runs before any UI/service initialization.
pub fn run_access_cli()->bool{
    let args:Vec<_>=std::env::args().skip(1).collect();
    if args.first().is_none_or(|arg|arg!="--access-probe"){return false}
    if args.len()!=1{std::process::exit(2)}
    if serde_json::to_writer(std::io::stdout(),&scan_access::status()).is_err(){std::process::exit(1)}
    true
}
