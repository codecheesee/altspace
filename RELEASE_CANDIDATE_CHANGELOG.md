# AltSpace 2.2.0 — Release Candidate Changelog

This changelog records the complete inventory of modifications implemented on branch `release/security-hardening-next` across Commits 1 through 4 and the final Release Preparation phase.

---

## Commit-by-Commit Inventory

### Commit 1 (`b9c6415`) — Baseline Hardening & Quality Gate Establishment
- **Phase 0 Baseline Audit:** Established initial security baseline report (`docs/security/audits/phase-0-baseline.md`).
- **Secret Redaction:** Sanitized exposed Discord webhook credentials in documentation with non-sensitive fingerprints.
- **Unified Test Script:** Established `npm test` as the single canonical automated test suite encompassing node-test, vitest, and security runner scripts.
- **Clippy Cleanliness:** Resolved all Rust compiler warnings under strict `-D warnings` enforcement.

### Commit 2 (`779c3f1`) — Shell Containment & Safe Execution
- **Shell Removal:** Deprecated and excised unbrokered `execute_shell_command` Tauri IPC command handler.
- **Terminal Execution Hardening:** Hardened `launch_in_terminal_window` by removing arbitrary shell interpolation, using direct parsed arguments and Win32 process spawn flags.
- **URL Handling:** Refactored `open_url` and `open_external_url` to use strict URL parsing, scheme allowlists (`http`, `https`, `mailto`), and direct `ShellExecuteW` execution without shell interpreters.
- **Fail-Closed Updater:** Disabled in-app update download and installation paths (`trigger_app_update` returns `InAppUpdateDisabled`). Preserved safe, read-only version discovery.

### Commit 3A (`858daa8`) — Extension Script & Executable Containment
- **Execution Blocking:** Blocked direct execution of community extension scripts and executable plugins (`run_plugin` returns `PluginExecutionDisabled`).
- **Installation Blocking:** Blocked executable and script plugin installation (`install_plugin` returns `PluginInstallationDisabled`).
- **Asset Preservation:** Preserved all installed plugin files, manifests, and configurations intact on disk.
- **Safe Inspection:** Introduced `BlockedForMigration` lifecycle status enabling users to view and audit their installed extensions in safe mode without executing untrusted code.

### Commit 3B (`d44ff25`) — Action Broker Hardening & Token Binding
- **Authority Bypass Removal:** Completely eliminated `bypass_approval` field and authority-bypass execution routes.
- **Latent Execution Removal:** Removed latent `RunPowerShell` and `CallHttpEndpoint` action variants from the broker.
- **Challenge Token Architecture:** Implemented cryptographically secure, backend-generated, single-use, 60-second TTL challenge tokens.
- **Parameter Binding:** Bound approval challenge tokens to exact action parameters via SHA-256 parameter hashing, preventing token reuse, parameter mutation, and replay attacks.
- **Dual-Phase Execution:** Enforced Level 2 and Level 3 action approval workflow requiring valid parameter-bound challenge tokens before system execution.

### Commit 4 (`24c42c4`) — Secret Boundary Hardening & Client Isolation
- **IPC Secret Containment:** Eliminated plaintext credential and secret transmission across the Tauri IPC bridge.
- **OAuth Backend Containment:** Removed GitHub OAuth access tokens from browser `localStorage`; relocated token exchange, refresh, and storage entirely behind Rust backend.
- **BYOK Isolation:** Relocated all Bring-Your-Own-Key provider network requests (OpenAI, Anthropic, Gemini, OpenRouter) to the Rust backend (`byok.rs`), preventing API key exposure to WebView JavaScript.
- **Profile & Diagnostics Masking:** Enforced client-side masking on user profile entries, credentials, and diagnostic logs. Scrubbed auth headers and bearer tokens from diagnostics ledger.

### Release Preparation Phase — Blockers Resolution & Alignment
- **Version Harmonization (B1):** Synchronized target version `2.2.0` across all 18 repository manifests, configurations, WinGet package files, and UI modals.
- **Documentation Reality Alignment (B2):** Realigned all technical documentation, threat models, and feature matrices to match actual codebase capabilities; removed outdated claims of Named Pipes, Job Object sandboxing, and in-app updater.
- **Installer Trust Hardening (B3):** Added `Assert-Authenticode` with publisher validation (`Codecheesee`) and fail-closed security logic to `install.ps1`, backed by automated tests.
- **Named Pipe Excision (B4):** Removed unused, latent `named_pipe.rs` module and references.

---

## Categorized Change Summary

### Security
- **Eliminated Arbitrary Shell Execution:** Excised `execute_shell_command` IPC endpoint; sanitized `launch_in_terminal_window`.
- **Enforced Scheme Allowlists:** Restricted URL opening to `http`, `https`, and `mailto` via strict parsing, preventing protocol handler exploitation.
- **Contained Extension Runtime:** Blocked untrusted script and binary plugin execution, establishing read-only manifest inspection.
- **Bound Broker Challenges:** Action execution now requires backend-issued, parameter-bound, single-use cryptographic tokens with 60s expiration.
- **Sealed Secret Boundaries:** Protected DPAPI secrets, OAuth bearer tokens, and BYOK AI provider keys from WebView and IPC exposure.
- **Hardened PowerShell Bootstrapper:** Enforced Authenticode signature and publisher checks in `install.ps1`.
- **Excised Latent Pipe Code:** Removed dead `named_pipe.rs` to eliminate latent replay cache risks.

### Privacy
- **Zero Token Leakage:** Eliminated OAuth access tokens and AI API keys from browser `localStorage` and memory dumps.
- **Sanitized Diagnostics Ledger:** Automated stripping of sensitive credentials, authorization headers, and personal file paths from crash dumps and support bundles.
- **Read-Only Update Discovery:** Replaced automatic background downloader with privacy-preserving, manual out-of-process release navigation.

### Architecture
- **In-Process Challenge Token Engine:** High-performance, memory-safe Rust token generator with cryptographic binding to serialized action payloads.
- **Backend AI Proxy (`byok.rs`):** Secure reqwest-based proxy in Rust handling external LLM interactions with encrypted DPAPI credential hydration.
- **Backend OAuth Engine (`github_auth.rs`):** Device-flow and web-flow authentication handled entirely within native backend.
- **Zero Dead Code:** Removed inactive modules and unreferenced dependencies.

### Developer Experience
- **Unified Test Automation:** Single command `npm test` runs 88 frontend and security regression tests alongside `cargo test` (78 tests) for 166 total automated checks.
- **Strict Linting Enforcement:** Verified zero Clippy warnings with `-D warnings` on all targets.
- **Explicit Test Suites:** Dedicated test files for broker replay/mutation, secret boundaries, auth token isolation, extension migration, and installer trust.

### Documentation
- **Canonical Release Identity:** Created `RELEASE_IDENTITY_2_2_0.md`.
- **Accurate Threat Model:** Updated `THREAT_MODEL.md` reflecting DPAPI user-login encryption and token-bound IPC boundaries.
- **Truth Alignment:** Reconciled `README.md`, `ALTSPACE_COPILOT_SOURCE_OF_TRUTH.md`, `FEATURE_MATRIX.md`, and `ROLLOUT_STRATEGY.md`.
