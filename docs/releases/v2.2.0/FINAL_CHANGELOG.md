# AltSpace 2.2.0 — Final Consolidated Changelog

**Release:** AltSpace 2.2.0  
**Milestone:** Security Hardening & Reliability Release  
**Branch:** `release/security-hardening-next`  
**Base Commit:** `691ea1f65476e9dd94236eccc02298a29a7490fc`  
**Date:** 2026-10-22

---

## Chronological Commit History

### Commit 1 (`b9c6415`) — Baseline Hardening & Quality Gate Establishment
- Established Phase 0 baseline audit ([docs/security/audits/phase-0-baseline.md](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/docs/security/audits/phase-0-baseline.md)).
- Redacted exposed Discord webhook credentials with non-sensitive fingerprints in project documentation.
- Unified frontend and script verification under single canonical `npm test` harness.
- Resolved all compiler warnings across Rust backend under strict `cargo clippy -- -D warnings`.

### Commit 2 (`779c3f1`) — Shell Containment & Safe Execution
- Excised unbrokered `execute_shell_command` IPC endpoint.
- Hardened `launch_in_terminal_window` by eliminating shell interpolation and using direct Win32 process spawn flags.
- Hardened `open_url` and `open_external_url` with URL parsing, scheme allowlists (`http`, `https`, `mailto`), and direct `ShellExecuteW` execution without shell interpreters.
- Disabled in-app update download and installation (`InAppUpdateDisabled`), retaining safe, read-only update discovery.
- Added automated security regression test suites for URL validation, terminal launching, and updater failsafe.

### Commit 3A (`858daa8`) — Extension Script & Executable Containment
- Blocked execution of arbitrary community extension scripts and executable plugins (`PluginExecutionDisabled`).
- Blocked installation of executable and script plugins (`PluginInstallationDisabled`).
- Preserved all installed extension files, manifests, and configs intact on disk.
- Introduced `BlockedForMigration` lifecycle status enabling users to view and inspect installed plugins in safe mode.
- Added comprehensive migration, preservation, and safe-mode regression tests.

### Commit 3B (`d44ff25`) — Action Broker Hardening & Token Binding
- Eliminated `bypass_approval` field and authority-bypass execution routes.
- Removed latent `RunPowerShell` and `CallHttpEndpoint` action pathways.
- Designed and implemented cryptographically secure, backend-issued, single-use, 60s expiring challenge tokens.
- Bound challenge tokens to SHA-256 action parameter hashes, stopping replay, parameter tampering, and token reuse.
- Added comprehensive automated tests verifying replay rejection, parameter mutation detection, token expiration, and capability disablement.

### Commit 4 (`24c42c4`) — Secret Boundary Hardening & Client Isolation
- Eliminated plaintext credential and secret transmission across the Tauri IPC bridge.
- Removed GitHub OAuth access tokens from browser `localStorage`; contained token exchange, refresh, and storage entirely behind Rust backend.
- Moved BYOK provider API requests (OpenAI, Anthropic, Gemini, OpenRouter) to native Rust backend ([frontend/src-tauri/src/byok.rs](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/frontend/src-tauri/src/byok.rs)).
- Masked user profile entries, credentials, and diagnostic logs before rendering in WebView.
- Added regression tests for all secret boundaries and IPC endpoints.

### Release Preparation Phase — Final Alignment & Validation
- Reconciled target version `2.2.0` across all 18 repository manifests, package descriptors, and UI components.
- Realigned technical documentation to reality across `README.md`, `THREAT_MODEL.md`, `FEATURE_MATRIX.md`, and `ROLLOUT_STRATEGY.md`.
- Added Authenticode signature and publisher validation (`Codecheesee`) with fail-closed behavior to `install.ps1`.
- Completely deleted dead, unreferenced `named_pipe.rs` module and removed references from `lib.rs`.
- Conducted pre-release verification sweep (166 automated tests passed, 0 Clippy warnings, release compilation clean).

---

## Grouped Changes

### Security
- **Arbitrary Command Execution Removed:** `execute_shell_command` completely excised; `launch_in_terminal_window` operates without shell interpolation.
- **Scheme Allowlists Enforced:** URL launching restricted strictly to `http`, `https`, and `mailto` via parsed validation and `ShellExecuteW`.
- **Extension Script Execution Paused:** Community script plugins blocked (`BlockedForMigration`) pending Phase 3 cryptographic signing architecture.
- **Challenge Token Binding:** High-risk system actions require backend-issued, single-use, 60s expiring challenge tokens tied to SHA-256 action parameter hashes.
- **IPC Secret Sealing:** Plaintext secrets, DPAPI keys, and OAuth tokens never cross the Tauri IPC bridge.
- **Installer Digital Signatures:** `install.ps1` validates Authenticode signatures (`Codecheesee`) before staging binaries.
- **Dead Code Removed:** `named_pipe.rs` completely excised.

### Privacy
- **Zero Token Caching in Browser:** OAuth tokens removed from `localStorage`.
- **BYOK Isolation:** Third-party AI API keys handled exclusively by native Rust backend and never exposed to browser memory.
- **Redacted Diagnostics:** Automated scrubbing of auth tokens, API keys, and personal file paths from crash dumps and support ledgers.

### Architecture
- **In-Process Challenge Token Engine:** Cryptographically secure CSPRNG token generator with SHA-256 parameter binding and strict TTL pruning.
- **Native BYOK Proxy (`byok.rs`):** Secure reqwest-based client in Rust handling model API requests with in-memory DPAPI vault decryption.
- **Native OAuth Engine (`github_auth.rs`):** Device-flow and web-flow authentication handled entirely within native backend.

### Developer Experience
- **Unified Test Automation:** Single command `npm test` runs 88 frontend and security regression tests alongside `cargo test` (78 tests) for 166 total automated checks.
- **Strict Linting Enforcement:** Verified zero Clippy warnings with `-D warnings` on all targets.
- **Dedicated Test Suites:** Regression tests for broker replay/mutation, secret boundaries, auth token isolation, extension migration, and installer trust.

### Documentation
- **Canonical Release Identity:** Documented in [docs/releases/RELEASE_IDENTITY_2_2_0.md](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/docs/releases/RELEASE_IDENTITY_2_2_0.md).
- **Accurate Threat Model:** Updated [docs/THREAT_MODEL.md](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/docs/THREAT_MODEL.md) reflecting DPAPI user-login encryption and token-bound IPC boundaries.
- **Truth Alignment:** Reconciled [README.md](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/README.md), [docs/ALTSPACE_COPILOT_SOURCE_OF_TRUTH.md](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/docs/ALTSPACE_COPILOT_SOURCE_OF_TRUTH.md), and [docs/FEATURE_MATRIX.md](file:///c:/Users/rohan/.gemini/antigravity/scratch/altspace/docs/FEATURE_MATRIX.md).
