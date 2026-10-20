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

#[cfg(test)]
mod tests {
    use super::*;

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
