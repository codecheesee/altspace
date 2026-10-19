use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use windows::core::w;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Sanitizes a filesystem path or command argument, rejecting dangerous control characters
pub fn sanitize_path(input: &str) -> Result<PathBuf, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".into());
    }

    // Reject command injection characters if they occur in path arguments
    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err("Path contains invalid control characters".into());
    }

    let p = PathBuf::from(trimmed);
    Ok(p)
}

/// Resolves the working directory for a given file or folder path
pub fn get_target_directory(path_str: &str) -> PathBuf {
    let p = Path::new(path_str);
    if p.is_dir() {
        p.to_path_buf()
    } else if let Some(parent) = p.parent() {
        if parent.as_os_str().is_empty() {
            PathBuf::from(".")
        } else {
            parent.to_path_buf()
        }
    } else {
        PathBuf::from(".")
    }
}

/// Launches a target application or script elevated as Administrator (UAC Prompt)
pub fn run_as_admin(target_path: &str) -> Result<(), String> {
    let p = sanitize_path(target_path)?;
    let wide_path: Vec<u16> = p.as_os_str().encode_wide().chain(std::iter::once(0)).collect();

    unsafe {
        let res = ShellExecuteW(
            HWND::default(),
            w!("runas"),
            windows::core::PCWSTR(wide_path.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
        );

        if res.0 as usize <= 32 {
            return Err(format!("Elevation failed or cancelled by user (code {})", res.0 as usize));
        }
    }

    Ok(())
}

/// Reveals a file or directory in Windows File Explorer
pub fn reveal_in_explorer(target_path: &str) -> Result<(), String> {
    let p = sanitize_path(target_path)?;
    let path_str = p.to_string_lossy().to_string();

    Command::new("explorer")
        .arg(format!("/select,{}", path_str))
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to open File Explorer: {}", e))?;

    Ok(())
}

/// Opens the specified directory or file's parent in Windows Terminal (or PowerShell fallback)
pub fn open_in_terminal(target_path: &str) -> Result<(), String> {
    let dir = get_target_directory(target_path);
    let dir_str = dir.to_string_lossy().to_string();

    // Try Windows Terminal (wt.exe) first
    let wt_spawn = Command::new("wt")
        .args(["-d", &dir_str])
        .spawn();

    if wt_spawn.is_ok() {
        return Ok(());
    }

    // Fallback to PowerShell
    Command::new("powershell")
        .args(["-NoExit", "-Command", &format!("Set-Location -LiteralPath '{}'", dir_str.replace('\'', "''"))])
        .spawn()
        .map_err(|e| format!("Failed to launch terminal: {}", e))?;

    Ok(())
}

/// Opens the specified file or folder in Visual Studio Code
pub fn open_in_vscode(target_path: &str) -> Result<(), String> {
    let p = sanitize_path(target_path)?;
    let path_str = p.to_string_lossy().to_string();

    // Try code command in PATH
    let code_spawn = Command::new("code")
        .arg(&path_str)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    if code_spawn.is_ok() {
        return Ok(());
    }

    // Fallback: check typical LocalAppData VS Code installation
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let code_exe = Path::new(&local_app_data)
            .join("Programs")
            .join("Microsoft VS Code")
            .join("Code.exe");

        if code_exe.exists() {
            Command::new(code_exe)
                .arg(&path_str)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to launch VS Code: {}", e))?;
            return Ok(());
        }
    }

    Err("Visual Studio Code ('code') executable was not found on PATH".into())
}

use std::os::windows::ffi::OsStrExt;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_empty_path() {
        assert!(sanitize_path("").is_err());
        assert!(sanitize_path("   ").is_err());
    }

    #[test]
    fn test_sanitize_control_characters() {
        assert!(sanitize_path("C:\\test\0bad.exe").is_err());
        assert!(sanitize_path("C:\\test\nbad.exe").is_err());
        assert!(sanitize_path("C:\\test\rbad.exe").is_err());
    }

    #[test]
    fn test_get_target_directory() {
        let file_path = r"C:\Windows\System32\notepad.exe";
        let dir = get_target_directory(file_path);
        assert_eq!(dir, PathBuf::from(r"C:\Windows\System32"));

        let empty_rel = "file.txt";
        let rel_dir = get_target_directory(empty_rel);
        assert_eq!(rel_dir, PathBuf::from("."));
    }
}
