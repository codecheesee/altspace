use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use windows::core::PCWSTR;
use windows::Win32::Foundation::LocalFree;
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

fn get_vault_dir() -> Result<PathBuf, String> {
    let base = if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_appdata).join("AltSpace").join("vault")
    } else if let Ok(userprofile) = std::env::var("USERPROFILE") {
        PathBuf::from(userprofile).join(".altspace").join("vault")
    } else {
        PathBuf::from("vault")
    };

    fs::create_dir_all(&base).map_err(|e| format!("Failed to create vault directory: {}", e))?;
    Ok(base)
}

fn sanitize_key(key: &str) -> Result<String, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err("Vault key must be between 1 and 64 characters".into());
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Vault key must only contain alphanumeric characters, underscores, or dashes".into());
    }
    Ok(trimmed.to_string())
}

/// Protects plaintext bytes using Windows Data Protection API (DPAPI).
/// Bound to the current Windows user and machine.
pub fn protect_bytes(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    if plaintext.is_empty() {
        return Ok(Vec::new());
    }

    let data_in = CRYPT_INTEGER_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut data_out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    unsafe {
        let success = CryptProtectData(
            &data_in,
            PCWSTR::null(),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut data_out,
        );

        if let Err(e) = success {
            return Err(format!("Windows DPAPI CryptProtectData failed: {}", e));
        }

        let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
        let result = slice.to_vec();
        let _ = LocalFree(windows::Win32::Foundation::HLOCAL(data_out.pbData as _));
        Ok(result)
    }
}

/// Unprotects DPAPI encrypted bytes back to plaintext.
pub fn unprotect_bytes(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    if ciphertext.is_empty() {
        return Ok(Vec::new());
    }

    let data_in = CRYPT_INTEGER_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut data_out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    unsafe {
        let success = CryptUnprotectData(
            &data_in,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut data_out,
        );

        if let Err(e) = success {
            return Err(format!("Windows DPAPI CryptUnprotectData failed: {}", e));
        }

        let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
        let result = slice.to_vec();
        let _ = LocalFree(windows::Win32::Foundation::HLOCAL(data_out.pbData as _));
        Ok(result)
    }
}

/// Stores an encrypted secret string under the given key using DPAPI
pub fn store_secret(key: &str, plaintext: &str) -> Result<(), String> {
    let clean_key = sanitize_key(key)?;
    let ciphertext = protect_bytes(plaintext.as_bytes())?;
    let path = get_vault_dir()?.join(format!("{}.dpapi", clean_key));
    fs::write(&path, ciphertext).map_err(|e| format!("Failed to write encrypted secret: {}", e))
}

/// Retrieves and decrypts a secret string under the given key
pub fn retrieve_secret(key: &str) -> Result<Option<String>, String> {
    let clean_key = sanitize_key(key)?;
    let path = get_vault_dir()?.join(format!("{}.dpapi", clean_key));
    if !path.exists() {
        return Ok(None);
    }
    let ciphertext = fs::read(&path).map_err(|e| format!("Failed to read encrypted secret: {}", e))?;
    let plaintext_bytes = unprotect_bytes(&ciphertext)?;
    let text = String::from_utf8(plaintext_bytes)
        .map_err(|e| format!("Corrupt or non-UTF8 secret payload: {}", e))?;
    Ok(Some(text))
}

/// Checks whether an encrypted secret exists under the given key without decrypting or exposing it
pub fn has_secret(key: &str) -> Result<bool, String> {
    let clean_key = sanitize_key(key)?;
    let path = get_vault_dir()?.join(format!("{}.dpapi", clean_key));
    Ok(path.exists())
}

/// Deletes an encrypted secret from the vault
pub fn delete_secret(key: &str) -> Result<bool, String> {
    let clean_key = sanitize_key(key)?;
    let path = get_vault_dir()?.join(format!("{}.dpapi", clean_key));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete encrypted secret: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn get_profiles_dir() -> Result<PathBuf, String> {
    let p = get_vault_dir()?.join("profiles");
    fs::create_dir_all(&p).map_err(|e| format!("Failed to create profiles vault directory: {}", e))?;
    Ok(p)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariableEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvProfileSummary {
    pub name: String,
    pub var_count: usize,
    pub updated_at: i64,
    pub redacted_keys: Vec<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvProfilePayload {
    pub name: String,
    pub description: Option<String>,
    pub updated_at: i64,
    pub variables: Vec<EnvVariableEntry>,
}

pub fn sanitize_profile_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 32 {
        return Err("Profile name must be between 1 and 32 characters".into());
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Profile name must only contain alphanumeric characters, underscores, or hyphens".into());
    }
    Ok(trimmed.to_lowercase())
}

pub fn sanitize_env_key(key: &str) -> Result<String, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err("Environment variable key must be between 1 and 64 characters".into());
    }
    let mut chars = trimmed.chars();
    let first = chars.next().unwrap();
    if !first.is_ascii_alphabetic() && first != '_' {
        return Err("Environment variable key must begin with a letter or underscore".into());
    }
    if !chars.all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("Environment variable key must contain only letters, numbers, or underscores".into());
    }
    Ok(trimmed.to_uppercase())
}

pub fn redact_secret_value(val: &str) -> String {
    let len = val.len();
    if len <= 4 {
        return "****".to_string();
    }
    let prefix_len = std::cmp::min(4, len / 4);
    format!("{}***{}", &val[..prefix_len], &val[len.saturating_sub(2)..])
}

pub fn save_env_profile(mut profile: EnvProfilePayload) -> Result<(), String> {
    let clean_name = sanitize_profile_name(&profile.name)?;
    profile.name = clean_name.clone();

    // Sanitize and deduplicate all variable keys
    let mut clean_vars = Vec::new();
    let mut seen_keys = std::collections::HashSet::new();

    for mut entry in profile.variables {
        let clean_k = sanitize_env_key(&entry.key)?;
        if seen_keys.insert(clean_k.clone()) {
            entry.key = clean_k;
            clean_vars.push(entry);
        }
    }
    profile.variables = clean_vars;
    profile.updated_at = chrono::Utc::now().timestamp();

    // Serialize to JSON, then encrypt using Windows DPAPI
    let serialized = serde_json::to_vec(&profile)
        .map_err(|e| format!("Failed to serialize profile payload: {}", e))?;
    let ciphertext = protect_bytes(&serialized)?;

    let path = get_profiles_dir()?.join(format!("{}.dpapi", clean_name));
    fs::write(&path, ciphertext)
        .map_err(|e| format!("Failed to persist encrypted environment profile: {}", e))
}

pub fn retrieve_profile_payload(profile_name: &str) -> Result<EnvProfilePayload, String> {
    let clean_name = sanitize_profile_name(profile_name)?;
    let path = get_profiles_dir()?.join(format!("{}.dpapi", clean_name));
    if !path.exists() {
        return Err(format!("Environment profile '{}' not found", clean_name));
    }

    let ciphertext = fs::read(&path)
        .map_err(|e| format!("Failed to read encrypted profile: {}", e))?;
    let plaintext_bytes = unprotect_bytes(&ciphertext)?;
    let payload: EnvProfilePayload = serde_json::from_slice(&plaintext_bytes)
        .map_err(|e| format!("Failed to parse decrypted profile JSON: {}", e))?;
    Ok(payload)
}

/// Retrieves environment profile payload with all secret values masked for safe WebView display
pub fn get_masked_profile_payload(profile_name: &str) -> Result<EnvProfilePayload, String> {
    let mut payload = retrieve_profile_payload(profile_name)?;
    for var in &mut payload.variables {
        var.value = redact_secret_value(&var.value);
    }
    Ok(payload)
}

pub fn list_env_profiles() -> Result<Vec<EnvProfileSummary>, String> {
    let dir = get_profiles_dir()?;
    let mut profiles = Vec::new();

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read profiles directory: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("dpapi") {
            if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                if let Ok(payload) = retrieve_profile_payload(file_stem) {
                    let redacted_keys = payload
                        .variables
                        .iter()
                        .take(5)
                        .map(|v| format!("{} ({})", v.key, redact_secret_value(&v.value)))
                        .collect();

                    profiles.push(EnvProfileSummary {
                        name: payload.name,
                        var_count: payload.variables.len(),
                        updated_at: payload.updated_at,
                        redacted_keys,
                        description: payload.description,
                    });
                }
            }
        }
    }

    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(profiles)
}

pub fn delete_env_profile(profile_name: &str) -> Result<bool, String> {
    let clean_name = sanitize_profile_name(profile_name)?;
    let path = get_profiles_dir()?.join(format!("{}.dpapi", clean_name));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete profile: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn launch_with_profile(
    profile_name: &str,
    target: &str,
) -> Result<String, String> {
    let payload = retrieve_profile_payload(profile_name)?;

    let mut cmd = match target {
        "code" => {
            let mut c = Command::new("cmd");
            c.args(["/C", "code", "."]);
            c
        }
        "powershell" => {
            let mut c = Command::new("powershell");
            c.args(["-NoExit", "-NoLogo"]);
            c
        }
        _ => {
            let mut c = Command::new("wt.exe");
            c.args(["-d", "."]);
            c
        }
    };

    // INJECT SECRETS EXCLUSIVELY VIA CHILD PROCESS ENVIRONMENT BLOCK
    // Windows CreateProcess lpEnvironment prevents visible command line disclosure in Task Manager or Event ID 4688
    for entry in &payload.variables {
        cmd.env(&entry.key, &entry.value);
    }

    let spawn_result = cmd.spawn();
    if spawn_result.is_err() && target != "powershell" {
        let mut fallback = Command::new("powershell");
        fallback.args(["-NoExit", "-NoLogo"]);
        for entry in &payload.variables {
            fallback.env(&entry.key, &entry.value);
        }
        fallback.spawn().map_err(|e| format!("Failed to launch terminal with environment: {}", e))?;
    } else if let Err(e) = spawn_result {
        return Err(format!("Failed to launch process with environment: {}", e));
    }

    Ok(format!(
        "Transiently injected {} secrets into {} session ({})",
        payload.variables.len(),
        target,
        profile_name
    ))
}

/// Retrieves or generates a persistent hardware-bound machine identifier for this Windows device.
/// Formatted as ALTS-XXXX-XXXX-XXXX and safely cached in the DPAPI vault.
pub fn get_or_create_device_id() -> Result<String, String> {
    if let Ok(Some(existing)) = retrieve_secret("device_machine_id") {
        let trimmed = existing.trim();
        if trimmed.starts_with("ALTS-") && trimmed.len() >= 14 {
            return Ok(trimmed.to_string());
        }
    }

    let mut raw_id = String::new();

    #[cfg(windows)]
    {
        use windows::Win32::System::Registry::{
            RegOpenKeyExW, RegQueryValueExW, HKEY_LOCAL_MACHINE, KEY_READ, REG_VALUE_TYPE,
        };
        use windows::core::w;

        unsafe {
            let mut hkey = windows::Win32::System::Registry::HKEY::default();
            if RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                w!("SOFTWARE\\Microsoft\\Cryptography"),
                0,
                KEY_READ,
                &mut hkey,
            )
            .is_ok()
            {
                let mut buffer = [0u16; 128];
                let mut size = (buffer.len() * 2) as u32;
                let mut reg_type = REG_VALUE_TYPE::default();
                if RegQueryValueExW(
                    hkey,
                    w!("MachineGuid"),
                    None,
                    Some(&mut reg_type),
                    Some(buffer.as_mut_ptr() as *mut u8),
                    Some(&mut size),
                )
                .is_ok()
                {
                    let len = (size as usize / 2).saturating_sub(1);
                    raw_id = String::from_utf16_lossy(&buffer[..len]);
                }
            }
        }
    }

    if raw_id.is_empty() {
        let comp = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "DEVICE".into());
        let user = std::env::var("USERNAME").unwrap_or_else(|_| "USER".into());
        raw_id = format!("{}-{}-{}", comp, user, chrono::Utc::now().timestamp_millis());
    }

    // Clean and produce a standardized ALTS-XXXX-XXXX-XXXX token
    let clean: String = raw_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    let padded = format!("{:0<16}", clean);
    let formatted = format!(
        "ALTS-{}-{}-{}",
        &padded[0..4],
        &padded[4..8],
        &padded[8..12]
    );

    let _ = store_secret("device_machine_id", &formatted);
    Ok(formatted)
}

pub fn store_byok_key(provider: &str, api_key: &str) -> Result<(), String> {
    let clean_provider = sanitize_key(provider)?;
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        let _ = delete_byok_key(&clean_provider);
        return Ok(());
    }
    let encrypted = protect_bytes(trimmed.as_bytes())?;
    let path = get_vault_dir()?.join("byok").join(format!("{}.dpapi", clean_provider));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create byok dir: {}", e))?;
    }
    fs::write(&path, encrypted).map_err(|e| format!("Failed to write byok key: {}", e))?;
    Ok(())
}

pub fn retrieve_byok_key(provider: &str) -> Result<Option<String>, String> {
    let clean_provider = sanitize_key(provider)?;
    let path = get_vault_dir()?.join("byok").join(format!("{}.dpapi", clean_provider));
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read(&path).map_err(|e| format!("Failed to read byok key: {}", e))?;
    let decrypted = unprotect_bytes(&raw)?;
    let key_str = String::from_utf8(decrypted).map_err(|e| format!("Invalid UTF-8 in byok key: {}", e))?;
    Ok(Some(key_str))
}

pub fn list_byok_providers() -> Result<Vec<String>, String> {
    let byok_dir = get_vault_dir()?.join("byok");
    if !byok_dir.exists() {
        return Ok(Vec::new());
    }
    let mut providers = Vec::new();
    if let Ok(entries) = fs::read_dir(&byok_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("dpapi") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    providers.push(stem.to_string());
                }
            }
        }
    }
    Ok(providers)
}

pub fn delete_byok_key(provider: &str) -> Result<bool, String> {
    let clean_provider = sanitize_key(provider)?;
    let path = get_vault_dir()?.join("byok").join(format!("{}.dpapi", clean_provider));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete byok key: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_byok_roundtrip() {
        let provider = "anthropic_test";
        let key = "sk-ant-api03-test-token-12345";
        store_byok_key(provider, key).expect("Store BYOK key should succeed");

        let retrieved = retrieve_byok_key(provider).expect("Retrieve BYOK should succeed");
        assert_eq!(retrieved.as_deref(), Some(key));

        let providers = list_byok_providers().expect("List BYOK providers should succeed");
        assert!(providers.contains(&provider.to_string()));

        let deleted = delete_byok_key(provider).expect("Delete BYOK key should succeed");
        assert!(deleted);

        let after_delete = retrieve_byok_key(provider).unwrap();
        assert_eq!(after_delete, None);
    }

    #[test]
    fn test_device_id_format() {
        let id = get_or_create_device_id().expect("Device ID should be generated");
        assert!(id.starts_with("ALTS-"), "Device ID must start with ALTS- prefix");
        assert_eq!(id.len(), 19, "Device ID must be 19 chars: ALTS-XXXX-XXXX-XXXX");
    }

    #[test]
    fn test_dpapi_roundtrip() {
        let sample = "gho_testToken123456789SecretKey";
        let encrypted = protect_bytes(sample.as_bytes()).expect("Encryption should succeed");
        assert_ne!(sample.as_bytes(), encrypted.as_slice(), "Ciphertext must not match plaintext");

        let decrypted = unprotect_bytes(&encrypted).expect("Decryption should succeed");
        assert_eq!(sample.as_bytes(), decrypted.as_slice(), "Decrypted data must match original");
    }

    #[test]
    fn test_dpapi_empty() {
        let empty: &[u8] = &[];
        let enc = protect_bytes(empty).unwrap();
        assert!(enc.is_empty());
        let dec = unprotect_bytes(&enc).unwrap();
        assert!(dec.is_empty());
    }

    #[test]
    fn test_sanitize_key() {
        assert!(sanitize_key("valid_key-1").is_ok());
        assert!(sanitize_key("../invalid").is_err());
        assert!(sanitize_key("").is_err());
    }

    #[test]
    fn test_has_secret_and_masked_profile() {
        let test_key = "test_presence_key";
        let _ = delete_secret(test_key);
        assert!(!has_secret(test_key).unwrap());

        store_secret(test_key, "super_secret_token_123").unwrap();
        assert!(has_secret(test_key).unwrap());
        delete_secret(test_key).unwrap();
        assert!(!has_secret(test_key).unwrap());

        let prof = EnvProfilePayload {
            name: "test_mask_prof".into(),
            description: Some("Test profile".into()),
            updated_at: 0,
            variables: vec![
                EnvVariableEntry {
                    key: "SECRET_KEY".into(),
                    value: "sk-ant-live01-1234567890abcdef".into(),
                },
                EnvVariableEntry {
                    key: "SHORT_PIN".into(),
                    value: "1234".into(),
                },
            ],
        };
        save_env_profile(prof).unwrap();

        // retrieve_profile_payload keeps plaintext for process injection
        let raw = retrieve_profile_payload("test_mask_prof").unwrap();
        assert_eq!(raw.variables[0].value, "sk-ant-live01-1234567890abcdef");
        assert_eq!(raw.variables[1].value, "1234");

        // get_masked_profile_payload masks values before returning to WebView
        let masked = get_masked_profile_payload("test_mask_prof").unwrap();
        assert_ne!(masked.variables[0].value, "sk-ant-live01-1234567890abcdef");
        assert!(masked.variables[0].value.contains("***"));
        assert_eq!(masked.variables[1].value, "****");

        delete_env_profile("test_mask_prof").unwrap();
    }
}
