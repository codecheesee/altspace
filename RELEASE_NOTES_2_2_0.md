# AltSpace 2.2.0 Release Notes

**Release:** AltSpace 2.2.0 — Security Hardening & Reliability Release  
**Target Platform:** Windows 10 & Windows 11 (64-bit)  
**Package:** `com.altspace.launcher`

AltSpace 2.2.0 is a major security and reliability update focused on protecting user data, locking down local automation interfaces, and establishing safe operational boundaries across Windows.

---

## Highlights

- **Enhanced Security Architecture:** All high-impact system actions now require explicit user verification, preventing background processes or untrusted inputs from executing unapproved actions.
- **Privacy-First AI & Authentication:** Your Bring-Your-Own-Key (BYOK) AI provider keys and GitHub account tokens are now isolated within the core desktop engine and are never stored in browser caches.
- **Protected Update Experience:** Updates now alert you when a new version is available with direct links to verified release downloads, ensuring complete control over software upgrades on your PC.
- **Auditable Extensions:** Installed plugins remain preserved and visible in a safe, read-only mode while we prepare the next-generation signed extension platform.

---

## Security Improvements

- **System Action Verification:** Any action that modifies files, opens URLs, or launches applications now requires explicit user interaction and cannot be bypassed.
- **Safe Web Navigation:** Links clicked within the app now strictly validate destination web addresses to protect against protocol redirection attacks.
- **Terminal Launch Safety:** Launching developer terminal windows is now strictly isolated to predefined system utilities without executing unvetted script commands.
- **Verified PowerShell Installation:** The official PowerShell quick-installer script now checks digital signatures to verify that software comes directly from the author before executing.

---

## Privacy Improvements

- **Isolated AI Credentials:** When configuring API keys for OpenAI, Anthropic, Gemini, or OpenRouter, your keys are stored exclusively in the Windows Data Protection vault and handled natively, never appearing in browser inspection windows or webpage memory.
- **Zero Token Caching:** GitHub login credentials are no longer stored in web browser caches or local web storage.
- **Scrubbed Diagnostic Logs:** Error logs, diagnostics summaries, and crash reports automatically redact all account tokens, API keys, and sensitive personal paths before you export or review them.

---

## Breaking Changes

- **Direct Shell Command Endpoint Removed:** External programs and internal components can no longer request raw command-line or shell execution through background application commands.
- **Script and Executable Extensions Paused:** Community plugins that run arbitrary PowerShell, batch files, or executable binaries have been disabled. Their manifests and files remain intact on your computer, but they cannot run until the signed extension platform launches in an upcoming release.
- **In-App Automatic Updater Replaced:** AltSpace will notify you when a new release is available, but will no longer automatically download and install updates in the background. Clicking "Update" opens the official GitHub release page for safe manual download.

---

## Migration Notes

- **Existing Extensions:** If you previously installed community extensions, you do not need to delete them. They will appear with a "Blocked for Migration" badge in your extension manager, allowing you to review their settings and files safely.
- **Re-Authentication:** You may be asked to reconnect your GitHub account or re-enter your AI provider API key once upon launching Version 2.2.0 so that credentials can be securely migrated to the hardened native vault.
- **Installation via PowerShell:** If using `install.ps1`, ensure your environment allows standard digital certificate verification. Developers testing custom local builds can pass the `-AllowUnsigned` switch if needed.

---

## Known Limitations

- **Extension Marketplace:** The community extension marketplace is temporarily in read-only preview mode while cryptographic signing and process sandboxing are completed for the next milestone.
- **Manual Installation:** Upgrades require running the new installer package or updating via WinGet (`winget upgrade codecheesee.altspace`).
