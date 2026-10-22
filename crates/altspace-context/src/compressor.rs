use super::graph::WorkspaceContext;

/// Compresses a 7-dimension workspace context into a deterministic, compact YAML summary
/// occupying under 400 LLM tokens, optimized for prompt injection.
pub fn compress_context_to_yaml(ctx: &WorkspaceContext) -> String {
    let mut out = String::with_capacity(512);

    out.push_str("workspace:\n");
    out.push_str(&format!("  project: \"{}\"\n", ctx.project_name));
    out.push_str(&format!("  root: \"{}\"\n", ctx.root_path));

    if !ctx.tech_stack.is_empty() {
        out.push_str(&format!("  stack: [{}]\n", ctx.tech_stack.join(", ")));
    }

    if let Some(ref branch) = ctx.git_branch {
        out.push_str(&format!("  git_branch: \"{}\"\n", branch));
        out.push_str(&format!("  git_dirty_files: {}\n", ctx.git_dirty_count));
    }

    if !ctx.listening_ports.is_empty() {
        let ports_str: Vec<String> = ctx.listening_ports.iter().map(|p| p.to_string()).collect();
        out.push_str(&format!("  listening_ports: [{}]\n", ports_str.join(", ")));
    }

    if !ctx.active_containers.is_empty() {
        out.push_str(&format!("  containers: [{}]\n", ctx.active_containers.join(", ")));
    }

    if let Some(ref distro) = ctx.wsl_distro {
        out.push_str(&format!("  wsl: \"{}\"\n", distro));
    }

    if let Some(ref profile) = ctx.active_env_profile {
        out.push_str(&format!("  env_profile: \"{}\"\n", profile));
    }

    out
}
