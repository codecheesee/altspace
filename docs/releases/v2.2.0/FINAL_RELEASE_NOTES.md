# AltSpace 2.2.0 Final Release Notes

**Release:** AltSpace 2.2.0  
**Title:** Security Hardening & Reliability Release  
**Platform:** Windows 10 & Windows 11 (64-bit)  
**Package:** `com.altspace.launcher`

AltSpace 2.2.0 is a major security and reliability release designed to safeguard user data, lock down local automation interfaces, and establish verifiable operational boundaries across Windows.

---

## Highlights

- **Mandatory Action Verification:** All high-impact system actions (such as file modifications, port terminations, or app launches) require explicit user interaction and cannot be triggered silently in the background.
- **Privacy-Isolated AI & Authentication:** Your Bring-Your-Own-Key (BYOK) AI provider keys and GitHub account tokens are now managed entirely within the core desktop engine, completely isolated from web browser storage.
- **Protected Update Notifications:** In-app update alerts notify you when a new release is available with direct links to verified downloads on GitHub, ensuring you maintain complete control over what runs on your computer.
- **Safe Extension Inspection:** Installed community plugins remain preserved and visible in a safe, read-only mode while we prepare the next-generation signed extension platform.

---

## Security Improvements

- **System Action Verification:** Any action modifying files, opening URLs, or launching applications requires explicit user interaction and cannot be bypassed.
- **Safe Web Navigation:** Links clicked within the app strictly validate destination web addresses against safe protocols (`http`, `https`, `mailto`) to protect against protocol redirection attacks.
- **Terminal Launch Safety:** Launching developer terminal windows is strictly isolated to predefined system utilities without executing unvetted script commands.
- **Verified PowerShell Installation:** The official PowerShell quick-installer script (`install.ps1`) verifies digital signatures to ensure the software comes directly from the author (`Codecheesee`) before running.

---

## Privacy Improvements

- **Isolated AI Credentials:** When configuring API keys for OpenAI, Anthropic, Gemini, or OpenRouter, your keys are stored exclusively in the Windows Data Protection vault and handled natively, never appearing in browser caches or webpage memory.
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
