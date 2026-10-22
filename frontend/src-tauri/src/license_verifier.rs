use base64::prelude::*;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::crypto_vault;

/// Master Public Key for AltSpace Ed25519 Cryptographic Licensing
/// Generated via scripts/keygen_and_license.cjs
pub const MASTER_PUBLIC_KEY: [u8; 32] = [
    0x04, 0x13, 0x91, 0x1f, 0x35, 0x48, 0xcc, 0x6e, 0xf3, 0x9f, 0x93, 0x44, 0xb8, 0xb6, 0x92, 0xeb,
    0x6d, 0xcb, 0x10, 0x10, 0x81, 0x9d, 0xeb, 0x36, 0x17, 0x94, 0x76, 0x84, 0xcf, 0xcd, 0x0d, 0x35,
];

fn default_any() -> String {
    "ANY".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LicensePayload {
    pub v: u32,
    pub id: String,
    pub user: String,
    #[serde(default)]
    pub email: Option<String>,
    pub tier: String,
    #[serde(default = "default_any")]
    pub machine: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseVerificationResult {
    pub valid: bool,
    pub id: String,
    pub user: String,
    pub email: Option<String>,
    pub tier: String,
    pub is_perpetual: bool,
    pub expires_at: Option<String>,
    pub machine: String,
    pub message: String,
}

/// Helper to decode base64url without padding
fn decode_base64url(s: &str) -> Result<Vec<u8>, String> {
    BASE64_URL_SAFE_NO_PAD
        .decode(s.trim())
        .or_else(|_| BASE64_URL_SAFE.decode(s.trim()))
        .map_err(|e| format!("Base64 decoding failed: {}", e))
}

/// Cryptographically verifies an Ed25519 license key string
pub fn verify_license_str(
    license_str: &str,
    current_machine_id: Option<&str>,
) -> Result<LicensePayload, String> {
    let trimmed = license_str.trim();
    if !trimmed.starts_with("ALTS1-") {
        return Err(
            "Invalid license key prefix. Expected format: ALTS1-<payload>.<signature>".to_string(),
        );
    }

    let token_body = &trimmed["ALTS1-".len()..];
    let parts: Vec<&str> = token_body.split('.').collect();
    if parts.len() != 2 {
        return Err("Malformed license key. Expected two segments separated by dot.".to_string());
    }

    let payload_bytes = decode_base64url(parts[0])?;
    let sig_bytes = decode_base64url(parts[1])?;

    if sig_bytes.len() != 64 {
        return Err(format!(
            "Invalid signature length: expected 64 bytes, got {}",
            sig_bytes.len()
        ));
    }

    let verifying_key = VerifyingKey::from_bytes(&MASTER_PUBLIC_KEY)
        .map_err(|e| format!("Internal public key error: {}", e))?;

    let mut sig_fixed = [0u8; 64];
    sig_fixed.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_fixed);

    // Cryptographic signature verification over the payload bytes
    verifying_key
        .verify(&payload_bytes, &signature)
        .map_err(|_| {
            "Cryptographic signature verification failed: Invalid or forged license key."
                .to_string()
        })?;

    // Parse verified payload JSON
    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| format!("Failed to parse license payload: {}", e))?;

    // Expiration check
    let now = chrono::Utc::now().timestamp();
    if payload.exp > 0 && payload.exp < now {
        return Err(format!(
            "License key expired on unix timestamp {}",
            payload.exp
        ));
    }

    // Machine lock check
    if payload.machine != "ANY" {
        if let Some(machine_id) = current_machine_id {
            if !payload.machine.eq_ignore_ascii_case(machine_id) {
                return Err(format!(
                    "License key is locked to machine '{}', but this machine is '{}'.",
                    payload.machine, machine_id
                ));
            }
        }
    }

    Ok(payload)
}

/// Tauri command: Verifies and activates a cryptographic license key, saving to DPAPI
#[tauri::command]
pub fn verify_and_activate_license(
    license_key: String,
) -> Result<LicenseVerificationResult, String> {
    let current_machine_id =
        crypto_vault::get_or_create_device_id().unwrap_or_else(|_| "ALTS-UNKNOWN".to_string());
    let payload = verify_license_str(&license_key, Some(&current_machine_id))?;

    // Save verified license into DPAPI vault
    if let Ok(serialized) = serde_json::to_string(&payload) {
        let _ = crypto_vault::store_secret("altspace_verified_license", &serialized);
        let _ = crypto_vault::store_secret(
            "altspace_entitlement_token",
            &format!("ALTS-PRO-{}", payload.id),
        );
    }

    let is_perpetual = payload.exp == 0;
    let expires_at = if payload.exp > 0 {
        chrono::DateTime::from_timestamp(payload.exp, 0).map(|dt| dt.to_rfc3339())
    } else {
        None
    };

    Ok(LicenseVerificationResult {
        valid: true,
        id: payload.id.clone(),
        user: payload.user.clone(),
        email: payload.email.clone(),
        tier: payload.tier.clone(),
        is_perpetual,
        expires_at,
        machine: payload.machine.clone(),
        message: format!(
            "Successfully activated {} license for {}!",
            payload.tier, payload.user
        ),
    })
}

/// Tauri command: Retrieves currently active verified license if present in DPAPI
#[tauri::command]
pub fn get_active_verified_license() -> Result<Option<LicenseVerificationResult>, String> {
    let current_machine_id =
        crypto_vault::get_or_create_device_id().unwrap_or_else(|_| "ALTS-UNKNOWN".to_string());
    let raw = match crypto_vault::retrieve_secret("altspace_verified_license") {
        Ok(Some(s)) if !s.trim().is_empty() => s,
        _ => return Ok(None),
    };

    let payload: LicensePayload = match serde_json::from_str(&raw) {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };

    // Check expiration
    let now = chrono::Utc::now().timestamp();
    if payload.exp > 0 && payload.exp < now {
        return Ok(None);
    }

    // Check machine lock
    if payload.machine != "ANY" && !payload.machine.eq_ignore_ascii_case(&current_machine_id) {
        return Ok(None);
    }

    let is_perpetual = payload.exp == 0;
    let expires_at = if payload.exp > 0 {
        chrono::DateTime::from_timestamp(payload.exp, 0).map(|dt| dt.to_rfc3339())
    } else {
        None
    };

    Ok(Some(LicenseVerificationResult {
        valid: true,
        id: payload.id,
        user: payload.user,
        email: payload.email,
        tier: payload.tier,
        is_perpetual,
        expires_at,
        machine: payload.machine,
        message: "Active verified license loaded from secure storage.".to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rejects_missing_prefix() {
        let err = verify_license_str("INVALID-TOKEN", None);
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("Invalid license key prefix"));
    }

    #[test]
    fn test_rejects_tampered_payload() {
        // Tamper with payload (change shilpi to hacker)
        let tampered_key = "ALTS1-eyJ2IjoxLCJpZCI6IkFMVFMtNjNCREQ3RjMiLCJ1c2VyIjoiaGFja2VyIiwiZW1haWwiOiJzaGlscGlAdGVzdC5jb20iLCJ0aWVyIjoiUHJvIiwibWFjaGluZSI6IkFOWSIsImlhdCI6MTc5MjU3ODQ1MywiZXhwIjowfQ.F9LGpEtucWShkXLZX7DsQN56oL5NGgfqK6ja07l9ly6gWfkowiG8NPLrv4QVUGYVfcEvniz5JFmokC1mJOrmAA";
        let err = verify_license_str(tampered_key, None);
        assert!(err.is_err());
        assert!(err
            .unwrap_err()
            .contains("Cryptographic signature verification failed"));
    }

    #[test]
    fn test_valid_key_verification() {
        let valid_key = "ALTS1-eyJ2IjoxLCJpZCI6IkFMVFMtNjNCREQ3RjMiLCJ1c2VyIjoic2hpbHBpIiwiZW1haWwiOiJzaGlscGlAdGVzdC5jb20iLCJ0aWVyIjoiUHJvIiwibWFjaGluZSI6IkFOWSIsImlhdCI6MTc5MjU3ODQ1MywiZXhwIjowfQ.F9LGpEtucWShkXLZX7DsQN56oL5NGgfqK6ja07l9ly6gWfkowiG8NPLrv4QVUGYVfcEvniz5JFmokC1mJOrmAA";
        let res = verify_license_str(valid_key, None);
        assert!(res.is_ok());
        let payload = res.unwrap();
        assert_eq!(payload.user, "shilpi");
        assert_eq!(payload.tier, "Pro");
        assert_eq!(payload.machine, "ANY");
    }

    #[test]
    fn test_machine_locking() {
        let valid_any_key = "ALTS1-eyJ2IjoxLCJpZCI6IkFMVFMtNjNCREQ3RjMiLCJ1c2VyIjoic2hpbHBpIiwiZW1haWwiOiJzaGlscGlAdGVzdC5jb20iLCJ0aWVyIjoiUHJvIiwibWFjaGluZSI6IkFOWSIsImlhdCI6MTc5MjU3ODQ1MywiZXhwIjowfQ.F9LGpEtucWShkXLZX7DsQN56oL5NGgfqK6ja07l9ly6gWfkowiG8NPLrv4QVUGYVfcEvniz5JFmokC1mJOrmAA";
        assert!(verify_license_str(valid_any_key, Some("ALTS-9999-8888")).is_ok());
    }
}
