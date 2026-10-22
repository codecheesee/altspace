//! Execution Broker 2.0 for AltSpace Control Plane.
//!
//! Enforces single-use cryptographic challenge tokens, parameter-bound execution hashes,
//! 3-tier risk classification, circuit-breaker loop limiting, and audit ledgers.

pub mod ledger;
pub mod limiter;
pub mod policy;
pub mod token;

pub use ledger::{ActionLedger, LedgerEntry};
pub use limiter::CircuitBreaker;
pub use policy::{ActionStatus, RiskTier, TypedAction};
pub use token::{BrokerToken, TokenVerifier};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_issuance_and_single_use() {
        let verifier = TokenVerifier::new();
        let action = r#"{"type":"KillPortProcess","payload":{"port":3000,"pid":1234}}"#;

        let token_id = verifier.issue_token(action);
        assert!(!token_id.is_empty());

        // First verification must succeed
        assert!(verifier.verify_and_consume(&token_id, action).is_ok());

        // Second verification with same token must fail (replay prevention)
        assert!(verifier.verify_and_consume(&token_id, action).is_err());
    }

    #[test]
    fn test_parameter_tampering_rejection() {
        let verifier = TokenVerifier::new();
        let original_action = r#"{"type":"KillPortProcess","payload":{"port":3000,"pid":1234}}"#;
        let tampered_action = r#"{"type":"KillPortProcess","payload":{"port":8080,"pid":5678}}"#;

        let token_id = verifier.issue_token(original_action);
        let result = verifier.verify_and_consume(&token_id, tampered_action);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("parameter tampering"));
    }

    #[test]
    fn test_circuit_breaker_loop_limiter() {
        let breaker = CircuitBreaker::new(3, 30);

        assert!(breaker.check_and_record().is_ok());
        assert!(breaker.check_and_record().is_ok());
        assert!(breaker.check_and_record().is_ok());

        // 4th action within window must be rejected
        let fourth = breaker.check_and_record();
        assert!(fourth.is_err());
        assert!(fourth.unwrap_err() <= 30);
    }
}
