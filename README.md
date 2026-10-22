# AltSpace — Native Windows Command Palette and Launcher

[![CI / Release](https://github.com/codecheesee/altspace/actions/workflows/release.yml/badge.svg)](https://github.com/codecheesee/altspace/actions/workflows/release.yml)
[![Discord Community](https://img.shields.io/discord/1562508214061236364?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/EtVCN9m7JV)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-0078D6.svg?logo=windows)](https://github.com/codecheesee/altspace)
[![Stack: Rust + React 19 + Tailwind v4](https://img.shields.io/badge/Stack-Rust%20%7C%20React%2019%20%7C%20Tailwind%20v4-7928CA.svg)](https://github.com/codecheesee/altspace)
[![Memory Footprint](https://img.shields.io/badge/Memory-%3C%2018MB%20RAM-success.svg)](https://github.com/codecheesee/altspace)
[![Model Context Protocol](https://img.shields.io/badge/AI-Model%20Context%20Protocol%20(MCP)-emerald.svg)](https://github.com/codecheesee/altspace)
[![Contributor Treasury](https://img.shields.io/badge/Governance-20%25%20Contributor%20Treasury-amber.svg)](TREASURY.md)

AltSpace is a high-performance, keyboard-driven desktop command palette and spotlight launcher designed specifically for Windows 10 and Windows 11 (x64). Built on a native Rust core using Tauri v2, React 19, and Tailwind CSS v4, AltSpace delivers instant keystroke responsiveness, low baseline memory consumption (< 18MB RAM), and comprehensive developer tooling without background telemetric overhead.

---

## Technical Specifications

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Core Architecture** | Rust 2021 + Tauri v2 + Tokio async runtime | Zero Electron runtime overhead |
| **UI Layer** | React 19, TypeScript 5.8, Tailwind CSS v4, Vite 8 | Hardware-accelerated WebView2 rendering |
| **Working Set Memory** | ~18MB RAM idle / ~32MB RAM active search | Evaluated on Windows 11 Pro 23H2 |
| **Query Latency** | Instant responsiveness for in-memory & indexed catalog | Cold invocation via native Win32 `RegisterHotKey` |
| **Filesystem Indexing** | Everything SDK/native indexed search + fallback scanner | Fast multi-drive search with zero CPU indexing overhead |
| **AI Integration** | Local Ollama (Model Context Protocol / MCP) | Private offline inference with local system action dispatch |
| **License** | Apache License 2.0 (Core) | Free and open source for personal and enterprise use |

---

## Installation and Updates

### Modern Windows Distribution

AltSpace is distributed as a native Windows application with several installation paths:

- **Official Web Landing Page:** Visit [**https://codecheesee.github.io/altspace/**](https://codecheesee.github.io/altspace/) to explore features, download installers, and view live contributor bounties.
- **Recommended (Installer):** Download [**`AltSpace-Setup-x64.exe`**](https://github.com/codecheesee/altspace/releases/download/v2.2.0/AltSpace-Setup-x64.exe) (v2.2.0, 4.1 MB). The per-user NSIS installer creates Start Menu and Desktop shortcuts and does not require administrator privileges.
- **Enterprise / MSI Installer:** Download [**`AltSpace-MSI-x64.msi`**](https://github.com/codecheesee/altspace/releases/download/v2.2.0/AltSpace-MSI-x64.msi) (v2.2.0, 6.5 MB) for enterprise WiX Group Policy deployments.
- **Windows Package Manager (Winget):**
  *(Catalog submission to official Microsoft `winget-pkgs` is in validation review. To install via local manifest or once merged:)*
  ```powershell
  # Global install (once Microsoft review completes):
  winget install codecheesee.altspace

  # Or install directly from repository manifest:
  winget install --manifest distribution/winget/manifests/c/codecheesee/altspace/2.2.0/
  ```
- **PowerShell (Instant One-Liner):** Run the verified installer script directly in PowerShell:
  ```powershell
  irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
  ```
  The script resolves the latest GitHub release, downloads `AltSpace-Portable-x64.zip`, verifies the archive with SHA-256 against `SHA256SUMS.txt`, validates the Authenticode signature against publisher Codecheesee, creates desktop shortcuts, and launches AltSpace.
- **Portable (.zip):** Download [**`AltSpace-Portable-x64.zip`**](https://github.com/codecheesee/altspace/releases/download/v2.2.0/AltSpace-Portable-x64.zip) (5.3 MB), extract to any folder, and run `AltSpace-Portable.exe`. Keep `Everything64.dll` beside the executable.

> [!TIP]
> **Windows SmartScreen Note**: AltSpace is an independent, community-driven open-source project. If Windows SmartScreen displays *"Windows protected your PC"*, click **More info** &rarr; **Run anyway**. All binaries are built openly and checksum-verified on GitHub Actions.

### In-App Update Verification

AltSpace includes automated release synchronization. When a new version is published to GitHub:
1. Summon AltSpace with `Alt + Space`.
2. Type `:update` in the omnibar and press <kbd>Enter</kbd>.
3. AltSpace queries GitHub release metadata read-only and directs you to the verified release package in your default browser. In-app background binary execution is disabled for security hardening.

---

## Core Subsystems

### 1. SQLite Frecency Scoring Engine
AltSpace indexes applications, scripts, and system utilities in an embedded SQLite database using logarithmic temporal decay:

$$\text{Score} = \text{VisitCount} \times e^{-\lambda \Delta t}$$

Commands and tools accessed frequently during specific times of day automatically rank highest in query results.

### 2. Developer Port Inspector and Process Termination (`:port`)
Inspect running network services directly from the omnibar.
- Type `:3000` or `:port` to enumerate listening TCP ports, process IDs (PIDs), and owning binaries (`node.exe`, `python.exe`, `docker-proxy.exe`).
- Press <kbd>Enter</kbd> to terminate blocking processes immediately, eliminating port collision errors during development.

### 3. Local AI and Model Context Protocol (MCP)
AltSpace connects to local Ollama endpoints (`localhost:11434`) to execute natural language desktop actions without sending code or prompts over the internet:
- Type `? kill port 3000` to dispatch automated process termination.
- Type `? snap window left` to invoke native window tile management.
- Type `? summarize selection` to query local LLMs using clipboard context.
- **Setup Guide**: If you don't have Ollama installed yet, see our step-by-step [Ollama Setup & Optimization Guide](docs/OLLAMA_SETUP_GUIDE.md) to get running in under 2 minutes.

### 4. User-Level Extension Containment (`:store`)
The AltSpace extension engine enforces strict containment on community scripts:
- **Containment Notice**: To protect workstations against arbitrary code execution, execution of external script files (`.ps1`, `.bat`, `.cmd`, `.py`, `.js`) is blocked with `BlockedForMigration` status pending the arrival of a cryptographic signing framework.
- **Manifest Preservation**: Installed plugin manifests and local directories remain preserved and visible in `:store` with clear security migration badges.
- **Execution Safeguards**: Arbitrary script execution is disabled in the Rust backend; plugins run in safe mode without spawning unsandboxed shell processes.
- **Direct Creator Sponsorship**: Extension manifests continue supporting author attribution and sponsorship endpoints with 0% platform take rates.

### 5. Multi-Drive Search via Everything SDK
Deep search across physical drives (C:, D:, E:, etc.) connects to the Everything SDK / native indexed search with an in-memory fallback scanner, yielding instant results across indexed files without CPU-heavy background indexing daemons.

### 6. In-Memory Clipboard Manager
Search and restore clipboard history with automated credential masking:
- In-memory regex parsing automatically classifies snippets as code, URLs, colors, or plain text.
- Passwords, bearer tokens, and private keys are detected and masked in memory to prevent accidental exposure.
- Fresh installs start empty; clipboard contents are never seeded with demo data and are not persisted to disk.

### 7. First-Run Privacy Defaults
- The details/context sidebar starts hidden and only changes when the user explicitly toggles it; the preference is persisted locally.
- Multi-drive indexing starts disabled. C: user folders are the initial scope; additional drives require an explicit preference action.
- Clipboard, listening ports, installed games, and drive data are exposed only in their explicit modes or after a meaningful query.
- No starter plugin or hardcoded workspace path is created on installation.

### 8. Capability-Based Execution Broker & Challenge Gate
Every native operation, AI-suggested intent, and filesystem modification passes through the authoritative Rust execution broker:
- **Parameter-Bound Challenge Tokens**: Level 2 and Level 3 actions require single-use, 60-second expiring challenge tokens generated by Rust and bound to the exact payload SHA-256 hash, preventing replay and parameter mutation attacks.
- **Level 1 (ReadOnlyAuto)**: Read-only searches, metadata inspection, and offline calculation run automatically without prompt friction.
- **Level 2 (PreviewThenApprove)**: File writes, renames, configuration changes, and memory reclamation require parameter-bound challenge approval.
- **Level 3 (AlwaysApprove)**: Destructive file deletions and port process terminations strictly mandate explicit confirmation every time. Unbrokered shell execution (`RunPowerShell`) and raw HTTP endpoints (`CallHttpEndpoint`) are permanently disabled.
- **Timeline Ledger & One-Click Undo**: The in-memory action ledger records operations with timestamps, targets, and reversal callbacks. Credential values in ledger events are automatically redacted. Summon with `Alt + H`.

### 9. Windows DPAPI Credential Vault
User tokens, GitHub OAuth credentials, and provider API keys are encrypted at rest using Windows DPAPI (`CryptProtectData`) tied to the active Windows user login:
- **Zero Secrets Across IPC**: Plaintext secrets and API keys are never returned across the Tauri IPC boundary to the Chromium WebView.
- **Zero Tokens in Web Storage**: OAuth access tokens are stored directly in DPAPI by Rust; `localStorage` contains zero access tokens or secrets.
- **Piped Stdin AI Execution**: Native BYOK chat completions (`byok.rs`) pipe credentials via `curl.exe --config -` standard input, ensuring API keys never appear in process argument lists or Windows Event 4688 logs.

### 10. Privacy-Preserving Observability & Diagnostics
Inspect and export telemetry safely without leaking credentials, private keys, or personal filesystem paths:
- Press `Ctrl + Shift + D` or invoke from the Footer/Context menu to open the sanitized diagnostics modal.
- Automated regex engine redacts OpenAI API keys (`sk-...`), GitHub tokens (`ghp_...`), Anthropic keys, RSA private keys, and user home directories (`C:\Users\<user>\` $\to$ `~\`).

### 11. Extension Trust Tiers, Auto-Quarantine & Safe Mode
- **Trust Tiers**: Extensions are classified as `BuiltIn`, `Verified`, `Community`, `LocalDev`, or `Revoked`. Known malicious IDs are blocked automatically.
- **Auto-Quarantine Health Tracker**: If an extension crashes 3 consecutive times or times out twice, it is quarantined to prevent runaway process loops.
- **Safe Mode**: Launch AltSpace with `--safe-mode` or `ALTSPACE_SAFE_MODE=1` to bypass all third-party plugins and custom themes during troubleshooting.

### 12. Validated Configuration Sync (`.altconfig`)
Export or import non-sensitive preferences (theme, custom accent, autostart, sidebar visibility, multi-drive preference). The validator strictly rejects prototype pollution and credential keys (`api_key`, `token`, `password`, `vault`) and calculates a dry-run diff preview before applying changes.

### 13. Deep Process Forensics & Port Verification
Port inspection goes beyond simple PID listening.
- Toolhelp32 process snapshotting traces child and parent process ancestry (e.g. `npm` &rarr; `node.exe` &rarr; `vite`).
- Automatically scans current working directories and package descriptors to identify project boundaries.
- The **Free & Verify Port** capability kills zombie processes and performs live TCP table polling verification to guarantee the port is released.

### 14. 100% Offline Developer Transform Toolkit
Execute offline formatting, conversions, and cryptographic transforms in `< 1ms` with zero cloud egress:
- **JWT Inspector**: Decode headers and payloads with expiration status, lifetime timers, and algorithm verification.
- **JSON &harr; YAML Studio**: Bidirectional format conversion with indentation formatting and syntax validation.
- **Regex Lab**: Real-time regex testing with capture group extraction and syntax error highlighting.
- **Hash Calculator**: Compute SHA-256 and MD5 checksums locally with 1-click clipboard copying.
- **UUID & Timestamp**: Generate cryptographically secure UUID v4 and convert ISO 8601 strings to Unix epoch timestamps.

### 15. DPAPI Secret & Environment Switcher
Eliminate `.env` file leaks and plaintext secrets in development workflows:
- Profiles (Development, Staging, Production) are encrypted at rest using Windows DPAPI (`CryptProtectData`).
- Keys are masked in memory and injected directly into child process environment blocks (`CreateProcessW` `lpEnvironment`), leaving zero disk or `localStorage` footprint.

### 16. Docker & WSL2 Environment Cockpit
Manage local virtualized environments directly from the palette:
- Enumerate running containers, image tags, port bindings, and Docker Compose service labels with zero shell parsing vulnerabilities.
- Inspect WSL2 distributions and monitor real-time Hyper-V memory consumption (`vmmem`).
- One-click memory reclaim (`wsl --shutdown`) safely returns gigabytes of dynamic RAM back to Windows host memory.

### 17. Private Local Copilot & Multi-Step Approved Actions
AltSpace provides a Three-Lane model architecture for intelligent developer assistance:
- **Lane A (Free Forever)**: 100% offline local Ollama inference (`http://localhost:11434`), zero token fees. (See [Ollama Setup Guide](docs/OLLAMA_SETUP_GUIDE.md)).
- **Lane B (BYOK Pro)**: Direct, private access to Anthropic Claude 3.7, OpenAI GPT-4o, or DeepSeek using API keys encrypted in your Windows DPAPI vault.
- **Deterministic Fast Path**: Natural language diagnostics (e.g. `? fix 5173`, `? reclaim memory`, `? docker restart`) synthesize multi-step action plans in `< 1ms`.
- **Volatile Failure Ring Buffer**: Automatically captures shell crash exits and stderr in an in-memory ring buffer (10 items max, zero disk writes) to synthesize instant recovery workflows.
- **Glassmorphic Stepper**: Preview planned actions, observe real-time execution pills, and revert modifications with 1-click rollback.

### 18. Unified Capability Matrix & Hybrid Toggles
Every developer feature can be toggled via two non-intrusive paths:
- **Option A (Settings)**: Press <kbd>Ctrl</kbd>+<kbd>,</kbd> to manage all capabilities with circuit-breaker health indicators.
- **Option C (Omnibar)**: Type `> toggle <id>` (e.g. `> toggle docker_wsl`) for instant inline state changes.
- **Invisibility Rule**: Toggled-off features are completely hidden from search, hotkeys, and tabs, failing closed in Rust IPC in `< 1µs`.

---

## Command Palette Syntax

| Query / Shortcut | Action | Quota Impact |
| :--- | :--- | :--- |
| `<search>` | Search installed applications, indexed files, and system settings | **Free Forever** |
| `:<port>` *(e.g. `:3000`)* | Inspect process listening on port with parent tree and 1-click verified release | **Free Forever** |
| `jwt`, `json`, `yaml` | Open offline JWT inspector and JSON &harr; YAML converter | **Free Forever** |
| `regex`, `uuid`, `hash`, `ts` | Instant offline regex tester, UUID v4 generator, SHA-256 hash, timestamp tools | **Free Forever** |
| `docker` | Inspect active containers, Compose labels, and trigger container restart | **Free Forever** |
| `wsl` | Monitor WSL2 distros and Hyper-V RAM footprint with 1-click memory reclaim | **Free Forever** |
| `?<prompt>` *(e.g. `? fix 5173`)* | Synthesize multi-step approved action recovery plans via local Ollama or BYOK | **Free Forever (Local)** |
| `> toggle <id>` | Instantly toggle developer capability on/off inline | **Free Forever** |
| `:store` / `:plugin` | Browse and manage community extensions | **Free Forever** |
| `:theme` | Open dynamic theme switcher | **Free Forever** |
| `:update` | Check for updates and open latest GitHub release | **Free Forever** |
| `Alt + C` | Switch directly to Clipboard History tab | **Free Forever** |
| `Alt + P` | Switch directly to Port Inspector tab | **Free Forever** |
| `Alt + H` | Open Action Execution Timeline and One-Click Undo Drawer | **Free Forever** |
| `Ctrl + ,` | Open Settings, Capability Matrix, and DPAPI Secret / BYOK Vault | **Free Forever** |
| `Ctrl + Shift + D` | Open Privacy Diagnostics & Sanitized Report Modal | **Free Forever** |
| `Ctrl + B` | Toggle contextual Details Sidebar | **Free Forever** |
| `Ctrl + K` | Open contextual Action Drawer for selected item | **Free Forever** |
| `><cmd>` | *Disabled for security hardening* (unbrokered shell execution blocked) | N/A |

---

## Contributor Economics and Governance

AltSpace operates under an **Open-Core and Contributor Treasury** governance model structured around a two-layer product architecture:

- **Layer A (100% Free Apache 2.0 Core)**: The desktop application launcher, local search indexer, developer port killer, in-memory clipboard manager, themes, and local Ollama AI integration are distributed under the **Apache License 2.0**. It runs 100% locally and offline without requiring an account.
- **Layer B (Server-Controlled Commercial Services)**: Hosted cloud AI routing, multi-device sync, team commands, and commercial entitlement leases are enforced behind a secure server-side trust boundary. While forks may modify local client code, they cannot access private hosted APIs without valid cryptographic server authorization.
- **Trademark Protection**: Apache 2.0 does not grant trademark rights. Official names, logos, and publisher identities are protected. Community forks must use distinct names and icons as specified in [**TRADEMARK.md**](TRADEMARK.md).
- **Comprehensive Feature Matrix**: For a complete breakdown of what runs locally versus what requires a server, review [**docs/FEATURE_MATRIX.md**](docs/FEATURE_MATRIX.md).
- **The 70 / 20 / 10 Allocation Model**:
  - **70% Maintainer Engineering**: Funds core Rust systems development, Win32 API integration, and security maintenance.
  - **20% Public Contributor Treasury**: Allocated directly to public community feature bounties on GitHub.
  - **10% Infrastructure Reserve**: Covers Authenticode code signing, build infrastructure, and hosting.
- **Transparent Bounty Tracking**: All funded community bounties are tracked on public GitHub issues with the [`bounty`](https://github.com/codecheesee/altspace/issues?q=is%3Aissue+is%3Aopen+label%3Abounty) label.
- **Tax-Compliant Payouts**: Lemon Squeezy handles Merchant-of-Record checkout and tax collection; contributor treasury payouts require operator configuration.

For complete financial, governance, and payout specifications, review [**TREASURY.md**](TREASURY.md).

### Hosted Checkout & Entitlement Policy

AltSpace uses Lemon Squeezy as its planned Merchant of Record. The client contains no payment or provider secrets, does not accept local license keys, and has no local development bypass.

- **Free Forever**: App launching, ordinary local search, calculator, Windows settings shortcuts, port inspection, clipboard history, themes, and offline use.
- **Trial Policy**: 100 premium actions per rolling 30-day window, early warning at 80 actions. No charge for empty queries, typing/debounce, repeated in-flight requests, local app launches, or failed/cancelled requests.
- **Roles**: Free, Supporter (voluntary funding tier), Pro (paid operational tier), Contributor ($\ge 2$ merged PRs, separate from sponsors), and Maintainer (`@codecheesee` lifetime sovereign access).
- **Security Boundary**: Local storage cannot grant paid status. Unverifiable or missing endpoints safely fail closed into Free mode.

Deployment configuration:
- `VITE_CHECKOUT_URL`: The Lemon Squeezy hosted checkout URL.
- `VITE_ENTITLEMENT_ENDPOINT`: HTTPS endpoint returning provider-verified JSON entitlement payload.
- `VITE_GITHUB_CLIENT_ID`: GitHub OAuth App Client ID for zero-git browser Device Flow authentication.

See [docs/LEMON_SQUEEZY_ENTITLEMENTS.md](docs/LEMON_SQUEEZY_ENTITLEMENTS.md) for complete operator instructions.

### Local Configuration Sync

The `.altconfig` export/import actions provide local transfer of non-sensitive preferences such as theme, custom accent, sidebar visibility, and drive-search preference. Clipboard history, frecency/history data, secrets, raw system paths, and entitlement state are intentionally excluded. AltSpace does not add cloud app-data sync.

---

## Building from Source

### Prerequisites
- [Rust toolchain](https://rustup.rs/) (1.80+ stable)
- [Node.js](https://nodejs.org/) (v20+ or v22 LTS)
- Visual Studio 2022 C++ Build Tools (with Windows 10/11 SDK)

### Build Instructions

```bash
# 1. Clone repository
git clone https://github.com/codecheesee/altspace.git
cd altspace/frontend

# 2. Install frontend dependencies
npm install

# 3. Launch in development mode
npm run tauri dev
```

### Automated Test Suite (165 Tests)

```bash
# Run 87 frontend unit, red-team security, governance, installer trust, and launch kit tests
npm test --prefix frontend

# Run frontend production build & type checks
npm run build --prefix frontend

# Run frontend linter
npm run lint --prefix frontend

# Run 78 native Rust unit and integration tests (including DPAPI vault, ports, and action broker)
cargo test --manifest-path src-tauri/Cargo.toml

# Run Rust Clippy strict linting
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

---

## Community and Support

- **Discord Community**: Join the official [Codecheesee Builds Discord Server](https://discord.gg/EtVCN9m7JV) for technical discussions, release announcements, and developer support.
- **GitHub Issues**: Report bugs and submit reproducible test cases via the [Issue Tracker](https://github.com/codecheesee/altspace/issues).
- **GitHub Discussions**: Propose feature specifications or architectural proposals in [Discussions](https://github.com/codecheesee/altspace/discussions).
- **Contributing**: Review the [Contributing Guidelines](.github/CONTRIBUTING.md) to inspect open issues and contributor bounties.

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for terms and conditions.
