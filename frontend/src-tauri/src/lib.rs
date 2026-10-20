mod actions;
mod apps;
mod clipboard;
mod everything;
mod games;
mod icons;
mod plugins;
mod ports;
mod terminal_runner;
mod frecency;
mod updater;
mod windows_mgmt;

use apps::AppIndex;
use everything::{DriveIndexStats, EverythingClient};
use std::sync::LazyLock;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use windows::core::w;
use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HWND, WAIT_OBJECT_0};
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE,
    DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ,
};
use windows::Win32::System::Threading::{
    CreateEventW, CreateMutexW, GetCurrentThreadId, OpenEventW, SetEvent, WaitForSingleObject,
    EVENT_MODIFY_STATE, INFINITE,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, VK_SPACE,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, GetForegroundWindow, GetMessageW, GetWindowThreadProcessId,
    PeekMessageW, SetForegroundWindow, ShowWindow, MSG, PM_NOREMOVE, SW_RESTORE, SW_SHOWNORMAL,
    WM_HOTKEY,
};

#[link(name = "user32")]
extern "system" {
    fn AttachThreadInput(
        idattach: u32,
        idattachto: u32,
        fattach: windows::Win32::Foundation::BOOL,
    ) -> windows::Win32::Foundation::BOOL;
}

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn apply_native_glass(hwnd: HWND) {
    unsafe {
        let dark_mode = 1i32;
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );

        let round = DWMWCP_ROUND.0 as i32;
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &round as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }
}

pub fn force_foreground_window(hwnd: HWND) {
    unsafe {
        let fg_hwnd = GetForegroundWindow();
        let fg_thread = GetWindowThreadProcessId(fg_hwnd, None);
        let cur_thread = GetCurrentThreadId();

        if fg_thread != 0 && fg_thread != cur_thread {
            let _ = AttachThreadInput(cur_thread, fg_thread, windows::Win32::Foundation::BOOL(1));
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
            let _ = AttachThreadInput(cur_thread, fg_thread, windows::Win32::Foundation::BOOL(0));
        } else {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchItem {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub category: String,
    pub icon_type: String,
    pub icon_data: Option<String>,
    pub path: String,
    pub size: Option<String>,
    pub updated: Option<String>,
}

static APP_INDEX: LazyLock<Mutex<AppIndex>> = LazyLock::new(|| Mutex::new(AppIndex::new()));
static EVERYTHING_CLIENT: LazyLock<EverythingClient> = LazyLock::new(|| EverythingClient::new());

#[tauri::command]
fn search(query: String) -> Vec<SearchItem> {
    let mut results = Vec::new();
    let query_trimmed = query.trim();

    // 1. Search installed applications
    if let Ok(index) = APP_INDEX.lock() {
        let app_matches = index.search(query_trimmed);
        for (app, _) in app_matches.into_iter().take(15) {
            let path_str = app.path.to_string_lossy().to_string();
            let icon_data = icons::get_app_icon_base64(&path_str);
            results.push(SearchItem {
                id: format!("app-{}", app.name),
                title: app.name,
                subtitle: path_str.clone(),
                category: "Application".into(),
                icon_type: "app".into(),
                icon_data,
                path: path_str,
                size: None,
                updated: None,
            });
        }
    }

    // 2. Search files via Everything IPC with fallback if query has >= 2 characters
    if query_trimmed.len() >= 2 {
        if let Ok(files) = EVERYTHING_CLIENT.search(query_trimmed, 20) {
            for file in files {
                let full = if file.path.ends_with('\\') {
                    format!("{}{}", file.path, file.name)
                } else {
                    format!("{}\\{}", file.path, file.name)
                };

                let category = if file.is_folder { "Folder".into() } else { "File".into() };
                let icon_type = if file.is_folder { "folder".into() } else { "file".into() };
                let is_app_binary = file.name.ends_with(".exe") || file.name.ends_with(".lnk");
                let icon_data = if is_app_binary {
                    icons::get_app_icon_base64(&full)
                } else {
                    None
                };

                results.push(SearchItem {
                    id: format!("file-{}", full),
                    title: file.name,
                    subtitle: file.path,
                    category,
                    icon_type,
                    icon_data,
                    path: full,
                    size: None,
                    updated: None,
                });
            }
        }
    }

    results
}

#[tauri::command]
fn get_drive_settings() -> DriveIndexStats {
    EVERYTHING_CLIENT.get_stats()
}

#[tauri::command]
fn set_search_all_drives(enabled: bool) -> DriveIndexStats {
    EVERYTHING_CLIENT.set_search_all_drives(enabled);
    EVERYTHING_CLIENT.get_stats()
}

#[tauri::command]
fn rescan_drives() -> DriveIndexStats {
    EVERYTHING_CLIENT.trigger_reindex();
    EVERYTHING_CLIENT.get_stats()
}

#[tauri::command]
fn get_suggested_projects() -> Vec<SearchItem> {
    let folders = EVERYTHING_CLIENT.get_top_folders(8);
    let mut results = Vec::new();
    for f in folders {
        let full = if f.path.ends_with('\\') {
            format!("{}{}", f.path, f.name)
        } else {
            format!("{}\\{}", f.path, f.name)
        };
        let icon_data = icons::get_app_icon_base64(&full);
        results.push(SearchItem {
            id: format!("project-{}", full),
            title: f.name,
            subtitle: f.path,
            category: "Folder".into(),
            icon_type: "folder".into(),
            icon_data,
            path: full,
            size: None,
            updated: None,
        });
    }
    results
}

#[tauri::command]
fn launch_item(path: String) -> Result<(), String> {
    let wide_path: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let res = ShellExecuteW(
            HWND::default(),
            w!("open"),
            windows::core::PCWSTR(wide_path.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
        );
        if res.0 as usize <= 32 {
            let _ = Command::new("explorer")
                .arg(&path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
fn open_parent_folder(path: String) -> Result<(), String> {
    Command::new("explorer")
        .arg(format!("/select,{}", path))
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn run_as_admin(path: String) -> Result<(), String> {
    actions::run_as_admin(&path)
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    actions::reveal_in_explorer(&path)
}

#[tauri::command]
fn open_in_terminal(path: String) -> Result<(), String> {
    actions::open_in_terminal(&path)
}

#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    actions::open_in_vscode(&path)
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    clipboard::set_system_clipboard_text(&text)
}

// Port Killer commands
#[tauri::command]
fn get_listening_ports() -> Vec<ports::PortProcess> {
    ports::get_listening_ports()
}

#[tauri::command]
fn kill_port_process(pid: u32) -> Result<(), String> {
    ports::kill_pid(pid)
}

// Clipboard History commands
#[tauri::command]
fn get_clipboard_history() -> Vec<clipboard::ClipboardItem> {
    clipboard::CLIPBOARD_MANAGER.get_history()
}

#[tauri::command]
fn copy_clipboard_item(content: String) -> Result<(), String> {
    clipboard::set_system_clipboard_text(&content)
}

#[tauri::command]
fn clear_clipboard_history() -> Result<(), String> {
    clipboard::CLIPBOARD_MANAGER.clear();
    Ok(())
}

// Window visibility commands
#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    if let Ok(hwnd) = window.hwnd() {
        windows_mgmt::record_previous_foreground(HWND(hwnd.0 as _));
    }
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn snap_window(window: tauri::WebviewWindow, position: String) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    windows_mgmt::snap_active_window(HWND(hwnd.0 as _), &position)
}

#[tauri::command]
fn execute_shell_command(command: String) -> Result<terminal_runner::ShellExecutionResult, String> {
    terminal_runner::execute_shell_command(&command)
}

#[tauri::command]
fn launch_in_terminal_window(command: String) -> Result<(), String> {
    terminal_runner::launch_in_terminal_window(&command)
}

// Autostart management via direct Win32 Registry APIs (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)
// Pure in-memory kernel syscall - ZERO console windows or external reg.exe processes spawned!
#[tauri::command]
fn get_autostart_status() -> bool {
    unsafe {
        let subkey = w!(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let value_name = w!("RaycastWindows");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_READ, &mut hkey).is_ok() {
            let mut data_len = 0u32;
            let res = RegQueryValueExW(
                hkey,
                value_name,
                None,
                None,
                None,
                Some(&mut data_len),
            );
            let _ = RegCloseKey(hkey);
            res.is_ok()
        } else {
            false
        }
    }
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<(), String> {
    unsafe {
        let subkey = w!(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let value_name = w!("RaycastWindows");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if enable {
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_path = format!("\"{}\"", current_exe.to_string_lossy());
            let wide_exe: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();

            RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_WRITE, &mut hkey)
                .ok()
                .map_err(|e| e.to_string())?;

            let res = RegSetValueExW(
                hkey,
                value_name,
                0,
                REG_SZ,
                Some(std::slice::from_raw_parts(
                    wide_exe.as_ptr() as *const u8,
                    wide_exe.len() * 2,
                )),
            );
            let _ = RegCloseKey(hkey);
            res.ok().map_err(|e| e.to_string())
        } else {
            if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_WRITE, &mut hkey).is_ok() {
                let _ = RegDeleteValueW(hkey, value_name);
                let _ = RegCloseKey(hkey);
            }
            Ok(())
        }
    }
}

#[tauri::command]
fn execute_system_command(command: String) -> Result<(), String> {
    match command.as_str() {
        "lock" => {
            Command::new("rundll32")
                .args(["user32.dll,LockWorkStation"])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        "empty_bin" => {
            Command::new("powershell")
                .args(["-WindowStyle", "Hidden", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        _ => Err("Unknown command".into()),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePreview {
    pub is_text: bool,
    pub content: Option<String>,
    pub extension: String,
    pub size_bytes: u64,
}

#[tauri::command]
fn read_file_preview(path: String) -> Result<FilePreview, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let size_bytes = metadata.len();
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let text_exts = [
        "txt", "md", "json", "rs", "ts", "tsx", "js", "jsx", "html", "css", "py", "toml",
        "yaml", "yml", "ini", "log", "env", "sh", "bat", "ps1", "sql", "c", "cpp", "h",
    ];

    if text_exts.contains(&ext.as_str()) {
        use std::io::Read;
        let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        let mut take = file.take(64 * 1024); // max 64KB for instant preview
        take.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        let content = String::from_utf8_lossy(&buffer).to_string();
        Ok(FilePreview {
            is_text: true,
            content: Some(content),
            extension: ext,
            size_bytes,
        })
    } else {
        Ok(FilePreview {
            is_text: false,
            content: None,
            extension: ext,
            size_bytes,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitInfo {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub modified_count: usize,
    pub untracked_count: usize,
    pub last_commit_message: Option<String>,
}

#[tauri::command]
fn get_git_info(path: String) -> GitInfo {
    let p = std::path::Path::new(&path);
    let dir = if p.is_dir() { p } else { p.parent().unwrap_or(p) };

    let branch_out = Command::new("git")
        .args(["-C", &dir.to_string_lossy(), "branch", "--show-current"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(b_out) = branch_out {
        if b_out.status.success() {
            let branch = String::from_utf8_lossy(&b_out.stdout).trim().to_string();
            let status_out = Command::new("git")
                .args(["-C", &dir.to_string_lossy(), "status", "--porcelain"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            let (modified_count, untracked_count) = if let Ok(s_out) = status_out {
                let text = String::from_utf8_lossy(&s_out.stdout);
                let mut mod_c = 0;
                let mut unt_c = 0;
                for line in text.lines() {
                    if line.starts_with("??") {
                        unt_c += 1;
                    } else {
                        mod_c += 1;
                    }
                }
                (mod_c, unt_c)
            } else {
                (0, 0)
            };

            let log_out = Command::new("git")
                .args(["-C", &dir.to_string_lossy(), "log", "-1", "--format=%s (%cr)"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            let last_commit_message = if let Ok(l_out) = log_out {
                let msg = String::from_utf8_lossy(&l_out.stdout).trim().to_string();
                if !msg.is_empty() {
                    Some(msg)
                } else {
                    None
                }
            } else {
                None
            };

            return GitInfo {
                is_repo: true,
                branch: Some(branch),
                modified_count,
                untracked_count,
                last_commit_message,
            };
        }
    }

    GitInfo {
        is_repo: false,
        branch: None,
        modified_count: 0,
        untracked_count: 0,
        last_commit_message: None,
    }
}

#[tauri::command]
fn kill_all_dev_servers() -> Result<usize, String> {
    let dev_ports = [3000, 3001, 5173, 5174, 8080, 8000, 4000, 4200, 8888, 9000, 1420];
    let active = ports::get_listening_ports();
    let mut killed = 0;
    let mut killed_pids = std::collections::HashSet::new();

    for item in active {
        if dev_ports.contains(&item.port) {
            if !killed_pids.contains(&item.pid) {
                if ports::kill_pid(item.pid).is_ok() {
                    killed_pids.insert(item.pid);
                    killed += 1;
                }
            }
        }
    }
    Ok(killed)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let wide_url: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let res = ShellExecuteW(
            HWND::default(),
            w!("open"),
            windows::core::PCWSTR(wide_url.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
        );
        if res.0 as usize <= 32 {
            let _ = Command::new("cmd")
                .args(["/c", "start", "", &url])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
fn open_settings_uri(uri: String) -> Result<(), String> {
    let wide_uri: Vec<u16> = uri.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let res = ShellExecuteW(
            HWND::default(),
            w!("open"),
            windows::core::PCWSTR(wide_uri.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
        );
        if res.0 as usize <= 32 {
            let _ = Command::new("cmd")
                .args(["/c", "start", "", &uri])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_installed_games() -> Vec<games::GameItem> {
    games::scan_all_installed_games()
}

#[tauri::command]
fn launch_game(launch_uri: String) -> Result<(), String> {
    games::launch_game(&launch_uri)
}

#[tauri::command]
fn get_game_mode_status() -> games::GameModeStatus {
    games::get_game_mode_status()
}

fn start_global_hotkey_listener(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        unsafe {
            // Force Windows to allocate a message queue for this worker thread before registering hotkeys
            let mut msg = MSG::default();
            let _ = PeekMessageW(&mut msg, HWND::default(), 0, 0, PM_NOREMOVE);

            // Register hotkeys with MOD_NOREPEAT to prevent stutter:
            // ID 1: Alt + Space (Default Raycast shortcut)
            let _ = RegisterHotKey(HWND::default(), 1, MOD_ALT | MOD_NOREPEAT, VK_SPACE.0 as u32);
            // ID 2: Ctrl + Space (Conflict-free instant shortcut, never blocked by PowerToys)
            let _ = RegisterHotKey(HWND::default(), 2, MOD_CONTROL | MOD_NOREPEAT, VK_SPACE.0 as u32);
            // ID 3: Alt + Shift + Space (Fallback power-user shortcut)
            let _ = RegisterHotKey(HWND::default(), 3, MOD_ALT | MOD_SHIFT | MOD_NOREPEAT, VK_SPACE.0 as u32);

            while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                if msg.message == WM_HOTKEY && (msg.wParam.0 >= 1 && msg.wParam.0 <= 3) {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        let is_focused = window.is_focused().unwrap_or(false);
                        if is_visible && is_focused {
                            let _ = window.hide();
                        } else {
                            if let Ok(hwnd) = window.hwnd() {
                                windows_mgmt::record_previous_foreground(HWND(hwnd.0 as _));
                            }
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                            let _ = window.emit("window-summoned", ());
                        }
                    }
                }
            }
        }
    });
}

#[tauri::command]
fn list_plugins() -> Vec<plugins::PluginItem> {
    plugins::scan_plugins()
}

#[tauri::command]
fn run_plugin(script_path: String, args: String) -> Result<String, String> {
    plugins::run_plugin_script(&script_path, &args)
}

#[tauri::command]
fn install_plugin(
    plugin_id: String,
    manifest_json: String,
    script_content: String,
    script_filename: String,
) -> Result<(), String> {
    plugins::install_plugin(&plugin_id, &manifest_json, &script_content, &script_filename)
}

#[tauri::command]
fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    plugins::uninstall_plugin(&plugin_id)
}

#[tauri::command]
fn check_app_update() -> Result<updater::UpdateInfo, String> {
    updater::check_for_update()
}

#[tauri::command]
fn trigger_app_update() -> Result<String, String> {
    updater::apply_update()
}

#[tauri::command]
fn record_frecency_usage(
    db: tauri::State<'_, frecency::FrecencyDb>,
    item_id: String,
) -> Result<(), String> {
    db.record(&item_id)
}

#[tauri::command]
fn get_frecency_scores(
    db: tauri::State<'_, frecency::FrecencyDb>,
) -> Result<Vec<frecency::FrecencyEntry>, String> {
    db.get_scores()
}

#[tauri::command]
fn import_legacy_frecency(
    db: tauri::State<'_, frecency::FrecencyDb>,
    data: Vec<(String, f64)>,
) -> Result<(), String> {
    db.import_legacy(&data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Single-Instance Named Event Guard:
    // If AltSpace is already running in background, signal it to pop up and exit second instance in <10ms!
    unsafe {
        let _mutex = CreateMutexW(None, true, w!("AltSpace_SingleInstance_Mutex_2026"));
        if GetLastError() == ERROR_ALREADY_EXISTS {
            if let Ok(event) = OpenEventW(EVENT_MODIFY_STATE, false, w!("AltSpace_Summon_Event_2026")) {
                let _ = SetEvent(event);
                let _ = CloseHandle(event);
            }
            return;
        }
    }


    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            search,
            launch_item,
            open_parent_folder,
            open_url,
            get_listening_ports,
            kill_port_process,
            get_clipboard_history,
            copy_clipboard_item,
            clear_clipboard_history,
            hide_window,
            show_window,
            get_autostart_status,
            set_autostart,
            execute_system_command,
            read_file_preview,
            get_git_info,
            kill_all_dev_servers,
            get_drive_settings,
            set_search_all_drives,
            rescan_drives,
            get_suggested_projects,
            open_settings_uri,
            run_as_admin,
            reveal_in_explorer,
            open_in_terminal,
            open_in_vscode,
            copy_to_clipboard,
            snap_window,
            execute_shell_command,
            launch_in_terminal_window,
            get_installed_games,
            launch_game,
            get_game_mode_status,
            list_plugins,
            run_plugin,
            install_plugin,
            uninstall_plugin,
            check_app_update,
            trigger_app_update,
            record_frecency_usage,
            get_frecency_scores,
            import_legacy_frecency
        ])
        .setup(|app| {
            let app_data_dir = std::env::var("LOCALAPPDATA")
                .map(|p| std::path::PathBuf::from(p).join("AltSpace"))
                .unwrap_or_else(|_| {
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                        .unwrap_or_else(|| std::path::PathBuf::from("."))
                });
            let _ = std::fs::create_dir_all(&app_data_dir);
            let frecency_db = frecency::FrecencyDb::open(&app_data_dir)
                .expect("Failed to open frecency DB");
            app.manage(frecency_db);
            // Start background Single-Instance Named Event summoner thread
            let app_handle_for_summon = app.handle().clone();
            std::thread::spawn(move || {
                let summon_event = unsafe {
                    CreateEventW(None, false, false, w!("AltSpace_Summon_Event_2026"))
                        .expect("Failed to create AltSpace summon event")
                };
                loop {
                    let res = unsafe { WaitForSingleObject(summon_event, INFINITE) };
                    if res == WAIT_OBJECT_0 {
                        if let Some(window) = app_handle_for_summon.get_webview_window("main") {
                            if let Ok(hwnd) = window.hwnd() {
                                windows_mgmt::record_previous_foreground(HWND(hwnd.0 as _));
                            }
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                            let _ = window.emit("window-summoned", ());
                        }
                    }
                }
            });

            // Start background in-memory clipboard watcher
            clipboard::start_clipboard_monitor();

            // Start global Alt + Space and Ctrl + Space hotkey listener
            start_global_hotkey_listener(app.handle().clone());

            // Pre-warm top application icons into memory & icon_cache.json in the background
            std::thread::spawn(|| {
                if let Ok(index) = APP_INDEX.lock() {
                    for (app, _) in index.search("") {
                        let path_str = app.path.to_string_lossy().to_string();
                        let _ = icons::get_app_icon_base64(&path_str);
                    }
                }
            });

            // Build System Tray (AltSpace)
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

            let show_i = MenuItem::with_id(app, "show", "⚡ Show AltSpace (Alt+Space)", true, None::<&str>)?;
            let clipboard_i = MenuItem::with_id(app, "clipboard", "📋 Clipboard History", true, None::<&str>)?;
            let ports_i = MenuItem::with_id(app, "ports", "🔌 Dev Ports Inspector", true, None::<&str>)?;
            let games_i = MenuItem::with_id(app, "games", "🎮 Game Launcher", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let autostart_label = if get_autostart_status() {
                "✓ Launch on Windows Startup"
            } else {
                "Launch on Windows Startup"
            };
            let autostart_i = MenuItem::with_id(app, "autostart", autostart_label, true, None::<&str>)?;
            let updates_i = MenuItem::with_id(app, "updates", "🔄 Check for Updates", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let feedback_i = MenuItem::with_id(app, "feedback", "💬 Rate & Send Feedback", true, None::<&str>)?;
            let github_i = MenuItem::with_id(app, "github", "⭐ Star on GitHub", true, None::<&str>)?;
            let sep3 = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "❌ Exit AltSpace", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &show_i,
                    &clipboard_i,
                    &ports_i,
                    &games_i,
                    &sep1,
                    &autostart_i,
                    &updates_i,
                    &sep2,
                    &feedback_i,
                    &github_i,
                    &sep3,
                    &quit_i,
                ],
            )?;

            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

            let tray = TrayIconBuilder::with_id("altspace-tray")
                .icon(tray_icon)
                .tooltip("AltSpace — Instant Command Palette (Alt+Space)")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                        }
                    }
                    "clipboard" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                            let _ = window.emit("open-mode", "clipboard");
                        }
                    }
                    "ports" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                            let _ = window.emit("open-mode", "ports");
                        }
                    }
                    "games" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                            let _ = window.emit("open-mode", "games");
                        }
                    }
                    "autostart" => {
                        let current = get_autostart_status();
                        let _ = set_autostart(!current);
                    }
                    "updates" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("check-updates", ());
                        }
                    }
                    "feedback" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            if let Ok(hwnd) = window.hwnd() {
                                force_foreground_window(HWND(hwnd.0 as _));
                            }
                            let _ = window.emit("open-feedback", ());
                        }
                    }
                    "github" => {
                        let _ = open_url("https://github.com/codecheesee/altspace".to_string());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(vis) = window.is_visible() {
                                if vis {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    if let Ok(hwnd) = window.hwnd() {
                                        force_foreground_window(HWND(hwnd.0 as _));
                                    }
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            app.manage(tray);

            // Prevent window close from exiting app; hide to tray instead
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 800.0, height: 520.0 }));
                let _ = window.center();

                if let Ok(hwnd) = window.hwnd() {
                    apply_native_glass(HWND(hwnd.0 as _));
                }

                let w_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w_clone.hide();
                    }
                });

                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                if let Ok(hwnd) = window.hwnd() {
                    force_foreground_window(HWND(hwnd.0 as _));
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
