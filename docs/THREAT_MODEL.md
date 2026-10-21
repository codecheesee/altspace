# AltSpace STRIDE Threat Model & Security Architecture

This document specifies the threat model, attack surfaces, security boundaries, and mitigations for AltSpace on Windows 10 and 11, evaluated against the **STRIDE** taxonomy (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

---

## 1. System Components & Trust Boundaries

```
[ Untrusted Web / User Input / Clipboard ]
                   │
                   ▼ (Boundary 1: Input Sanitization & Masking)
        ┌─────────────────────┐
        │   React / WebView2  │  <-- Non-Elevated UI
        └──────────┬──────────┘
                   │
                   ▼ (Boundary 2: Windows Named Pipe / Typed IPC + ACL)
        ┌─────────────────────┐
        │  Native Rust Core   │  <-- Capability Broker & Policy Gate
        │  & DPAPI Vault      │
        └────┬───────────┬────┘
             │           │
(Boundary 3) │           │ (Boundary 4)
             ▼           ▼
   ┌───────────────┐   ┌────────────────────────┐
   │ Plugin Worker │   │ Windows OS & APIs      │
   │ (15s Timeout, │   │ (Filesystem, Win32,    │
   │  Path Guard)  │   │  Everything64, SQLite) │
   └───────────────┘   └────────────────────────┘
```

### Trust Boundaries:
1. **Boundary 1 (Input/Renderer Boundary)**: Untrusted external strings (clipboard contents, search queries, external file paths, web responses) entering the WebView2 frontend.
2. **Boundary 2 (IPC & Broker Boundary)**: Communication between the frontend renderer and the native Rust backend via typed Tauri IPC and local Windows Named Pipe (`\\.\pipe\AltSpace.Broker`).
3. **Boundary 3 (Extension Isolation Boundary)**: Execution of user-provided or community extensions (PowerShell, Node.js, Python) as child worker processes.
4. **Boundary 4 (Host OS Boundary)**: File writes, process terminations, registry lookups, and network calls.

---

## 2. STRIDE Threat Analysis & Mitigations

### S — Spoofing Identity

| Threat | Target | Risk | Mitigation in AltSpace |
| :--- | :--- | :--- | :--- |
| **Fake Entitlement Leases** | Licensing & Quota | High | Entitlement leases are cryptographically signed with HMAC-SHA256/Ed25519; client verifies signatures, expiration, and key IDs. Unverified leases default to Free. |
| **Impersonated IPC Messages** | Named Pipe / Broker | High | Named Pipe requires current-user Windows SID DACL, cryptographic nonces, 60s timestamp expiration, and session bearer tokens. |
| **Malicious Official Binary Impersonation** | Distribution & Update | Critical | Official releases are signed with Authenticode; SHA-256 checksums are verified before installation. Community forks must rebrand per `TRADEMARK.md`. |

### T — Tampering with Data

| Threat | Target | Risk | Mitigation in AltSpace |
| :--- | :--- | :--- | :--- |
| **Path Traversal Attacks** | Filesystem & Extensions | Critical | Script filenames and file paths are canonicalized; directory separators (`/`, `\`, `..`) are strictly rejected. Extensions are confined to `%LOCALAPPDATA%\AltSpace\plugins\`. |
| **UNC Path NTLM Exfiltration** | Search & Launch | High | Remote UNC paths (e.g., `\\attacker.com\share`) are detected and blocked from automatic indexing or preview execution. |
| **Shell Metacharacter Injection** | Shell Runner (`>`) | High | Commands executed via terminal runner run non-elevated; arguments are explicitly tokenized and sanitized; AI-generated shell actions require explicit approval. |
| **Configuration Injection** | `.altconfig` Import | Medium | Configuration files are schema-validated; sensitive keys (tokens, entitlements, secrets) are stripped on export and rejected on import. |

### R — Repudiation

| Threat | Target | Risk | Mitigation in AltSpace |
| :--- | :--- | :--- | :--- |
| **Unattributable Native Actions** | Capability Broker | Medium | All native actions are logged to the `action_ledger` SQLite store with timestamps, target summaries, risk ratings, and outcomes. |
| **Unapproved AI Actions** | AI / MCP Intents | High | Destructive actions require user confirmation; history timeline displays approval timestamps and provides one-click undo for reversible operations. |

### I — Information Disclosure

| Threat | Target | Risk | Mitigation in AltSpace |
| :--- | :--- | :--- | :--- |
| **Plaintext Token Theft** | OAuth & API Keys | High | Sensitive credentials and session tokens are encrypted using Windows DPAPI (`CryptProtectData`) tied to the user's Windows login. Zero tokens in `localStorage`. |
| **Clipboard Credential Leaks** | Clipboard History | High | In-memory regex scanner detects and masks private keys, bearer tokens, AWS secrets, and passwords before display; clipboard history is never written to disk. |
| **Telemetry Leaks in Diagnostics** | Logs & Diagnostics | Medium | Structured diagnostic exporter automatically redacts file paths, usernames, prompt strings, and tokens prior to display or export. |

### D — Denial of Service (DoS)

| Threat | Target | Risk | Mitigation in AltSpace |
| :--- | :--- | :--- | :--- |
| **Runaway Extension Processes** | Extension Runtime | High | Extensions are executed with a hard 15-second execution timeout enforced via OS job objects / process termination (`taskkill /F /T`). |
| **Repeated Crash Loops** | Startup & State | Medium | Safe Mode launch flag (`--safe-mode`) boots AltSpace with third-party extensions, custom themes, and cached state disabled. Auto-quarantine disables crashing extensions. |
| **Stale Search Overload** | Search Engine | Medium | Debounced search queries use `searchSeq` tokens and `AbortController` cancellation to drop stale in-flight results. |

### E — Elevation of Privilege

| Threat | Target | Risk | Mitigation in AltSpace |
| :--- | :--- | :--- | :--- |
| **Privilege Escalation via Extensions** | Child Processes | High | Extensions execute as standard user-level processes and are never spawned with elevated administrative privileges. |
| **Protected Process Killing** | Port Inspector (`:port`) | High | Protected system processes (PID 0, PID 4, csrss, lsass, services) and the AltSpace process itself are blacklisted from termination. |
| **Silent Execution of Dangerous Code** | AI & Terminal | High | 3-tier execution policy: Level 3 actions (file delete, arbitrary scripts, binary launches) always require interactive modal confirmation. |

---

## 3. Residual Risks & Ongoing Controls

1. **Local Fork Modification**: Under Apache 2.0, local code can be modified. Mitigated by keeping commercial value (hosted AI, cloud sync, support, official releases) server-side behind cryptographic lease boundaries.
2. **Third-Party DLL Injection**: Running under standard Windows user session. Mitigated by Authenticode binary signing and verifying loaded DLL hashes.
