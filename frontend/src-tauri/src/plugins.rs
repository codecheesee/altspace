use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::os::windows::process::CommandExt;
use std::sync::mpsc;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const PLUGIN_EXECUTION_TIMEOUT_SECS: u64 = 15;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keyword: String,
    pub script: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keyword: String,
    pub script_path: String,
    pub icon: String,
}

pub fn get_plugins_dir() -> PathBuf {
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let dir = PathBuf::from(local_appdata).join("AltSpace").join("plugins");
        let _ = fs::create_dir_all(&dir);
        return dir;
    }
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let dir = PathBuf::from(userprofile).join(".altspace").join("plugins");
        let _ = fs::create_dir_all(&dir);
        return dir;
    }
    PathBuf::from("plugins")
}

pub fn scan_plugins() -> Vec<PluginItem> {
    let plugins_dir = get_plugins_dir();

    let mut plugins = Vec::new();

    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    if let Ok(content) = fs::read_to_string(&manifest_path) {
                        if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                            if validate_script_filename(&manifest.script).is_ok() {
                                let script_path = path.join(&manifest.script);
                                plugins.push(PluginItem {
                                    id: manifest.id,
                                    name: manifest.name,
                                    description: manifest.description,
                                    keyword: manifest.keyword,
                                    script_path: script_path.to_string_lossy().to_string(),
                                    icon: manifest.icon.unwrap_or_else(|| "cmd".to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    plugins
}

/// Validates that an ID is safe against path traversal and special characters
pub fn validate_plugin_id(id: &str) -> Result<(), String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err("Plugin ID cannot be empty".into());
    }
    if trimmed.len() > 64 {
        return Err("Plugin ID exceeds maximum length of 64 characters".into());
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Plugin ID can only contain letters, numbers, hyphens, and underscores".into());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("Invalid Plugin ID".into());
    }
    Ok(())
}

/// Validates that script filename does not escape and has an allowed extension
pub fn validate_script_filename(filename: &str) -> Result<(), String> {
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        return Err("Script filename cannot be empty".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("Script filename cannot contain directory separators".into());
    }

    let ext = Path::new(trimmed)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "ps1" | "bat" | "cmd" | "py" | "js" => Ok(()),
        _ => Err(format!("Disallowed script extension: .{}", ext)),
    }
}

/// Runs a plugin script as a user-level process inside the plugins directory with path validation and a 15-second execution timeout.
/// NOTE: The execution model is privileged user-level code, not an OS-isolated container or sandbox.
pub fn run_plugin_script(script_path: &str, args: &str) -> Result<String, String> {
    let path = PathBuf::from(script_path);
    if !path.exists() {
        return Err(format!("Plugin script not found: {}", script_path));
    }

    // Security Check: Verify that the script resides inside the AltSpace plugins directory
    let plugins_dir = get_plugins_dir();
    let canon_script = fs::canonicalize(&path)
        .map_err(|e| format!("Unable to resolve plugin script safely: {}", e))?;
    let canon_dir = fs::canonicalize(&plugins_dir)
        .map_err(|e| format!("Unable to resolve plugin directory safely: {}", e))?;
    if !canon_script.starts_with(&canon_dir) {
        return Err("Security Violation: Script resides outside the AltSpace plugins directory. Extensions run as user-level privileged processes and must reside in the approved plugins directory.".into());
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut command = match extension.as_str() {
        "ps1" => {
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script_path]);
            cmd.args(args.split_whitespace());
            cmd
        }
        "bat" | "cmd" => {
            let mut cmd = Command::new("cmd.exe");
            cmd.args(["/C", script_path]);
            cmd.args(args.split_whitespace());
            cmd
        }
        "py" => {
            let mut cmd = Command::new("python.exe");
            cmd.arg(script_path);
            cmd.args(args.split_whitespace());
            cmd
        }
        "js" => {
            let mut cmd = Command::new("node.exe");
            cmd.arg(script_path);
            cmd.args(args.split_whitespace());
            cmd
        }
        _ => return Err(format!("Unsupported script type: .{}", extension)),
    };

    command
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Spawn and enforce strict execution timeout
    let child = command.spawn().map_err(|e| format!("Failed to spawn plugin: {}", e))?;
    let child_pid = child.id();

    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let res = child.wait_with_output();
        let _ = tx.send(res);
    });

    match rx.recv_timeout(Duration::from_secs(PLUGIN_EXECUTION_TIMEOUT_SECS)) {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else if !stderr.is_empty() {
                Err(stderr)
            } else {
                Err(format!("Plugin exited with code: {:?}", out.status.code()))
            }
        }
        Ok(Err(e)) => Err(format!("Execution failed: {}", e)),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            // Force terminate runaway process tree
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &child_pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            Err(format!(
                "Plugin execution timed out (exceeded {}s limit)",
                PLUGIN_EXECUTION_TIMEOUT_SECS
            ))
        }
        Err(e) => Err(format!("Execution thread error: {}", e)),
    }
}

pub fn install_plugin(
    plugin_id: &str,
    manifest_json: &str,
    script_content: &str,
    script_filename: &str,
) -> Result<(), String> {
    validate_plugin_id(plugin_id)?;
    validate_script_filename(script_filename)?;

    // Validate manifest JSON syntax
    let manifest: PluginManifest = serde_json::from_str(manifest_json)
        .map_err(|e| format!("Invalid manifest JSON: {}", e))?;

    if manifest.id != plugin_id {
        return Err("Manifest ID mismatch with plugin ID".into());
    }
    if manifest.script != script_filename {
        return Err("Manifest script filename does not match submitted script filename".into());
    }

    let plugins_dir = get_plugins_dir();
    let target_dir = plugins_dir.join(plugin_id);
    fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;

    fs::write(target_dir.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

    fs::write(target_dir.join(script_filename), script_content)
        .map_err(|e| format!("Failed to write {}: {}", script_filename, e))?;

    Ok(())
}

pub fn uninstall_plugin(plugin_id: &str) -> Result<(), String> {
    validate_plugin_id(plugin_id)?;

    let plugins_dir = get_plugins_dir();
    let target_dir = plugins_dir.join(plugin_id);

    // Verify boundary before removing
    if let (Ok(canon_target), Ok(canon_plugins)) = (fs::canonicalize(&target_dir), fs::canonicalize(&plugins_dir)) {
        if canon_target.starts_with(&canon_plugins) && canon_target != canon_plugins {
            fs::remove_dir_all(&canon_target)
                .map_err(|e| format!("Failed to remove plugin dir: {}", e))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_plugin_id() {
        assert!(validate_plugin_id("valid-plugin-1").is_ok());
        assert!(validate_plugin_id("wifi_cleaner").is_ok());
        assert!(validate_plugin_id("").is_err());
        assert!(validate_plugin_id("../escape").is_err());
        assert!(validate_plugin_id("has spaces").is_err());
        assert!(validate_plugin_id("special$chars").is_err());
    }

    #[test]
    fn test_validate_script_filename() {
        assert!(validate_script_filename("run.ps1").is_ok());
        assert!(validate_script_filename("clean.bat").is_ok());
        assert!(validate_script_filename("tool.js").is_ok());
        assert!(validate_script_filename("tool.py").is_ok());
        assert!(validate_script_filename("../run.ps1").is_err());
        assert!(validate_script_filename("payload.exe").is_err());
        assert!(validate_script_filename("script.sh").is_err());
    }
}
