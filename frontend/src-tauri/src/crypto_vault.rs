use std::fs;
use std::path::PathBuf;
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
