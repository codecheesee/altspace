# AltSpace — Native Windows Command Palette and Launcher

[![CI / Release](https://github.com/codecheesee/altspace/actions/workflows/release.yml/badge.svg)](https://github.com/codecheesee/altspace/actions/workflows/release.yml)
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

- **Recommended:** Download `AltSpace-Setup-x64.exe` from the [latest GitHub release](https://github.com/codecheesee/altspace/releases). The per-user NSIS installer creates Start Menu and Desktop shortcuts and does not require administrator access.
- **Managed environments:** Use `AltSpace-MSI-x64.msi` with your organization's Windows deployment tooling.
- **Portable:** Download `AltSpace-Portable-x64.zip`, extract it, and run `AltSpace-Portable.exe`. Keep `Everything64.dll` beside the executable.
- **PowerShell:** Run the verified installer script from a trusted PowerShell prompt:

```powershell
irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
```

The script resolves the latest GitHub release through the GitHub API, downloads `AltSpace-Portable-x64.zip` and `SHA256SUMS.txt`, verifies the archive with SHA-256, and then installs it to `%LOCALAPPDATA%\Programs\AltSpace`. Do not bypass checksum failures. Release artifacts include `SHA256SUMS.txt`; signed releases may also show a Windows publisher identity after Authenticode signing is configured.

### In-App Update Verification

AltSpace includes automated release synchronization. When a new version is published to GitHub:
1. Summon AltSpace with `Alt + Space`.
2. Type `:update` in the omnibar and press <kbd>Enter</kbd>.
3. AltSpace will direct you to the verified GitHub release package.

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

### 4. User-Level Extension Runtime (`:store`)
The AltSpace extension engine runs community scripts as child processes:
- **Supported Languages**: PowerShell (`.ps1`), Batch (`.bat`/`.cmd`), Node.js (`.js`), Python (`.py`).
- **Security Notice**: Extensions run as privileged user-level code, **not** inside an OS sandbox or container. Always review script code before execution.
- **Execution Safeguards**: Hard 15-second execution timeout enforced via OS job objects; script path canonicalization restricted to `%LOCALAPPDATA%\AltSpace\plugins\`.
- **Direct Creator Sponsorship**: Extension manifests support author attribution and sponsorship endpoints with 0% platform take rates.

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

---

## Command Palette Syntax

| Query Syntax | Action | Quota Impact |
| :--- | :--- | :--- |
| `<search>` | Search installed applications, indexed files, and system settings | **Free Forever** |
| `:<port>` *(e.g. `:3000`)* | Inspect process listening on port and terminate on <kbd>Enter</kbd> | **Free Forever** |
| `:store` / `:plugin` | Browse and manage community extensions | **Free Forever** |
| `:theme` | Open dynamic theme switcher | **Free Forever** |
| `:update` | Check for updates and open latest GitHub release | **Free Forever** |
| `Alt + C` | Switch directly to Clipboard History tab | **Free Forever** |
| `Alt + P` | Switch directly to Port Inspector tab | **Free Forever** |
| `Ctrl + K` | Open contextual Action Drawer for selected item | **Free Forever** |
| `?<prompt>` *(or `ai:`)* | Query local/hosted AI via Model Context Protocol | Trial Quota (100 actions / 30 days) |
| `><cmd>` *(or `cmd:`)* | Execute native terminal shell command | Trial Quota (100 actions / 30 days) |

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

### Automated Test Suite

```bash
# Run frontend unit tests (quota, entitlements, first-run privacy, bounties)
node --test src/lib/*.test.mjs ../scripts/*.test.mjs

# Run frontend production build & type checks
npm run build

# Run frontend linter
npm run lint

# Run Rust unit and integration tests
cd src-tauri
cargo test
```

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for terms and conditions.
