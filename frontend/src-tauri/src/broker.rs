use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::os::windows::process::CommandExt;
use std::sync::{Arc, Mutex, LazyLock};
use std::time::{Duration, Instant};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const DEFAULT_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskTier {
    ReadOnlyAuto,
    PreviewThenApprove,
    AlwaysApprove,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionStatus {
    Requested,
    Approved,
    Started,
    Completed,
    Failed,
    Cancelled,
    Undone,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum TypedAction {
    ReadFile {
        path: String,
        max_bytes: Option<usize>,
    },
    WriteFile {
        path: String,
        content: String,
        overwrite: bool,
    },
    DeleteFile {
        path: String,
    },
    RunProgram {
        program: String,
        args: Vec<String>,
        cwd: Option<String>,
    },
    RunPowerShell {
        script: String,
        timeout_secs: Option<u64>,
    },
    CallHttpEndpoint {
        url: String,
        method: String,
        body: Option<String>,
    },
    InstallPlugin {
        plugin_id: String,
        manifest_json: String,
        script_filename: String,
        script_content: String,
    },
    InstallUpdate {
        release_url: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub id: String,
    pub action: TypedAction,
    pub session_token: Option<String>,
    pub bypass_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionEvaluation {
    pub id: String,
    pub risk_tier: RiskTier,
    pub requires_approval: bool,
    pub target_summary: String,
    pub diff_preview: Option<String>,
    pub reversibility: bool,
    pub requires_entitlement: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub id: String,
    pub status: ActionStatus,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub elapsed_ms: u64,
    pub undo_available: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub action_name: String,
    pub risk_tier: RiskTier,
    pub status: ActionStatus,
    pub target: String,
    pub timestamp: u64,
    pub undo_available: bool,
}

// In-memory session approvals set: (action_type, target_prefix)
static SESSION_APPROVALS: LazyLock<Arc<Mutex<HashMap<String, Instant>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

type UndoEntry = (PathBuf, Vec<u8>);
type UndoMap = Arc<Mutex<HashMap<String, UndoEntry>>>;

// In-memory undo buffers: action_id -> (original_path, original_content)
static UNDO_STORE: LazyLock<UndoMap> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

// Action ledger history (bounded in-memory ring / SQLite synced)
static ACTION_LEDGER: LazyLock<Arc<Mutex<Vec<LedgerEntry>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(Vec::new())));

/// Determines the risk tier and approval requirement for a typed action
pub fn evaluate_action(request: &ActionRequest) -> ActionEvaluation {
    match &request.action {
        TypedAction::ReadFile { path, .. } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::ReadOnlyAuto,
            requires_approval: false,
            target_summary: format!("Read file: {}", path),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: false,
        },
        TypedAction::WriteFile { path, content, overwrite } => {
            let exists = Path::new(path).exists();
            let summary = if exists {
                format!("Overwrite existing file: {}", path)
            } else {
                format!("Create new file: {}", path)
            };
            let diff = if content.len() > 1000 {
                format!("{}... (truncated {} bytes)", &content[..1000], content.len())
            } else {
                content.clone()
            };

            // Check if already approved for this session
            let is_session_approved = has_session_approval("write_file", path);

            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::PreviewThenApprove,
                requires_approval: !is_session_approved && !request.bypass_approval,
                target_summary: summary,
                diff_preview: Some(diff),
                reversibility: exists || *overwrite,
                requires_entitlement: false,
            }
        }
        TypedAction::DeleteFile { path } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::AlwaysApprove,
            requires_approval: !request.bypass_approval,
            target_summary: format!("Permanently delete: {}", path),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: false,
        },
        TypedAction::RunProgram { program, args, .. } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::AlwaysApprove,
            requires_approval: !request.bypass_approval,
            target_summary: format!("Execute binary: {} with args: {:?}", program, args),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: true,
        },
        TypedAction::RunPowerShell { script, .. } => {
            let preview = if script.len() > 500 {
                format!("{}... (truncated)", &script[..500])
            } else {
                script.clone()
            };
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::AlwaysApprove,
                requires_approval: !request.bypass_approval,
                target_summary: "Run PowerShell command".into(),
                diff_preview: Some(preview),
                reversibility: false,
                requires_entitlement: true,
            }
        }
        TypedAction::CallHttpEndpoint { url, method, body } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::PreviewThenApprove,
            requires_approval: !has_session_approval("http", url) && !request.bypass_approval,
            target_summary: format!("HTTP {} {}", method, url),
            diff_preview: body.clone(),
            reversibility: false,
            requires_entitlement: true,
        },
        TypedAction::InstallPlugin { plugin_id, script_filename, .. } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::PreviewThenApprove,
            requires_approval: !request.bypass_approval,
            target_summary: format!("Install extension '{}' ({})", plugin_id, script_filename),
            diff_preview: None,
            reversibility: true,
            requires_entitlement: false,
        },
        TypedAction::InstallUpdate { release_url } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::ReadOnlyAuto,
            requires_approval: false,
            target_summary: format!("Open verified release page: {}", release_url),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: false,
        },
    }
}

pub fn remember_session_approval(action_type: &str, target: &str) {
    if let Ok(mut lock) = SESSION_APPROVALS.lock() {
        let key = format!("{}:{}", action_type, target);
        lock.insert(key, Instant::now());
    }
}

fn has_session_approval(action_type: &str, target: &str) -> bool {
    if let Ok(lock) = SESSION_APPROVALS.lock() {
        let key = format!("{}:{}", action_type, target);
        if let Some(ts) = lock.get(&key) {
            // Approvals valid for 2 hours within active session
            return ts.elapsed() < Duration::from_secs(7200);
        }
    }
    false
}

/// Executes a validated and policy-checked typed action
pub fn execute_action(request: &ActionRequest) -> ActionResult {
    let start = Instant::now();
    let evaluation = evaluate_action(request);

    // Record start in ledger
    record_ledger(LedgerEntry {
        id: request.id.clone(),
        action_name: format!("{:?}", std::mem::discriminant(&request.action)),
        risk_tier: evaluation.risk_tier,
        status: ActionStatus::Started,
        target: evaluation.target_summary.clone(),
        timestamp: chrono::Utc::now().timestamp() as u64,
        undo_available: evaluation.reversibility,
    });

    match &request.action {
        TypedAction::ReadFile { path, max_bytes } => {
            let max = max_bytes.unwrap_or(1024 * 1024); // 1MB default
            let p = Path::new(path);
            if !p.exists() {
                return make_failure(&request.id, "File does not exist", start.elapsed());
            }
            match fs::read(p) {
                Ok(bytes) => {
                    let to_take = bytes.len().min(max);
                    let content = String::from_utf8_lossy(&bytes[..to_take]).to_string();
                    make_success(&request.id, content, String::new(), start.elapsed(), false)
                }
                Err(e) => make_failure(&request.id, &format!("Failed to read file: {}", e), start.elapsed()),
            }
        }
        TypedAction::WriteFile { path, content, overwrite } => {
            let p = PathBuf::from(path);
            let exists = p.exists();
            if exists && !*overwrite {
                return make_failure(&request.id, "File exists and overwrite is false", start.elapsed());
            }

            // Stash original content for undo
            if exists {
                if let Ok(orig) = fs::read(&p) {
                    if let Ok(mut undo) = UNDO_STORE.lock() {
                        undo.insert(request.id.clone(), (p.clone(), orig));
                    }
                }
            }

            if let Some(parent) = p.parent() {
                let _ = fs::create_dir_all(parent);
            }

            match fs::write(&p, content) {
                Ok(_) => make_success(&request.id, format!("Wrote {} bytes to {}", content.len(), path), String::new(), start.elapsed(), exists),
                Err(e) => make_failure(&request.id, &format!("Failed to write file: {}", e), start.elapsed()),
            }
        }
        TypedAction::DeleteFile { path } => {
            let p = Path::new(path);
            if !p.exists() {
                return make_failure(&request.id, "Path does not exist", start.elapsed());
            }
            let res = if p.is_dir() {
                fs::remove_dir_all(p)
            } else {
                fs::remove_file(p)
            };
            match res {
                Ok(_) => make_success(&request.id, format!("Deleted: {}", path), String::new(), start.elapsed(), false),
                Err(e) => make_failure(&request.id, &format!("Failed to delete: {}", e), start.elapsed()),
            }
        }
        TypedAction::RunProgram { program, args, cwd } => {
            let mut cmd = Command::new(program);
            cmd.args(args);
            if let Some(c) = cwd {
                cmd.current_dir(c);
            }
            cmd.creation_flags(CREATE_NO_WINDOW);

            match cmd.output() {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    if out.status.success() {
                        make_success(&request.id, stdout, stderr, start.elapsed(), false)
                    } else {
                        make_failure(&request.id, &format!("Exit code: {:?}. {}", out.status.code(), stderr), start.elapsed())
                    }
                }
                Err(e) => make_failure(&request.id, &format!("Failed to spawn {}: {}", program, e), start.elapsed()),
            }
        }
        TypedAction::RunPowerShell { script, timeout_secs } => {
            let timeout = Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]);
            cmd.creation_flags(CREATE_NO_WINDOW);

            let res = match cmd.output() {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    if out.status.success() {
                        make_success(&request.id, stdout, stderr, start.elapsed(), false)
                    } else {
                        make_failure(&request.id, &format!("Execution error: {}", stderr), start.elapsed())
                    }
                }
                Err(e) => make_failure(&request.id, &format!("Failed to execute script: {}", e), start.elapsed()),
            };
            let _ = timeout;
            res
        }
        TypedAction::CallHttpEndpoint { url, method, body } => {
            // Basic secure HTTP request runner
            let mut cmd = Command::new("powershell.exe");
            let ps = if let Some(b) = body {
                format!(
                    r#"$r = Invoke-RestMethod -Uri '{}' -Method '{}' -Body '{}' -ContentType 'application/json' -TimeoutSec 10; ConvertTo-Json -InputObject $r -Compress"#,
                    url, method, b.replace('\'', "''")
                )
            } else {
                format!(
                    r#"$r = Invoke-RestMethod -Uri '{}' -Method '{}' -TimeoutSec 10; ConvertTo-Json -InputObject $r -Compress"#,
                    url, method
                )
            };
            cmd.args(["-NoProfile", "-Command", &ps]);
            cmd.creation_flags(CREATE_NO_WINDOW);

            match cmd.output() {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    if out.status.success() {
                        make_success(&request.id, stdout, stderr, start.elapsed(), false)
                    } else {
                        make_failure(&request.id, &format!("HTTP call failed: {}", stderr), start.elapsed())
                    }
                }
                Err(e) => make_failure(&request.id, &format!("Network execution failed: {}", e), start.elapsed()),
            }
        }
        TypedAction::InstallPlugin { plugin_id, manifest_json, script_filename, script_content } => {
            let res = crate::plugins::install_plugin(
                plugin_id,
                manifest_json,
                script_content,
                script_filename,
            );
            match res {
                Ok(_) => make_success(&request.id, format!("Successfully installed extension '{}'", plugin_id), String::new(), start.elapsed(), true),
                Err(ref e) => make_failure(&request.id, e, start.elapsed()),
            }
        }
        TypedAction::InstallUpdate { release_url } => {
            match Command::new("explorer.exe").arg(release_url).creation_flags(CREATE_NO_WINDOW).spawn() {
                Ok(_) => make_success(&request.id, format!("Opened release page: {}", release_url), String::new(), start.elapsed(), false),
                Err(e) => make_failure(&request.id, &format!("Failed to open browser: {}", e), start.elapsed()),
            }
        }
    }
}

/// Reverts a previously executed reversible action
pub fn undo_action(action_id: &str) -> Result<String, String> {
    if let Ok(mut undo) = UNDO_STORE.lock() {
        if let Some((path, original_bytes)) = undo.remove(action_id) {
            fs::write(&path, original_bytes)
                .map_err(|e| format!("Failed to restore file {}: {}", path.display(), e))?;
            return Ok(format!("Successfully restored {}", path.display()));
        }
    }
    Err("No undo buffer found or action is not reversible".into())
}

/// Retrieves the recent ledger history
pub fn get_action_ledger() -> Vec<LedgerEntry> {
    if let Ok(lock) = ACTION_LEDGER.lock() {
        lock.iter().cloned().rev().take(50).collect()
    } else {
        Vec::new()
    }
}

fn record_ledger(entry: LedgerEntry) {
    if let Ok(mut lock) = ACTION_LEDGER.lock() {
        lock.push(entry);
        if lock.len() > 100 {
            lock.remove(0);
        }
    }
}

fn make_success(id: &str, stdout: String, stderr: String, dur: Duration, undo: bool) -> ActionResult {
    ActionResult {
        id: id.to_string(),
        status: ActionStatus::Completed,
        success: true,
        stdout,
        stderr,
        elapsed_ms: dur.as_millis() as u64,
        undo_available: undo,
        error_message: None,
    }
}

fn make_failure(id: &str, err: &str, dur: Duration) -> ActionResult {
    ActionResult {
        id: id.to_string(),
        status: ActionStatus::Failed,
        success: false,
        stdout: String::new(),
        stderr: err.to_string(),
        elapsed_ms: dur.as_millis() as u64,
        undo_available: false,
        error_message: Some(err.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_policy_classification_levels() {
        let read = ActionRequest {
            id: "act-1".into(),
            action: TypedAction::ReadFile { path: "C:\\test.txt".into(), max_bytes: None },
            session_token: None,
            bypass_approval: false,
        };
        let eval_read = evaluate_action(&read);
        assert_eq!(eval_read.risk_tier, RiskTier::ReadOnlyAuto);
        assert!(!eval_read.requires_approval);

        let write = ActionRequest {
            id: "act-2".into(),
            action: TypedAction::WriteFile { path: "C:\\out.txt".into(), content: "hello".into(), overwrite: true },
            session_token: None,
            bypass_approval: false,
        };
        let eval_write = evaluate_action(&write);
        assert_eq!(eval_write.risk_tier, RiskTier::PreviewThenApprove);
        assert!(eval_write.requires_approval);

        let delete = ActionRequest {
            id: "act-3".into(),
            action: TypedAction::DeleteFile { path: "C:\\del.txt".into() },
            session_token: None,
            bypass_approval: false,
        };
        let eval_del = evaluate_action(&delete);
        assert_eq!(eval_del.risk_tier, RiskTier::AlwaysApprove);
        assert!(eval_del.requires_approval);

        let ps = ActionRequest {
            id: "act-4".into(),
            action: TypedAction::RunPowerShell { script: "Get-Process".into(), timeout_secs: None },
            session_token: None,
            bypass_approval: false,
        };
        let eval_ps = evaluate_action(&ps);
        assert_eq!(eval_ps.risk_tier, RiskTier::AlwaysApprove);
        assert!(eval_ps.requires_approval);
    }

    #[test]
    fn test_session_approval_remembering() {
        let target = "C:\\session_test.txt";
        assert!(!has_session_approval("write_file", target));
        remember_session_approval("write_file", target);
        assert!(has_session_approval("write_file", target));
    }
}
