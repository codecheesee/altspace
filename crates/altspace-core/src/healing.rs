use altspace_broker::{CircuitBreaker, RiskTier, TypedAction};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionMode {
    Manual,
    Supervised,
    Turbo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairAction {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub action: TypedAction,
    pub risk_tier: RiskTier,
}

pub struct HealingEngine {
    mode: std::sync::RwLock<ExecutionMode>,
    breaker: CircuitBreaker,
}

impl Default for HealingEngine {
    fn default() -> Self {
        Self::new(ExecutionMode::Supervised)
    }
}

impl HealingEngine {
    pub fn new(mode: ExecutionMode) -> Self {
        Self {
            mode: std::sync::RwLock::new(mode),
            breaker: CircuitBreaker::default_production(),
        }
    }

    pub fn get_mode(&self) -> ExecutionMode {
        *self.mode.read().unwrap()
    }

    pub fn set_mode(&self, mode: ExecutionMode) {
        let mut lock = self.mode.write().unwrap();
        *lock = mode;
    }

    pub fn can_execute_autonomically(&self, action: &RepairAction) -> bool {
        let current_mode = self.get_mode();
        match current_mode {
            ExecutionMode::Manual => false,
            ExecutionMode::Supervised => action.risk_tier == RiskTier::ReadOnlyAuto,
            ExecutionMode::Turbo => {
                // In Turbo mode, allowed if circuit breaker permits and risk tier is not AlwaysApprove
                if action.risk_tier == RiskTier::AlwaysApprove {
                    false
                } else {
                    self.breaker.check_and_record().is_ok()
                }
            }
        }
    }
}
