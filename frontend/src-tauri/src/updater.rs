use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_url: String,
    pub release_notes: String,
}

pub fn check_for_update() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    // Query GitHub API using PowerShell Invoke-RestMethod for zero extra dependencies
    let ps_script = r#"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $res = Invoke-RestMethod -Uri 'https://api.github.com/repos/codecheesee/altspace/releases/latest' -Headers @{'User-Agent'='AltSpace-Updater'} -TimeoutSec 5; ConvertTo-Json -InputObject @{ tag_name = $res.tag_name; html_url = $res.html_url; body = $res.body } -Compress"#;

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Update check failed: {}", e))?;

    if !output.status.success() {
        return Ok(UpdateInfo {
            has_update: false,
            current_version: current_version.clone(),
            latest_version: current_version,
            release_url: "https://github.com/codecheesee/altspace/releases".to_string(),
            release_notes: String::new(),
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Ok(UpdateInfo {
            has_update: false,
            current_version: current_version.clone(),
            latest_version: current_version,
            release_url: "https://github.com/codecheesee/altspace/releases".to_string(),
            release_notes: String::new(),
        });
    }

    #[derive(Deserialize)]
    struct GhRelease {
        tag_name: Option<String>,
        html_url: Option<String>,
        body: Option<String>,
    }

    if let Ok(release) = serde_json::from_str::<GhRelease>(&stdout) {
        let tag = release.tag_name.unwrap_or_default();
        let clean_latest = tag.trim_start_matches('v').trim().to_string();
        let clean_current = current_version.trim_start_matches('v').trim().to_string();

        let has_update = !clean_latest.is_empty() && clean_latest != clean_current;

        return Ok(UpdateInfo {
            has_update,
            current_version,
            latest_version: clean_latest,
            release_url: release.html_url.unwrap_or_else(|| "https://github.com/codecheesee/altspace/releases".to_string()),
            release_notes: release.body.unwrap_or_default(),
        });
    }

    Ok(UpdateInfo {
        has_update: false,
        current_version: current_version.clone(),
        latest_version: current_version,
        release_url: "https://github.com/codecheesee/altspace/releases".to_string(),
        release_notes: String::new(),
    })
}

pub fn apply_update() -> Result<String, String> {
    // Executes 1-line update command via background PowerShell
    let ps_cmd = "irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex";
    Command::new("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn updater: {}", e))?;

    Ok("Update installer launched in background. AltSpace will restart shortly.".to_string())
}
