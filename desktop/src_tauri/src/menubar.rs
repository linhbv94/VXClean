const MENUBAR_RGBA: &[u8; 36 * 36 * 4] = include_bytes!("../assets/menubar_36.rgba");
use std::sync::atomic::{AtomicBool,Ordering};
use tauri::{AppHandle,Manager,Emitter,WebviewUrl,WebviewWindowBuilder,WindowEvent};
use tauri::menu::{MenuBuilder,MenuItemBuilder};
use tauri::tray::{TrayIconBuilder,TrayIconEvent,MouseButton,MouseButtonState};
#[derive(Default)]
pub struct MenubarState { ready:AtomicBool, quitting:AtomicBool }
pub fn is_ready(app:&AppHandle)->bool {app.state::<MenubarState>().ready.load(Ordering::SeqCst)}
pub fn open_main(app:&AppHandle, action:&str) -> Result<(),String> {
    #[cfg(target_os="macos")] app.set_activation_policy(tauri::ActivationPolicy::Regular).map_err(|e|e.to_string())?;
    if let Some(panel)=app.get_webview_window("menubar") {let _=panel.hide();}
    let main=app.get_webview_window("main").ok_or("Không tìm thấy cửa sổ chính")?;
    main.show().map_err(|e|e.to_string())?; let _=main.unminimize(); main.set_focus().map_err(|e|e.to_string())?;
    #[cfg(target_os="macos")] crate::sync_mac_traffic_lights(&main);
    if action!="open" {main.emit("menubar-action",action).map_err(|e|e.to_string())?;}
    Ok(())
}
pub fn show_panel(app:&AppHandle) {
    if let Some(panel)=app.get_webview_window("menubar") {
        // Native menu fallback anchors to the main window's monitor. Tray clicks
        // keep their pointer anchor below; Cocoa tray rects differ across displays.
        if let Some(main)=app.get_webview_window("main") {
            if let Ok(Some(monitor))=main.current_monitor() {
                let area=monitor.work_area(); let scale=monitor.scale_factor();
                let x=area.position.x as f64+(area.size.width as f64-340.*scale).max(0.);
                let _=panel.set_position(tauri::PhysicalPosition::new(x as i32,area.position.y));
            }
        }
        let _=panel.show(); let _=panel.set_focus(); let _=panel.emit("panel-open",());
    }
}
#[tauri::command]
pub fn menubar_action(window:tauri::WebviewWindow, app:AppHandle, action:String)->Result<(),String> {
    if !["menubar","main"].contains(&window.label()) {return Err("invalid window".into());}
    match action.as_str() {
        "hide"=>{if let Some(p)=app.get_webview_window("menubar"){let _=p.hide();} Ok(())},
        "open"|"settings"=>open_main(&app,&action),
        "quick"=>{ if app.state::<crate::maintenance_bridge::EngineState>().is_mutating(){return Err("Đang dọn dữ liệu; vui lòng chờ".into());} open_main(&app,&action)},
        _=>Err("unsupported action".into())
    }
}
pub fn quit(app:&AppHandle) {
    if app.state::<MenubarState>().quitting.swap(true,Ordering::SeqCst){return;}
    app.state::<crate::maintenance_bridge::EngineState>().shutdown();
    app.state::<crate::engine_bridge::MetricsService>().shutdown();
    let app=app.clone();
    std::thread::spawn(move || {
        let started=std::time::Instant::now();
        while (app.state::<crate::maintenance_bridge::EngineState>().is_busy() || app.state::<crate::engine_bridge::MetricsService>().is_busy()) && started.elapsed()<std::time::Duration::from_secs(12) {std::thread::sleep(std::time::Duration::from_millis(40));}
        app.exit(0);
    });
}
pub fn window_event(window:&tauri::Window,event:&WindowEvent) {
    let app=window.app_handle();
    if let WindowEvent::CloseRequested{api,..}=event {
        if app.state::<MenubarState>().quitting.load(Ordering::SeqCst){return;}
        if window.label()=="menubar" {api.prevent_close();let _=window.hide();}
        else if window.label()=="main" && is_ready(app) {
            api.prevent_close();let _=window.hide();
            if let Some(panel)=app.get_webview_window("menubar"){let _=panel.hide();}
            #[cfg(target_os="macos")] let _=app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        }
    }
    if window.label()=="menubar" && matches!(event,WindowEvent::Focused(false)) {let _=window.hide();}
    #[cfg(target_os="macos")]
    if window.label()=="main" && matches!(event, WindowEvent::Resized(_) | WindowEvent::Focused(true) | WindowEvent::ScaleFactorChanged { .. }) {
        if let Some(main) = app.get_webview_window("main") {
            crate::sync_mac_traffic_lights(&main);
        }
    }
}
pub fn setup(app:&mut tauri::App)->Result<(),Box<dyn std::error::Error>> {
    #[cfg(target_os="macos")] {
        let panel=WebviewWindowBuilder::new(app,"menubar",WebviewUrl::App("menubar.html".into()))
            .title("VXClean — Tài nguyên hệ thống").inner_size(340.,430.).resizable(false).decorations(false).transparent(true).shadow(true).always_on_top(true).skip_taskbar(true).visible(false).build()?;
        let open=MenuItemBuilder::with_id("tray_open","Mở VXClean").build(app)?;
        let settings=MenuItemBuilder::with_id("tray_settings","Cài đặt…").build(app)?;
        let exit=MenuItemBuilder::with_id("tray_quit","Thoát VXClean").build(app)?;
        let menu=MenuBuilder::new(app).items(&[&open,&settings,&exit]).build()?;
        let image=tauri::image::Image::new_owned(MENUBAR_RGBA.to_vec(),36,36);
        TrayIconBuilder::with_id("vxclean_status").icon(image).icon_as_template(true).tooltip("VXClean").menu(&menu).show_menu_on_left_click(false)
            .on_menu_event(|app,event|match event.id().as_ref(){"tray_open"=>{let _=open_main(app,"open");},"tray_settings"=>{let _=open_main(app,"settings");},"tray_quit"=>quit(app),_=>{}})
            .on_tray_icon_event(move |tray,event| {
                if let TrayIconEvent::Click{position,button:MouseButton::Left,button_state:MouseButtonState::Up,..}=event {
                    let app=tray.app_handle();
                    if let Some(panel)=app.get_webview_window("menubar") {
                        if panel.is_visible().unwrap_or(false){let _=panel.hide();return;}
                        let scale=panel.scale_factor().unwrap_or(1.);
                        let size=tauri::PhysicalSize::new((340.*scale) as u32,(430.*scale) as u32);
                        let mut x=position.x-(size.width as f64)/2.;let mut y=position.y+12.*scale;
                        if let Ok(monitors)=app.available_monitors(){if let Some(m)=monitors.iter().find(|m|position.x>=m.position().x as f64 && position.x<(m.position().x as f64+m.size().width as f64) && position.y>=m.position().y as f64 && position.y<(m.position().y as f64+m.size().height as f64)){
                            let area=m.work_area();x=x.clamp(area.position.x as f64,(area.position.x as f64+area.size.width as f64-size.width as f64).max(area.position.x as f64));y=y.clamp(area.position.y as f64,(area.position.y as f64+area.size.height as f64-size.height as f64).max(area.position.y as f64));
                        }}
                        let _=panel.set_position(tauri::PhysicalPosition::new(x as i32,y as i32));let _=panel.show();let _=panel.set_focus();let _=panel.emit("panel-open",());
                    }
                }
            }).build(app)?;
        let _=panel;
        app.state::<MenubarState>().ready.store(true,Ordering::SeqCst);
    }
    Ok(())
}

#[cfg(test)] mod icon_tests {
 #[test] fn menubar_icon_has_packed_pixels_and_visible_alpha() {
  assert_eq!(super::MENUBAR_RGBA.len(),36*36*4);
  let opaque=super::MENUBAR_RGBA.chunks_exact(4).filter(|p|p[3]>0).count();
  assert!(opaque>50 && opaque<36*36);
 }
}
