use serde::{Deserialize, Serialize};
use std::io::Write;
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use crate::crypto_vault;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const GITHUB_VAULT_TOKEN_KEY: &str = "altspace_github_oauth_token";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUserProfile {
    pub login: String,
    pub id: u64,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceTokenResponse {
    pub success: bool,
    pub user: Option<GitHubUserProfile>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RawGitHubOAuthResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

/// Initiates GitHub OAuth Device Flow natively, bypassing browser CORS
#[tauri::command]
pub fn github_device_code_request(client_id: String) -> Result<DeviceCodeResponse, String> {
    let clean_id = client_id.trim();
    if clean_id.is_empty() {
        return Err("GitHub Client ID is required.".to_string());
    }

    let output = Command::new("curl.exe")
        .args([
            "-s",
            "-X", "POST",
            "https://github.com/login/device/code",
            "-H", "Accept: application/json",
            "-H", "User-Agent: AltSpace-Desktop",
            "-d", &format!("client_id={}&scope=read:user user:email", clean_id),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute native network request: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Ok(res) = serde_json::from_str::<DeviceCodeResponse>(&stdout) {
        if !res.device_code.is_empty() {
            return Ok(res);
        }
    }

    if let Ok(err_val) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(err_msg) = err_val.get("error_description").or_else(|| err_val.get("error")) {
            return Err(format!("GitHub API error: {}", err_msg));
        }
    }

    Err(format!("Invalid response from GitHub: {}", stdout))
}

/// Polls GitHub OAuth device token endpoint natively.
/// SECURITY: When an access token is returned, it is stored directly in Windows DPAPI.
/// The plaintext token is NEVER emitted across the IPC boundary to the WebView!
#[tauri::command]
pub fn github_device_token_poll(client_id: String, device_code: String) -> Result<DeviceTokenResponse, String> {
    let clean_id = client_id.trim();
    let clean_code = device_code.trim();

    let output = Command::new("curl.exe")
        .args([
            "-s",
            "-X", "POST",
            "https://github.com/login/oauth/access_token",
            "-H", "Accept: application/json",
            "-H", "User-Agent: AltSpace-Desktop",
            "-d", &format!(
                "client_id={}&device_code={}&grant_type=urn:ietf:params:oauth:grant-type:device_code",
                clean_id, clean_code
            ),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to poll GitHub: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let raw: RawGitHubOAuthResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse token response: {} (raw: {})", e, stdout))?;

    if let Some(token) = raw.access_token {
        // 1. Encrypt token in Windows DPAPI
        crypto_vault::store_secret(GITHUB_VAULT_TOKEN_KEY, &token)?;

        // 2. Fetch user profile natively using token
        let user = fetch_github_user_profile(&token).ok();

        // 3. Return sanitized response with ZERO token material
        return Ok(DeviceTokenResponse {
            success: true,
            user,
            token_type: raw.token_type,
            scope: raw.scope,
            error: None,
            error_description: None,
        });
    }

    Ok(DeviceTokenResponse {
        success: false,
        user: None,
        token_type: raw.token_type,
        scope: raw.scope,
        error: raw.error,
        error_description: raw.error_description,
    })
}

/// Stores a manually supplied GitHub PAT into DPAPI and fetches the user profile.
/// Plaintext PAT is never persisted in WebView localStorage.
#[tauri::command]
pub fn github_store_manual_pat(pat: String) -> Result<GitHubUserProfile, String> {
    let clean = pat.trim();
    if clean.is_empty() {
        return Err("Personal Access Token cannot be empty.".into());
    }

    let user = fetch_github_user_profile(clean)?;
    crypto_vault::store_secret(GITHUB_VAULT_TOKEN_KEY, clean)?;
    Ok(user)
}

/// Retrieves currently authenticated GitHub user profile using DPAPI-stored token.
#[tauri::command]
pub fn github_get_current_user() -> Result<Option<GitHubUserProfile>, String> {
    let token = match crypto_vault::retrieve_secret(GITHUB_VAULT_TOKEN_KEY) {
        Ok(Some(t)) if !t.trim().is_empty() => t,
        _ => return Ok(None),
    };
    fetch_github_user_profile(&token).map(Some)
}

/// Signs out of GitHub by securely deleting the token from Windows DPAPI.
#[tauri::command]
pub fn github_sign_out() -> Result<(), String> {
    let _ = crypto_vault::delete_secret(GITHUB_VAULT_TOKEN_KEY);
    Ok(())
}

fn fetch_github_user_profile(token: &str) -> Result<GitHubUserProfile, String> {
    let config = format!(
        "silent\nurl = \"https://api.github.com/user\"\nheader = \"Accept: application/vnd.github.v3+json\"\nheader = \"User-Agent: AltSpace-Desktop\"\nheader = \"Authorization: Bearer {}\"\n",
        token
    );

    let mut child = Command::new("curl.exe")
        .args(["--config", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn native curl process: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(config.as_bytes())
            .map_err(|e| format!("Failed to write config to curl stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Curl execution failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("GitHub API user profile request failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let val: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse GitHub user profile JSON: {} (raw: {})", e, stdout))?;

    if let Some(msg) = val.get("message").and_then(|m| m.as_str()) {
        return Err(format!("GitHub API error: {}", msg));
    }

    let login = val
        .get("login")
        .and_then(|l| l.as_str())
        .ok_or_else(|| "Missing 'login' in GitHub user profile".to_string())?
        .to_string();

    let id = val.get("id").and_then(|i| i.as_u64()).unwrap_or(0);
    let name = val.get("name").and_then(|n| n.as_str()).map(|s| s.to_string());
    let avatar_url = val.get("avatar_url").and_then(|a| a.as_str()).map(|s| s.to_string());
    let email = val.get("email").and_then(|e| e.as_str()).map(|s| s.to_string());

    Ok(GitHubUserProfile {
        login,
        id,
        name,
        avatar_url,
        email,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_sign_out_clears_dpapi() {
        crypto_vault::store_secret(GITHUB_VAULT_TOKEN_KEY, "gho_dummy_token_12345").unwrap();
        assert!(crypto_vault::has_secret(GITHUB_VAULT_TOKEN_KEY).unwrap());

        github_sign_out().unwrap();
        assert!(!crypto_vault::has_secret(GITHUB_VAULT_TOKEN_KEY).unwrap());
    }

    #[test]
    fn test_github_device_token_poll_sanitization_structure() {
        // Ensures RawGitHubOAuthResponse parses and maps to DeviceTokenResponse with access_token stripped
        let mock_github_json = r#"{"access_token":"gho_mock1234567890abcdef","token_type":"bearer","scope":"read:user"}"#;
        let raw: RawGitHubOAuthResponse = serde_json::from_str(mock_github_json).unwrap();
        assert_eq!(raw.access_token.as_deref(), Some("gho_mock1234567890abcdef"));

        let client_response = DeviceTokenResponse {
            success: true,
            user: Some(GitHubUserProfile {
                login: "testuser".into(),
                id: 12345,
                name: Some("Test User".into()),
                avatar_url: None,
                email: None,
            }),
            token_type: raw.token_type,
            scope: raw.scope,
            error: None,
            error_description: None,
        };

        // Assert serialized response sent to WebView contains NO access_token field
        let serialized = serde_json::to_string(&client_response).unwrap();
        assert!(!serialized.contains("access_token"), "Serialized IPC response must NOT contain access_token");
        assert!(!serialized.contains("gho_mock"), "Serialized IPC response must NOT contain token value");
    }
}
