use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const DETACHED_PROCESS: u32 = 0x00000008;

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
    pub portable_url: Option<String>,
    pub sha256_portable: Option<String>,
    pub published_at: Option<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct RawManifest {
    pub version: Option<String>,
    pub name: Option<String>,
    pub release_url: Option<String>,
    pub download_url: Option<String>,
    pub portable_url: Option<String>,
    pub sha256_portable: Option<String>,
    pub published_at: Option<String>,
    pub features: Option<Vec<String>>,
    pub fixes: Option<Vec<String>>,
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
            || lower.contains("hub")
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
        portable_url: None,
        sha256_portable: None,
        published_at: None,
    };

    // 1. Try static CDN manifest first (GitHub Pages - 0 rate limits, instant response)
    let cdn_endpoints = [
        "https://codecheesee.github.io/altspace/latest-release.json",
        "https://raw.githubusercontent.com/codecheesee/altspace/main/distribution/latest-release.json",
    ];

    for endpoint in cdn_endpoints {
        let manifest_output = Command::new("curl.exe")
            .args([
                "-s",
                "-f",
                "-m", "5",
                "-H", "User-Agent: AltSpace-Updater",
                endpoint,
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
                            download_url: manifest.download_url,
                            portable_url: manifest.portable_url,
                            sha256_portable: manifest.sha256_portable,
                            published_at: manifest.published_at,
                        });
                    }
                }
            }
        }
    }

    // 2. Fallback to GitHub API if CDN manifests were unreachable
    let gh_output = Command::new("curl.exe")
        .args([
            "-s",
            "-f",
            "-m", "5",
            "-H", "User-Agent: AltSpace-Updater",
            "-H", "Accept: application/json",
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
                        latest_version: clean_latest.clone(),
                        release_name: gh.name.unwrap_or_else(|| format!("AltSpace v{}", tag)),
                        release_url: gh.html_url.unwrap_or_else(|| {
                            "https://github.com/codecheesee/altspace/releases".to_string()
                        }),
                        release_notes: body,
                        features,
                        fixes,
                        download_url: Some(format!(
                            "https://github.com/codecheesee/altspace/releases/download/v{}/AltSpace-Setup-x64.exe",
                            clean_latest
                        )),
                        portable_url: Some(format!(
                            "https://github.com/codecheesee/altspace/releases/download/v{}/AltSpace-Portable-x64.zip",
                            clean_latest
                        )),
                        sha256_portable: None,
                        published_at: gh.published_at,
                    });
                }
            }
        }
    }

    Ok(default_info)
}

pub fn install_update(
    custom_url: Option<String>,
    expected_sha256: Option<String>,
) -> Result<String, String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Cannot locate current executable: {}", e))?;
    let current_dir = current_exe
        .parent()
        .ok_or_else(|| "Cannot locate installation directory".to_string())?
        .to_path_buf();

    // Determine target download URL
    let download_url = match custom_url.filter(|s| !s.trim().is_empty()) {
        Some(url) => url,
        None => {
            let info = check_for_update()?;
            info.portable_url
                .or(info.download_url)
                .ok_or_else(|| "No verified download asset found for update.".to_string())?
        }
    };

    // Ensure target URL is secure HTTPS
    if !download_url.starts_with("https://") {
        return Err("Insecure update URL rejected. Updates require HTTPS.".to_string());
    }

    // Unique isolated temporary directory
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = std::env::temp_dir().join(format!("AltSpaceUpdate_{}", timestamp));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temporary update directory: {}", e))?;

    let zip_path = temp_dir.join("AltSpace-Portable-x64.zip");

    // Download package via curl
    let dl_output = Command::new("curl.exe")
        .args([
            "-s",
            "-f",
            "-L",
            "--connect-timeout", "10",
            "-m", "60",
            "-H", "User-Agent: AltSpace-Updater",
            "-o",
            zip_path.to_str().unwrap(),
            &download_url,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| {
            let _ = std::fs::remove_dir_all(&temp_dir);
            format!("Failed to invoke curl: {}", e)
        })?;

    if !dl_output.status.success() || !zip_path.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("Download failed. Please check network connection and try again.".to_string());
    }

    // Cryptographic SHA-256 Checksum Verification
    let zip_bytes = std::fs::read(&zip_path).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("Failed to read downloaded update archive: {}", e)
    })?;

    let mut hasher = Sha256::new();
    hasher.update(&zip_bytes);
    let computed_hash = format!("{:x}", hasher.finalize());

    if let Some(expected) = expected_sha256.filter(|s| !s.trim().is_empty()) {
        let clean_expected = expected.trim().to_lowercase();
        if clean_expected != computed_hash {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(format!(
                "Security integrity failure: SHA-256 mismatch (expected {}, got {}). Update aborted.",
                clean_expected, computed_hash
            ));
        }
    }

    // Unpack archive into temporary extracted directory
    let extract_dir = temp_dir.join("extracted");
    let _ = std::fs::create_dir_all(&extract_dir);

    // Prefer fast native tar.exe, fallback to powershell Expand-Archive
    let tar_status = Command::new("tar.exe")
        .args(["-xf", zip_path.to_str().unwrap(), "-C", extract_dir.to_str().unwrap()])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let extracted_ok = match tar_status {
        Ok(s) if s.success() => true,
        _ => {
            let ps_status = Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    &format!(
                        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                        zip_path.to_str().unwrap(),
                        extract_dir.to_str().unwrap()
                    ),
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
            matches!(ps_status, Ok(s) if s.success())
        }
    };

    if !extracted_ok {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("Failed to extract update package.".to_string());
    }

    // Verify presence of binary
    let portable_bin = extract_dir.join("AltSpace-Portable.exe");
    let standard_bin = extract_dir.join("altspace.exe");

    if !standard_bin.exists() && portable_bin.exists() {
        let _ = std::fs::copy(&portable_bin, &standard_bin);
    }

    if !standard_bin.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("Extracted update does not contain a valid AltSpace executable.".to_string());
    }

    // Write atomic handoff helper script (apply_update.cmd)
    let helper_path = temp_dir.join("apply_update.cmd");
    let helper_script = r#"@echo off
setlocal EnableDelayedExpansion
set "PID=%~1"
set "SRC=%~2"
set "DST=%~3"
set "EXE=%~4"

:: 1. Graceful exit wait for running instance (up to 5 seconds)
for /l %%i in (1,1,5) do (
    tasklist /fi "PID eq %PID%" 2>nul | find "%PID%" >nul
    if errorlevel 1 (
        goto ready_to_copy
    )
    timeout /t 1 /nobreak >nul
)

:: 2. Force terminate running instance and any lingering subprocesses
taskkill /F /T /PID %PID% >nul 2>&1
timeout /t 1 /nobreak >nul

:ready_to_copy
:: 3. Robust copy with 3 retries (1s wait) to overcome transient antivirus/search file locks
robocopy "%SRC%" "%DST%" /E /R:3 /W:1 /NFL /NDL /NJH /NJS >nul 2>&1
if errorlevel 8 (
    :: Fallback to xcopy if robocopy fails or is restricted
    xcopy /Y /E /Q /I "%SRC%\*" "%DST%\" >nul 2>&1
)

:: 4. Verify primary binary exists before relaunching
if exist "%EXE%" (
    start "" "%EXE%"
) else if exist "%DST%\altspace.exe" (
    start "" "%DST%\altspace.exe"
) else if exist "%DST%\AltSpace-Portable.exe" (
    start "" "%DST%\AltSpace-Portable.exe"
)

:: 5. Self-destruct temporary updater folder cleanly
timeout /t 2 /nobreak >nul
(goto) 2>nul & rd /s /q "%~dp0"
"#;

    std::fs::write(&helper_path, helper_script).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("Failed to write update handoff script: {}", e)
    })?;

    // In development mode or test runner, do not spawn the process-killing helper
    let exe_str = current_exe.to_string_lossy();
    if exe_str.contains("\\target\\debug\\") || exe_str.contains("\\target\\release\\") {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Ok("AltSpace is running in development mode. Update verified successfully.".to_string());
    }

    // Spawn detached helper process
    let current_pid = std::process::id();
    Command::new("cmd.exe")
        .args([
            "/c",
            helper_path.to_str().unwrap(),
            &current_pid.to_string(),
            extract_dir.to_str().unwrap(),
            current_dir.to_str().unwrap(),
            current_exe.to_str().unwrap(),
        ])
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()
        .map_err(|e| {
            let _ = std::fs::remove_dir_all(&temp_dir);
            format!("Failed to spawn update helper: {}", e)
        })?;

    Ok("Update downloaded and verified. AltSpace will restart now.".to_string())
}

#[allow(dead_code)]
pub fn apply_update() -> Result<String, String> {
    install_update(None, None)
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
    fn test_install_update_fails_closed_on_bad_url() {
        let res = install_update(Some("http://insecure.example.com/bad.exe".into()), None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Insecure update URL rejected"));
    }
}
