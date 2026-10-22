use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellExecutionResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub elapsed_ms: u64,
}

/// Executes a shell command silently in PowerShell and captures stdout/stderr.
///
/// NOTE: Direct arbitrary shell execution is disabled for security hardening.
/// Use explicit developer console windows or native brokered operations instead.
pub fn execute_shell_command(cmd: &str) -> Result<ShellExecutionResult, String> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty".into());
    }

    Err("Direct shell execution is disabled for security hardening. Use an external development console.".into())
}

/// Launches a command interactively in a visible Windows Terminal (wt.exe) or PowerShell window.
///
/// NOTE: Arbitrary shell string execution in interactive windows is disabled for security hardening.
pub fn launch_in_terminal_window(cmd: &str) -> Result<(), String> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty".into());
    }

    Err("Interactive terminal execution with arbitrary command arguments is disabled for security hardening.".into())
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
    fn test_execute_shell_command_fails_closed() {
        let res = execute_shell_command("Write-Output 'Hello AltSpace 2026'");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("disabled for security hardening"));
    }

    #[test]
    fn test_launch_in_terminal_window_fails_closed() {
        let res = launch_in_terminal_window("Write-Output 'Hello AltSpace 2026'");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("disabled for security hardening"));
    }
}
