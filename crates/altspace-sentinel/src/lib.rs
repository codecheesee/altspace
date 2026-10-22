//! Real-time DevSecOps Secret Sentinel for AltSpace Control Plane.
//!
//! Provides ultra-low-latency (< 0.5ms) clipboard, file, and prompt scanning
//! using a 5-stage filter: length check -> Shannon entropy threshold (> 4.5) ->
//! pattern prefix match -> suppression hash lookup -> redaction masking.

pub mod entropy;
pub mod masking;
pub mod patterns;
pub mod scanner;

pub use entropy::shannon_entropy;
pub use masking::mask_secret;
pub use patterns::SecretType;
pub use scanner::{ScanResult, SecretScanner};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shannon_entropy_calculation() {
        let low_entropy = "aaaaaaaaaaaaaaaa";
        let high_entropy = "4k8F#9xL@2qP$zW7";
        assert!(shannon_entropy(low_entropy) < 1.0);
        assert!(shannon_entropy(high_entropy) > 3.5);
    }

    #[test]
    fn test_secret_detection_and_masking() {
        let scanner = SecretScanner::new();
        let payload = "Deploying with token: ghp_1234567890abcdef1234567890abcdef for project";
        let result = scanner.scan(payload);

        assert!(result.has_secrets);
        assert_eq!(result.detected.len(), 1);
        assert_eq!(result.detected[0].secret_type, SecretType::GitHubToken);
        assert_eq!(result.detected[0].raw_preview_masked, "ghp_1234...cdef");
        assert!(result.elapsed_micros < 5000); // Sub-5ms execution guarantee
    }

    #[test]
    fn test_suppression_hash() {
        let scanner = SecretScanner::new();
        let token = "ghp_1234567890abcdef1234567890abcdef";
        let initial_scan = scanner.scan(token);
        assert!(initial_scan.has_secrets);

        let hash = initial_scan.detected[0].sha256_hash.clone();
        scanner.suppress_hash(hash);

        let second_scan = scanner.scan(token);
        assert!(!second_scan.has_secrets);
    }
}
