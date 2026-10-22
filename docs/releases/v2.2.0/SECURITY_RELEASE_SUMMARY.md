# AltSpace 2.2.0 — Security Release Summary

This summary documents the structural transformation of the AltSpace security perimeter between Version 2.1.0 and Version 2.2.0, details the remediation of audited vulnerabilities, and records deferred items and residual risks.

---

## 1. Before vs. After Security Matrix

| Component | Version 2.1.0 (Before) | Version 2.2.0 (After) | Security Impact |
| :--- | :--- | :--- | :--- |
| **Updater** | In-app background update download and execution via `trigger_app_update`. Unsigned binary staging risk. | In-app download and installation paths completely disabled (`InAppUpdateDisabled`). Safe, read-only version discovery with links to official release downloads. | Eliminates remote code execution and untrusted binary injection vectors via update channels. |
| **Extensions** | Arbitrary PowerShell, Batch, and executable plugins could be installed and executed directly via `install_plugin` and `run_plugin`. | Execution and installation of script/binary plugins blocked (`BlockedForMigration`). Manifests preserved for safe, read-only inspection. | Neutralizes untrusted community script execution; sets foundation for Phase 3 signed extensions. |
| **Action Broker** | Supported `bypass_approval: true`, latent `RunPowerShell` & `CallHttpEndpoint` routes, and lacked parameter validation. | Authority bypass routes removed; actions require backend-issued, single-use, 60s expiring challenge tokens bound to SHA-256 action parameter hash. | Completely stops privilege escalation, token reuse, parameter tampering, and execution replay attacks. |
| **DPAPI Vault** | DPAPI-encrypted secrets decrypted in backend and passed across IPC in plaintext to WebView JavaScript. | Secrets decrypted strictly within backend memory for immediate native use. Plaintext secrets never cross IPC. Stored data reported via masked identifiers. | Prevents credential theft via WebView XSS, DOM introspection, or malicious renderer extensions. |
| **OAuth** | GitHub OAuth access tokens stored in browser `localStorage`. Accessible to any frontend script. | OAuth tokens removed from `localStorage`. Token exchange, refresh, storage, and authenticated API calls handled entirely in native Rust. | Prevents token exfiltration and session hijacking from WebView storage. |
| **BYOK (AI Keys)** | API keys for OpenAI, Anthropic, Gemini, and OpenRouter stored in frontend memory and transmitted via browser `fetch`. | All BYOK API calls proxied through native Rust backend (`byok.rs`). Keys read directly from DPAPI vault by backend. | Prevents exposure of third-party API keys in browser network inspection, memory dumps, or frontend scripts. |
| **Diagnostics** | Diagnostics dumps and ledger logs could record raw authorization headers, bearer tokens, and API keys. | Automated redaction and scrubbing in diagnostics pipeline. Auth tokens, keys, and credentials masked before ledger writing or export. | Prevents accidental credential leakage in bug reports and support bundles. |
| **Named Pipe** | Dead, unreferenced `named_pipe.rs` module with latent in-memory replay vulnerability and non-functional IPC listener. | Module completely deleted from repository (`git rm frontend/src-tauri/src/named_pipe.rs`). Zero dead pipe code remains. | Eliminates unmaintained attack surface and misleading architectural claims. |

---

## 2. Vulnerability Findings Resolution

### Closed Findings (Remediated & Verified)

1. **Finding 1 — Unbrokered Shell Execution:**
   - *Status:* **CLOSED**
   - *Resolution:* Excised `execute_shell_command` IPC endpoint; sanitized `launch_in_terminal_window` to run without shell command interpolation.
2. **Finding 2 — In-App Updater Binary Execution:**
   - *Status:* **CLOSED**
   - *Resolution:* Fails closed with `InAppUpdateDisabled`. In-app installer execution routes eliminated.
3. **Finding 3 — Uncontrolled Plugin Script Execution:**
   - *Status:* **CLOSED**
   - *Resolution:* Executable and script extension execution disabled; legacy plugins transitioned to `BlockedForMigration` status.
4. **Finding 4 — Broker Approval Bypass & Latent High-Risk Routes:**
   - *Status:* **CLOSED**
   - *Resolution:* Removed `bypass_approval` field, excised `RunPowerShell` and `CallHttpEndpoint`, bound all approvals to SHA-256 parameter hashes with single-use expiring tokens.
5. **Finding 5 — Plaintext Secret Exposure Across IPC:**
   - *Status:* **CLOSED**
   - *Resolution:* Prohibited secret retrieval across Tauri IPC. DPAPI secrets are consumed exclusively inside Rust.
6. **Finding 6 — Client-Side OAuth Token Storage:**
   - *Status:* **CLOSED**
   - *Resolution:* Removed OAuth tokens from `localStorage`; authenticated GitHub operations encapsulated in native backend.
7. **Finding 7 — Latent Named Pipe Broker Flaws:**
   - *Status:* **CLOSED**
   - *Resolution:* `named_pipe.rs` completely removed from codebase.
8. **Finding 8 — Compromised Webhook Exposure:**
   - *Status:* **CLOSED**
   - *Resolution:* Exposed Discord webhook token sanitized from documentation; maintainer revoked external credential.
9. **Finding 9 — Unsigned Bootstrapper Execution:**
   - *Status:* **CLOSED**
   - *Resolution:* Added `Assert-Authenticode` with publisher validation (`Codecheesee`) to `install.ps1`.
10. **Finding 10 — Documentation Reality Discrepancies:**
    - *Status:* **CLOSED**
    - *Resolution:* Realigned all architectural and security claims across all project documentation.

---

## 3. Deferred Items (Scheduled for Future Milestones)

1. **Signed Extension Ecosystem (Phase 3 Architecture):**
   - *Deferred To:* Milestone 2.3.0
   - *Scope:* Implementation of cryptographic manifest signatures, publisher verification, and isolated process sandboxing (via Windows AppContainer or Job Objects) before re-enabling community plugins.
2. **Out-of-Process Broker Daemon:**
   - *Deferred To:* Milestone 2.3.0 / 3.0.0
   - *Scope:* Moving the action broker into a separate, isolated Windows service or separate user process communicating via authenticated named pipes. In 2.2.0, the broker operates in-process with parameter-bound cryptographic challenge tokens.
3. **Automated Background Update Verification (Win32 AppInstaller / MSIX):**
   - *Deferred To:* Milestone 2.3.0
   - *Scope:* Transitioning updater to Windows AppInstaller or signed MSIX packages rather than in-app binary extraction.

---

## 4. Residual Risks & Operational Guidance

1. **Local Physical / Administrative Access:**
   - DPAPI encryption binds secrets to the currently logged-in Windows user account. Any process running under the same user security context with identical privileges can technically request DPAPI decryption via Windows APIs. AltSpace assumes the local operating system user profile is not already compromised.
2. **Third-Party AI Endpoint Exposure:**
   - When BYOK is configured, the native backend dispatches outbound HTTPS requests to user-selected model providers (e.g., api.openai.com, api.anthropic.com). While credentials are never exposed to the frontend, users must trust the third-party providers with the context sent in prompts.
3. **Manual Installer Downloads:**
   - Because in-app update installation is disabled, users must manually download installers from the official GitHub Releases page. Users should always verify that downloads originate from the verified repository (`codecheesee/altspace`) and carry the Authenticode signature of `Codecheesee`.
