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

#[cfg(target_os = "macos")]
#[allow(deprecated)]
pub fn sync_mac_traffic_lights(window: &tauri::WebviewWindow) {
    let win = window.clone();
    let win_closure = win.clone();
    let _ = win.run_on_main_thread(move || {
        #[allow(deprecated)]
        use cocoa::base::{id, nil, BOOL, YES};
        #[allow(deprecated)]
        use cocoa::foundation::{NSPoint, NSRect};
        use objc::{class, msg_send, sel, sel_impl};

        if let Ok(ns_win_ptr) = win_closure.ns_window() {
            let ns_window = ns_win_ptr as id;
            if ns_window == nil {
                return;
            }
            unsafe {
                let style_mask: u64 = msg_send![ns_window, styleMask];
                if (style_mask & (1 << 14)) != 0 {
                    return;
                }

                for (i, btn_id) in [0usize, 1usize, 2usize].iter().enumerate() {
                    let btn: id = msg_send![ns_window, standardWindowButton: *btn_id];
                    if btn != nil {
                        let is_hidden: BOOL = msg_send![btn, isHidden];
                        if is_hidden == YES {
                            continue;
                        }
                        let reference: id = msg_send![class!(NSWindow),
                            standardWindowButton: *btn_id forStyleMask: style_mask];
                        if reference == nil {
                            continue;
                        }
                        let reference_frame: NSRect = msg_send![reference, frame];
                        let reference_bounds: NSRect = msg_send![reference, bounds];
                        let control_size: u64 = msg_send![reference, controlSize];
                        let _: () = msg_send![btn, setControlSize: control_size];

                        let content_view: id = msg_send![ns_window, contentView];
                        let superview: id = msg_send![btn, superview];
                        if content_view == nil || superview == nil {
                            continue;
                        }
                        let content_bounds: NSRect = msg_send![content_view, bounds];
                        let is_flipped: BOOL = msg_send![content_view, isFlipped];
                        let toolbar_center_from_top = 15.5_f64;
                        let toolbar_center_y = if is_flipped == YES {
                            toolbar_center_from_top
                        } else {
                            content_bounds.size.height - toolbar_center_from_top
                        };
                        let content_center = NSPoint {
                            x: content_bounds.origin.x + 14.0 + (i as f64) * 20.0,
                            y: content_bounds.origin.y + toolbar_center_y,
                        };
                        let native_center: NSPoint = msg_send![superview,
                            convertPoint: content_center fromView: content_view];
                        let target_x = native_center.x - reference_frame.size.width / 2.0;
                        let target_y = native_center.y - reference_frame.size.height / 2.0;
                        let target_frame = NSRect {
                            origin: NSPoint {
                                x: target_x,
                                y: target_y,
                            },
                            size: reference_frame.size,
                        };
                        let _: () = msg_send![btn, setFrame: target_frame];
                        let _: () = msg_send![btn, setBounds: reference_bounds];
                    }
                }
            }
        }
    });
}

#[cfg(target_os = "macos")]
fn rebuild_mac_app_menu(app: &tauri::AppHandle, lang: &str) -> tauri::Result<()> {
    let en = lang == "en";
    let about_comments = if en {
        "Monitor resources, inspect storage, and maintain system performance."
    } else {
        "Theo dõi tài nguyên, dọn dẹp dung lượng và tối ưu hóa hệ thống."
    };
    let about_credits = if en {
        "Bùi Việt Linh\nMonitor resources, clean system caches, and inspect storage usage.\nGitHub: https://github.com/linhbv94/VXClean"
    } else {
        "Bùi Việt Linh\nTheo dõi tài nguyên, dọn dẹp dung lượng và kiểm tra bộ nhớ an toàn.\nGitHub: https://github.com/linhbv94/VXClean"
    };

    let mut about_builder = AboutMetadataBuilder::new()
        .name(Some("VXClean"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        // Empty AppKit build version prevents fallback to CFBundleVersion.
        .short_version(Some(""))
        .copyright(Some("© 2026 Bùi Việt Linh. All rights reserved."))
        .authors(Some(vec!["Bùi Việt Linh".into()]))
        .comments(Some(about_comments))
        .website(Some("https://github.com/linhbv94/VXClean"))
        .website_label(Some("GitHub — VXClean"))
        .credits(Some(about_credits));
    about_builder = about_builder.icon(Some(tauri::include_image!("icons/icon.png")));

                let settings_item = MenuItemBuilder::with_id("open_settings", if en {"Settings…"} else {"Cài đặt..."})
                    .accelerator("CmdOrCtrl+,")
                    .build(app)?;

                let app_submenu = SubmenuBuilder::new(app, "VXClean")
                    .about(Some(about_builder.build()))
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

                let refresh_item = MenuItemBuilder::with_id("refresh_data", if en {"Refresh data"} else {"Làm mới dữ liệu"})
                    .accelerator("CmdOrCtrl+R")
                    .build(app)?;

                let file_submenu = SubmenuBuilder::new(app, if en {"File"} else {"Tệp"})
                    .item(&refresh_item)
                    .separator()
                    .close_window()
                    .build()?;

                let toggle_theme_item = MenuItemBuilder::with_id("toggle_theme", if en {"Toggle light/dark appearance"} else {"Chuyển giao diện sáng/tối"})
                    .build(app)?;

                let resource_panel_item = MenuItemBuilder::with_id("resource_panel", if en {"Resource panel"} else {"Bảng tài nguyên (menubar)"}).build(app)?;
                let view_submenu = SubmenuBuilder::new(app, if en {"View"} else {"Xem"})
                    .item(&resource_panel_item)
                    .item(&toggle_theme_item)
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&app_submenu)
                    .item(&file_submenu)
                    .item(&view_submenu)
                    .build()?;

                let _ = app.set_menu(menu);
    Ok(())
}
#[tauri::command]
fn set_app_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    #[cfg(target_os="macos")]
    return rebuild_mac_app_menu(&app, &lang).map_err(|e| e.to_string());
    #[cfg(not(target_os="macos"))]
    {let _ = (app,lang); Ok(())}
}
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
                rebuild_mac_app_menu(app.handle(), "vi")?;
                use tauri::Manager;
                if let Some(main_win) = app.get_webview_window("main") {
                    sync_mac_traffic_lights(&main_win);
                }
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
                let _ = menubar::open_main(app_handle, "open");
                let _ = app_handle.emit("trigger-open-settings", ());
            }
            "resource_panel" => { menubar::show_panel(app_handle); }
            "toggle_theme" => {
                let _ = app_handle.emit("trigger-toggle-theme", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            set_app_language,
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
