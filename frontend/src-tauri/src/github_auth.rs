use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceTokenResponse {
    pub access_token: Option<String>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Initiates GitHub OAuth Device Flow natively, bypassing browser CORS
#[tauri::command]
pub fn github_device_code_request(client_id: String) -> Result<DeviceCodeResponse, String> {
    let clean_id = client_id.trim();
    if clean_id.is_empty() {
        return Err("GitHub Client ID is required.".to_string());
    }

    let output = Command::new("curl.exe")
        .args(&[
            "-s",
            "-X", "POST",
            "https://github.com/login/device/code",
            "-H", "Accept: application/json",
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

/// Polls GitHub OAuth device token endpoint natively
#[tauri::command]
pub fn github_device_token_poll(client_id: String, device_code: String) -> Result<DeviceTokenResponse, String> {
    let clean_id = client_id.trim();
    let clean_code = device_code.trim();

    let output = Command::new("curl.exe")
        .args(&[
            "-s",
            "-X", "POST",
            "https://github.com/login/oauth/access_token",
            "-H", "Accept: application/json",
            "-d", &format!(
                "client_id={}&device_code={}&grant_type=urn:ietf:params:oauth:grant-type:device_code",
                clean_id, clean_code
            ),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to poll GitHub: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<DeviceTokenResponse>(&stdout)
        .map_err(|e| format!("Failed to parse token response: {} (raw: {})", e, stdout))
}
