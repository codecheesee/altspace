//! Blast-Radius Guardrails for Autonomous Self-Healing in AltSpace.
//!
//! Enforces:
//! 1. Whitelisted Developer Binaries Only (system processes are strictly immune).
//! 2. Target Port Range Restrictions (developer port ranges only).
//! 3. Scoped Workspace Boundaries (prevents modifications outside verified project trees).
//! 4. Circuit Breaker Loop Protection (trips to manual if >= 2 repeated failures in 60s).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use std::time::Instant;

/// System processes that are strictly IMMUNE to termination.
pub const IMMUNE_SYSTEM_BINARIES: &[&str] = &[
    "explorer.exe",
    "svchost.exe",
    "services.exe",
    "lsass.exe",
    "csrss.exe",
    "smss.exe",
    "wininit.exe",
    "winlogon.exe",
    "dwm.exe",
    "spoolsv.exe",
    "taskhostw.exe",
    "RuntimeBroker.exe",
    "SearchIndexer.exe",
];

/// Permitted developer binaries that can be safely terminated when deadlocked.
pub const WHITELISTED_DEV_BINARIES: &[&str] = &[
    "node.exe",
    "python.exe",
    "python3.exe",
    "cargo.exe",
    "rustc.exe",
    "esbuild.exe",
    "tsc.exe",
    "vite.cmd",
    "webpack.exe",
    "docker-proxy.exe",
    "uvicorn.exe",
    "gunicorn.exe",
    "deno.exe",
    "bun.exe",
];

/// Permitted developer port ranges.
pub const PERMITTED_DEV_PORT_RANGES: &[(u16, u16)] = &[
    (3000, 3999),   // Common Node / React / Vite / Rails
    (4000, 4999),   // Phoenix / Hexo / Angular
    (5000, 5999),   // Flask / ASP.NET / Vite Alt
    (8000, 8999),   // Django / HTTP servers / Spring
    (9000, 9999),   // Microservices / SonarQube
    (5432, 5432),   // PostgreSQL
    (3306, 3306),   // MySQL
    (6379, 6379),   // Redis
    (27017, 27017), // MongoDB
];

pub struct GuardrailEngine {
    failure_history: RwLock<HashMap<String, Vec<Instant>>>,
    loop_window_secs: u64,
    max_occurrences: usize,
}

impl Default for GuardrailEngine {
    fn default() -> Self {
        Self {
            failure_history: RwLock::new(HashMap::new()),
            loop_window_secs: 60,
            max_occurrences: 2,
        }
    }
}

impl GuardrailEngine {
    pub fn new(loop_window_secs: u64, max_occurrences: usize) -> Self {
        Self {
            failure_history: RwLock::new(HashMap::new()),
            loop_window_secs,
            max_occurrences,
        }
    }

    /// Verifies if a process binary is safe to target.
    /// Returns Ok(()) if whitelisted, Err if immune or unknown.
    pub fn validate_process_binary(&self, binary_name: &str) -> Result<(), String> {
        let clean_name = binary_name
            .trim()
            .to_lowercase();

        // 1. Check immunity list (fail closed immediately)
        for &immune in IMMUNE_SYSTEM_BINARIES {
            if clean_name == immune.to_lowercase() {
                return Err(format!(
                    "SECURITY GUARDRAIL: '{}' is a protected Windows system process and is strictly immune to termination.",
                    binary_name
                ));
            }
        }

        // 2. Check developer whitelist
        let is_whitelisted = WHITELISTED_DEV_BINARIES.iter().any(|&dev| clean_name == dev.to_lowercase());
        if !is_whitelisted {
            return Err(format!(
                "GUARDRAIL REJECTED: '{}' is not in the developer binary whitelist.",
                binary_name
            ));
        }

        Ok(())
    }

    /// Verifies if a port is within approved developer port ranges.
    pub fn validate_port(&self, port: u16) -> Result<(), String> {
        for &(start, end) in PERMITTED_DEV_PORT_RANGES {
            if port >= start && port <= end {
                return Ok(());
            }
        }

        Err(format!(
            "GUARDRAIL REJECTED: Port {} is outside recognized developer ranges (3000-3999, 5000-5999, 8000-8999, 5432, 27017, 6379, 3306).",
            port
        ))
    }

    /// Verifies that a target file path is scoped strictly within a user project directory.
    /// Rejects operations targeting system roots like C:\, C:\Windows, C:\Program Files.
    pub fn validate_workspace_path(&self, target_path: &Path, workspace_root: &Path) -> Result<PathBuf, String> {
        let canonical_target = target_path
            .canonicalize()
            .map_err(|e| format!("Failed to resolve path: {}", e))?;

        let canonical_root = workspace_root
            .canonicalize()
            .map_err(|e| format!("Failed to resolve workspace root: {}", e))?;

        // Target must start with workspace root
        if !canonical_target.starts_with(&canonical_root) {
            return Err(format!(
                "GUARDRAIL REJECTED: Operation target '{:?}' is outside workspace boundary '{:?}'.",
                canonical_target, canonical_root
            ));
        }

        // Target must not be root directory itself
        if canonical_target == canonical_root {
            return Err("GUARDRAIL REJECTED: Modifying workspace root directory itself is disallowed.".into());
        }

        Ok(canonical_target)
    }

    /// Circuit breaker loop detector: records an occurrence and returns Err if threshold exceeded.
    pub fn check_and_record_loop(&self, recipe_key: &str) -> Result<(), String> {
        let mut history = self.failure_history.write().unwrap();
        let now = Instant::now();

        let entries = history.entry(recipe_key.to_string()).or_default();

        // Prune older than window
        entries.retain(|&t| now.duration_since(t).as_secs() < self.loop_window_secs);

        if entries.len() >= self.max_occurrences {
            return Err(format!(
                "CIRCUIT BREAKER TRIPPED: Recipe '{}' triggered {} times in {}s. Falling back to Manual mode to prevent loop.",
                recipe_key,
                entries.len(),
                self.loop_window_secs
            ));
        }

        entries.push(now);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_binary_guardrails() {
        let guard = GuardrailEngine::default();

        // Whitelisted dev binaries must pass
        assert!(guard.validate_process_binary("node.exe").is_ok());
        assert!(guard.validate_process_binary("python.exe").is_ok());
        assert!(guard.validate_process_binary("cargo.exe").is_ok());

        // Immune system processes must fail
        assert!(guard.validate_process_binary("explorer.exe").is_err());
        assert!(guard.validate_process_binary("svchost.exe").is_err());
        assert!(guard.validate_process_binary("services.exe").is_err());

        // Arbitrary unknown binaries must fail
        assert!(guard.validate_process_binary("malicious.exe").is_err());
    }

    #[test]
    fn test_port_guardrails() {
        let guard = GuardrailEngine::default();

        // Standard dev ports must pass
        assert!(guard.validate_port(3000).is_ok());
        assert!(guard.validate_port(5173).is_ok());
        assert!(guard.validate_port(8080).is_ok());
        assert!(guard.validate_port(5432).is_ok());

        // Sensitive system ports must fail
        assert!(guard.validate_port(80).is_err());
        assert!(guard.validate_port(443).is_err());
        assert!(guard.validate_port(22).is_err());
        assert!(guard.validate_port(445).is_err()); // SMB
    }

    #[test]
    fn test_loop_circuit_breaker() {
        let guard = GuardrailEngine::new(60, 2);

        assert!(guard.check_and_record_loop("fix_port_3000").is_ok());
        assert!(guard.check_and_record_loop("fix_port_3000").is_ok());

        // 3rd attempt within window must trip
        assert!(guard.check_and_record_loop("fix_port_3000").is_err());
    }
}
