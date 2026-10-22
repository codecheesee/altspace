/// Masks a detected secret while preserving prefix and suffix for developer context.
/// Example: `ghp_1234567890abcdef1234567890abcdef` -> `ghp_1234...cdef`
pub fn mask_secret(secret: &str) -> String {
    let len = secret.chars().count();
    if len <= 8 {
        return "********".into();
    }

    let prefix_len = if len > 24 { 8 } else { 4 };
    let suffix_len = 4;

    let prefix: String = secret.chars().take(prefix_len).collect();
    let suffix: String = secret.chars().skip(len - suffix_len).collect();

    format!("{}...{}", prefix, suffix)
}

/// Redacts all occurrences of a secret within a larger text block.
pub fn redact_within_text(text: &str, secret: &str) -> String {
    if secret.is_empty() {
        return text.to_string();
    }
    let masked = mask_secret(secret);
    text.replace(secret, &masked)
}
