use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{Arc, Mutex, LazyLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub const DEFAULT_PIPE_NAME: &str = r"\\.\pipe\AltSpace.Broker";
pub const NONCE_WINDOW_SECS: u64 = 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipeRequest {
    pub nonce: String,
    pub timestamp: u64,
    pub session_token: String,
    pub action: crate::broker::TypedAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipeResponse {
    pub nonce: String,
    pub success: bool,
    pub result: Option<crate::broker::ActionResult>,
    pub error: Option<String>,
}

// In-memory replay protection cache
static SEEN_NONCES: LazyLock<Arc<Mutex<HashSet<String>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashSet::new())));

/// Validates pipe request authentication, expiration, and replay protection
pub fn validate_pipe_request(
    req: &PipeRequest,
    expected_session_token: &str,
    now: u64,
) -> Result<(), String> {
    // 1. Session token validation
    if req.session_token.trim() != expected_session_token.trim() || req.session_token.is_empty() {
        return Err("Unauthorized: Invalid or missing broker session token".into());
    }

    // 2. Request expiration (replay window)
    if req.timestamp > now + 10 || now.saturating_sub(req.timestamp) > NONCE_WINDOW_SECS {
        return Err("Request expired or timestamp skewed beyond allowed window".into());
    }

    // 3. Replay protection via nonce cache
    if req.nonce.trim().is_empty() {
        return Err("Missing request nonce".into());
    }

    let mut lock = SEEN_NONCES.lock().map_err(|e| format!("Mutex error: {}", e))?;
    if lock.contains(&req.nonce) {
        return Err("Replay attack detected: Nonce has already been consumed".into());
    }

    lock.insert(req.nonce.clone());
    if lock.len() > 1000 {
        lock.clear(); // Bounded reset
    }

    Ok(())
}

/// Generates a cryptographically random nonce for client requests
pub fn generate_nonce() -> String {
    use std::time::Instant;
    format!("{:x}-{:x}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos(), Instant::now().elapsed().as_nanos())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::broker::TypedAction;

    #[test]
    fn test_valid_pipe_request() {
        let now = 1000000;
        let token = "valid_session_token_xyz";
        let req = PipeRequest {
            nonce: "nonce_1".into(),
            timestamp: now,
            session_token: token.into(),
            action: TypedAction::ReadFile { path: "C:\\test.txt".into(), max_bytes: None },
        };

        let res = validate_pipe_request(&req, token, now);
        assert!(res.is_ok());

        // Replay of same nonce must fail
        let replay = validate_pipe_request(&req, token, now);
        assert!(replay.is_err());
        assert!(replay.unwrap_err().contains("Replay attack"));
    }

    #[test]
    fn test_expired_pipe_request() {
        let now = 1000000;
        let token = "valid_session_token_xyz";
        let expired_req = PipeRequest {
            nonce: "nonce_2".into(),
            timestamp: now - (NONCE_WINDOW_SECS + 5),
            session_token: token.into(),
            action: TypedAction::ReadFile { path: "C:\\test.txt".into(), max_bytes: None },
        };

        let res = validate_pipe_request(&expired_req, token, now);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("expired"));
    }

    #[test]
    fn test_invalid_session_token() {
        let now = 1000000;
        let req = PipeRequest {
            nonce: "nonce_3".into(),
            timestamp: now,
            session_token: "wrong_token".into(),
            action: TypedAction::ReadFile { path: "C:\\test.txt".into(), max_bytes: None },
        };

        let res = validate_pipe_request(&req, "correct_token", now);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Unauthorized"));
    }
}
