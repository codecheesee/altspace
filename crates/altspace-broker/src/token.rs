use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct BrokerToken {
    pub token_id: String,
    pub action_hash: String,
    pub issued_at: Instant,
    pub ttl: Duration,
    pub consumed: bool,
}

pub struct TokenVerifier {
    active_tokens: std::sync::Mutex<std::collections::HashMap<String, BrokerToken>>,
}

impl Default for TokenVerifier {
    fn default() -> Self {
        Self::new()
    }
}

impl TokenVerifier {
    pub fn new() -> Self {
        Self {
            active_tokens: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// Computes deterministic SHA-256 parameter hash for an action payload
    pub fn compute_action_hash(action_json: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(action_json.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Issues a single-use parameter-bound challenge token valid for 60 seconds
    pub fn issue_token(&self, action_json: &str) -> String {
        let action_hash = Self::compute_action_hash(action_json);
        let token_id = format!("tkn_{}", &action_hash[..16]);
        let token = BrokerToken {
            token_id: token_id.clone(),
            action_hash,
            issued_at: Instant::now(),
            ttl: Duration::from_secs(60),
            consumed: false,
        };

        let mut lock = self.active_tokens.lock().unwrap();
        // Evict expired tokens
        lock.retain(|_, t| t.issued_at.elapsed() < t.ttl && !t.consumed);
        lock.insert(token_id.clone(), token);

        token_id
    }

    /// Verifies and consumes a token against the matching action payload.
    /// Returns true only if token is valid, unconsumed, unexpired, and matches payload hash.
    pub fn verify_and_consume(&self, token_id: &str, action_json: &str) -> Result<(), String> {
        let mut lock = self.active_tokens.lock().unwrap();
        let token = lock.get_mut(token_id).ok_or("Token not found or already expired")?;

        if token.consumed {
            return Err("Token has already been consumed (replay prevention)".into());
        }

        if token.issued_at.elapsed() > token.ttl {
            return Err("Token expired (TTL exceeded)".into());
        }

        let current_hash = Self::compute_action_hash(action_json);
        if token.action_hash != current_hash {
            return Err("Action payload hash mismatch: parameter tampering detected".into());
        }

        token.consumed = true;
        Ok(())
    }
}
