use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

const CREATE_NO_WINDOW: u32 = 0x08000000;

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
    FreePortAndVerify {
        port: u16,
        pid: u32,
    },
    RestartDockerContainer {
        id: String,
    },
    ReclaimWslMemory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub id: String,
    pub action: TypedAction,
    pub session_token: Option<String>,
    pub approval_token: Option<String>,
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
    pub approval_token: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureEvent {
    pub id: String,
    pub source: String,
    pub command_or_target: String,
    pub exit_code: Option<i32>,
    pub error_message: String,
    pub stdout_excerpt: Option<String>,
    pub timestamp: u64,
}

static FAILURE_RING_BUFFER: LazyLock<Arc<Mutex<Vec<FailureEvent>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(Vec::with_capacity(10))));

pub fn redact_sensitive_str(input: &str) -> String {
    let mut s = input.to_string();

    // 1. Anthropic keys (must be evaluated before generic sk-)
    if let Ok(re) = regex::Regex::new(r"\bsk-ant-[a-zA-Z0-9_\-]{15,}\b") {
        s = re.replace_all(&s, "[REDACTED_ANTHROPIC_KEY]").to_string();
    }
    // 2. OpenAI / generic AI keys
    if let Ok(re) = regex::Regex::new(r"\bsk-(?:proj-)?[a-zA-Z0-9_\-]{15,}\b") {
        s = re.replace_all(&s, "[REDACTED_API_KEY]").to_string();
    }
    // 3. GitHub tokens (ghp, gho, ghu, ghs, ghr)
    if let Ok(re) = regex::Regex::new(r"\bgh[pousr]_[a-zA-Z0-9]{20,}\b") {
        s = re.replace_all(&s, "[REDACTED_GITHUB_TOKEN]").to_string();
    }
    // 4. Bearer tokens
    if let Ok(re) = regex::Regex::new(r"(?i)\bbearer\s+[a-zA-Z0-9_\-\.~+/]+=*") {
        s = re.replace_all(&s, "Bearer [REDACTED_TOKEN]").to_string();
    }
    // 5. Windows user paths
    if let Ok(re) = regex::Regex::new(r"(?i)[a-z]:\\users\\[^\\]+\\") {
        s = re.replace_all(&s, "~\\").to_string();
    }

    s
}

pub fn record_failure_event(mut event: FailureEvent) {
    event.command_or_target = redact_sensitive_str(&event.command_or_target);
    event.error_message = redact_sensitive_str(&event.error_message);
    if let Some(ref mut out) = event.stdout_excerpt {
        *out = redact_sensitive_str(out);
    }
    if let Ok(mut buf) = FAILURE_RING_BUFFER.lock() {
        if buf.len() >= 10 {
            buf.remove(0);
        }
        buf.push(event);
    }
}

pub fn get_recent_failures() -> Vec<FailureEvent> {
    if let Ok(buf) = FAILURE_RING_BUFFER.lock() {
        buf.clone()
    } else {
        Vec::new()
    }
}

pub fn clear_failures() {
    if let Ok(mut buf) = FAILURE_RING_BUFFER.lock() {
        buf.clear();
    }
}

// Cryptographic challenge structure for Level 2 and Level 3 actions
#[derive(Debug, Clone)]
pub struct ApprovalChallenge {
    pub action_digest: [u8; 32],
    pub expires_at: Instant,
}

static CHALLENGE_STORE: LazyLock<Arc<Mutex<HashMap<String, ApprovalChallenge>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

pub const CHALLENGE_TTL_SECS: u64 = 60;

pub fn compute_action_digest(action: &TypedAction) -> Result<[u8; 32], String> {
    let serialized = serde_json::to_vec(action)
        .map_err(|e| format!("Failed to serialize action for digest: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&serialized);
    Ok(hasher.finalize().into())
}

fn generate_secure_token() -> Result<String, String> {
    use windows::Win32::Security::Cryptography::{
        BCryptGenRandom, BCRYPT_ALG_HANDLE, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    };
    let mut buf = [0u8; 32];
    unsafe {
        BCryptGenRandom(
            BCRYPT_ALG_HANDLE::default(),
            &mut buf,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
        .ok()
        .map_err(|e| format!("BCryptGenRandom failed: {}", e))?;
    }
    let mut hex = String::with_capacity(64);
    for b in buf {
        use std::fmt::Write;
        let _ = write!(hex, "{:02x}", b);
    }
    Ok(hex)
}

pub fn issue_approval_challenge_with_ttl(
    action: &TypedAction,
    ttl: Duration,
) -> Result<String, String> {
    let digest = compute_action_digest(action)?;
    let token = generate_secure_token()?;
    let challenge = ApprovalChallenge {
        action_digest: digest,
        expires_at: Instant::now() + ttl,
    };
    if let Ok(mut store) = CHALLENGE_STORE.lock() {
        if store.len() > 100 {
            let now = Instant::now();
            store.retain(|_, v| v.expires_at > now);
        }
        store.insert(token.clone(), challenge);
    }
    Ok(token)
}

pub fn issue_approval_challenge(action: &TypedAction) -> Result<String, String> {
    issue_approval_challenge_with_ttl(action, Duration::from_secs(CHALLENGE_TTL_SECS))
}

pub fn remember_session_approval(_action_type: &str, _target: &str) {
    // Deprecated / no-op: session caching cannot bypass parameter-bound single-use challenge tokens
}

type UndoEntry = (PathBuf, Vec<u8>);
type UndoMap = Arc<Mutex<HashMap<String, UndoEntry>>>;

// In-memory undo buffers: action_id -> (original_path, original_content)
static UNDO_STORE: LazyLock<UndoMap> = LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

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
            approval_token: None,
        },
        TypedAction::InstallUpdate { release_url } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::ReadOnlyAuto,
            requires_approval: false,
            target_summary: format!("Open verified release page: {}", release_url),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: false,
            approval_token: None,
        },
        TypedAction::RunPowerShell { .. } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::AlwaysApprove,
            requires_approval: false,
            target_summary:
                "Run PowerShell command (Capability permanently disabled for security hardening)"
                    .into(),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: true,
            approval_token: None,
        },
        TypedAction::CallHttpEndpoint { method, url, .. } => ActionEvaluation {
            id: request.id.clone(),
            risk_tier: RiskTier::PreviewThenApprove,
            requires_approval: false,
            target_summary: format!(
                "HTTP {} {} (Capability permanently disabled for security hardening)",
                method, url
            ),
            diff_preview: None,
            reversibility: false,
            requires_entitlement: true,
            approval_token: None,
        },
        TypedAction::WriteFile {
            path,
            content,
            overwrite,
        } => {
            let exists = Path::new(path).exists();
            let summary = if exists {
                format!("Overwrite existing file: {}", path)
            } else {
                format!("Create new file: {}", path)
            };
            let diff = if content.len() > 1000 {
                format!(
                    "{}... (truncated {} bytes)",
                    &content[..1000],
                    content.len()
                )
            } else {
                content.clone()
            };

            let approval_token = issue_approval_challenge(&request.action).ok();

            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::PreviewThenApprove,
                requires_approval: true,
                target_summary: summary,
                diff_preview: Some(diff),
                reversibility: exists || *overwrite,
                requires_entitlement: false,
                approval_token,
            }
        }
        TypedAction::DeleteFile { path } => {
            let approval_token = issue_approval_challenge(&request.action).ok();
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::AlwaysApprove,
                requires_approval: true,
                target_summary: format!("Permanently delete: {}", path),
                diff_preview: None,
                reversibility: false,
                requires_entitlement: false,
                approval_token,
            }
        }
        TypedAction::RunProgram { program, args, .. } => {
            let approval_token = issue_approval_challenge(&request.action).ok();
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::AlwaysApprove,
                requires_approval: true,
                target_summary: format!("Execute binary: {} with args: {:?}", program, args),
                diff_preview: None,
                reversibility: false,
                requires_entitlement: true,
                approval_token,
            }
        }
        TypedAction::InstallPlugin {
            plugin_id,
            script_filename,
            ..
        } => {
            let approval_token = issue_approval_challenge(&request.action).ok();
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::PreviewThenApprove,
                requires_approval: true,
                target_summary: format!("Install extension '{}' ({})", plugin_id, script_filename),
                diff_preview: None,
                reversibility: true,
                requires_entitlement: false,
                approval_token,
            }
        }
        TypedAction::FreePortAndVerify { port, pid } => {
            let approval_token = issue_approval_challenge(&request.action).ok();
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::PreviewThenApprove,
                requires_approval: true,
                target_summary: format!("Free TCP port :{} (PID {}) with verification", port, pid),
                diff_preview: Some(format!("taskkill.exe /PID {} /T /F -> Poll TCP Table", pid)),
                reversibility: false,
                requires_entitlement: false,
                approval_token,
            }
        }
        TypedAction::RestartDockerContainer { id } => {
            let approval_token = issue_approval_challenge(&request.action).ok();
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::PreviewThenApprove,
                requires_approval: true,
                target_summary: format!("Restart Docker container '{}'", id),
                diff_preview: Some(format!("docker.exe restart {}", id)),
                reversibility: false,
                requires_entitlement: false,
                approval_token,
            }
        }
        TypedAction::ReclaimWslMemory => {
            let approval_token = issue_approval_challenge(&request.action).ok();
            ActionEvaluation {
                id: request.id.clone(),
                risk_tier: RiskTier::PreviewThenApprove,
                requires_approval: true,
                target_summary: "Reclaim WSL2 hypervisor dynamic memory".into(),
                diff_preview: Some("wsl.exe --shutdown -> Reclaim VMMem memory".into()),
                reversibility: false,
                requires_entitlement: false,
                approval_token,
            }
        }
    }
}

/// Executes a validated and policy-checked typed action
pub fn execute_action(request: &ActionRequest) -> ActionResult {
    let start = Instant::now();

    // 1. Immediately fail closed on permanently disabled capabilities
    match &request.action {
        TypedAction::RunPowerShell { .. } => {
            return make_failure(
                &request.id,
                "Capability disabled: RunPowerShell execution route is permanently removed for security hardening.",
                start.elapsed(),
            );
        }
        TypedAction::CallHttpEndpoint { .. } => {
            return make_failure(
                &request.id,
                "Capability disabled: CallHttpEndpoint execution route is permanently removed for security hardening.",
                start.elapsed(),
            );
        }
        _ => {}
    }

    // 2. Classify risk tier
    let risk_tier = match &request.action {
        TypedAction::ReadFile { .. } | TypedAction::InstallUpdate { .. } => RiskTier::ReadOnlyAuto,
        TypedAction::WriteFile { .. }
        | TypedAction::InstallPlugin { .. }
        | TypedAction::FreePortAndVerify { .. }
        | TypedAction::RestartDockerContainer { .. }
        | TypedAction::ReclaimWslMemory => RiskTier::PreviewThenApprove,
        TypedAction::DeleteFile { .. } | TypedAction::RunProgram { .. } => RiskTier::AlwaysApprove,
        TypedAction::RunPowerShell { .. } | TypedAction::CallHttpEndpoint { .. } => unreachable!(),
    };

    // 3. For Level 2 and Level 3 actions, enforce single-use, unexpired, parameter-bound approval token
    if risk_tier != RiskTier::ReadOnlyAuto {
        let token = match &request.approval_token {
            Some(tok) if !tok.trim().is_empty() => tok.trim(),
            _ => {
                return make_failure(
                    &request.id,
                    "Approval required: this action requires an approval token issued by the backend evaluation challenge.",
                    start.elapsed(),
                );
            }
        };

        // Atomically retrieve and remove token (enforces single-use & replay safety)
        let challenge = match CHALLENGE_STORE.lock() {
            Ok(mut store) => store.remove(token),
            Err(_) => {
                return make_failure(
                    &request.id,
                    "Internal challenge store lock error.",
                    start.elapsed(),
                );
            }
        };

        let challenge = match challenge {
            Some(c) => c,
            None => {
                return make_failure(
                    &request.id,
                    "Invalid, already consumed, or unknown approval token.",
                    start.elapsed(),
                );
            }
        };

        // Enforce expiry
        if Instant::now() > challenge.expires_at {
            return make_failure(&request.id, "Approval token has expired.", start.elapsed());
        }

        // Enforce parameter binding (prevent mutation)
        let current_digest = match compute_action_digest(&request.action) {
            Ok(d) => d,
            Err(e) => {
                return make_failure(
                    &request.id,
                    &format!("Failed to compute action digest: {}", e),
                    start.elapsed(),
                );
            }
        };

        if current_digest != challenge.action_digest {
            return make_failure(
                &request.id,
                "Approval token parameter mismatch: action payload was mutated after evaluation challenge issuance.",
                start.elapsed(),
            );
        }
    }

    // 4. Record start in ledger
    let target_summary = match &request.action {
        TypedAction::ReadFile { path, .. } => format!("Read file: {}", path),
        TypedAction::WriteFile { path, .. } => format!("Write file: {}", path),
        TypedAction::DeleteFile { path } => format!("Delete: {}", path),
        TypedAction::RunProgram { program, args, .. } => {
            format!("Execute binary: {} with args: {:?}", program, args)
        }
        TypedAction::InstallPlugin { plugin_id, .. } => {
            format!("Install extension '{}'", plugin_id)
        }
        TypedAction::InstallUpdate { release_url } => format!("Open release page: {}", release_url),
        TypedAction::FreePortAndVerify { port, pid } => {
            format!("Free TCP port :{} (PID {})", port, pid)
        }
        TypedAction::RestartDockerContainer { id } => format!("Restart Docker container '{}'", id),
        TypedAction::ReclaimWslMemory => "Reclaim WSL2 hypervisor dynamic memory".into(),
        _ => "Unknown action".into(),
    };

    record_ledger(LedgerEntry {
        id: request.id.clone(),
        action_name: format!("{:?}", std::mem::discriminant(&request.action)),
        risk_tier,
        status: ActionStatus::Started,
        target: target_summary,
        timestamp: chrono::Utc::now().timestamp() as u64,
        undo_available: matches!(request.action, TypedAction::WriteFile { .. }),
    });

    // 5. Execute action
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
                Err(e) => make_failure(
                    &request.id,
                    &format!("Failed to read file: {}", e),
                    start.elapsed(),
                ),
            }
        }
        TypedAction::WriteFile {
            path,
            content,
            overwrite,
        } => {
            let p = PathBuf::from(path);
            let exists = p.exists();
            if exists && !*overwrite {
                return make_failure(
                    &request.id,
                    "File exists and overwrite is false",
                    start.elapsed(),
                );
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
                Ok(_) => make_success(
                    &request.id,
                    format!("Wrote {} bytes to {}", content.len(), path),
                    String::new(),
                    start.elapsed(),
                    exists,
                ),
                Err(e) => make_failure(
                    &request.id,
                    &format!("Failed to write file: {}", e),
                    start.elapsed(),
                ),
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
                Ok(_) => make_success(
                    &request.id,
                    format!("Deleted: {}", path),
                    String::new(),
                    start.elapsed(),
                    false,
                ),
                Err(e) => make_failure(
                    &request.id,
                    &format!("Failed to delete: {}", e),
                    start.elapsed(),
                ),
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
                        make_failure(
                            &request.id,
                            &format!("Exit code: {:?}. {}", out.status.code(), stderr),
                            start.elapsed(),
                        )
                    }
                }
                Err(e) => make_failure(
                    &request.id,
                    &format!("Failed to spawn {}: {}", program, e),
                    start.elapsed(),
                ),
            }
        }
        TypedAction::InstallPlugin {
            plugin_id,
            manifest_json,
            script_filename,
            script_content,
        } => {
            let res = crate::plugins::install_plugin(
                plugin_id,
                manifest_json,
                script_content,
                script_filename,
            );
            match res {
                Ok(_) => make_success(
                    &request.id,
                    format!("Successfully installed extension '{}'", plugin_id),
                    String::new(),
                    start.elapsed(),
                    true,
                ),
                Err(ref e) => make_failure(&request.id, e, start.elapsed()),
            }
        }
        TypedAction::InstallUpdate { release_url } => {
            match Command::new("explorer.exe")
                .arg(release_url)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
            {
                Ok(_) => make_success(
                    &request.id,
                    format!("Opened release page: {}", release_url),
                    String::new(),
                    start.elapsed(),
                    false,
                ),
                Err(e) => make_failure(
                    &request.id,
                    &format!("Failed to open browser: {}", e),
                    start.elapsed(),
                ),
            }
        }
        TypedAction::FreePortAndVerify { port, pid } => {
            match crate::ports::kill_and_verify_port(*port, *pid) {
                Ok(res) => {
                    if res.verified_free || res.success {
                        make_success(
                            &request.id,
                            res.message,
                            String::new(),
                            start.elapsed(),
                            false,
                        )
                    } else {
                        make_failure(&request.id, &res.message, start.elapsed())
                    }
                }
                Err(e) => make_failure(&request.id, &e, start.elapsed()),
            }
        }
        TypedAction::RestartDockerContainer { id } => {
            let res = crate::docker_wsl::docker_action(id, "restart");
            if res.success {
                make_success(
                    &request.id,
                    res.message,
                    res.stdout.unwrap_or_default(),
                    start.elapsed(),
                    false,
                )
            } else {
                make_failure(&request.id, &res.message, start.elapsed())
            }
        }
        TypedAction::ReclaimWslMemory => {
            let res = crate::docker_wsl::wsl_shutdown();
            if res.success {
                make_success(
                    &request.id,
                    res.message,
                    res.stdout.unwrap_or_default(),
                    start.elapsed(),
                    false,
                )
            } else {
                make_failure(&request.id, &res.message, start.elapsed())
            }
        }
        TypedAction::RunPowerShell { .. } | TypedAction::CallHttpEndpoint { .. } => unreachable!(),
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

fn record_ledger(mut entry: LedgerEntry) {
    entry.target = redact_sensitive_str(&entry.target);
    if let Ok(mut lock) = ACTION_LEDGER.lock() {
        lock.push(entry);
        if lock.len() > 100 {
            lock.remove(0);
        }
    }
}

fn make_success(
    id: &str,
    stdout: String,
    stderr: String,
    dur: Duration,
    undo: bool,
) -> ActionResult {
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
            action: TypedAction::ReadFile {
                path: "C:\\test.txt".into(),
                max_bytes: None,
            },
            session_token: None,
            approval_token: None,
        };
        let eval_read = evaluate_action(&read);
        assert_eq!(eval_read.risk_tier, RiskTier::ReadOnlyAuto);
        assert!(!eval_read.requires_approval);
        assert!(eval_read.approval_token.is_none());

        let write = ActionRequest {
            id: "act-2".into(),
            action: TypedAction::WriteFile {
                path: "C:\\out.txt".into(),
                content: "hello".into(),
                overwrite: true,
            },
            session_token: None,
            approval_token: None,
        };
        let eval_write = evaluate_action(&write);
        assert_eq!(eval_write.risk_tier, RiskTier::PreviewThenApprove);
        assert!(eval_write.requires_approval);
        assert!(eval_write.approval_token.is_some());

        let delete = ActionRequest {
            id: "act-3".into(),
            action: TypedAction::DeleteFile {
                path: "C:\\del.txt".into(),
            },
            session_token: None,
            approval_token: None,
        };
        let eval_del = evaluate_action(&delete);
        assert_eq!(eval_del.risk_tier, RiskTier::AlwaysApprove);
        assert!(eval_del.requires_approval);
        assert!(eval_del.approval_token.is_some());
    }

    #[test]
    fn test_level_1_actions_execute_without_approval_token() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("altspace_broker_l1_test.txt");
        let _ = fs::write(&test_file, "level1_data");

        let read_req = ActionRequest {
            id: "act-l1".into(),
            action: TypedAction::ReadFile {
                path: test_file.to_string_lossy().into(),
                max_bytes: None,
            },
            session_token: None,
            approval_token: None,
        };
        let res = execute_action(&read_req);
        assert!(
            res.success,
            "Level 1 action must execute without approval token: {:?}",
            res.error_message
        );
        assert_eq!(res.stdout, "level1_data");

        let _ = fs::remove_file(test_file);
    }

    #[test]
    fn test_level_2_and_3_actions_fail_closed_without_token() {
        let write_req = ActionRequest {
            id: "act-unapproved-write".into(),
            action: TypedAction::WriteFile {
                path: "C:\\unapproved.txt".into(),
                content: "data".into(),
                overwrite: true,
            },
            session_token: None,
            approval_token: None,
        };
        let res_write = execute_action(&write_req);
        assert!(!res_write.success);
        assert!(res_write
            .error_message
            .unwrap()
            .contains("Approval required"));

        let del_req = ActionRequest {
            id: "act-unapproved-del".into(),
            action: TypedAction::DeleteFile {
                path: "C:\\unapproved.txt".into(),
            },
            session_token: None,
            approval_token: None,
        };
        let res_del = execute_action(&del_req);
        assert!(!res_del.success);
        assert!(res_del.error_message.unwrap().contains("Approval required"));
    }

    #[test]
    fn test_single_use_and_replay_rejection() {
        let temp_dir = std::env::temp_dir();
        let target_file = temp_dir.join("altspace_replay_test.txt");
        let action = TypedAction::WriteFile {
            path: target_file.to_string_lossy().into(),
            content: "initial_write".into(),
            overwrite: true,
        };

        // 1. Evaluate to obtain backend-issued challenge token
        let eval_req = ActionRequest {
            id: "eval-replay".into(),
            action: action.clone(),
            session_token: None,
            approval_token: None,
        };
        let eval = evaluate_action(&eval_req);
        let token = eval
            .approval_token
            .expect("Challenge token must be generated");

        // 2. First execution succeeds
        let exec_req1 = ActionRequest {
            id: "exec-replay-1".into(),
            action: action.clone(),
            session_token: None,
            approval_token: Some(token.clone()),
        };
        let res1 = execute_action(&exec_req1);
        assert!(
            res1.success,
            "First execution with token must succeed: {:?}",
            res1.error_message
        );

        // 3. Second execution (replay) fails closed
        let exec_req2 = ActionRequest {
            id: "exec-replay-2".into(),
            action,
            session_token: None,
            approval_token: Some(token),
        };
        let res2 = execute_action(&exec_req2);
        assert!(!res2.success, "Replayed token must be rejected");
        assert!(res2.error_message.unwrap().contains("already consumed"));

        let _ = fs::remove_file(target_file);
    }

    #[test]
    fn test_token_expiry_rejection() {
        let action = TypedAction::WriteFile {
            path: "C:\\expired_test.txt".into(),
            content: "expired_payload".into(),
            overwrite: true,
        };

        // Issue token with 0 duration TTL (already expired)
        let token = issue_approval_challenge_with_ttl(&action, Duration::from_nanos(0))
            .expect("Token generation succeeded");

        // Small sleep to ensure Instant::now() > expires_at
        std::thread::sleep(Duration::from_millis(5));

        let exec_req = ActionRequest {
            id: "exec-expired".into(),
            action,
            session_token: None,
            approval_token: Some(token),
        };
        let res = execute_action(&exec_req);
        assert!(!res.success, "Expired token must be rejected");
        assert!(res.error_message.unwrap().contains("expired"));
    }

    #[test]
    fn test_parameter_mutation_rejection() {
        let original_action = TypedAction::WriteFile {
            path: "C:\\safe_doc.txt".into(),
            content: "innocuous text".into(),
            overwrite: true,
        };

        let eval_req = ActionRequest {
            id: "eval-mutation".into(),
            action: original_action,
            session_token: None,
            approval_token: None,
        };
        let eval = evaluate_action(&eval_req);
        let token = eval.approval_token.expect("Must produce token");

        // Attempt to execute with modified target path
        let mutated_action_1 = TypedAction::WriteFile {
            path: "C:\\Windows\\System32\\drivers\\etc\\hosts".into(),
            content: "innocuous text".into(),
            overwrite: true,
        };
        let exec_req_1 = ActionRequest {
            id: "exec-mutated-1".into(),
            action: mutated_action_1,
            session_token: None,
            approval_token: Some(token.clone()),
        };
        let res1 = execute_action(&exec_req_1);
        assert!(!res1.success, "Mutated action path must be rejected");
        assert!(res1.error_message.unwrap().contains("parameter mismatch"));

        // Issue a second token to test mutated content
        let action_for_content = TypedAction::WriteFile {
            path: "C:\\safe_doc.txt".into(),
            content: "original".into(),
            overwrite: true,
        };
        let token2 = issue_approval_challenge(&action_for_content).unwrap();

        let mutated_content_action = TypedAction::WriteFile {
            path: "C:\\safe_doc.txt".into(),
            content: "malicious injected content".into(),
            overwrite: true,
        };
        let exec_req_2 = ActionRequest {
            id: "exec-mutated-2".into(),
            action: mutated_content_action,
            session_token: None,
            approval_token: Some(token2),
        };
        let res2 = execute_action(&exec_req_2);
        assert!(!res2.success, "Mutated action content must be rejected");
        assert!(res2.error_message.unwrap().contains("parameter mismatch"));
    }

    #[test]
    fn test_powershell_route_permanently_disabled() {
        let ps_action = TypedAction::RunPowerShell {
            script: "Get-Process".into(),
            timeout_secs: None,
        };

        let eval_req = ActionRequest {
            id: "eval-ps".into(),
            action: ps_action.clone(),
            session_token: None,
            approval_token: None,
        };
        let eval = evaluate_action(&eval_req);
        assert!(!eval.requires_approval);
        assert!(eval.approval_token.is_none());
        assert!(eval.target_summary.contains("permanently disabled"));

        let exec_req = ActionRequest {
            id: "exec-ps".into(),
            action: ps_action,
            session_token: None,
            approval_token: Some("arbitrary_token".into()),
        };
        let res = execute_action(&exec_req);
        assert!(!res.success, "RunPowerShell must fail closed");
        assert!(res
            .error_message
            .unwrap()
            .contains("RunPowerShell execution route is permanently removed"));
    }

    #[test]
    fn test_http_route_permanently_disabled() {
        let http_action = TypedAction::CallHttpEndpoint {
            url: "https://example.com/api".into(),
            method: "POST".into(),
            body: Some("{}".into()),
        };

        let eval_req = ActionRequest {
            id: "eval-http".into(),
            action: http_action.clone(),
            session_token: None,
            approval_token: None,
        };
        let eval = evaluate_action(&eval_req);
        assert!(!eval.requires_approval);
        assert!(eval.approval_token.is_none());
        assert!(eval.target_summary.contains("permanently disabled"));

        let exec_req = ActionRequest {
            id: "exec-http".into(),
            action: http_action,
            session_token: None,
            approval_token: Some("arbitrary_token".into()),
        };
        let res = execute_action(&exec_req);
        assert!(!res.success, "CallHttpEndpoint must fail closed");
        assert!(res
            .error_message
            .unwrap()
            .contains("CallHttpEndpoint execution route is permanently removed"));
    }

    #[test]
    fn test_ledger_and_failure_events_redact_secrets() {
        let raw_target = "Execute binary: cli.exe with args: [\"--api-key\", \"sk-proj-superSecretOpenAiKey1234567890\"]";
        let entry = LedgerEntry {
            id: "led-secret-test".into(),
            action_name: "RunProgram".into(),
            risk_tier: RiskTier::AlwaysApprove,
            status: ActionStatus::Started,
            target: raw_target.into(),
            timestamp: 1000,
            undo_available: false,
        };
        record_ledger(entry);

        let recent = get_action_ledger();
        let found = recent
            .iter()
            .find(|e| e.id == "led-secret-test")
            .expect("Ledger entry must exist");
        assert!(
            !found
                .target
                .contains("sk-proj-superSecretOpenAiKey1234567890"),
            "Ledger target must not leak plaintext key"
        );
        assert!(
            found.target.contains("[REDACTED_API_KEY]"),
            "Ledger target must contain redacted placeholder"
        );

        let failure = FailureEvent {
            id: "fail-secret-test".into(),
            source: "cli".into(),
            command_or_target:
                "git clone https://ghp_secretGitHubToken1234567890abcdef@github.com/org/repo".into(),
            exit_code: Some(1),
            error_message:
                "Failed for user C:\\Users\\alice\\AppData with sk-ant-secretAnthropicKey1234567"
                    .into(),
            stdout_excerpt: Some("Authorization: Bearer mySecretJwtToken123456".into()),
            timestamp: 1000,
        };
        record_failure_event(failure);

        let failures = get_recent_failures();
        let f = failures
            .iter()
            .find(|e| e.id == "fail-secret-test")
            .expect("Failure must exist");
        assert!(!f
            .command_or_target
            .contains("ghp_secretGitHubToken1234567890abcdef"));
        assert!(f.command_or_target.contains("[REDACTED_GITHUB_TOKEN]"));
        assert!(!f.error_message.contains("sk-ant-secretAnthropicKey1234567"));
        assert!(f.error_message.contains("[REDACTED_ANTHROPIC_KEY]"));
        assert!(!f.error_message.contains("C:\\Users\\alice\\"));
        assert!(f.error_message.contains("~\\"));
        assert_eq!(
            f.stdout_excerpt.as_deref(),
            Some("Authorization: Bearer [REDACTED_TOKEN]")
        );
    }
}
