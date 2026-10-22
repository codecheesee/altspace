//! Core orchestration, license management, and self-healing engine for AltSpace.

pub mod config;
pub mod healing;
pub mod guardrails;
pub mod license;
pub mod recipes;

pub use config::AltSpaceConfig;
pub use healing::{ExecutionMode, HealingEngine, RepairAction};
pub use license::{LicenseStatus, LicenseVerifier};
pub use guardrails::GuardrailEngine;
pub use recipes::{RecipeCatalog, RecipeFailure, RecipeResult};

#[cfg(test)]
mod tests {
    use super::*;
    use altspace_broker::{RiskTier, TypedAction};

    #[test]
    fn test_healing_engine_execution_modes() {
        let engine = HealingEngine::new(ExecutionMode::Manual);
        let safe_action = RepairAction {
            id: "read_log".into(),
            title: "Read Log".into(),
            description: "Read build log".into(),
            category: "Diagnostic".into(),
            action: TypedAction::ReadFile { path: "build.log".into(), max_bytes: Some(1024) },
            risk_tier: RiskTier::ReadOnlyAuto,
        };

        // In Manual mode, nothing is automatic
        assert!(!engine.can_execute_autonomically(&safe_action));

        // In Supervised mode, ReadOnlyAuto is automatic
        engine.set_mode(ExecutionMode::Supervised);
        assert!(engine.can_execute_autonomically(&safe_action));

        // In Turbo mode, PreviewThenApprove is allowed within circuit breaker limits
        engine.set_mode(ExecutionMode::Turbo);
        let port_kill_action = RepairAction {
            id: "kill_3000".into(),
            title: "Kill Port 3000".into(),
            description: "Kill orphaned process".into(),
            category: "Network".into(),
            action: TypedAction::KillPortProcess { port: 3000, pid: 1234 },
            risk_tier: RiskTier::PreviewThenApprove,
        };
        assert!(engine.can_execute_autonomically(&port_kill_action));
    }
}
