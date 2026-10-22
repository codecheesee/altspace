# AltSpace Phase 0 Security & Reliability Baseline Audit Report

**Audited Commit**: `691ea1f65476e9dd94236eccc02298a29a7490fc`  
**Audited Branch**: `main` (baseline at branching point)  
**Dedicated Hardening Branch**: `release/security-hardening-next`  
**Date**: October 2026  
**Auditor Roles**: Principal Security Architect, Staff Rust Engineer, Staff Windows Engineer, Release Engineer, Test Engineer, Product Architecture Reviewer  
**Target Platform**: Windows 10 & Windows 11 (x64)  
**Application Identifier**: `com.altspace.launcher`  

---

## Notice & Scope Disclaimer

This report records empirical verification of the AltSpace codebase as committed at the audited commit SHA. Observations and vulnerability classifications reflect static source inspection, local Windows build and test execution, dependency analysis, and architecture review. 

> [!IMPORTANT]
> This audit report records verified code paths, architectural design liabilities, and test results. It does not constitute proof of active in-the-wild exploitation beyond the specifically analyzed and demonstrated code execution paths. All sensitive tokens and credentials have been redacted and represented by non-sensitive structural fingerprints.

---

## 1. System & Environment Baseline

### 1.1 Toolchain & Operating System
- **Host Operating System**: Microsoft Windows NT 10.0.26200.0 (Windows 11 Build 26200, AMD64)
- **Rust Toolchain**: `rustc 1.99.1 (58cf8f9c3 2026-10-13)`, `cargo 1.99.1 (5f94df478 2026-08-27)`
- **Node.js Environment**: `v22.22.3`, `npm 10.9.8`, `pnpm 11.6.0`
- **Compiler Targets**:
  - Configured in CI: `x86_64-pc-windows-msvc`
  - ARM64: No ARM64 compiler target or verification runner configured in repository CI.

### 1.2 Lockfile Hashes
- `frontend/package-lock.json`: `SHA256: 33E4DFB824BD15F99BE9BB96280C7A8DCB42B90549542CC7E71626F112BEF566`
- `frontend/src-tauri/Cargo.lock`: `SHA256: 4EEA68CA58B8FB8AFDF8ADD86D7E67A83C7EDD4B1475BD8326968722E2C61286`

### 1.3 Key Binary Assets
- `Everything64.dll` (`bin/` and `frontend/src-tauri/sdk/dll/`):
  - **SHA-256**: `81B5BE18126ACD2C2B913F8F4A821E476B18393CDD3DEBD03387C50AFD8DB88F`
  - **Authenticode**: Valid signature by `voidtools PTY LTD`, Thumbprint `C6B9AE08C3B83981FB1931CDA4A501FCE5F4F92E`.
- `bin/altspace.exe`:
  - **Size**: 13,652,992 bytes
  - **Product/File Version**: `2.0.0`
  - **Authenticode**: Unsigned (`Status: NotSigned`).

---

## 2. Baseline Test, Lint, and Build Results

| Verification Check | Invocation Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Frontend Tests** | `npm test --prefix frontend` | **FAILED** | Missing npm script `"test"` in `package.json`. |
| **Frontend Node Tests** | `node --test frontend/src/lib/*.test.mjs` | **PASSED** (73/73) | 73 unit tests passed in 570 ms. Validates TypeScript helper logic under mock conditions. |
| **Launch Kit Tests** | `node --test scripts/verify_launch_kit.test.mjs` | **PASSED** (4/4) | 4 distribution asset checks passed in 180 ms. |
| **Frontend Linter** | `npm run lint --prefix frontend` (`oxlint`) | **PASSED with 104 Warnings** | 0 errors, 104 warnings across 76 files (empty catch blocks, cascading renders). |
| **Frontend Production Build** | `npm run build --prefix frontend` | **PASSED** | Compiled client bundle via Rolldown in 7.22s. |
| **Rust Unit Tests** | `cargo test --manifest-path frontend/src-tauri/Cargo.toml` | **PASSED** (52/52) | 52 unit tests passed in 3.13s across `raycast_windows_lib`. |
| **Rust Release Check** | `cargo check --manifest-path frontend/src-tauri/Cargo.toml --release` | **PASSED** | Zero compilation errors in release profile. |
| **Rust Clippy (`-D warnings`)** | `cargo clippy --manifest-path frontend/src-tauri/Cargo.toml --all-targets -- -D warnings` | **FAILED (6 errors)** | Failed with 6 warnings promoted to errors (`unnecessary_sort_by`, `collapsible_if`, `unnecessary_map_or`, `needless_borrows_for_generic_args` (x2), `chunks_exact_to_as_chunks`). |
| **Frontend Audit** | `npm audit --prefix frontend` | **PASSED** | 0 vulnerabilities found. |

---

## 3. Critical and High Vulnerability Findings

### Finding 1: Unrestricted Remote Updater Remote Code Execution (RCE)
- **Severity**: **Critical**
- **Location**: `frontend/src-tauri/src/updater.rs:251-285`
- **Mechanism**: The Tauri command `trigger_app_update(download_url: Option<String>)` accepts an arbitrary caller-controlled download URL. It directly string-interpolates `{url}` into a PowerShell command script executed with `powershell.exe -Command`.
- **Impact**:
  1. Arbitrary PowerShell command injection via unescaped string formatting.
  2. If the URL points to an executable or script (`.ps1`), it downloads and executes the payload with `Start-Process` under `-ExecutionPolicy Bypass` with zero signature, digest, or Authenticode verification.
- **Classification**: Verified Code Path.

### Finding 2: Unbrokered Arbitrary Shell & Process Execution
- **Severity**: **Critical**
- **Location**: `frontend/src-tauri/src/terminal_runner.rs:20-79`, `frontend/src-tauri/src/lib.rs:427-448`
- **Mechanism**: `execute_shell_command(command: String)` is registered as a direct, unbrokered Tauri command. It executes `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command <trimmed>` directly with the raw input string.
- **Impact**: Any context able to invoke Tauri IPC can execute arbitrary PowerShell commands with full standard-user rights.
- **Classification**: Verified Code Path.

### Finding 3: Capability Broker Authorisation Bypass & Missing Enforcement
- **Severity**: **Critical**
- **Location**: `frontend/src-tauri/src/broker.rs:82-87, 323-337`, `frontend/src-tauri/src/lib.rs:1171-1256`
- **Mechanism**:
  1. `ActionRequest` defines `pub bypass_approval: bool`.
  2. `execute_action()` calculates `evaluation = evaluate_action(request)` and logs to the in-memory ledger, but **never checks whether approval was granted or required before executing**.
  3. All 84 backend Tauri commands are exposed directly to the WebView without brokering.
  4. The frontend `ActionApprovalModal.tsx` is completely unused (`setPendingApproval` is only initialized and cleared with `null`).
- **Impact**: The backend broker provides no authoritative security boundary in its current implementation.
- **Classification**: Verified Code Path.

### Finding 4: Plaintext Secrets and OAuth Tokens Persisted in localStorage
- **Severity**: **Critical**
- **Location**: `frontend/src/lib/authProvider.ts:64-68`, `frontend/src/components/FeedbackModal.tsx:144`
- **Mechanism**: `saveCurrentSession(session: UserSession)` executes `localStorage.setItem("altspace_auth_session_v2", JSON.stringify(session))`. The stored `session` object contains the user's plaintext GitHub OAuth `accessToken`. Webhook endpoints and entitlement tokens are similarly written to `localStorage`.
- **Impact**: Violates strict credential handling requirements. Any script running in the WebView context can extract plaintext user access tokens.
- **Classification**: Verified Code Path.

### Finding 5: Decrypted Secrets Returned to the WebView Context
- **Severity**: **Critical**
- **Location**: `frontend/src-tauri/src/lib.rs:945-949, 971-977, 1093-1097`, `frontend/src-tauri/src/crypto_vault.rs`
- **Mechanism**: Tauri commands `vault_retrieve_secret`, `vault_get_profile`, and `vault_retrieve_byok_key` decrypt DPAPI-protected secrets and return the plaintext strings directly to JavaScript via IPC.
- **Impact**: Exposes decrypted master credentials, API keys, and environment variables into the frontend memory space and DOM lifecycle.
- **Classification**: Verified Code Path.

### Finding 6: Unrestricted Community Extension Execution
- **Severity**: **Critical**
- **Location**: `frontend/src-tauri/src/plugins.rs:333-359, 418-449`
- **Mechanism**: `install_plugin` writes arbitrary script files (`.ps1`, `.bat`, `.cmd`, `.py`, `.js`) into `%LOCALAPPDATA%\AltSpace\plugins\<id>\` without verifying manifest digital signatures. `run_plugin` invokes them as child processes via `powershell.exe -ExecutionPolicy Bypass` or `cmd.exe /C`.
- **Impact**: Community extensions run as privileged standard-user processes with unrestricted filesystem and network access.
- **Classification**: Verified Code Path.

### Finding 7: Phantom Named Pipe & Flawed Nonce Cache
- **Severity**: **High**
- **Location**: `frontend/src-tauri/src/named_pipe.rs:25-59`
- **Mechanism**: Documentation claims a Windows Named Pipe (`\\.\pipe\AltSpace.Broker`) enforces SID-restricted security descriptors. In reality, `CreateNamedPipe` is never called. Furthermore, the nonce cache in `named_pipe.rs` executes `lock.clear()` when `lock.len() > 1000`, allowing replay attacks once flushed.
- **Classification**: Verified Code Path / Architectural Discrepancy.

### Finding 8: Exposed Discord Webhook in Documentation & History
- **Severity**: **Critical** (Containment required)
- **Location**: `docs/ALTSPACE_COPILOT_SOURCE_OF_TRUTH.md:58`, git history (`62f459b`, `d124c8a`, `691ea1f`)
- **Fingerprint**: Discord Webhook ID `1562534871874936882` (Token redacted).
- **Status**: Maintainer independently revoking on Discord. Tracked documentation reference sanitized to non-sensitive placeholder.
- **Classification**: Verified Repository Artifact.

---

## 4. Documentation-versus-Code Conflict Inventory

| Component | Documented Specification | Code Reality | Conflict Severity |
| :--- | :--- | :--- | :--- |
| **Named Pipe Broker** | Replay-protected Windows Named Pipe with SID DACL | Pipe server is never created; no Win32 pipe exists | **Critical** |
| **Action Broker Gate** | Mandatory interactive modal approval for Level 3 actions | `bypass_approval` exists; `execute_action` never enforces approval; modal is dead code | **Critical** |
| **Token Storage** | "Zero tokens in localStorage" | OAuth `accessToken` saved directly to `localStorage` | **Critical** |
| **Extension Sandboxing** | 15s execution timeout enforced via OS job objects | No Windows Job Objects created; standard child process killed via `taskkill` | **High** |
| **Offline Privacy** | 100% offline desktop application | Loads remote fonts from `fonts.googleapis.com`; fetches FX rates from `open.er-api.com` | **Medium** |
| **Action Ledger** | All native actions saved to SQLite action ledger | Action ledger is an ephemeral, in-memory `Vec<LedgerEntry>` | **Medium** |
| **Test Coverage** | "100% passing automated test suite of 128 tests via npm test" | `npm test` script missing; test count is 77 Node + 52 Rust = 129 tests | **Low** |
| **Release Version** | Shipped release documentation refers to `2.0.0` | Cargo/Tauri/npm specify `2.1.0`; git tag `v2.1.0` exists; winget specifies `2.0.0-preview` | **High** |

---

## 5. Architectural & Security Recommendations

1. **Rust Authoritative Boundary**:
   - Establish Rust as the sole arbiter of privilege. 
   - Sensitive commands must require single-use, parameter-bound, cryptographically random approval tokens issued by Rust after displaying exact execution previews.
2. **Immediate P0 Containment**:
   - Disable or stub arbitrary command-line execution and unbrokered process elevation.
   - Restrict community extensions from executing arbitrary user scripts; shift to declarative host actions or isolated LocalDev mode.
   - Disable update downloads until TUF-inspired signed metadata and Authenticode verification are integrated.
   - Refactor secret vault so plaintext credentials never enter the WebView context; inject secrets exclusively at the native process creation boundary (`lpEnvironment`).
3. **Build & Release Hygiene**:
   - Add canonical `"test": "node --test src/lib/*.test.mjs"` script to `frontend/package.json`.
   - Resolve the 6 Clippy warnings without suppressing lints.
   - Pin CI actions by immutable commit SHAs.
   - Standardize release versioning to `2.2.0` across all metadata sources.
