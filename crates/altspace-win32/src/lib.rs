//! Native Win32 driver crate for AltSpace Developer Control Plane.
//!
//! Provides zero-subprocess process tree snapshots, TCP port ownership queries,
//! hardware-backed DPAPI memory protection with page-locking (`VirtualLock`),
//! and dynamic WSL2 APIs.

pub mod dpapi;
pub mod ports;
pub mod process;
pub mod wsl;

pub use dpapi::{protect_bytes, unprotect_bytes, ProtectedBuffer};
pub use ports::{get_listening_ports, get_process_tree_map, PortProcess, ProcessSnapshot};
pub use process::{is_process_alive, terminate_process_tree};
pub use wsl::{is_wsl_installed, list_wsl_distributions};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dpapi_roundtrip_encryption() {
        let secret = b"my_super_secret_github_personal_access_token_123456789";
        let ciphertext = protect_bytes(secret).expect("DPAPI encryption should succeed");
        assert!(!ciphertext.is_empty());
        assert_ne!(ciphertext.as_slice(), secret);

        let decrypted_buf = unprotect_bytes(&ciphertext).expect("DPAPI decryption should succeed");
        assert_eq!(decrypted_buf.as_slice(), secret);
    }

    #[test]
    fn test_process_tree_and_listening_ports() {
        let _ports = get_listening_ports();
        // There should be at least one listening port on any developer workstation or an empty valid list
        let tree = get_process_tree_map();
        assert!(!tree.is_empty());

        let my_pid = std::process::id();
        assert!(tree.contains_key(&my_pid));
        assert!(is_process_alive(my_pid));
    }
}
