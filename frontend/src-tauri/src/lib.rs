mod actions;
mod apps;
pub mod broker;
pub mod byok;
mod clipboard;
pub mod crypto_vault;
pub mod docker_wsl;
mod everything;
mod frecency;
mod games;
pub mod github_auth;
mod icons;
pub mod license_verifier;
mod plugins;
mod ports;
mod terminal_runner;
mod updater;
mod windows_mgmt;

use apps::AppIndex;
use everything::{DriveIndexStats, EverythingClient};
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::LazyLock;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{Emitter, Manager};
use windows::core::w;
use windows::Win32::Foundation::{
    CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HWND, WAIT_OBJECT_0,
};
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE,
    DWMWCP_ROUND,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ,
};
use windows::Win32::System::Threading::{
    CreateEventW, CreateMutexW, GetCurrentThreadId, OpenEventW, OpenProcess, SetEvent, TerminateProcess,
    WaitForSingleObject, EVENT_MODIFY_STATE, INFINITE, PROCESS_TERMINATE,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, RegisterHotKey, KEYEVENTF_KEYUP, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT,
    VK_MENU, VK_SPACE,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    AllowSetForegroundWindow, BringWindowToTop, EnumWindows, GetForegroundWindow, GetMessageW,
    GetWindowTextW, GetWindowThreadProcessId, IsHungAppWindow, IsWindow, PeekMessageW,
    SetForegroundWindow, SetWindowPos, ShowWindow, HWND_TOPMOST, MSG, PM_NOREMOVE, SWP_NOMOVE,
    SWP_NOSIZE, SWP_SHOWWINDOW, SW_RESTORE, SW_SHOW, SW_SHOWNORMAL, WM_HOTKEY,
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

struct ExitState(AtomicBool);

fn apply_native_glass(hwnd: HWND) {
    unsafe {
        let dark_mode = 1i32;
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );

        let round = DWMWCP_ROUND.0;
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
        let target_thread = GetWindowThreadProcessId(hwnd, None);
        let current_thread = GetCurrentThreadId();

        // 1. Explicitly allow foreground activation from any process
        let _ = AllowSetForegroundWindow(0xFFFFFFFF);

        // 2. Attach input queues if threads differ to bypass Windows foreground lock
        let mut attached_current = false;
        let mut attached_target = false;
        if fg_thread != 0 {
            if current_thread != 0 && current_thread != fg_thread {
                attached_current = AttachThreadInput(
                    current_thread,
                    fg_thread,
                    windows::Win32::Foundation::BOOL(1),
                )
                .as_bool();
            }
            if target_thread != 0 && target_thread != fg_thread && target_thread != current_thread {
                attached_target = AttachThreadInput(
                    target_thread,
                    fg_thread,
                    windows::Win32::Foundation::BOOL(1),
                )
                .as_bool();
            }
        }

        // 3. Synthesize an Alt key pulse to trick Windows into granting foreground-setting rights
        keybd_event(VK_MENU.0 as u8, 0, Default::default(), 0);
        keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);

        // 4. Force Show, Restore, Topmost, and Foreground
        let _ = ShowWindow(hwnd, SW_SHOW);
        let _ = ShowWindow(hwnd, SW_RESTORE);

        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
        );

        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);

        // 5. Detach input queues
        if attached_current {
            let _ = AttachThreadInput(
                current_thread,
                fg_thread,
                windows::Win32::Foundation::BOOL(0),
            );
        }
        if attached_target {
            let _ = AttachThreadInput(
                target_thread,
                fg_thread,
                windows::Win32::Foundation::BOOL(0),
            );
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

static LAST_SHOWN: LazyLock<Mutex<std::time::Instant>> =
    LazyLock::new(|| Mutex::new(std::time::Instant::now()));
static HAS_GAINED_FOCUS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn mark_window_shown() {
    if let Ok(mut lock) = LAST_SHOWN.lock() {
        *lock = std::time::Instant::now();
    }
    HAS_GAINED_FOCUS.store(false, Ordering::SeqCst);
}

static APP_INDEX: LazyLock<Mutex<AppIndex>> = LazyLock::new(|| Mutex::new(AppIndex::new()));
static EVERYTHING_CLIENT: LazyLock<EverythingClient> = LazyLock::new(EverythingClient::new);

static FEATURE_FLAGS: LazyLock<Mutex<std::collections::HashMap<String, bool>>> =
    LazyLock::new(|| {
        let mut map = std::collections::HashMap::new();
        map.insert("ports_advanced".into(), true);
        map.insert("developer_transforms".into(), true);
        map.insert("secret_vault".into(), true);
        map.insert("docker_wsl".into(), true);
        map.insert("local_copilot".into(), true);
        Mutex::new(map)
    });

pub fn is_feature_enabled(id: &str) -> bool {
    if let Ok(guard) = FEATURE_FLAGS.lock() {
        *guard.get(id).unwrap_or(&true)
    } else {
        true
    }
}

#[tauri::command]
fn set_feature_flags(flags: std::collections::HashMap<String, bool>) -> Result<(), String> {
    if let Ok(mut guard) = FEATURE_FLAGS.lock() {
        for (k, v) in flags {
            guard.insert(k, v);
        }
    }
    Ok(())
}

#[tauri::command]
fn get_feature_flags() -> std::collections::HashMap<String, bool> {
    if let Ok(guard) = FEATURE_FLAGS.lock() {
        guard.clone()
    } else {
        std::collections::HashMap::new()
    }
}

#[tauri::command]
fn search(query: String) -> Vec<SearchItem> {
    let mut scored_results: Vec<(SearchItem, i64)> = Vec::new();
    let query_trimmed = query.trim();
    let q_lower = query_trimmed.to_lowercase();

    // Context-Aware Hybrid Intent:
    // If the query contains file path separators (/ or \), or an explicit file extension (e.g. .ps1, .rs, .json),
    // or file: prefix, the user is explicitly searching for files.
    // Otherwise, default application prioritization is enforced.
    let has_file_intent = {
        let has_path_separator = q_lower.contains('/') || q_lower.contains('\\');
        let has_extension = if let Some(dot_idx) = q_lower.rfind('.') {
            let ext = &q_lower[dot_idx + 1..];
            !ext.is_empty() && ext.len() <= 6 && ext.chars().all(|c| c.is_alphanumeric())
        } else {
            false
        };
        has_path_separator || has_extension || q_lower.starts_with("file:") || q_lower.starts_with("f:")
    };

    // 1. Search installed applications
    if let Ok(index) = APP_INDEX.lock() {
        let app_matches = index.search(query_trimmed);
        for (app, mut score) in app_matches {
            let path_str = app.path.to_string_lossy().to_string();
            let icon_data = icons::get_app_icon_base64(&path_str);

            // In explicit file-intent mode, reduce app score so matching files take precedence
            if has_file_intent {
                score = (score / 4).max(1000);
            }

            scored_results.push((
                SearchItem {
                    id: format!("app-{}", app.name),
                    title: app.name,
                    subtitle: path_str.clone(),
                    category: "Application".into(),
                    icon_type: "app".into(),
                    icon_data,
                    path: path_str,
                    size: None,
                    updated: None,
                },
                score,
            ));
        }
    }

    // 2. Search files via Everything IPC with fallback if query has >= 2 characters
    if query_trimmed.len() >= 2 {
        if let Ok(files) = EVERYTHING_CLIENT.search(query_trimmed, 40) {
            for file in files {
                // Skip known least-used noise extensions unless explicitly searched in query
                if !file.is_folder {
                    let ext = file.name.rsplit('.').next().unwrap_or("").to_lowercase();
                    let is_noise_ext = matches!(
                        ext.as_str(),
                        "ini"
                            | "sys"
                            | "dll"
                            | "drv"
                            | "inf"
                            | "cat"
                            | "cur"
                            | "ani"
                            | "tmp"
                            | "temp"
                            | "bak"
                            | "backup"
                            | "old"
                            | "log"
                            | "cache"
                            | "dmp"
                            | "chk"
                            | "part"
                            | "crdownload"
                            | "swp"
                            | "pdb"
                            | "obj"
                            | "lib"
                            | "exp"
                            | "ilk"
                            | "idb"
                            | "pyc"
                            | "class"
                            | "ink"
                    );
                    let query_mentions_ext =
                        q_lower.contains(&format!(".{}", ext)) || q_lower.ends_with(&ext);
                    if is_noise_ext && !query_mentions_ext {
                        continue;
                    }
                }

                let full = if file.path.ends_with('\\') {
                    format!("{}{}", file.path, file.name)
                } else {
                    format!("{}\\{}", file.path, file.name)
                };

                let category = if file.is_folder {
                    "Folder".into()
                } else {
                    "File".into()
                };
                let icon_type = if file.is_folder {
                    "folder".into()
                } else {
                    "file".into()
                };
                let is_app_binary = file.name.ends_with(".exe") || file.name.ends_with(".lnk");
                let icon_data = if is_app_binary {
                    icons::get_app_icon_base64(&full)
                } else {
                    None
                };

                // Score files/folders dynamically based on intent
                let name_lower = file.name.to_lowercase();
                let file_score = if has_file_intent {
                    // Explicit File Intent Mode: Files outrank general apps
                    if name_lower == q_lower {
                        60000
                    } else if name_lower.starts_with(&q_lower) {
                        50000 + (100 - name_lower.len().min(100) as i64)
                    } else if name_lower
                        .split(|c: char| !c.is_alphanumeric())
                        .any(|w| w.starts_with(&q_lower))
                    {
                        40000 + (100 - name_lower.len().min(100) as i64)
                    } else if name_lower.contains(&q_lower) {
                        30000 + (100 - name_lower.len().min(100) as i64)
                    } else {
                        5000
                    }
                } else {
                    // Default Mode: Installed applications take top priority;
                    // Files and folders stay in secondary tier below applications
                    if name_lower == q_lower {
                        8000
                    } else if name_lower.starts_with(&q_lower) {
                        5000 + (100 - name_lower.len().min(100) as i64)
                    } else if name_lower
                        .split(|c: char| !c.is_alphanumeric())
                        .any(|w| w.starts_with(&q_lower))
                    {
                        3000 + (100 - name_lower.len().min(100) as i64)
                    } else if name_lower.contains(&q_lower) {
                        1000 + (100 - name_lower.len().min(100) as i64)
                    } else {
                        200
                    }
                };

                scored_results.push((
                    SearchItem {
                        id: format!("file-{}", full),
                        title: file.name,
                        subtitle: file.path,
                        category,
                        icon_type,
                        icon_data,
                        path: full,
                        size: None,
                        updated: None,
                    },
                    file_score,
                ));
            }
        }
    }

    // Sort all candidates globally by relevance score descending
    scored_results.sort_by_key(|a| std::cmp::Reverse(a.1));
    scored_results
        .into_iter()
        .map(|(item, _)| item)
        .take(25)
        .collect()
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
fn launch_item(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    let _ = window.hide();
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
fn open_parent_folder(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    let _ = window.hide();
    actions::open_folder_or_reveal(&path)
}

#[tauri::command]
fn run_as_admin(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    let _ = window.hide();
    actions::run_as_admin(&path)
}

#[tauri::command]
fn reveal_in_explorer(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    let _ = window.hide();
    actions::reveal_in_explorer(&path)
}

#[tauri::command]
fn open_in_terminal(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    let _ = window.hide();
    actions::open_in_terminal(&path)
}

#[tauri::command]
fn open_in_vscode(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    let _ = window.hide();
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

#[tauri::command]
fn get_port_process_forensics(port: u16, pid: u32) -> Result<ports::PortProcessForensics, String> {
    if !is_feature_enabled("ports_advanced") {
        return Err("Intelligent Port Forensics is disabled in Settings".into());
    }
    ports::get_port_process_forensics(port, pid)
}

#[tauri::command]
fn kill_and_verify_port(port: u16, pid: u32) -> Result<ports::KillVerifyResult, String> {
    if !is_feature_enabled("ports_advanced") {
        ports::kill_pid(pid)?;
        return Ok(ports::KillVerifyResult {
            success: true,
            port,
            pid,
            verified_free: true,
            elapsed_ms: 0,
            message: format!("Port :{} killed (basic)", port),
        });
    }
    ports::kill_and_verify_port(port, pid)
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
    let _ = window.unminimize();
    let _ = window.set_focus();
    if let Ok(hwnd) = window.hwnd() {
        force_foreground_window(HWND(hwnd.0 as _));
    }
    Ok(())
}

#[tauri::command]
fn focus_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    if let Ok(hwnd) = window.hwnd() {
        force_foreground_window(HWND(hwnd.0 as _));
    }
    Ok(())
}

#[tauri::command]
fn snap_window(window: tauri::WebviewWindow, position: String) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    windows_mgmt::snap_active_window(HWND(hwnd.0 as _), &position)
}

#[tauri::command]
fn execute_shell_command(command: String) -> Result<terminal_runner::ShellExecutionResult, String> {
    let res = terminal_runner::execute_shell_command(&command);
    if let Ok(ref result) = res {
        if !result.success || result.exit_code != 0 {
            broker::record_failure_event(broker::FailureEvent {
                id: format!(
                    "term_{}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis()
                ),
                source: "terminal".into(),
                command_or_target: command.clone(),
                exit_code: Some(result.exit_code),
                error_message: if !result.stderr.is_empty() {
                    result.stderr.clone()
                } else {
                    format!("Exited with code {}", result.exit_code)
                },
                stdout_excerpt: if !result.stdout.is_empty() {
                    Some(result.stdout.chars().take(500).collect())
                } else {
                    None
                },
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            });
        }
    }
    res
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
            let res = RegQueryValueExW(hkey, value_name, None, None, None, Some(&mut data_len));
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
                .args([
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    "Clear-RecycleBin -Force -ErrorAction SilentlyContinue",
                ])
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
        "txt", "md", "json", "rs", "ts", "tsx", "js", "jsx", "html", "css", "py", "toml", "yaml",
        "yml", "ini", "log", "env", "sh", "bat", "ps1", "sql", "c", "cpp", "h",
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
    let dir = if p.is_dir() {
        p
    } else {
        p.parent().unwrap_or(p)
    };

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
                .args([
                    "-C",
                    &dir.to_string_lossy(),
                    "log",
                    "-1",
                    "--format=%s (%cr)",
                ])
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
    let dev_ports = [
        3000, 3001, 5173, 5174, 8080, 8000, 4000, 4200, 8888, 9000, 1420,
    ];
    let active = ports::get_listening_ports();
    let mut killed = 0;
    let mut killed_pids = std::collections::HashSet::new();

    for item in active {
        if dev_ports.contains(&item.port)
            && !killed_pids.contains(&item.pid)
            && ports::kill_pid(item.pid).is_ok()
        {
            killed_pids.insert(item.pid);
            killed += 1;
        }
    }
    Ok(killed)
}

/// Strictly validates URLs for opening via the system default browser.
///
/// Permits:
/// - Any valid HTTPS URL
/// - HTTP only if the host is explicitly loopback (localhost, 127.0.0.1, [::1])
///
/// Rejects:
/// - Insecure remote HTTP URLs
/// - File URLs (file://)
/// - Dangerous URI schemes (javascript:, data:, ms-appinstaller:, cmd:, powershell:, smb:, etc.)
/// - Embedded credentials (user:pass@host)
/// - Control characters (\0, \r, \n)
pub fn validate_url_for_opening(raw_url: &str) -> Result<url::Url, String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return Err("URL cannot be empty".into());
    }

    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err("URL contains invalid control characters".into());
    }

    let parsed = url::Url::parse(trimmed).map_err(|e| format!("Invalid URL format: {}", e))?;

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("URLs with user credentials are not permitted".into());
    }

    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" => {
            let is_loopback = match parsed.host() {
                Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
                Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
                Some(url::Host::Domain(d)) => d.eq_ignore_ascii_case("localhost"),
                None => false,
            };
            if is_loopback {
                Ok(parsed)
            } else {
                Err(
                    "Insecure HTTP is restricted to localhost/loopback addresses. Use HTTPS."
                        .into(),
                )
            }
        }
        other => Err(format!(
            "URL scheme '{}' is blocked. Only HTTPS and localhost HTTP are allowed.",
            other
        )),
    }
}

/// Strictly validates Windows Settings URIs (ms-settings:*).
///
/// Permits:
/// - Safe ms-settings: URIs containing alphanumeric and dash/dot/query characters.
///
/// Rejects:
/// - Non ms-settings schemes
/// - Control characters, whitespace, quotes, slashes, or injection characters
pub fn validate_settings_uri_for_opening(raw_uri: &str) -> Result<String, String> {
    let trimmed = raw_uri.trim();
    if trimmed.is_empty() {
        return Err("Settings URI cannot be empty".into());
    }

    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err("URI contains invalid control characters".into());
    }

    if !trimmed.starts_with("ms-settings:") {
        return Err("Only 'ms-settings:' URIs are permitted".into());
    }

    let subpage = &trimmed["ms-settings:".len()..];
    for ch in subpage.chars() {
        if !ch.is_ascii_alphanumeric()
            && ch != '-'
            && ch != '_'
            && ch != '.'
            && ch != '?'
            && ch != '='
            && ch != '&'
        {
            return Err("Settings URI contains forbidden characters".into());
        }
    }

    let parsed = url::Url::parse(trimmed).map_err(|e| format!("Invalid settings URI: {}", e))?;
    if parsed.scheme() != "ms-settings" {
        return Err("URI scheme must be 'ms-settings'".into());
    }

    Ok(trimmed.to_string())
}

fn open_url_internal(url: &str) -> Result<(), String> {
    let parsed = validate_url_for_opening(url)?;
    let wide_url: Vec<u16> = parsed
        .as_str()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
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
            return Err(format!(
                "System failed to open URL (code {})",
                res.0 as usize
            ));
        }
    }
    Ok(())
}

#[tauri::command]
fn open_url(window: tauri::WebviewWindow, url: String) -> Result<(), String> {
    let _ = window.hide();
    open_url_internal(&url)
}

#[tauri::command]
fn open_settings_uri(window: tauri::WebviewWindow, uri: String) -> Result<(), String> {
    let _ = window.hide();
    let safe_uri = validate_settings_uri_for_opening(&uri)?;
    let wide_uri: Vec<u16> = safe_uri.encode_utf16().chain(std::iter::once(0)).collect();
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
            return Err(format!(
                "System failed to open Settings URI (code {})",
                res.0 as usize
            ));
        }
    }
    Ok(())
}

#[tauri::command]
fn get_installed_games() -> Vec<games::GameItem> {
    games::scan_all_installed_games()
}

#[tauri::command]
fn launch_game(window: tauri::WebviewWindow, launch_uri: String) -> Result<(), String> {
    let _ = window.hide();
    games::launch_game(&launch_uri)
}

#[tauri::command]
fn launch_game_advanced(
    window: tauri::WebviewWindow,
    launch_uri: String,
    boost: bool,
    record: bool,
) -> Result<(), String> {
    let _ = window.hide();
    games::launch_game_advanced(&launch_uri, boost, record)
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
            let _ = RegisterHotKey(
                HWND::default(),
                1,
                MOD_ALT | MOD_NOREPEAT,
                VK_SPACE.0 as u32,
            );
            // ID 2: Ctrl + Space (Conflict-free instant shortcut, never blocked by PowerToys)
            let _ = RegisterHotKey(
                HWND::default(),
                2,
                MOD_CONTROL | MOD_NOREPEAT,
                VK_SPACE.0 as u32,
            );
            // ID 3: Alt + Shift + Space (Fallback power-user shortcut)
            let _ = RegisterHotKey(
                HWND::default(),
                3,
                MOD_ALT | MOD_SHIFT | MOD_NOREPEAT,
                VK_SPACE.0 as u32,
            );

            while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                if msg.message == WM_HOTKEY && (msg.wParam.0 >= 1 && msg.wParam.0 <= 3) {
                    let handle = app_handle.clone();
                    let handle_inner = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        if let Some(window) = handle_inner.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_focused = window.is_focused().unwrap_or(false);
                            if is_visible && is_focused {
                                let _ = window.hide();
                            } else {
                                if let Ok(hwnd) = window.hwnd() {
                                    windows_mgmt::record_previous_foreground(HWND(hwnd.0 as _));
                                    force_foreground_window(HWND(hwnd.0 as _));
                                }
                                mark_window_shown();
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit("window-summoned", ());
                            }
                        }
                    });
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
    plugins::install_plugin(
        &plugin_id,
        &manifest_json,
        &script_content,
        &script_filename,
    )
}

#[tauri::command]
fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    plugins::uninstall_plugin(&plugin_id)
}

#[tauri::command]
fn get_plugin_health(plugin_id: String) -> plugins::PluginHealthStatus {
    plugins::get_plugin_health(&plugin_id)
}

#[tauri::command]
fn reset_plugin_health(plugin_id: String) {
    plugins::reset_plugin_health(&plugin_id);
}

#[tauri::command]
fn get_safe_mode_status() -> bool {
    plugins::is_safe_mode()
}

#[tauri::command]
fn check_app_update() -> Result<updater::UpdateInfo, String> {
    updater::check_for_update()
}

#[tauri::command]
fn trigger_app_update(
    app: tauri::AppHandle,
    download_url: Option<String>,
    expected_sha256: Option<String>,
) -> Result<String, String> {
    let res = updater::install_update(download_url, expected_sha256)?;
    let exe = std::env::current_exe().unwrap_or_default();
    let exe_str = exe.to_string_lossy();
    if !exe_str.contains("\\target\\") {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(800));
            app.exit(0);
        });
    }
    Ok(res)
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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct MaintainerStatus {
    pub is_maintainer: bool,
    pub login: String,
    pub reason: String,
}

#[tauri::command]
fn check_maintainer_status() -> Result<MaintainerStatus, String> {
    // 1. Direct local token check (works without git.exe installed on any Windows PC)
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let marker_path = std::path::PathBuf::from(local_appdata)
            .join("AltSpace")
            .join("maintainer.json");
        if marker_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&marker_path) {
                if content.contains("\"codecheesee\"") && content.contains("\"maintainer\"") {
                    return Ok(MaintainerStatus {
                        is_maintainer: true,
                        login: "codecheesee".to_string(),
                        reason: "Verified Maintainer Sovereign Access Token".to_string(),
                    });
                }
            }
        }
    }

    // 2. Developer machine repository fallback (auto-provisions maintainer.json if git is configured)
    let remote_output = std::process::Command::new("git")
        .args(["config", "--get", "remote.origin.url"])
        .output();
    if let Ok(out) = remote_output {
        let remote_str = String::from_utf8_lossy(&out.stdout).to_lowercase();
        if remote_str.contains("codecheesee/altspace") {
            let email_output = std::process::Command::new("git")
                .args(["config", "--get", "user.email"])
                .output();
            let email_str = email_output
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase())
                .unwrap_or_default();

            if email_str.contains("codecheesee")
                || email_str.contains("narayan")
                || remote_str.contains("codecheesee/altspace")
            {
                if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
                    let dir = std::path::PathBuf::from(local_appdata).join("AltSpace");
                    let _ = std::fs::create_dir_all(&dir);
                    let marker_path = dir.join("maintainer.json");
                    let _ = std::fs::write(
                        &marker_path,
                        "{\"login\":\"codecheesee\",\"tier\":\"maintainer\",\"unlimited\":true}",
                    );
                }
                return Ok(MaintainerStatus {
                    is_maintainer: true,
                    login: "codecheesee".to_string(),
                    reason: "Verified Local Maintainer Repository Environment (Lifetime Sovereign Access)".to_string(),
                });
            }
        }
    }

    Ok(MaintainerStatus {
        is_maintainer: false,
        login: "".to_string(),
        reason: "Standard client mode".to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
fn broker_evaluate_action(
    request: broker::ActionRequest,
) -> Result<broker::ActionEvaluation, String> {
    Ok(broker::evaluate_action(&request))
}

#[tauri::command]
fn broker_execute_action(request: broker::ActionRequest) -> Result<broker::ActionResult, String> {
    Ok(broker::execute_action(&request))
}

#[tauri::command]
fn broker_remember_session_approval(action_type: String, target: String) -> Result<(), String> {
    broker::remember_session_approval(&action_type, &target);
    Ok(())
}

#[tauri::command]
fn broker_undo_action(action_id: String) -> Result<String, String> {
    broker::undo_action(&action_id)
}

#[tauri::command]
fn broker_get_ledger() -> Result<Vec<broker::LedgerEntry>, String> {
    Ok(broker::get_action_ledger())
}

#[tauri::command]
fn vault_store_secret(key: String, value: String) -> Result<(), String> {
    crypto_vault::store_secret(&key, &value)
}

#[tauri::command]
fn vault_retrieve_secret(_key: String) -> Result<Option<String>, String> {
    Err("Direct plaintext secret retrieval across IPC is prohibited by security policy. Secrets remain locked in DPAPI.".to_string())
}

#[tauri::command]
fn vault_has_secret(key: String) -> Result<bool, String> {
    crypto_vault::has_secret(&key)
}

#[tauri::command]
fn vault_check_entitlement_lease() -> Result<bool, String> {
    if let Ok(Some(lease)) = crypto_vault::retrieve_secret("altspace_entitlement_token") {
        let trimmed = lease.trim().to_uppercase();
        Ok(trimmed.starts_with("ALTS-PRO-")
            || trimmed.starts_with("PRO-")
            || trimmed.contains("PRO"))
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn vault_delete_secret(key: String) -> Result<bool, String> {
    crypto_vault::delete_secret(&key)
}

#[tauri::command]
fn vault_list_profiles() -> Result<Vec<crypto_vault::EnvProfileSummary>, String> {
    if !is_feature_enabled("secret_vault") {
        return Err("DPAPI Secret Vault is disabled in Settings".into());
    }
    crypto_vault::list_env_profiles()
}

#[tauri::command]
fn vault_save_profile(profile: crypto_vault::EnvProfilePayload) -> Result<(), String> {
    if !is_feature_enabled("secret_vault") {
        return Err("DPAPI Secret Vault is disabled in Settings".into());
    }
    crypto_vault::save_env_profile(profile)
}

#[tauri::command]
fn vault_get_profile(name: String) -> Result<crypto_vault::EnvProfilePayload, String> {
    if !is_feature_enabled("secret_vault") {
        return Err("DPAPI Secret Vault is disabled in Settings".into());
    }
    crypto_vault::get_masked_profile_payload(&name)
}

#[tauri::command]
fn vault_delete_profile(name: String) -> Result<bool, String> {
    if !is_feature_enabled("secret_vault") {
        return Err("DPAPI Secret Vault is disabled in Settings".into());
    }
    crypto_vault::delete_env_profile(&name)
}

#[tauri::command]
fn vault_launch_profile(name: String, target: String) -> Result<String, String> {
    if !is_feature_enabled("secret_vault") {
        return Err("DPAPI Secret Vault is disabled in Settings".into());
    }
    crypto_vault::launch_with_profile(&name, &target)
}

#[tauri::command]
fn get_environment_cockpit() -> Result<docker_wsl::EnvironmentCockpitData, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    Ok(docker_wsl::get_environment_cockpit_snapshot())
}

#[tauri::command]
fn docker_container_action(
    id: String,
    action: String,
) -> Result<docker_wsl::CockpitActionResult, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    Ok(docker_wsl::docker_action(&id, &action))
}

#[tauri::command]
fn docker_container_logs(id: String, tail: u32) -> Result<String, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    docker_wsl::docker_logs(&id, tail)
}

#[tauri::command]
fn docker_open_shell(id: String) -> Result<String, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    docker_wsl::docker_open_shell(&id)
}

#[tauri::command]
fn docker_start_daemon() -> Result<String, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    docker_wsl::start_docker_desktop()
}

#[tauri::command]
fn wsl_shutdown() -> Result<docker_wsl::CockpitActionResult, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    Ok(docker_wsl::wsl_shutdown())
}

#[tauri::command]
fn wsl_terminate_distro(distro: String) -> Result<docker_wsl::CockpitActionResult, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    Ok(docker_wsl::wsl_terminate(&distro))
}

#[tauri::command]
fn wsl_launch_shell(distro: String) -> Result<String, String> {
    if !is_feature_enabled("docker_wsl") {
        return Err("Docker & WSL2 Cockpit is disabled in Settings".into());
    }
    docker_wsl::wsl_launch_shell(&distro)
}

#[tauri::command]
fn get_machine_id() -> Result<String, String> {
    crypto_vault::get_or_create_device_id()
}

#[tauri::command]
fn record_terminal_failure(
    command: String,
    exit_code: i32,
    stderr: String,
    stdout: Option<String>,
) {
    broker::record_failure_event(broker::FailureEvent {
        id: format!(
            "term_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ),
        source: "terminal".into(),
        command_or_target: command,
        exit_code: Some(exit_code),
        error_message: stderr,
        stdout_excerpt: stdout,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    });
}

#[tauri::command]
fn get_recent_failure_context() -> Result<Vec<broker::FailureEvent>, String> {
    Ok(broker::get_recent_failures())
}

#[tauri::command]
fn clear_failure_context() -> Result<(), String> {
    broker::clear_failures();
    Ok(())
}

#[tauri::command]
fn vault_store_byok_key(provider: String, api_key: String) -> Result<(), String> {
    crypto_vault::store_byok_key(&provider, &api_key)
}

#[tauri::command]
fn vault_retrieve_byok_key(_provider: String) -> Result<Option<String>, String> {
    Err("Direct retrieval of BYOK API keys across IPC is prohibited by security policy. Use backend AI completion.".to_string())
}

#[tauri::command]
fn vault_get_byok_status(provider: String) -> Result<Option<byok::ByokProviderStatus>, String> {
    byok::get_byok_status(&provider)
}

#[tauri::command]
fn byok_chat_completion(request: byok::ByokChatRequest) -> Result<byok::ByokChatResponse, String> {
    byok::chat_completion(request)
}

#[tauri::command]
fn vault_list_byok_providers() -> Result<Vec<String>, String> {
    crypto_vault::list_byok_providers()
}

#[tauri::command]
fn vault_delete_byok_key(provider: String) -> Result<bool, String> {
    crypto_vault::delete_byok_key(&provider)
}

// ============================================================================
// AEGIS-VORTEX CONTROL PLANE™ IPC INTERFACES
// ============================================================================

static AEGIS_SCANNER: std::sync::LazyLock<altspace_sentinel::SecretScanner> =
    std::sync::LazyLock::new(altspace_sentinel::SecretScanner::new);

static AEGIS_HEALING: std::sync::LazyLock<altspace_core::HealingEngine> =
    std::sync::LazyLock::new(|| {
        altspace_core::HealingEngine::new(altspace_core::ExecutionMode::Supervised)
    });

static AEGIS_RECIPES: std::sync::LazyLock<altspace_core::RecipeCatalog> =
    std::sync::LazyLock::new(altspace_core::RecipeCatalog::default);

static ORBITAL_GRAPH: std::sync::LazyLock<altspace_context::WorkspaceGraph> =
    std::sync::LazyLock::new(altspace_context::WorkspaceGraph::new);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AegisSystemStatus {
    pub aegis_sentinel_active: bool,
    pub vortex_driver_active: bool,
    pub orbital_context_active: bool,
    pub execution_mode: String,
    pub architecture_name: String,
    pub active_workspace_hint: Option<String>,
}

#[tauri::command]
fn sentinel_scan_text(text: String) -> Result<altspace_sentinel::ScanResult, String> {
    Ok(AEGIS_SCANNER.scan(&text))
}

#[tauri::command]
fn sentinel_suppress_hash(hash: String) -> Result<(), String> {
    AEGIS_SCANNER.suppress_hash(hash);
    Ok(())
}

#[tauri::command]
fn aegis_get_system_status() -> Result<AegisSystemStatus, String> {
    let mode_str = match AEGIS_HEALING.get_mode() {
        altspace_core::ExecutionMode::Manual => "manual",
        altspace_core::ExecutionMode::Supervised => "supervised",
        altspace_core::ExecutionMode::Turbo => "turbo",
    };

    let active_hint = ORBITAL_GRAPH.get_active_context().map(|c| c.project_name);

    Ok(AegisSystemStatus {
        aegis_sentinel_active: true,
        vortex_driver_active: true,
        orbital_context_active: true,
        execution_mode: mode_str.to_string(),
        architecture_name: "Aegis-Vortex Control Plane™".to_string(),
        active_workspace_hint: active_hint,
    })
}

#[tauri::command]
fn aegis_set_execution_mode(mode: String) -> Result<(), String> {
    let new_mode = match mode.to_lowercase().as_str() {
        "manual" => altspace_core::ExecutionMode::Manual,
        "turbo" => altspace_core::ExecutionMode::Turbo,
        _ => altspace_core::ExecutionMode::Supervised,
    };
    AEGIS_HEALING.set_mode(new_mode);
    Ok(())
}

#[tauri::command]
fn aegis_scan_healing_failures(
    workspace_path: Option<String>,
) -> Result<Vec<altspace_core::RecipeFailure>, String> {
    let path = workspace_path.as_deref().map(std::path::Path::new);
    Ok(AEGIS_RECIPES.scan_environment(path))
}

#[tauri::command]
fn aegis_execute_healing_recipe(
    recipe_id: String,
    port: Option<u16>,
    workspace_path: Option<String>,
) -> Result<altspace_core::RecipeResult, String> {
    if recipe_id.starts_with("port-") {
        let p = port.unwrap_or_else(|| {
            recipe_id
                .strip_prefix("port-")
                .and_then(|s| s.parse().ok())
                .unwrap_or(3000)
        });
        AEGIS_RECIPES.fix_port_collision(p)
    } else if recipe_id == "git-index-lock" {
        let root_str = workspace_path
            .ok_or_else(|| "Workspace path required for git lock cleanup".to_string())?;
        AEGIS_RECIPES.fix_git_lock(std::path::Path::new(&root_str))
    } else if recipe_id == "zombies-workers" {
        AEGIS_RECIPES.fix_zombie_processes()
    } else if recipe_id == "wsl-ram" {
        AEGIS_RECIPES.fix_wsl_memory()
    } else {
        Err(format!("Unknown healing recipe '{}'", recipe_id))
    }
}

unsafe extern "system" fn find_altspace_enum_proc(
    hwnd: HWND,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::BOOL {
    let mut buf = [0u16; 128];
    let len = GetWindowTextW(hwnd, &mut buf);
    if len > 0 {
        let title = String::from_utf16_lossy(&buf[..len as usize]);
        if title == "AltSpace" {
            *(lparam.0 as *mut HWND) = hwnd;
            return windows::Win32::Foundation::BOOL(0);
        }
    }
    windows::Win32::Foundation::BOOL(1)
}

fn find_existing_altspace_hwnd() -> Option<HWND> {
    let mut target = HWND::default();
    unsafe {
        let _ = EnumWindows(
            Some(find_altspace_enum_proc),
            windows::Win32::Foundation::LPARAM(&mut target as *mut _ as _),
        );
        if !target.0.is_null() && IsWindow(target).as_bool() {
            Some(target)
        } else {
            None
        }
    }
}

pub fn run() {
    // Safe-Mode Flag Detection:
    if std::env::args().any(|arg| arg == "--safe-mode")
        || std::env::var("ALTSPACE_SAFE_MODE")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    {
        plugins::set_safe_mode(true);
    }

    // Single-Instance Named Event Guard:
    // If AltSpace is already running in background, signal it to pop up and exit second instance in <10ms!
    unsafe {
        let _mutex = CreateMutexW(None, true, w!("AltSpace_SingleInstance_Mutex_2026"));
        if GetLastError() == ERROR_ALREADY_EXISTS {
            let mut previous_was_hung_and_killed = false;

            // 1. Authorize foreground activation from explorer / desktop double-click
            let _ = AllowSetForegroundWindow(0xFFFFFFFF);

            // 2. Direct Window Summoning:
            // Find the existing AltSpace window and bring it directly to top.
            if let Some(existing_hwnd) = find_existing_altspace_hwnd() {
                if !existing_hwnd.0.is_null() && IsWindow(existing_hwnd).as_bool() {
                    if IsHungAppWindow(existing_hwnd).as_bool() {
                        // Previous instance is hung/frozen - terminate it to unblock the user!
                        let mut hung_pid = 0u32;
                        GetWindowThreadProcessId(existing_hwnd, Some(&mut hung_pid));
                        if hung_pid != 0 {
                            if let Ok(process) = OpenProcess(PROCESS_TERMINATE, false, hung_pid) {
                                let _ = TerminateProcess(process, 1);
                                let _ = CloseHandle(process);
                                previous_was_hung_and_killed = true;
                            }
                        }
                    } else {
                        force_foreground_window(existing_hwnd);
                    }
                }
            }

            // 3. Signal the named summon event so Tauri's webview focuses the input bar
            if let Ok(event) =
                OpenEventW(EVENT_MODIFY_STATE, false, w!("AltSpace_Summon_Event_2026"))
            {
                let _ = SetEvent(event);
                let _ = CloseHandle(event);
            }

            // If the previous instance was hung and terminated, don't exit!
            // Continue execution so THIS instance starts up cleanly as the active instance!
            if !previous_was_hung_and_killed {
                return;
            }
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
            focus_window,
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
            launch_game_advanced,
            get_game_mode_status,
            list_plugins,
            run_plugin,
            install_plugin,
            uninstall_plugin,
            check_app_update,
            trigger_app_update,
            record_frecency_usage,
            get_frecency_scores,
            import_legacy_frecency,
            check_maintainer_status,
            broker_evaluate_action,
            broker_execute_action,
            broker_remember_session_approval,
            broker_undo_action,
            broker_get_ledger,
            vault_store_secret,
            vault_retrieve_secret,
            vault_has_secret,
            vault_check_entitlement_lease,
            vault_delete_secret,
            get_machine_id,
            get_plugin_health,
            reset_plugin_health,
            get_safe_mode_status,
            license_verifier::verify_and_activate_license,
            license_verifier::get_active_verified_license,
            github_auth::github_device_code_request,
            github_auth::github_device_token_poll,
            github_auth::github_get_current_user,
            github_auth::github_sign_out,
            github_auth::github_store_manual_pat,
            set_feature_flags,
            get_feature_flags,
            get_port_process_forensics,
            kill_and_verify_port,
            vault_list_profiles,
            vault_save_profile,
            vault_get_profile,
            vault_delete_profile,
            vault_launch_profile,
            get_environment_cockpit,
            docker_container_action,
            docker_container_logs,
            docker_open_shell,
            docker_start_daemon,
            wsl_shutdown,
            wsl_terminate_distro,
            wsl_launch_shell,
            record_terminal_failure,
            get_recent_failure_context,
            clear_failure_context,
            vault_store_byok_key,
            vault_retrieve_byok_key,
            vault_get_byok_status,
            byok_chat_completion,
            vault_list_byok_providers,
            vault_delete_byok_key,
            sentinel_scan_text,
            sentinel_suppress_hash,
            aegis_get_system_status,
            aegis_set_execution_mode,
            aegis_scan_healing_failures,
            aegis_execute_healing_recipe
        ])
        .setup(|app| {
            app.manage(ExitState(AtomicBool::new(false)));
            let app_data_dir = std::env::var("LOCALAPPDATA")
                .map(|p| std::path::PathBuf::from(p).join("AltSpace"))
                .unwrap_or_else(|_| {
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                        .unwrap_or_else(|| std::path::PathBuf::from("."))
                });
            let _ = std::fs::create_dir_all(&app_data_dir);
            let frecency_db =
                frecency::FrecencyDb::open(&app_data_dir).expect("Failed to open frecency DB");
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
                        let handle = app_handle_for_summon.clone();
                        let handle_inner = handle.clone();
                        let _ = handle.run_on_main_thread(move || {
                            if let Some(window) = handle_inner.get_webview_window("main") {
                                if let Ok(hwnd) = window.hwnd() {
                                    windows_mgmt::record_previous_foreground(HWND(hwnd.0 as _));
                                    force_foreground_window(HWND(hwnd.0 as _));
                                }
                                mark_window_shown();
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit("window-summoned", ());
                            }
                        });
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

            let show_i = MenuItem::with_id(
                app,
                "show",
                "⚡ Show AltSpace (Alt+Space)",
                true,
                None::<&str>,
            )?;
            let clipboard_i =
                MenuItem::with_id(app, "clipboard", "📋 Clipboard History", true, None::<&str>)?;
            let ports_i =
                MenuItem::with_id(app, "ports", "🔌 Dev Ports Inspector", true, None::<&str>)?;
            let games_i = MenuItem::with_id(app, "games", "🎮 Game Launcher", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let autostart_label = if get_autostart_status() {
                "✓ Launch on Windows Startup"
            } else {
                "Launch on Windows Startup"
            };
            let autostart_i =
                MenuItem::with_id(app, "autostart", autostart_label, true, None::<&str>)?;
            let updates_i =
                MenuItem::with_id(app, "updates", "🔄 Check for Updates", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let feedback_i = MenuItem::with_id(
                app,
                "feedback",
                "💬 Rate & Send Feedback",
                true,
                None::<&str>,
            )?;
            let github_i =
                MenuItem::with_id(app, "github", "⭐ Star on GitHub", true, None::<&str>)?;
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
                            mark_window_shown();
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
                            mark_window_shown();
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
                            mark_window_shown();
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
                            mark_window_shown();
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
                            mark_window_shown();
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("check-updates", ());
                        }
                    }
                    "feedback" => {
                        if let Some(window) = app.get_webview_window("main") {
                            mark_window_shown();
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
                        let _ = open_url_internal("https://github.com/codecheesee/altspace");
                    }
                    "quit" => {
                        app.state::<ExitState>().0.store(true, Ordering::SeqCst);
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
                                    mark_window_shown();
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
                let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 800.0,
                    height: 520.0,
                }));
                let _ = window.center();

                if let Ok(hwnd) = window.hwnd() {
                    apply_native_glass(HWND(hwnd.0 as _));
                }

                let w_clone = window.clone();
                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = w_clone.hide();
                    }
                    tauri::WindowEvent::Focused(focused) => {
                        if *focused {
                            HAS_GAINED_FOCUS.store(true, Ordering::SeqCst);
                        } else if HAS_GAINED_FOCUS.load(Ordering::SeqCst)
                            && LAST_SHOWN
                                .lock()
                                .map(|t| t.elapsed())
                                .unwrap_or(std::time::Duration::from_secs(10))
                                > std::time::Duration::from_millis(800)
                        {
                            let _ = w_clone.hide();
                        }
                    }
                    _ => {}
                });

                mark_window_shown();
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
                if !_app_handle.state::<ExitState>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_valid_https() {
        assert!(validate_url_for_opening("https://github.com/codecheesee/altspace").is_ok());
        assert!(validate_url_for_opening("https://altspace.dev/docs?query=test#hash").is_ok());
    }

    #[test]
    fn test_validate_url_valid_localhost() {
        assert!(validate_url_for_opening("http://localhost:3000/app").is_ok());
        assert!(validate_url_for_opening("http://127.0.0.1:8080/api").is_ok());
        assert!(validate_url_for_opening("http://[::1]:5173/").is_ok());
    }

    #[test]
    fn test_validate_url_rejects_insecure_remote_http() {
        let res = validate_url_for_opening("http://example.com");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Insecure HTTP is restricted"));
    }

    #[test]
    fn test_validate_url_rejects_dangerous_schemes() {
        assert!(validate_url_for_opening("javascript:alert(1)").is_err());
        assert!(validate_url_for_opening("file:///C:/Windows/System32/calc.exe").is_err());
        assert!(validate_url_for_opening("data:text/html,<script>alert(1)</script>").is_err());
        assert!(
            validate_url_for_opening("ms-appinstaller:?source=https://evil.com/app.msix").is_err()
        );
        assert!(validate_url_for_opening("cmd:foo").is_err());
        assert!(validate_url_for_opening("powershell:bar").is_err());
        assert!(validate_url_for_opening("smb://attacker/share").is_err());
    }

    #[test]
    fn test_validate_url_rejects_credentials_and_control_chars() {
        assert!(validate_url_for_opening("https://user:password@github.com").is_err());
        assert!(validate_url_for_opening("https://github.com\0/bad").is_err());
        assert!(validate_url_for_opening("https://github.com\r\n/bad").is_err());
        assert!(validate_url_for_opening("").is_err());
        assert!(validate_url_for_opening("   ").is_err());
    }

    #[test]
    fn test_validate_settings_uri_valid() {
        assert!(validate_settings_uri_for_opening("ms-settings:display").is_ok());
        assert!(validate_settings_uri_for_opening("ms-settings:network-wifi").is_ok());
        assert!(validate_settings_uri_for_opening("ms-settings:windowsupdate").is_ok());
        assert!(validate_settings_uri_for_opening("ms-settings:").is_ok());
    }

    #[test]
    fn test_validate_settings_uri_rejects_invalid() {
        assert!(validate_settings_uri_for_opening("").is_err());
        assert!(validate_settings_uri_for_opening("https://evil.com").is_err());
        assert!(validate_settings_uri_for_opening("ms-settings:display & calc.exe").is_err());
        assert!(validate_settings_uri_for_opening("ms-settings:display; cmd.exe").is_err());
        assert!(validate_settings_uri_for_opening("ms-settings:display\0bad").is_err());
        assert!(validate_settings_uri_for_opening("ms-settings:display|bad").is_err());
    }
}
