# Security Policy

AltSpace takes the security and privacy of its users seriously. As a keyboard-driven desktop command palette with deep native Windows integration, maintaining strict containment boundaries between user interface rendering and native system execution is a core architectural priority.

---

## Supported Versions

Only the latest canonical release series receives active security updates and vulnerability patches.

| Version | Supported | Security Posture |
| :--- | :---: | :--- |
| **2.2.x** | ✅ Yes | Canonical security-hardened release. Authoritative Rust broker, parameter-bound tokens, DPAPI vault, script execution blocked. |
| **2.1.x** | ❌ No | Deprecated. Contains uncontained shell execution routes. Upgrade immediately. |
| **2.0.x** | ❌ No | Deprecated. Contains legacy IPC token exposure. Upgrade immediately. |
| **< 2.0.0** | ❌ No | End-of-life legacy preview builds. |

---

## Reporting a Vulnerability

If you discover a security vulnerability or trust boundary bypass in AltSpace, please disclose it responsibly so that a fix can be verified and published before public disclosure.

### Preferred Method: GitHub Private Vulnerability Reporting
Please submit all vulnerability reports through GitHub's Private Vulnerability Reporting interface:
👉 **[Report a Security Vulnerability](https://github.com/codecheesee/altspace/security/advisories/new)**

### What to Include
To help us triage and reproduce the issue rapidly, please include:
1. **Description**: A clear summary of the vulnerability and its potential impact.
2. **Affected Version**: The specific AltSpace version (e.g. `v2.2.0`) and Windows OS build.
3. **Proof of Concept**: Minimal steps, scripts, or payloads required to reproduce the issue.
4. **Impact Assessment**: What data, credentials, or system privileges could an adversary access?

### Response Timeline
- **Initial Acknowledgment**: Within **48 hours** of report receipt.
- **Triage & Reproduction**: Within **5 business days**.
- **Fix Verification & Advisory Release**: Patches are staged and validated against the comprehensive 165-test suite before public release.

---

## Core Security Invariants (v2.2.0+)

AltSpace enforces the following architectural security controls:

1. **Authoritative Rust Security Barrier**: The WebView2 Chromium UI layer is treated as untrusted. Decrypted credentials, access tokens, and unbrokered execution routes never cross the IPC boundary.
2. **Single-Use Parameter-Bound Challenge Tokens**: All Level 2 (filesystem modifications) and Level 3 (process terminations, deletions) actions require a 60-second expiring token bound cryptographically to the SHA-256 hash of the exact payload.
3. **Windows DPAPI Vault**: Cloud API keys and GitHub OAuth credentials are encrypted at rest using Windows DPAPI (`CryptProtectData`) tied to the active Windows user login.
4. **Piped Stdin Authentication**: BYOK AI requests pipe API credentials natively via `curl.exe --config -` over standard input, preventing command-line arguments from appearing in Windows Event ID 4688 logs or Process Explorer.
5. **No Unbrokered Shell Execution**: Direct command-line execution (`execute_shell_command`, `RunPowerShell`, `launch_in_terminal_window`) is permanently disabled and fails closed.
6. **Contained Community Extensions**: External script and binary extensions (`.ps1`, `.bat`, `.cmd`, `.py`, `.js`, `.exe`) are blocked with `BlockedForMigration` status pending the Phase 3 cryptographically signed extension engine.
7. **Sanitized Diagnostics**: Exported logs and diagnostic reports automatically redact API keys, tokens, and personal user directories.
8. **Aegis Sentinel Kernel™ Zero-Lag Scan**: All developer clipboard and prompt events undergo real-time Shannon entropy (< 0.5ms) and prefix pattern verification with page-locked buffers (`VirtualLock`) and volatile memory zeroing on drop.
9. **Vortex Win32 Driver™ Subprocess Elimination**: Native Win32 kernel calls (`GetExtendedTcpTable`, `Toolhelp32`, direct named pipes) replace all uncontained CLI tools (`taskkill`, `netstat`, `docker ps`), eliminating subprocess hijacking surfaces.
10. **Aegis Shielded Boundary & Cryptographic Cloud Attestation**: All Pro capabilities and cloud AI endpoints enforce constant-time Ed25519 digital signature validation and HMAC attestation tokens. Tampered client binaries cannot access upstream services.
