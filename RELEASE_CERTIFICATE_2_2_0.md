# AltSpace 2.2.0 — Final Release Certificate

---

### Release Metadata

| Field | Value |
| :--- | :--- |
| **Product Name** | AltSpace |
| **Application ID** | `com.altspace.launcher` |
| **Target Version** | `2.2.0` |
| **Base Commit SHA** | `691ea1f65476e9dd94236eccc02298a29a7490fc` |
| **Release Candidate Commit** | `24c42c4f884b2d79d99357b135a5d6a01be225bf` |
| **Branch** | `release/security-hardening-next` |
| **Target Release Tag** | `v2.2.0` |

---

### Verification & Test Counts

| Test Suite | Metric | Result |
| :--- | :--- | :--- |
| **Frontend Unit & Security Tests** | 15 test suites | **88 passed**, 0 failed |
| **Rust Backend Tests** | Native test harness | **78 passed**, 0 failed |
| **Total Automated Tests** | Comprehensive test coverage | **166 passed** (100% pass rate) |
| **Rust Compiler Linter** | `cargo clippy --all-targets --all-features -- -D warnings` | **0 warnings**, 0 errors |
| **Frontend Bundle Build** | `tsc -b && vite build` | **Clean**, 1984 modules bundled |
| **Rust Release Compilation** | `cargo check --release` | **Clean**, 0 errors |

---

### Security Summary

AltSpace 2.2.0 enforces fail-closed security perimeters across all critical execution paths:
1. **Unbrokered Shell Execution Removed:** `execute_shell_command` excised; terminal launching stripped of shell interpolation.
2. **Action Broker Hardening:** High-impact system actions require backend-issued, single-use, 60s expiring cryptographic challenge tokens bound to SHA-256 action parameter hashes.
3. **Secret Boundary Sealing:** Plaintext credentials and DPAPI keys are strictly isolated in native Rust memory and never cross the IPC bridge to WebView.
4. **Client-Side Storage Isolation:** GitHub OAuth access tokens and AI provider API keys removed from browser `localStorage`.
5. **BYOK Native Proxying:** Third-party AI provider requests proxied through native backend (`byok.rs`).
6. **Extension Containment:** Arbitrary community script and binary execution disabled; manifests preserved in `BlockedForMigration` status.
7. **Installer Signature Verification:** `install.ps1` verifies Authenticode digital signatures (`Codecheesee`) before staging binaries.
8. **Dead Subsystem Excision:** `named_pipe.rs` completely removed from repository.

---

### Known Operational Risks

1. **Host-Level Operating System Boundary:** Windows DPAPI encryption is tied to the active Windows user login. Operating system account compromise permits DPAPI access via standard Win32 APIs.
2. **Third-Party AI Endpoint Exposure:** BYOK API calls transmit user prompts over HTTPS to user-configured external AI providers.
3. **Manual Upgrade Verification:** In-app update installation is disabled; users manually downloading updates must verify the Authenticode signature of `Codecheesee`.

---

### Formal Release Attestation

**Release Date:** `2026-10-22`  
**Maintainer Approval:** `Approved by Maintainer (2026-10-22)`
