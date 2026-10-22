/// Resolves a workspace root hint by inspecting window titles of active developer editors.
/// Supports VS Code, Cursor, Windsurf, Windows Terminal, and IntelliJ.
pub fn resolve_active_workspace_hint(window_title: &str) -> Option<String> {
    let title = window_title.trim();
    if title.is_empty() {
        return None;
    }

    // Pattern: "filename — project_name — Visual Studio Code" (handles ASCII hyphen, en-dash, em-dash)
    if title.contains("Visual Studio Code") || title.contains("Cursor") || title.contains("Windsurf") {
        let parts: Vec<&str> = title.split(['-', '—', '–']).collect();
        if parts.len() >= 2 {
            let candidate = parts[parts.len() - 2].trim();
            if !candidate.is_empty() {
                return Some(candidate.to_string());
            }
        }
    }

    None
}
