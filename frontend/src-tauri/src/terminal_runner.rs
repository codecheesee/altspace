use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Instant;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellExecutionResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub elapsed_ms: u64,
}

/// Executes a shell command silently in PowerShell and captures stdout/stderr
pub fn execute_shell_command(cmd: &str) -> Result<ShellExecutionResult, String> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty".into());
    }

    let start = Instant::now();

    // Run in powershell.exe with hidden window and output capture
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            trimmed,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let exit_code = output.status.code().unwrap_or(-1);
    let success = output.status.success();

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    Ok(ShellExecutionResult {
        success,
        exit_code,
        stdout,
        stderr,
        elapsed_ms,
    })
}

/// Launches a command interactively in a visible Windows Terminal (wt.exe) or PowerShell window
pub fn launch_in_terminal_window(cmd: &str) -> Result<(), String> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty".into());
    }

    // Try Windows Terminal (wt.exe) first
    let wt_spawn = Command::new("wt")
        .args(["powershell", "-NoExit", "-Command", trimmed])
        .spawn();

    if wt_spawn.is_ok() {
        return Ok(());
    }

    // Fallback to native PowerShell
    Command::new("powershell")
        .args(["-NoExit", "-Command", trimmed])
        .spawn()
        .map_err(|e| format!("Failed to spawn PowerShell: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_command_fails() {
        assert!(execute_shell_command("").is_err());
        assert!(execute_shell_command("   ").is_err());
    }

    #[test]
    fn test_echo_command_execution() {
        let res = execute_shell_command("Write-Output 'Hello AltSpace 2026'");
        assert!(res.is_ok());
        let out = res.unwrap();
        assert!(out.success);
        assert_eq!(out.exit_code, 0);
        assert!(out.stdout.contains("Hello AltSpace 2026"));
    }

    #[test]
    fn test_error_command_execution() {
        let res = execute_shell_command("throw 'Sample error'");
        assert!(res.is_ok());
        let out = res.unwrap();
        assert!(!out.success || !out.stderr.is_empty());
    }
}
