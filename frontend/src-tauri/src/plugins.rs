use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};

#[allow(dead_code)]
const MAX_CONSECUTIVE_FAILURES: u32 = 3;
#[allow(dead_code)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PluginStatus {
    Active,
    #[default]
    BlockedMigrationRequired,
    Quarantined,
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
    #[serde(default)]
    pub status: PluginStatus,
    #[serde(default)]
    pub status_message: Option<String>,
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

    #[allow(dead_code)]
    pub fn record_success(&mut self, id: &str) {
        if let Some(entry) = self.records.get_mut(id) {
            entry.consecutive_failures = 0;
            entry.consecutive_timeouts = 0;
        }
    }

    #[allow(dead_code)]
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

#[allow(dead_code)]
pub fn record_plugin_success(id: &str) {
    HEALTH_TRACKER.lock().unwrap().record_success(id);
}

#[allow(dead_code)]
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

/// Scans the specified directory for installed plugins, preserving all manifests and metadata.
/// Script extensions are classified with `PluginStatus::BlockedMigrationRequired` to prevent unbrokered execution.
pub fn scan_plugins_in_dir(plugins_dir: &Path) -> Vec<PluginItem> {
    let safe_mode = is_safe_mode();
    let mut plugins = Vec::new();

    if let Ok(entries) = fs::read_dir(plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    if let Ok(content) = fs::read_to_string(&manifest_path) {
                        if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                            if validate_script_filename(&manifest.script).is_ok() {
                                let script_path = path.join(&manifest.script);
                                let is_revoked = is_plugin_revoked(&manifest.id);
                                let tier = if is_revoked {
                                    TrustTier::Revoked
                                } else {
                                    manifest.tier.unwrap_or(TrustTier::Community)
                                };

                                // In safe mode, community and local development extensions are bypassed
                                if safe_mode && tier != TrustTier::BuiltIn {
                                    continue;
                                }

                                let health = get_plugin_health(&manifest.id);
                                let is_quarantined = is_revoked || health.is_quarantined;

                                let (status, status_message) = if is_revoked {
                                    (
                                        PluginStatus::Revoked,
                                        Some("Extension is revoked on security grounds.".to_string()),
                                    )
                                } else if health.is_quarantined {
                                    (
                                        PluginStatus::Quarantined,
                                        health.quarantine_reason.clone(),
                                    )
                                } else {
                                    (
                                        PluginStatus::BlockedMigrationRequired,
                                        Some("Execution of script-based extensions is disabled for security hardening (migration required).".to_string()),
                                    )
                                };

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
                                    status,
                                    status_message,
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

pub fn scan_plugins() -> Vec<PluginItem> {
    scan_plugins_in_dir(&get_plugins_dir())
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

/// Evaluates a plugin script execution request against security boundaries.
///
/// NOTE: In this release, arbitrary script execution (.ps1, .bat, .cmd, .py, .js) is strictly blocked
/// for security hardening (migration required). Files, manifests, and plugin directories are preserved.
pub fn run_plugin_script_in_dir(
    script_path: &str,
    _args: &str,
    base_plugins_dir: &Path,
) -> Result<String, String> {
    let path = PathBuf::from(script_path);
    if !path.exists() {
        return Err(format!("Plugin script not found: {}", script_path));
    }

    // Security Check: Verify that the script resides inside the approved plugins directory
    let canon_script = fs::canonicalize(&path)
        .map_err(|e| format!("Unable to resolve plugin script safely: {}", e))?;
    let canon_dir = fs::canonicalize(base_plugins_dir)
        .map_err(|e| format!("Unable to resolve plugin directory safely: {}", e))?;
    if !canon_script.starts_with(&canon_dir) {
        return Err("Security Violation: Script resides outside the AltSpace plugins directory.".into());
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
            "Security Guard: Plugin '{}' is quarantined due to: {}.",
            plugin_id,
            health.quarantine_reason.as_deref().unwrap_or("repeated failures")
        ));
    }

    if is_safe_mode() {
        return Err(format!(
            "Safe Mode is active: Extension '{}' is blocked from running.",
            plugin_id
        ));
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Security Containment: Block execution of all script-based extensions (.ps1, .bat, .cmd, .py, .js)
    // Child processes (powershell, cmd, python, node) are never spawned. Files and manifests are preserved.
    match extension.as_str() {
        "ps1" | "bat" | "cmd" | "py" | "js" => Err(format!(
            "Execution of script extension '{}' (type: .{}) is blocked for security hardening (migration required). Arbitrary script execution is disabled pending the signed extension framework.",
            plugin_id, extension
        )),
        _ => Err(format!("Unsupported script type: .{}", extension)),
    }
}

pub fn run_plugin_script(script_path: &str, args: &str) -> Result<String, String> {
    run_plugin_script_in_dir(script_path, args, &get_plugins_dir())
}

/// Installs a plugin package.
///
/// NOTE: Installation of executable script extensions is disabled for security hardening.
/// Manifest validation runs, but no script files are written to disk.
pub fn install_plugin(
    plugin_id: &str,
    manifest_json: &str,
    _script_content: &str,
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

    // Security Containment: Block remote script/executable plugin installation
    Err("Installation of script-based extensions (.ps1, .bat, .cmd, .py, .js) is disabled for security hardening. Extension installation will be re-enabled when the signed extension framework is released.".into())
}

/// Uninstalls an installed plugin by removing its directory within the approved plugins location.
pub fn uninstall_plugin_in_dir(plugin_id: &str, base_plugins_dir: &Path) -> Result<(), String> {
    validate_plugin_id(plugin_id)?;

    let target_dir = base_plugins_dir.join(plugin_id);

    if let (Ok(canon_target), Ok(canon_plugins)) = (fs::canonicalize(&target_dir), fs::canonicalize(base_plugins_dir)) {
        if canon_target.starts_with(&canon_plugins) && canon_target != canon_plugins {
            fs::remove_dir_all(&canon_target)
                .map_err(|e| format!("Failed to remove plugin dir: {}", e))?;
        }
    }
    Ok(())
}

pub fn uninstall_plugin(plugin_id: &str) -> Result<(), String> {
    uninstall_plugin_in_dir(plugin_id, &get_plugins_dir())
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

    static SAFE_MODE_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_safe_mode_toggle() {
        let _guard = SAFE_MODE_TEST_LOCK.lock().unwrap();
        set_safe_mode(true);
        assert!(is_safe_mode());
        set_safe_mode(false);
        assert!(!is_safe_mode());
    }

    #[test]
    fn test_plugin_preservation_and_migration_status() {
        let _guard = SAFE_MODE_TEST_LOCK.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("altspace_test_preservation_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        let sample_plugin_dir = temp_dir.join("sample_tool");
        fs::create_dir_all(&sample_plugin_dir).unwrap();

        let manifest = r#"{
            "id": "sample_tool",
            "name": "Sample Developer Tool",
            "description": "A sample local developer automation tool",
            "keyword": ":sample",
            "script": "run.ps1"
        }"#;
        let script = "Write-Output 'Hello from sample tool'";

        fs::write(sample_plugin_dir.join("manifest.json"), manifest).unwrap();
        fs::write(sample_plugin_dir.join("run.ps1"), script).unwrap();

        // Ensure safe mode is off
        set_safe_mode(false);

        // 1. Verify scan discovers the plugin and preserves its metadata
        let plugins = scan_plugins_in_dir(&temp_dir);
        assert_eq!(plugins.len(), 1);
        let item = &plugins[0];
        assert_eq!(item.id, "sample_tool");
        assert_eq!(item.name, "Sample Developer Tool");
        assert_eq!(item.keyword, ":sample");
        assert_eq!(item.status, PluginStatus::BlockedMigrationRequired);
        assert!(item.status_message.as_ref().unwrap().contains("migration required"));

        // 2. Verify files are completely preserved on disk
        assert!(sample_plugin_dir.join("manifest.json").exists());
        assert!(sample_plugin_dir.join("run.ps1").exists());
        assert_eq!(fs::read_to_string(sample_plugin_dir.join("run.ps1")).unwrap(), script);

        // 3. Verify running the script is blocked and does NOT delete the files
        let run_res = run_plugin_script_in_dir(&item.script_path, "", &temp_dir);
        assert!(run_res.is_err());
        let err_msg = run_res.unwrap_err();
        assert!(err_msg.contains("migration required"));
        assert!(err_msg.contains("blocked for security hardening"));

        // 4. Verify files still exist after execution attempt
        assert!(sample_plugin_dir.join("manifest.json").exists());
        assert!(sample_plugin_dir.join("run.ps1").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_safe_mode_interaction_with_blocked_status() {
        let _guard = SAFE_MODE_TEST_LOCK.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("altspace_test_safemode_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        let sample_plugin_dir = temp_dir.join("sample_tool");
        fs::create_dir_all(&sample_plugin_dir).unwrap();

        let manifest = r#"{
            "id": "sample_tool",
            "name": "Sample Developer Tool",
            "description": "A sample local developer automation tool",
            "keyword": ":sample",
            "script": "run.ps1"
        }"#;
        fs::write(sample_plugin_dir.join("manifest.json"), manifest).unwrap();
        fs::write(sample_plugin_dir.join("run.ps1"), "Write-Output 123").unwrap();

        let script_path = sample_plugin_dir.join("run.ps1").to_string_lossy().to_string();

        // When Safe Mode is active:
        set_safe_mode(true);
        let plugins_safe = scan_plugins_in_dir(&temp_dir);
        // Safe mode filters out community plugins
        assert_eq!(plugins_safe.len(), 0);

        let run_safe = run_plugin_script_in_dir(&script_path, "", &temp_dir);
        assert!(run_safe.is_err());
        assert!(run_safe.unwrap_err().contains("Safe Mode is active"));

        // When Safe Mode is toggled off:
        set_safe_mode(false);
        let plugins_normal = scan_plugins_in_dir(&temp_dir);
        assert_eq!(plugins_normal.len(), 1);
        assert_eq!(plugins_normal[0].status, PluginStatus::BlockedMigrationRequired);

        // Execution is STILL blocked even when safe mode is off
        let run_normal = run_plugin_script_in_dir(&script_path, "", &temp_dir);
        assert!(run_normal.is_err());
        assert!(run_normal.unwrap_err().contains("migration required"));

        set_safe_mode(false);
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_install_plugin_fails_closed_without_writing_files() {
        let temp_dir = std::env::temp_dir().join(format!("altspace_test_install_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        let manifest = r#"{
            "id": "new_tool",
            "name": "New Tool",
            "description": "Tool",
            "keyword": ":new",
            "script": "run.ps1"
        }"#;

        let res = install_plugin("new_tool", manifest, "Write-Output 'Bad'", "run.ps1");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("disabled for security hardening"));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
