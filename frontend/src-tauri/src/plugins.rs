use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keyword: String,
    pub script: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keyword: String,
    pub script_path: String,
    pub icon: String,
}

pub fn get_plugins_dir() -> PathBuf {
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let dir = PathBuf::from(local_appdata).join("AltSpace").join("plugins");
        let _ = fs::create_dir_all(&dir);
        return dir;
    }
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let dir = PathBuf::from(userprofile).join(".altspace").join("plugins");
        let _ = fs::create_dir_all(&dir);
        return dir;
    }
    PathBuf::from("plugins")
}

/// Ensures a demo plugin exists so users can see how to build extensions immediately
fn ensure_starter_plugin(plugins_dir: &PathBuf) {
    let demo_dir = plugins_dir.join("ip-inspector");
    if !demo_dir.exists() {
        if let Ok(_) = fs::create_dir_all(&demo_dir) {
            let manifest = r#"{
  "id": "ip-inspector",
  "name": "Local Network & IP Inspector",
  "description": "Inspects local IPv4/IPv6 addresses and active default gateway",
  "keyword": ":ip",
  "script": "get_ip.ps1",
  "icon": "globe"
}"#;
            let script = r#"Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -Property IPAddress, InterfaceAlias | Format-Table -AutoSize | Out-String"#;
            let _ = fs::write(demo_dir.join("manifest.json"), manifest);
            let _ = fs::write(demo_dir.join("get_ip.ps1"), script);
        }
    }
}

pub fn scan_plugins() -> Vec<PluginItem> {
    let plugins_dir = get_plugins_dir();
    ensure_starter_plugin(&plugins_dir);

    let mut plugins = Vec::new();

    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    if let Ok(content) = fs::read_to_string(&manifest_path) {
                        if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                            let script_path = path.join(&manifest.script);
                            plugins.push(PluginItem {
                                id: manifest.id,
                                name: manifest.name,
                                description: manifest.description,
                                keyword: manifest.keyword,
                                script_path: script_path.to_string_lossy().to_string(),
                                icon: manifest.icon.unwrap_or_else(|| "cmd".to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    plugins
}

pub fn run_plugin_script(script_path: &str, args: &str) -> Result<String, String> {
    let path = PathBuf::from(script_path);
    if !path.exists() {
        return Err(format!("Plugin script not found: {}", script_path));
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let output = match extension.as_str() {
        "ps1" => Command::new("powershell.exe")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script_path])
            .args(args.split_whitespace())
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        "bat" | "cmd" => Command::new("cmd.exe")
            .args(["/C", script_path])
            .args(args.split_whitespace())
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        "py" => Command::new("python.exe")
            .arg(script_path)
            .args(args.split_whitespace())
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        "js" => Command::new("node.exe")
            .arg(script_path)
            .args(args.split_whitespace())
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        _ => return Err(format!("Unsupported script type: .{}", extension)),
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else if !stderr.is_empty() {
                Err(stderr)
            } else {
                Err(format!("Plugin failed with exit code: {:?}", out.status.code()))
            }
        }
        Err(e) => Err(format!("Failed to execute plugin: {}", e)),
    }
}


pub fn install_plugin(
    plugin_id: &str,
    manifest_json: &str,
    script_content: &str,
    script_filename: &str,
) -> Result<(), String> {
    let plugins_dir = get_plugins_dir();
    let target_dir = plugins_dir.join(plugin_id);
    fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;

    fs::write(target_dir.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

    fs::write(target_dir.join(script_filename), script_content)
        .map_err(|e| format!("Failed to write {}: {}", script_filename, e))?;

    Ok(())
}

pub fn uninstall_plugin(plugin_id: &str) -> Result<(), String> {
    let plugins_dir = get_plugins_dir();
    let target_dir = plugins_dir.join(plugin_id);
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|e| format!("Failed to remove plugin dir: {}", e))?;
    }
    Ok(())
}
