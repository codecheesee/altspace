use serde::{Deserialize, Serialize};

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
    KillPortProcess {
        port: u16,
        pid: u32,
    },
    RestartDockerService,
    DropWslCache,
}

/// Permitted developer executables that can be invoked via the Broker
pub const WHITELISTED_PROGRAMS: &[&str] = &[
    "git.exe",
    "git",
    "npm.cmd",
    "npm",
    "pnpm.cmd",
    "pnpm",
    "yarn.cmd",
    "yarn",
    "cargo.exe",
    "cargo",
    "rustc.exe",
    "rustc",
    "node.exe",
    "node",
    "python.exe",
    "python",
    "docker.exe",
    "docker",
    "wsl.exe",
    "wsl",
];

/// Classifies a typed action into its corresponding RiskTier
pub fn classify_action(action: &TypedAction) -> RiskTier {
    match action {
        TypedAction::ReadFile { .. } => RiskTier::ReadOnlyAuto,
        TypedAction::KillPortProcess { .. } => RiskTier::PreviewThenApprove,
        TypedAction::RestartDockerService => RiskTier::PreviewThenApprove,
        TypedAction::DropWslCache => RiskTier::PreviewThenApprove,
        TypedAction::RunProgram { program, .. } => {
            let lower = program.to_lowercase();
            let is_whitelisted = WHITELISTED_PROGRAMS.iter().any(|&p| lower == p || lower.ends_with(&format!("\\{}", p)));
            if is_whitelisted {
                RiskTier::PreviewThenApprove
            } else {
                RiskTier::AlwaysApprove
            }
        }
        TypedAction::WriteFile { .. } => RiskTier::AlwaysApprove,
        TypedAction::DeleteFile { .. } => RiskTier::AlwaysApprove,
    }
}
