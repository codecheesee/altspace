use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse = |value: &str| {
        value
            .trim_start_matches('v')
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let mut latest_parts = parse(latest);
    let mut current_parts = parse(current);
    latest_parts.resize(3, 0);
    current_parts.resize(3, 0);
    latest_parts > current_parts
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_name: String,
    pub release_url: String,
    pub release_notes: String,
    pub features: Vec<String>,
    pub fixes: Vec<String>,
    pub download_url: Option<String>,
    pub published_at: Option<String>,
}

#[derive(Deserialize)]
struct RawManifest {
    version: Option<String>,
    name: Option<String>,
    release_url: Option<String>,
    download_url: Option<String>,
    published_at: Option<String>,
    features: Option<Vec<String>>,
    fixes: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct GhReleaseAsset {
    name: Option<String>,
    browser_download_url: Option<String>,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: Option<String>,
    name: Option<String>,
    html_url: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    assets: Option<Vec<GhReleaseAsset>>,
}

fn parse_changelog_lines(body: &str) -> (Vec<String>, Vec<String>) {
    let mut features = Vec::new();
    let mut fixes = Vec::new();

    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let is_bullet = trimmed.starts_with("- ")
            || trimmed.starts_with("* ")
            || trimmed.starts_with("• ");

        let text = if is_bullet {
            trimmed[2..].trim().to_string()
        } else {
            trimmed.to_string()
        };

        if text.starts_with('#') || text.starts_with("**Full Changelog**") {
            continue;
        }

        let lower = text.to_lowercase();
        if lower.contains("feat")
            || lower.contains("add")
            || lower.contains("new")
            || lower.contains("support")
            || lower.contains("matrix")
            || lower.contains("cockpit")
        {
            if !features.contains(&text) && features.len() < 10 {
                features.push(text);
            }
        } else if lower.contains("fix")
            || lower.contains("patch")
            || lower.contains("clean")
            || lower.contains("resolve")
            || lower.contains("mitigat")
            || lower.contains("secur")
        {
            if !fixes.contains(&text) && fixes.len() < 10 {
                fixes.push(text);
            }
        }
    }

    (features, fixes)
}

pub fn check_for_update() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let ps_script = r#"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
$headers = @{'User-Agent'='AltSpace-Updater'};
$res = $null;

# 1. Check raw manifest first (zero rate limits, instant)
try {
    $raw = Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/codecheesee/altspace/main/distribution/latest-release.json' -Headers $headers -TimeoutSec 4;
    if ($raw -and $raw.version) {
        $res = @{
            source = 'manifest';
            tag_name = $raw.version;
            name = $raw.name;
            html_url = $raw.release_url;
            body = ($raw.features -join "`n") + "`n" + ($raw.fixes -join "`n");
            features = $raw.features;
            fixes = $raw.fixes;
            download_url = $raw.download_url;
            published_at = $raw.published_at;
        };
    }
} catch {}

# 2. Check GitHub API if manifest wasn't reachable
if (-not $res) {
    try {
        $gh = Invoke-RestMethod -Uri 'https://api.github.com/repos/codecheesee/altspace/releases/latest' -Headers $headers -TimeoutSec 4;
        if ($gh -and $gh.tag_name) {
            $dl = ($gh.assets | Where-Object { $_.name -like '*setup*.exe' -or $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url;
            $res = @{
                source = 'github';
                tag_name = $gh.tag_name;
                name = $gh.name;
                html_url = $gh.html_url;
                body = $gh.body;
                download_url = $dl;
                published_at = $gh.published_at;
            };
        }
    } catch {}
}

if ($res) {
    ConvertTo-Json -InputObject $res -Compress
} else {
    "{}"
}
"#;

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Update check failed: {}", e))?;

    let default_info = UpdateInfo {
        has_update: false,
        current_version: current_version.clone(),
        latest_version: current_version.clone(),
        release_name: format!("AltSpace v{}", current_version),
        release_url: "https://github.com/codecheesee/altspace/releases".to_string(),
        release_notes: "You are currently running the latest build of AltSpace.".to_string(),
        features: vec![],
        fixes: vec![],
        download_url: None,
        published_at: None,
    };

    if !output.status.success() {
        return Ok(default_info);
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "{}" {
        return Ok(default_info);
    }

    // Try parsing as raw manifest
    if let Ok(manifest) = serde_json::from_str::<RawManifest>(&stdout) {
        if let Some(tag) = manifest.version {
            let clean_latest = tag.trim_start_matches('v').trim().to_string();
            let clean_current = current_version.trim_start_matches('v').trim().to_string();
            let has_update = !clean_latest.is_empty() && is_newer_version(&clean_latest, &clean_current);

            return Ok(UpdateInfo {
                has_update,
                current_version,
                latest_version: clean_latest,
                release_name: manifest.name.unwrap_or_else(|| format!("AltSpace v{}", tag)),
                release_url: manifest.release_url.unwrap_or_else(|| "https://github.com/codecheesee/altspace/releases".to_string()),
                release_notes: format!("AltSpace update v{} is ready to install.", tag),
                features: manifest.features.unwrap_or_default(),
                fixes: manifest.fixes.unwrap_or_default(),
                download_url: manifest.download_url,
                published_at: manifest.published_at,
            });
        }
    }

    // Try parsing as GitHub release response
    if let Ok(gh) = serde_json::from_str::<GhRelease>(&stdout) {
        if let Some(tag) = gh.tag_name {
            let clean_latest = tag.trim_start_matches('v').trim().to_string();
            let clean_current = current_version.trim_start_matches('v').trim().to_string();
            let has_update = !clean_latest.is_empty() && is_newer_version(&clean_latest, &clean_current);
            let body = gh.body.unwrap_or_default();
            let (features, fixes) = parse_changelog_lines(&body);
            let dl_url = gh.assets.and_then(|a| {
                a.into_iter()
                    .find(|asset| {
                        asset.name.as_deref().map_or(false, |n| {
                            n.ends_with(".exe") || n.contains("Setup")
                        })
                    })
                    .and_then(|asset| asset.browser_download_url)
            });

            return Ok(UpdateInfo {
                has_update,
                current_version,
                latest_version: clean_latest,
                release_name: gh.name.unwrap_or_else(|| format!("AltSpace v{}", tag)),
                release_url: gh.html_url.unwrap_or_else(|| "https://github.com/codecheesee/altspace/releases".to_string()),
                release_notes: body,
                features,
                fixes,
                download_url: dl_url,
                published_at: gh.published_at,
            });
        }
    }

    Ok(default_info)
}

pub fn install_update(download_url: Option<String>) -> Result<String, String> {
    let url = download_url.unwrap_or_else(|| {
        "https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1".to_string()
    });

    let ps_script = format!(
        r#"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
$targetUrl = '{url}';
$tempDir = Join-Path $env:TEMP 'AltSpace-Update';
if (-not (Test-Path $tempDir)) {{ New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }}

if ($targetUrl -like '*.ps1') {{
    $scriptPath = Join-Path $tempDir 'install.ps1';
    Invoke-WebRequest -Uri $targetUrl -OutFile $scriptPath -UseBasicParsing;
    Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"' + $scriptPath + '\"' -WindowStyle Normal;
}} else {{
    $exePath = Join-Path $tempDir 'AltSpace-Setup-x64.exe';
    Invoke-WebRequest -Uri $targetUrl -OutFile $exePath -UseBasicParsing;
    Start-Process -FilePath $exePath -WindowStyle Normal;
}}
"#
    );

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", &ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to initiate installer: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installer launch failed: {}", err));
    }

    Ok("Update installer downloaded and launched successfully. AltSpace will close to complete the upgrade.".to_string())
}

#[allow(dead_code)]
pub fn apply_update() -> Result<String, String> {
    install_update(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_newer_versions_are_updates() {
        assert!(is_newer_version("1.0.3", "1.0.2"));
        assert!(is_newer_version("v2.0.0", "1.99.99"));
        assert!(!is_newer_version("1.0.2", "1.0.2"));
        assert!(!is_newer_version("1.0.1", "1.0.2"));
    }

    #[test]
    fn test_parse_changelog_lines() {
        let body = "- feat: add DPAPI encrypted vault\n- fix: resolve memory leak in wsl\n- New feature: docker compose cockpit\n- Fix issue with port inspection";
        let (features, fixes) = parse_changelog_lines(body);
        assert_eq!(features.len(), 2);
        assert_eq!(fixes.len(), 2);
    }
}
