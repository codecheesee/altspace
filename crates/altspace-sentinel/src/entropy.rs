use std::collections::HashMap;

/// Computes Shannon entropy in bits per character for a given string slice.
/// Random or high-entropy tokens (API keys, private keys, hashes) typically have entropy > 4.5.
pub fn shannon_entropy(input: &str) -> f64 {
    if input.is_empty() {
        return 0.0;
    }

    let mut frequency = HashMap::new();
    let total_len = input.len() as f64;

    for byte in input.bytes() {
        *frequency.entry(byte).or_insert(0usize) += 1;
    }

    let mut entropy = 0.0;
    for &count in frequency.values() {
        let p = (count as f64) / total_len;
        entropy -= p * p.log2();
    }

    entropy
}
