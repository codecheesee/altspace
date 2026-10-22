# AltSpace 2.2.0 — Maintainer Approval Package

**Target Release:** `v2.2.0`  
**Base Commit on `main`:** `691ea1f65476e9dd94236eccc02298a29a7490fc`  
**Development Branch:** `release/security-hardening-next`  
**Security Status:** **GO**  
**Quality Status:** **GO**

---

## 1. Complete Commit List

| Commit SHA | Type | Subject |
| :--- | :--- | :--- |
| `691ea1f` | `fix(ci)` | *(Base on `main`)* repair ingest-feedback YAML indentation and add winget continue-on-error |
| `b9c6415` | `chore(ci)` | establish canonical test command, redact docs secret, and resolve clippy errors |
| `779c3f1` | `feat(security)` | contain unbrokered shell execution, harden url opening and updater |
| `858daa8` | `feat(security)` | contain extension script execution and installation with migration status |
| `d44ff25` | `feat(security)` | harden broker with parameter-bound single-use approval challenges |
| `24c42c4` | `feat(security)` | harden secret boundaries, contain oauth and byok behind rust |
| `[staged]` | `chore(release)` | finalize 2.2.0 release candidate, version alignment, authenticode installer verification, dead pipe removal |

---

## 2. File Change Statistics (Relative to `main`)

### A. Modified Files (28)
* `.github/workflows/ci.yml` — Unified automated test workflow.
* `.github/workflows/ingest-feedback.yml` — Version alignment to `2.2.0`.
* `.github/workflows/winget.yml` — Version alignment to `2.2.0`.
* `README.md` — Realigned architecture claims (DPAPI vault, token-bound IPC).
* `distribution/latest-release.json` — Version alignment to `2.2.0`.
* `distribution/product-registry.json` — Version alignment to `2.2.0`.
* `distribution/winget/README.md` — Updated WinGet manifest documentation to `2.2.0`.
* `docs/ALTSPACE_COPILOT_SOURCE_OF_TRUTH.md` — Redacted webhook secret, updated architecture truth.
* `docs/DISCORD_COMMUNITY_SYSTEM.md` — Updated canonical version references.
* `docs/FEATURE_MATRIX.md` — Updated extension execution and security gating status.
* `docs/LAUNCH_KIT.md` — Updated download links to `v2.2.0`.
* `docs/ROLLOUT_STRATEGY.md` — Realigned rollout channels with read-only updater.
* `docs/THREAT_MODEL.md` — Reconciled threat model with verified 2.2.0 trust boundaries.
* `docs/VERIFICATION_AND_BUG_REPORTING_GUIDE.md` — Updated verified test suite benchmarks.
* `docs/index.html` — Updated version badges and release assets to `2.2.0`.
* `index.html` — Updated version badges and release assets to `2.2.0`.
* `landing/index.html` — Updated version badges and release assets to `2.2.0`.
* `install.ps1` — Hardened with Authenticode publisher verification (`Assert-Authenticode`).
* `frontend/package.json` — Version `2.2.0` and canonical `npm test` script.
* `frontend/src-tauri/Cargo.toml` — Version `2.2.0` and dependency declarations.
* `frontend/src-tauri/Cargo.lock` — Updated dependency graph and version lock.
* `frontend/src-tauri/tauri.conf.json` — Version `2.2.0` configuration.
* `frontend/src-tauri/src/actions.rs` — Hardened `run_as_admin` path sanitization and UNC checks.
* `frontend/src-tauri/src/broker.rs` — Single-use challenge token engine and authority bypass removal.
* `frontend/src-tauri/src/crypto_vault.rs` — Secret masking and in-memory DPAPI consumption.
* `frontend/src-tauri/src/docker_wsl.rs` — Process argument sanitization.
* `frontend/src-tauri/src/everything.rs` — Resilient Everything service fallback.
* `frontend/src-tauri/src/github_auth.rs` — Native backend OAuth device/web flow engine.
* `frontend/src-tauri/src/lib.rs` — Hardened IPC surface and removed unbrokered shell handlers.
* `frontend/src-tauri/src/plugins.rs` — Blocked script/binary execution, preservation state.
* `frontend/src-tauri/src/terminal_runner.rs` — Direct Win32 process spawning without shell wrappers.
* `frontend/src-tauri/src/updater.rs` — Read-only update discovery; disabled in-app binary extraction.
* `frontend/src/App.tsx` — Version indicator and preference export alignment.
* `frontend/src/components/DiagnosticsModal.tsx` — Diagnostic bundle version alignment.
* `frontend/src/components/LicenseModal.tsx` — License modal version alignment.
* `frontend/src/components/UpdateModal.tsx` — Update notification modal alignment.
* `frontend/src/hooks/useSearchEngine.ts` — Hardened search IPC invocations.
* `frontend/src/lib/actionBroker.ts` & `actionBroker.test.mjs` — Frontend broker challenge token integration.
* `frontend/src/lib/actionPlanner.ts` — Hardened intent action schemas.
* `frontend/src/lib/authProvider.ts` & `authProvider.test.mjs` — Native OAuth session integration and `localStorage` scrubbing.
* `frontend/src/lib/diagnostics.ts` & `diagnostics.test.mjs` — Automated secret scrubbing in diagnostics.
* `frontend/src/lib/license.ts` — Entitlement verification hardening.
* `frontend/src/lib/secureVault.ts` — Native DPAPI vault integration.

### B. Added Files
* `frontend/src-tauri/src/byok.rs` — Native backend BYOK AI proxy with DPAPI vault integration.
* `frontend/src/lib/authProvider.test.mjs` — OAuth storage and token isolation regression tests.
* `scripts/install_trust.test.mjs` — Authenticode verification unit tests for `install.ps1`.
* `distribution/winget/manifests/c/codecheesee/altspace/2.2.0/codecheesee.altspace.yaml`
* `distribution/winget/manifests/c/codecheesee/altspace/2.2.0/codecheesee.altspace.installer.yaml`
* `distribution/winget/manifests/c/codecheesee/altspace/2.2.0/codecheesee.altspace.locale.en-US.yaml`
* `docs/security/audits/phase-0-baseline.md` — Phase 0 baseline audit artifact.
* `docs/TRUST_BOUNDARIES.md` — Security trust boundary documentation.
* `docs/releases/RELEASE_IDENTITY_2_2_0.md` — Canonical release identity specification.
* Canonical Release Reports: `RELEASE_CANDIDATE_CHANGELOG.md`, `SECURITY_RELEASE_SUMMARY.md`, `RELEASE_NOTES_2_2_0.md`, `MERGE_READINESS_REPORT.md`, `FINAL_RELEASE_CHECKLIST.md`, `FINAL_SECURITY_POSTURE.md`, `FINAL_CHANGELOG.md`, `FINAL_RELEASE_NOTES.md`.

### C. Deleted Files (1)
* `frontend/src-tauri/src/named_pipe.rs` — Latent, unreferenced named pipe stub.

---

## 3. Security-Impact Summary

- **Eliminated Arbitrary Shell Execution:** Deprecated and excised `execute_shell_command` IPC endpoint; sanitized `launch_in_terminal_window`.
- **Enforced Single-Use Parameter-Bound Challenge Tokens:** Action Broker requires backend-issued, expiring (60s TTL) cryptographic tokens tied to SHA-256 parameter hashes. Replay, mutation, and bypass pathways are eliminated.
- **Sealed Secret Boundaries:** Plaintext secrets, DPAPI keys, and OAuth access tokens are prohibited from crossing the Tauri IPC bridge.
- **Contained Client-Side Storage:** Browser `localStorage` is completely purged of OAuth access tokens and AI provider API keys.
- **Native AI Proxying:** All BYOK requests are proxied via native Rust (`byok.rs`) using in-memory DPAPI vault decryption.
- **Blocked Untrusted Plugin Execution:** Executable and script extension execution is paused pending Phase 3 cryptographic signing architecture.
- **Hardened Installer Verification:** `install.ps1` verifies Authenticode digital signatures (`Codecheesee`) before staging binaries.

---

## 4. Release-Impact Summary

- **Quality Gates:** 166 automated tests pass (88 frontend + 78 Rust backend), 0 Clippy warnings (`-D warnings`), clean production builds (`tsc -b && vite build` and `cargo check --release`).
- **Identity Harmony:** Version `2.2.0` is synchronized across all 18 repository manifests and configuration points.
- **Distribution Channels:** NSIS Setup, WiX MSI, Portable Zip, WinGet manifests, and PowerShell bootstrapper are fully aligned.

---

## 5. Breaking Changes Summary

- **Direct Shell Command Removal:** `execute_shell_command` is no longer callable via IPC.
- **Paused Extension Script Execution:** Community plugins running arbitrary scripts/executables are paused in `BlockedForMigration` mode. Manifests and files remain intact.
- **In-App Updater Replacement:** Background binary updater execution is replaced with read-only notification and verified manual download links.
- **Re-Authentication Migration:** Users must log in once to GitHub or re-enter AI provider keys to migrate credentials from legacy browser storage to the native DPAPI vault.
