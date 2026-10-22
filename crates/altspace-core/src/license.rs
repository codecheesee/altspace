use base64::prelude::*;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

/// Master Public Key for AltSpace Ed25519 Cryptographic Licensing
pub const MASTER_PUBLIC_KEY: [u8; 32] = [
    0x04, 0x13, 0x91, 0x1f, 0x35, 0x48, 0xcc, 0x6e,
    0xf3, 0x9f, 0x93, 0x44, 0xb8, 0xb6, 0x92, 0xeb,
    0x6d, 0xcb, 0x10, 0x10, 0x81, 0x9d, 0xeb, 0x36,
    0x17, 0x94, 0x76, 0x84, 0xcf, 0xcd, 0x0d, 0x35,
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
pub struct LicenseStatus {
    pub is_pro: bool,
    pub tier: String,
    pub is_trial: bool,
    pub trial_days_remaining: u32,
    pub license_id: Option<String>,
    pub expires_at: Option<i64>,
}

fn decode_base64url(s: &str) -> Result<Vec<u8>, String> {
    BASE64_URL_SAFE_NO_PAD
        .decode(s.trim())
        .or_else(|_| BASE64_URL_SAFE.decode(s.trim()))
        .map_err(|e| format!("Base64 decoding failed: {}", e))
}

pub struct LicenseVerifier;

impl LicenseVerifier {
    /// Verifies an Ed25519 license key string
    pub fn verify_license_str(
        license_str: &str,
        current_machine_id: Option<&str>,
    ) -> Result<LicensePayload, String> {
        let trimmed = license_str.trim();
        let parts: Vec<&str> = trimmed.split('.').collect();
        if parts.len() != 2 {
            return Err("Invalid license format: expected payload.signature".into());
        }

        let payload_bytes = decode_base64url(parts[0])?;
        let sig_bytes = decode_base64url(parts[1])?;

        if sig_bytes.len() != 64 {
            return Err("Invalid signature length: expected 64 bytes".into());
        }

        let verifying_key = VerifyingKey::from_bytes(&MASTER_PUBLIC_KEY)
            .map_err(|e| format!("Invalid public key configuration: {}", e))?;

        let mut sig_arr = [0u8; 64];
        sig_arr.copy_from_slice(&sig_bytes);
        let signature = Signature::from_bytes(&sig_arr);

        verifying_key
            .verify(&payload_bytes, &signature)
            .map_err(|_| "Cryptographic signature verification failed: license is invalid or forged".to_string())?;

        let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
            .map_err(|e| format!("Malformed license payload: {}", e))?;

        if payload.exp > 0 {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            if now > payload.exp {
                return Err("License key has expired".into());
            }
        }

        if payload.machine != "ANY" {
            if let Some(m_id) = current_machine_id {
                if payload.machine != m_id {
                    return Err("License key is locked to a different machine ID".into());
                }
            }
        }

        Ok(payload)
    }
}
