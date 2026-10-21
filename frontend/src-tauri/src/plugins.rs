use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, LazyLock, Mutex};
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const PLUGIN_EXECUTION_TIMEOUT_SECS: u64 = 15;
const MAX_CONSECUTIVE_FAILURES: u32 = 3;
const MAX_CONSECUTIVE_TIMEOUTS: u32 = 2;

static SAFE_MODE: AtomicBool = AtomicBool::new(false);

pub fn set_safe_mode(enabled: bool) {
    SAFE_MODE.store(enabled, Ordering::SeqCst);
}

pub fn is_safe_mode() -> bool {
    SAFE_MODE.load(Ordering::SeqCst)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum TrustTier {
    BuiltIn,
    Verified,
    #[default]
    Community,
    LocalDev,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct PluginPermissions {
    #[serde(default)]
    pub filesystem: Vec<String>,
    #[serde(default)]
    pub network: Vec<String>,
    #[serde(default)]
    pub process: Vec<String>,
    #[serde(default)]
    pub clipboard: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keyword: String,
    pub script: String,
    pub icon: Option<String>,
    #[serde(default)]
    pub tier: Option<TrustTier>,
    #[serde(default)]
    pub permissions: Option<PluginPermissions>,
    #[serde(default)]
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keyword: String,
    pub script_path: String,
    pub icon: String,
    #[serde(default)]
    pub tier: TrustTier,
    #[serde(default)]
    pub permissions: PluginPermissions,
    #[serde(default)]
    pub is_quarantined: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginHealthStatus {
    pub consecutive_failures: u32,
    pub consecutive_timeouts: u32,
    pub is_quarantined: bool,
    pub quarantine_reason: Option<String>,
}

#[derive(Default)]
pub struct HealthTracker {
    records: HashMap<String, PluginHealthStatus>,
}

impl HealthTracker {
    pub fn get_status(&self, id: &str) -> PluginHealthStatus {
        self.records.get(id).cloned().unwrap_or(PluginHealthStatus {
            consecutive_failures: 0,
            consecutive_timeouts: 0,
            is_quarantined: false,
            quarantine_reason: None,
        })
    }

    pub fn record_success(&mut self, id: &str) {
        if let Some(entry) = self.records.get_mut(id) {
            entry.consecutive_failures = 0;
            entry.consecutive_timeouts = 0;
        }
    }

    pub fn record_failure(&mut self, id: &str, is_timeout: bool, err_msg: &str) {
        let entry = self.records.entry(id.to_string()).or_insert_with(|| PluginHealthStatus {
            consecutive_failures: 0,
            consecutive_timeouts: 0,
            is_quarantined: false,
            quarantine_reason: None,
        });

        entry.consecutive_failures += 1;
        if is_timeout {
            entry.consecutive_timeouts += 1;
        }

        if entry.consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS {
            entry.is_quarantined = true;
            entry.quarantine_reason = Some(format!(
                "Quarantined: {} consecutive timeouts. Last error: {}",
                entry.consecutive_timeouts, err_msg
            ));
        } else if entry.consecutive_failures >= MAX_CONSECUTIVE_FAILURES {
            entry.is_quarantined = true;
            entry.quarantine_reason = Some(format!(
                "Quarantined: {} consecutive crashes. Last error: {}",
                entry.consecutive_failures, err_msg
            ));
        }
    }

    pub fn reset(&mut self, id: &str) {
        self.records.remove(id);
    }
}

static HEALTH_TRACKER: LazyLock<Mutex<HealthTracker>> = LazyLock::new(|| Mutex::new(HealthTracker::default()));

pub fn is_plugin_revoked(id: &str) -> bool {
    const REVOKED_IDS: &[&str] = &[
        "malicious_tool",
        "crypto_drainer",
        "ransomware_mock",
    ];
    REVOKED_IDS.contains(&id)
}

pub fn get_plugin_health(id: &str) -> PluginHealthStatus {
    HEALTH_TRACKER.lock().unwrap().get_status(id)
}

pub fn reset_plugin_health(id: &str) {
    HEALTH_TRACKER.lock().unwrap().reset(id);
}

pub fn record_plugin_success(id: &str) {
    HEALTH_TRACKER.lock().unwrap().record_success(id);
}

pub fn record_plugin_failure(id: &str, is_timeout: bool, err_msg: &str) {
    HEALTH_TRACKER.lock().unwrap().record_failure(id, is_timeout, err_msg);
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
    let safe_mode = is_safe_mode();

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
                                let tier = if is_plugin_revoked(&manifest.id) {
                                    TrustTier::Revoked
                                } else if manifest.id == "dns-flusher" || manifest.id == "git-clean" {
                                    TrustTier::BuiltIn
                                } else {
                                    manifest.tier.unwrap_or(TrustTier::Community)
                                };

                                // In safe mode, community and local development extensions are bypassed
                                if safe_mode && tier != TrustTier::BuiltIn {
                                    continue;
                                }

                                let is_quarantined = tier == TrustTier::Revoked
                                    || get_plugin_health(&manifest.id).is_quarantined;

                                plugins.push(PluginItem {
                                    id: manifest.id,
                                    name: manifest.name,
                                    description: manifest.description,
                                    keyword: manifest.keyword,
                                    script_path: script_path.to_string_lossy().to_string(),
                                    icon: manifest.icon.unwrap_or_else(|| "cmd".to_string()),
                                    tier,
                                    permissions: manifest.permissions.unwrap_or_default(),
                                    is_quarantined,
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

    let plugin_id = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    if is_plugin_revoked(&plugin_id) {
        return Err(format!(
            "Security Violation: Plugin '{}' is on the revocation list and has been blocked.",
            plugin_id
        ));
    }

    let health = get_plugin_health(&plugin_id);
    if health.is_quarantined {
        return Err(format!(
            "Security Guard: Plugin '{}' is quarantined due to: {}. Please reset health in settings or reinstall to proceed.",
            plugin_id,
            health.quarantine_reason.as_deref().unwrap_or("repeated failures")
        ));
    }

    if is_safe_mode() && plugin_id != "dns-flusher" && plugin_id != "git-clean" {
        return Err(format!(
            "Safe Mode is active: Community/local extension '{}' is blocked from running.",
            plugin_id
        ));
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
                record_plugin_success(&plugin_id);
                Ok(stdout)
            } else if !stderr.is_empty() {
                record_plugin_failure(&plugin_id, false, &stderr);
                Err(stderr)
            } else {
                let msg = format!("Plugin exited with code: {:?}", out.status.code());
                record_plugin_failure(&plugin_id, false, &msg);
                Err(msg)
            }
        }
        Ok(Err(e)) => {
            let msg = format!("Execution failed: {}", e);
            record_plugin_failure(&plugin_id, false, &msg);
            Err(msg)
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
            // Force terminate runaway process tree
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &child_pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            let msg = format!(
                "Plugin execution timed out (exceeded {}s limit)",
                PLUGIN_EXECUTION_TIMEOUT_SECS
            );
            record_plugin_failure(&plugin_id, true, &msg);
            Err(msg)
        }
        Err(e) => {
            let msg = format!("Execution thread error: {}", e);
            record_plugin_failure(&plugin_id, false, &msg);
            Err(msg)
        }
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

    #[test]
    fn test_trust_tier_and_revocation() {
        assert!(is_plugin_revoked("malicious_tool"));
        assert!(!is_plugin_revoked("dns-flusher"));
    }

    #[test]
    fn test_plugin_health_quarantine() {
        let test_id = "test_failing_plugin";
        reset_plugin_health(test_id);
        assert!(!get_plugin_health(test_id).is_quarantined);

        record_plugin_failure(test_id, false, "error 1");
        assert!(!get_plugin_health(test_id).is_quarantined);

        record_plugin_failure(test_id, false, "error 2");
        assert!(!get_plugin_health(test_id).is_quarantined);

        record_plugin_failure(test_id, false, "error 3");
        assert!(get_plugin_health(test_id).is_quarantined);

        reset_plugin_health(test_id);
        assert!(!get_plugin_health(test_id).is_quarantined);
    }

    #[test]
    fn test_plugin_timeout_quarantine() {
        let test_id = "test_timeout_plugin";
        reset_plugin_health(test_id);

        record_plugin_failure(test_id, true, "timeout 1");
        assert!(!get_plugin_health(test_id).is_quarantined);

        record_plugin_failure(test_id, true, "timeout 2");
        assert!(get_plugin_health(test_id).is_quarantined);

        reset_plugin_health(test_id);
        assert!(!get_plugin_health(test_id).is_quarantined);
    }

    #[test]
    fn test_safe_mode_toggle() {
        set_safe_mode(true);
        assert!(is_safe_mode());
        set_safe_mode(false);
        assert!(!is_safe_mode());
    }
}
