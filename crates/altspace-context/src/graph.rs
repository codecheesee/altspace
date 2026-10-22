use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceContext {
    pub project_name: String,
    pub root_path: String,
    pub tech_stack: Vec<String>,
    pub git_branch: Option<String>,
    pub git_dirty_count: usize,
    pub listening_ports: Vec<u16>,
    pub active_containers: Vec<String>,
    pub wsl_distro: Option<String>,
    pub active_env_profile: Option<String>,
    pub last_updated_epoch_secs: u64,
}

pub struct WorkspaceGraph {
    workspaces: RwLock<HashMap<String, WorkspaceContext>>,
    active_root: RwLock<Option<String>>,
}

impl Default for WorkspaceGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkspaceGraph {
    pub fn new() -> Self {
        Self {
            workspaces: RwLock::new(HashMap::new()),
            active_root: RwLock::new(None),
        }
    }

    pub fn set_active_root(&self, root: Option<String>) {
        let mut lock = self.active_root.write().unwrap();
        *lock = root;
    }

    pub fn get_active_context(&self) -> Option<WorkspaceContext> {
        let active = self.active_root.read().unwrap();
        if let Some(ref root) = *active {
            let map = self.workspaces.read().unwrap();
            map.get(root).cloned()
        } else {
            None
        }
    }

    pub fn update_context(&self, ctx: WorkspaceContext) {
        let mut map = self.workspaces.write().unwrap();
        map.insert(ctx.root_path.clone(), ctx);
    }
}
