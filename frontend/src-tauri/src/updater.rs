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
    published_at: Option<String>,
    features: Option<Vec<String>>,
    fixes: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: Option<String>,
    name: Option<String>,
    html_url: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
}

fn parse_changelog_lines(body: &str) -> (Vec<String>, Vec<String>) {
    let mut features = Vec::new();
    let mut fixes = Vec::new();

    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let is_bullet =
            trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("• ");

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
        } else if (lower.contains("fix")
            || lower.contains("patch")
            || lower.contains("clean")
            || lower.contains("resolve")
            || lower.contains("mitigat")
            || lower.contains("secur"))
            && !fixes.contains(&text)
            && fixes.len() < 10
        {
            fixes.push(text);
        }
    }

    (features, fixes)
}

pub fn check_for_update() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

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

    // 1. Check raw manifest first via direct curl.exe (read-only, no PowerShell subshell)
    let manifest_output = Command::new("curl.exe")
        .args([
            "-s",
            "-f",
            "-m", "5",
            "-H", "User-Agent: AltSpace-Updater",
            "https://raw.githubusercontent.com/codecheesee/altspace/main/distribution/latest-release.json",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = manifest_output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if let Ok(manifest) = serde_json::from_str::<RawManifest>(&stdout) {
                if let Some(tag) = manifest.version {
                    let clean_latest = tag.trim_start_matches('v').trim().to_string();
                    let clean_current = current_version.trim_start_matches('v').trim().to_string();
                    let has_update =
                        !clean_latest.is_empty() && is_newer_version(&clean_latest, &clean_current);

                    return Ok(UpdateInfo {
                        has_update,
                        current_version,
                        latest_version: clean_latest,
                        release_name: manifest
                            .name
                            .unwrap_or_else(|| format!("AltSpace v{}", tag)),
                        release_url: manifest.release_url.unwrap_or_else(|| {
                            "https://github.com/codecheesee/altspace/releases".to_string()
                        }),
                        release_notes: format!("AltSpace update v{} is available.", tag),
                        features: manifest.features.unwrap_or_default(),
                        fixes: manifest.fixes.unwrap_or_default(),
                        download_url: None,
                        published_at: manifest.published_at,
                    });
                }
            }
        }
    }

    // 2. Check GitHub API if manifest wasn't reached
    let gh_output = Command::new("curl.exe")
        .args([
            "-s",
            "-f",
            "-m",
            "5",
            "-H",
            "User-Agent: AltSpace-Updater",
            "-H",
            "Accept: application/json",
            "https://api.github.com/repos/codecheesee/altspace/releases/latest",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = gh_output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if let Ok(gh) = serde_json::from_str::<GhRelease>(&stdout) {
                if let Some(tag) = gh.tag_name {
                    let clean_latest = tag.trim_start_matches('v').trim().to_string();
                    let clean_current = current_version.trim_start_matches('v').trim().to_string();
                    let has_update =
                        !clean_latest.is_empty() && is_newer_version(&clean_latest, &clean_current);
                    let body = gh.body.unwrap_or_default();
                    let (features, fixes) = parse_changelog_lines(&body);

                    return Ok(UpdateInfo {
                        has_update,
                        current_version,
                        latest_version: clean_latest,
                        release_name: gh.name.unwrap_or_else(|| format!("AltSpace v{}", tag)),
                        release_url: gh.html_url.unwrap_or_else(|| {
                            "https://github.com/codecheesee/altspace/releases".to_string()
                        }),
                        release_notes: body,
                        features,
                        fixes,
                        download_url: None,
                        published_at: gh.published_at,
                    });
                }
            }
        }
    }

    Ok(default_info)
}

pub fn install_update(_download_url: Option<String>) -> Result<String, String> {
    Err("In-app update installation is temporarily disabled for security hardening. Please visit https://github.com/codecheesee/altspace/releases to download verified releases.".to_string())
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

    #[test]
    fn test_install_update_fails_closed() {
        let res = install_update(Some("https://example.com/bad.exe".into()));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("disabled for security hardening"));
    }
}
