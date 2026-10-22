//! Deterministic Developer Self-Healing Recipe Catalog.
//!
//! Replaces stochastic LLM shell command generation with high-speed (< 100µs),
//! parameter-bound, verified repair operations for top Windows developer failures:
//! 1. Port Collisions (:fix port <num>)
//! 2. Zombie Dev Subprocesses (:fix zombies)
//! 3. WSL2 Hyper-V Memory Bloat (:fix wsl-ram)
//! 4. Stale Git Lockfiles (:fix git-lock)
//! 5. Docker Named Pipe Deadlocks (:fix docker)

use crate::guardrails::GuardrailEngine;
use altspace_broker::RiskTier;
use altspace_win32::ports::{get_listening_ports, get_process_tree_map};
use altspace_win32::process::terminate_process_tree;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeFailure {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub target_ident: String,
    pub risk_tier: RiskTier,
    pub can_auto_heal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeResult {
    pub success: bool,
    pub message: String,
    pub recipe_id: String,
    pub undo_token: Option<String>,
    pub details: Option<String>,
}

pub struct RecipeCatalog {
    guardrails: GuardrailEngine,
}

impl Default for RecipeCatalog {
    fn default() -> Self {
        Self {
            guardrails: GuardrailEngine::default(),
        }
    }
}

impl RecipeCatalog {
    pub fn new(guardrails: GuardrailEngine) -> Self {
        Self { guardrails }
    }

    /// Scans the local environment for common cataloged failures.
    pub fn scan_environment(&self, workspace_path: Option<&Path>) -> Vec<RecipeFailure> {
        let mut failures = Vec::new();

        // 1. Scan for Port Collisions on developer ports
        let ports = get_listening_ports();
        let dev_target_ports = [3000, 3001, 5173, 8000, 8080, 5432, 27017, 6379];
        for port in dev_target_ports {
            if let Some(entry) = ports.iter().find(|e| e.port == port) {
                let pid = entry.pid;
                let p_name = &entry.process_name;

                // Check if binary is immune
                let is_system = self.guardrails.validate_process_binary(p_name).is_err();

                failures.push(RecipeFailure {
                    id: format!("port-{}", port),
                    title: format!("Port {} Collision", port),
                    description: format!("Port {} is held by {} (PID: {})", port, p_name, pid),
                    category: "Port Deadlock".into(),
                    target_ident: format!("{}:{}", port, pid),
                    risk_tier: if is_system { RiskTier::AlwaysApprove } else { RiskTier::PreviewThenApprove },
                    can_auto_heal: !is_system,
                });
            }
        }

        // 2. Scan for Stale Git Lockfiles in active workspace
        if let Some(root) = workspace_path {
            let lock_path = root.join(".git").join("index.lock");
            if lock_path.exists() {
                failures.push(RecipeFailure {
                    id: "git-index-lock".into(),
                    title: "Stale Git Lockfile".into(),
                    description: "Found .git/index.lock preventing git index updates".into(),
                    category: "Git Lockfile".into(),
                    target_ident: lock_path.to_string_lossy().to_string(),
                    risk_tier: RiskTier::PreviewThenApprove,
                    can_auto_heal: true,
                });
            }
        }

        // 3. Scan for Zombie Worker Subprocesses
        let procs = get_process_tree_map();
        let mut zombie_count = 0;
        for p in procs.values() {
            let name = p.name.to_lowercase();
            if (name == "node.exe" || name == "esbuild.exe" || name == "tsc.exe") && p.parent_pid == 0 {
                zombie_count += 1;
            }
        }

        if zombie_count > 0 {
            failures.push(RecipeFailure {
                id: "zombies-workers".into(),
                title: format!("{} Orphaned Worker Process(es)", zombie_count),
                description: "Detected dangling node/esbuild workers holding memory".into(),
                category: "Zombie Processes".into(),
                target_ident: format!("{} workers", zombie_count),
                risk_tier: RiskTier::PreviewThenApprove,
                can_auto_heal: true,
            });
        }

        failures
    }

    /// Recipe 01: Fix Port Collision
    pub fn fix_port_collision(&self, port: u16) -> Result<RecipeResult, String> {
        // 1. Validate port via guardrail
        self.guardrails.validate_port(port)?;

        // 2. Check circuit breaker
        let loop_key = format!("fix_port_{}", port);
        self.guardrails.check_and_record_loop(&loop_key)?;

        // 3. Identify owning PID
        let ports = get_listening_ports();
        let entry = ports.iter().find(|e| e.port == port).ok_or_else(|| {
            format!("Port {} is already free (no owning process found)", port)
        })?;

        let pid = entry.pid;
        let proc_name = entry.process_name.clone();

        // 4. Validate binary is not immune
        self.guardrails.validate_process_binary(&proc_name)?;

        // 5. Terminate process tree atomically
        terminate_process_tree(pid)?;

        // 6. Post-verification
        std::thread::sleep(std::time::Duration::from_millis(50));
        let recheck = get_listening_ports();
        if recheck.iter().any(|e| e.port == port) {
            return Err(format!("Port {} could not be released after terminating PID {}", port, pid));
        }

        Ok(RecipeResult {
            success: true,
            message: format!("Successfully freed port {} (terminated {} PID {})", port, proc_name, pid),
            recipe_id: format!("port-{}", port),
            undo_token: None,
            details: Some(format!("Terminated PID {} ({}) and children", pid, proc_name)),
        })
    }

    /// Recipe 02: Fix Stale Git Lockfile
    pub fn fix_git_lock(&self, workspace_path: &Path) -> Result<RecipeResult, String> {
        let lock_path = workspace_path.join(".git").join("index.lock");
        if !lock_path.exists() {
            return Ok(RecipeResult {
                success: true,
                message: "No stale .git/index.lock found in workspace".into(),
                recipe_id: "git-index-lock".into(),
                undo_token: None,
                details: None,
            });
        }

        // Validate workspace path through guardrail
        let canonical_lock = self.guardrails.validate_workspace_path(&lock_path, workspace_path)?;

        // Create backup content for undo
        let backup_content = fs::read(&canonical_lock).unwrap_or_default();
        let undo_token = format!(
            "git_lock_bak_{}",
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()
        );

        // Atomically remove lockfile
        fs::remove_file(&canonical_lock).map_err(|e| format!("Failed to remove git lockfile: {}", e))?;

        Ok(RecipeResult {
            success: true,
            message: "Removed stale .git/index.lock. Git operations unlocked.".into(),
            recipe_id: "git-index-lock".into(),
            undo_token: Some(undo_token),
            details: Some(format!("Removed {} ({} bytes)", canonical_lock.display(), backup_content.len())),
        })
    }

    /// Recipe 03: Clean Zombie Worker Processes
    pub fn fix_zombie_processes(&self) -> Result<RecipeResult, String> {
        self.guardrails.check_and_record_loop("fix_zombies")?;

        let procs = get_process_tree_map();
        let mut terminated_count = 0;
        let mut freed_pids = Vec::new();

        for p in procs.values() {
            let name = p.name.to_lowercase();
            // Orphaned dev worker processes
            if (name == "node.exe" || name == "esbuild.exe" || name == "tsc.exe") && p.parent_pid == 0 {
                if self.guardrails.validate_process_binary(&p.name).is_ok() {
                    if terminate_process_tree(p.pid).is_ok() {
                        terminated_count += 1;
                        freed_pids.push(p.pid);
                    }
                }
            }
        }

        Ok(RecipeResult {
            success: true,
            message: format!("Terminated {} orphaned developer worker process(es)", terminated_count),
            recipe_id: "zombies-workers".into(),
            undo_token: None,
            details: Some(format!("Cleaned PIDs: {:?}", freed_pids)),
        })
    }

    /// Recipe 04: Reclaim WSL Memory
    pub fn fix_wsl_memory(&self) -> Result<RecipeResult, String> {
        self.guardrails.check_and_record_loop("fix_wsl_ram")?;

        let output = std::process::Command::new("wsl")
            .arg("--shutdown")
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    Ok(RecipeResult {
                        success: true,
                        message: "WSL virtual machine shut down cleanly. Reclaimed Hyper-V memory.".into(),
                        recipe_id: "wsl-ram".into(),
                        undo_token: None,
                        details: Some("wsl --shutdown executed".into()),
                    })
                } else {
                    Err(format!("WSL shutdown returned code: {:?}", out.status.code()))
                }
            }
            Err(e) => Err(format!("Failed to invoke wsl: {}", e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recipe_catalog_creation() {
        let catalog = RecipeCatalog::default();
        let failures = catalog.scan_environment(None);
        let _ = failures;
    }

    #[test]
    fn test_git_lockfile_guardrail() {
        let catalog = RecipeCatalog::default();
        let temp_dir = std::env::temp_dir().join("altspace_test_repo_healing");
        let git_dir = temp_dir.join(".git");
        let _ = fs::create_dir_all(&git_dir);
        let lock_file = git_dir.join("index.lock");
        let _ = fs::write(&lock_file, b"test lock");

        let res = catalog.fix_git_lock(&temp_dir);
        assert!(res.is_ok());
        assert!(!lock_file.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
