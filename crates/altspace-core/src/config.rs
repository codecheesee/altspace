use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AltSpaceConfig {
    pub auto_start: bool,
    pub hotkey: String,
    pub sentinel_enabled: bool,
    pub execution_mode: super::healing::ExecutionMode,
    pub telemetry_egress_allowed: bool,
}

impl Default for AltSpaceConfig {
    fn default() -> Self {
        Self {
            auto_start: false,
            hotkey: "Alt+Space".into(),
            sentinel_enabled: true,
            execution_mode: super::healing::ExecutionMode::Supervised,
            telemetry_egress_allowed: false,
        }
    }
}
