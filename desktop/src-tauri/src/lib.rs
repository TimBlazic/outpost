use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;
use url::Url;

const PROD_URL: &str = "https://admin.timblazic.dev";
const DEV_URL: &str = "http://localhost:3000";

fn app_start_url() -> &'static str {
    if cfg!(debug_assertions) {
        DEV_URL
    } else {
        PROD_URL
    }
}

fn is_allowed_navigation(url: &Url) -> bool {
    match url.scheme() {
        "http" | "https" => {}
        // Allow about:blank / data during intermediate loads
        "about" | "data" | "blob" => return true,
        _ => return false,
    }

    match url.host_str() {
        Some("localhost") | Some("127.0.0.1") => true,
        Some("admin.timblazic.dev") => true,
        // Supabase Auth redirects (magic link / OAuth) then bounce back to admin
        Some(host) if host.ends_with(".supabase.co") => true,
        _ => false,
    }
}

fn open_external(app: &tauri::AppHandle, url: &str) {
    if let Err(err) = app.opener().open_url(url, None::<&str>) {
        eprintln!("[outpost-desktop] failed to open external url: {err}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let start = app_start_url();
            let start_url: Url = start.parse().expect("valid start url");

            let reload = MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let open_browser = MenuItemBuilder::with_id("open_browser", "Open in Browser")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&reload)
                .separator()
                .item(&open_browser)
                .build()?;

            let app_menu = SubmenuBuilder::new(app, "Outpost")
                .item(&PredefinedMenuItem::about(app, Some("Outpost"), None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .build()?;
            app.set_menu(menu)?;

            let nav_handle = handle.clone();
            let new_win_handle = handle.clone();

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start_url))
                .title("Outpost")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                .resizable(true)
                .fullscreen(false)
                .on_navigation(move |url| {
                    if is_allowed_navigation(url) {
                        true
                    } else {
                        open_external(&nav_handle, url.as_str());
                        false
                    }
                })
                .on_new_window(move |url, _features| {
                    open_external(&new_win_handle, url.as_str());
                    tauri::webview::NewWindowResponse::Deny
                })
                .build()?;

            let menu_handle = handle.clone();
            app.on_menu_event(move |app, event| match event.id().as_ref() {
                "reload" => {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.eval("window.location.reload()");
                    }
                }
                "open_browser" => {
                    if let Some(win) = app.get_webview_window("main") {
                        if let Ok(url) = win.url() {
                            open_external(&menu_handle, url.as_str());
                        } else {
                            open_external(&menu_handle, app_start_url());
                        }
                    } else {
                        open_external(&menu_handle, app_start_url());
                    }
                }
                _ => {}
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Outpost desktop");
}
