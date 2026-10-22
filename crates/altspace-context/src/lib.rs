//! 7-Dimension Workspace Context Engine for AltSpace Control Plane.
//!
//! Maintains an in-memory graph of developer environment state across
//! active projects, git branches, listening ports, Docker containers, and WSL2 runtimes.
//! Produces deterministic < 400 token compressed context summaries for AI tools.

pub mod compressor;
pub mod graph;
pub mod resolver;

pub use compressor::compress_context_to_yaml;
pub use graph::{WorkspaceContext, WorkspaceGraph};
pub use resolver::resolve_active_workspace_hint;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_graph_and_compression() {
        let graph = WorkspaceGraph::new();
        let ctx = WorkspaceContext {
            project_name: "altspace".into(),
            root_path: "C:\\projects\\altspace".into(),
            tech_stack: vec!["Rust".into(), "React".into(), "Tauri".into()],
            git_branch: Some("main".into()),
            git_dirty_count: 2,
            listening_ports: vec![3000, 5173],
            active_containers: vec!["redis-dev".into()],
            wsl_distro: Some("Ubuntu-22.04".into()),
            active_env_profile: Some("development".into()),
            last_updated_epoch_secs: 1729600000,
        };

        graph.update_context(ctx.clone());
        graph.set_active_root(Some(ctx.root_path.clone()));

        let active = graph.get_active_context().expect("Active context should exist");
        assert_eq!(active.project_name, "altspace");

        let yaml = compress_context_to_yaml(&active);
        assert!(yaml.contains("project: \"altspace\""));
        assert!(yaml.contains("listening_ports: [3000, 5173]"));
        assert!(yaml.len() < 500); // Sub-400 token footprint
    }

    #[test]
    fn test_editor_title_resolution() {
        let vs_code_title = "App.tsx — altspace — Visual Studio Code";
        let resolved = resolve_active_workspace_hint(vs_code_title);
        assert_eq!(resolved, Some("altspace".into()));
    }
}
