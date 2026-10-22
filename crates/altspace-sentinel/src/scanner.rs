use super::entropy::shannon_entropy;
use super::patterns::{SecretType, KNOWN_PATTERNS};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedSecret {
    pub secret_type: SecretType,
    pub raw_preview_masked: String,
    pub sha256_hash: String,
    pub entropy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub has_secrets: bool,
    pub detected: Vec<DetectedSecret>,
    pub elapsed_micros: u64,
}

pub struct SecretScanner {
    suppression_hashes: RwLock<HashSet<String>>,
}

impl Default for SecretScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl SecretScanner {
    pub fn new() -> Self {
        Self {
            suppression_hashes: RwLock::new(HashSet::new()),
        }
    }

    /// Adds a SHA-256 hash to the user's suppression whitelist
    pub fn suppress_hash(&self, hash: String) {
        let mut lock = self.suppression_hashes.write().unwrap();
        lock.insert(hash);
    }

    /// Checks if a hash is suppressed
    pub fn is_suppressed(&self, hash: &str) -> bool {
        let lock = self.suppression_hashes.read().unwrap();
        lock.contains(hash)
    }

    /// Scans an input string through the 5-stage zero-lag pipeline (< 0.5ms)
    pub fn scan(&self, input: &str) -> ScanResult {
        let start = std::time::Instant::now();
        let mut detected = Vec::new();

        // Stage 1: Length check (skip if too small)
        if input.len() < 16 {
            return ScanResult {
                has_secrets: false,
                detected: Vec::new(),
                elapsed_micros: start.elapsed().as_micros() as u64,
            };
        }

        // Tokenize input by whitespace and common punctuation delimiters
        for word in input.split(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == '=' || c == ':' || c == ';') {
            let token = word.trim();
            if token.len() < 16 {
                continue;
            }

            // Stage 2: Known Pattern Prefix Check
            let mut matched_pattern = None;
            for pattern in KNOWN_PATTERNS {
                if token.starts_with(pattern.prefix) && token.len() >= pattern.min_len && token.len() <= pattern.max_len {
                    matched_pattern = Some(pattern.secret_type);
                    break;
                }
            }

            // Stage 3: Shannon Entropy Calculation
            let entropy = shannon_entropy(token);

            let detected_type = if let Some(st) = matched_pattern {
                Some(st)
            } else if entropy > 4.5 && token.len() >= 24 && !token.contains('/') && !token.contains('\\') {
                Some(SecretType::GenericHighEntropyToken)
            } else {
                None
            };

            if let Some(sec_type) = detected_type {
                // Compute SHA-256 hash
                let mut hasher = Sha256::new();
                hasher.update(token.as_bytes());
                let hash = format!("{:x}", hasher.finalize());

                // Stage 4: Suppression Hash Lookup
                if !self.is_suppressed(&hash) {
                    detected.push(DetectedSecret {
                        secret_type: sec_type,
                        raw_preview_masked: super::masking::mask_secret(token),
                        sha256_hash: hash,
                        entropy,
                    });
                }
            }
        }

        let elapsed = start.elapsed().as_micros() as u64;
        ScanResult {
            has_secrets: !detected.is_empty(),
            detected,
            elapsed_micros: elapsed,
        }
    }
}
