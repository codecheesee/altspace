// Prevent console window in release mode
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apps;
mod everything;
mod hotkey;

use apps::AppIndex;
use everything::EverythingClient;
use slint::{ModelRc, VecModel};
use std::cell::RefCell;
use std::process::Command;
use std::rc::Rc;

slint::include_modules!();

fn main() -> Result<(), slint::PlatformError> {
    let app_window = AppWindow::new()?;
    let window_handle = app_window.as_weak();

    // Background Global Alt+Space Hotkey Listener
    let hotkey_window_weak = window_handle.clone();
    std::thread::spawn(move || {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{GetMessageW, MSG, WM_HOTKEY};

        let mut hotkey_manager = hotkey::HotkeyManager::new();
        if hotkey_manager.register(HWND(std::ptr::null_mut())) {
            let mut msg = MSG::default();
            unsafe {
                while GetMessageW(&mut msg, HWND(std::ptr::null_mut()), 0, 0).as_bool() {
                    if msg.message == WM_HOTKEY && msg.wParam.0 as i32 == hotkey::HOTKEY_ID {
                        let _ = hotkey_window_weak.upgrade_in_event_loop(|window| {
                            let _ = window.show();
                        });
                    }
                }
            }
        }
    });

    // Initialize subsystems
    let app_index = Rc::new(RefCell::new(AppIndex::new()));
    let everything_client = Rc::new(EverythingClient::new());

    // Populate initial default recommendations (Applications)
    {
        let initial_apps = app_index.borrow().search("");
        let mut initial_items = Vec::new();
        for (app, _) in initial_apps {
            initial_items.push(LauncherItem {
                id: app.name.clone().into(),
                title: app.name.clone().into(),
                subtitle: app.path.to_string_lossy().to_string().into(),
                category: "App".into(),
                is_app: true,
                is_folder: false,
                full_path: app.path.to_string_lossy().to_string().into(),
            });
        }
        app_window.set_results(ModelRc::new(VecModel::from(initial_items)));
    }

    // Query Changed Event (Search as you type)
    {
        let app_index = Rc::clone(&app_index);
        let everything_client = Rc::clone(&everything_client);
        let window_weak = window_handle.clone();

        app_window.on_query_changed(move |query| {
            let Some(window) = window_weak.upgrade() else { return };
            let query_trimmed = query.trim();

            let mut combined_results = Vec::new();

            // 1. First, search installed applications
            let app_matches = app_index.borrow().search(query_trimmed);
            for (app, _) in app_matches {
                combined_results.push(LauncherItem {
                    id: app.name.clone().into(),
                    title: app.name.clone().into(),
                    subtitle: app.path.to_string_lossy().to_string().into(),
                    category: "App".into(),
                    is_app: true,
                    is_folder: false,
                    full_path: app.path.to_string_lossy().to_string().into(),
                });
            }

            // 2. Second, search files via Everything IPC if query has >= 2 chars
            if query_trimmed.len() >= 2 {
                match everything_client.search(query_trimmed, 15) {
                    Ok(files) => {
                        for file in files {
                            let full = if file.path.ends_with('\\') {
                                format!("{}{}", file.path, file.name)
                            } else {
                                format!("{}\\{}", file.path, file.name)
                            };

                            combined_results.push(LauncherItem {
                                id: full.clone().into(),
                                title: file.name.into(),
                                subtitle: file.path.into(),
                                category: if file.is_folder { "Folder".into() } else { "File".into() },
                                is_app: false,
                                is_folder: file.is_folder,
                                full_path: full.into(),
                            });
                        }
                    }
                    Err(e) => {
                        window.set_status_text(format!("Search note: {}", e).into());
                    }
                }
            }

            let count = combined_results.len();
            window.set_results(ModelRc::new(VecModel::from(combined_results)));
            window.set_selected_index(0);
            window.set_status_text(format!("{} results found", count).into());
        });
    }

    // Item Executed (Enter pressed on selected item)
    {
        let window_weak = window_handle.clone();
        app_window.on_item_executed(move |item| {
            let path = item.full_path.as_str();
            let _ = Command::new("explorer").arg(path).spawn();
            if let Some(window) = window_weak.upgrade() {
                window.hide().unwrap();
            }
        });
    }

    // Close Window (Escape pressed)
    {
        let window_weak = window_handle.clone();
        app_window.on_close_window(move || {
            if let Some(window) = window_weak.upgrade() {
                window.hide().unwrap();
            }
        });
    }

    app_window.run()
}
