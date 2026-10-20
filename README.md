# AltSpace — Native Windows Command Palette and Launcher

[![CI / Release](https://github.com/codecheesee/altspace/actions/workflows/release.yml/badge.svg)](https://github.com/codecheesee/altspace/actions/workflows/release.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-0078D6.svg?logo=windows)](https://github.com/codecheesee/altspace)
[![Stack: Rust + React 19 + Tailwind v4](https://img.shields.io/badge/Stack-Rust%20%7C%20React%2019%20%7C%20Tailwind%20v4-7928CA.svg)](https://github.com/codecheesee/altspace)
[![Memory Footprint](https://img.shields.io/badge/Memory-%3C%2018MB%20RAM-success.svg)](https://github.com/codecheesee/altspace)
[![Model Context Protocol](https://img.shields.io/badge/AI-Model%20Context%20Protocol%20(MCP)-emerald.svg)](https://github.com/codecheesee/altspace)
[![Contributor Treasury](https://img.shields.io/badge/Governance-20%25%20Contributor%20Treasury-amber.svg)](TREASURY.md)

AltSpace is a high-performance, keyboard-driven desktop command palette and spotlight launcher designed specifically for Windows 10 and Windows 11 (x64). Built on a native Rust core using Tauri v2, React 19, and Tailwind CSS v4, AltSpace delivers sub-5ms input response times, low baseline memory consumption (< 18MB RAM), and comprehensive developer tooling without background telemetric overhead.

---

## Technical Specifications

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Core Architecture** | Rust 2021 + Tauri v2 + Tokio async runtime | Zero Electron runtime overhead |
| **UI Layer** | React 19, TypeScript 5.8, Tailwind CSS v4, Vite 8 | Hardware-accelerated WebView2 rendering |
| **Working Set Memory** | ~18MB RAM idle / ~32MB RAM active search | Evaluated on Windows 11 Pro 23H2 |
| **Query Response Latency** | < 5ms for in-memory and SQLite frecency index | Cold invocation via native Win32 `RegisterHotKey` |
| **Filesystem Indexing** | Direct NTFS Master File Table (MFT) IPC | Real-time multi-drive search with zero CPU indexing overhead |
| **AI Integration** | Local Ollama (Model Context Protocol / MCP) | Private offline inference with local system action dispatch |
| **License** | Apache License 2.0 | Free and open source for personal and enterprise use |

---

## Installation and Updates

### 1-Line PowerShell Installation

To install or upgrade AltSpace to the latest release package directly via PowerShell:

```powershell
irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
```

#### Automated Setup Steps:
1. Resolves and downloads the latest verified release binary (`altspace.exe`) from GitHub Releases.
2. Deploys executable to `%LOCALAPPDATA%\Programs\AltSpace`.
3. Registers Start Menu application shortcut and updates the User `PATH` environment variable.
4. Starts the background tray daemon with global hotkey `Alt + Space`.

### In-App Self-Update

AltSpace includes automated release synchronization. When a new version is published to GitHub:
1. Summon AltSpace with `Alt + Space`.
2. Type `:update` in the omnibar and press <kbd>Enter</kbd>.
3. AltSpace will automatically download the verified update package and restart seamlessly.

Alternatively, re-running the 1-line PowerShell installer script above will upgrade an existing installation in-place.

### Manual Download

Portable zip archives and executable packages are available directly on the [GitHub Releases](https://github.com/codecheesee/altspace/releases) page.

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

### 4. Sandboxed Extension Runtime (`:store`)
The AltSpace extension engine decouples extension execution from the main application binary:
- **Languages Supported**: PowerShell (`.ps1`), Batch (`.bat`/`.cmd`), Node.js (`.js`), Python (`.py`).
- **Process Isolation**: Hard 15-second execution timeout enforced via OS job objects to prevent runaway processes.
- **Path Traversal Protection**: Extension paths are canonicalized and restricted strictly to `%LOCALAPPDATA%\AltSpace\plugins\`.
- **Direct Creator Sponsorship**: Extension manifests support author attribution and sponsorship endpoints with 0% platform take rates.

### 5. Multi-Drive NTFS MFT Indexing
Deep search across physical drives (C:, D:, E:, etc.) connects directly to Windows Master File Table indices via native IPC, yielding instant results across millions of files without persistent indexing background services.

### 6. In-Memory Clipboard Manager
Search and restore clipboard history with automated credential masking:
- In-memory regex parsing automatically classifies snippets as code, URLs, colors, or plain text.
- Passwords, bearer tokens, and private keys are detected and masked in memory to prevent accidental exposure.

---

## Command Palette Syntax

| Query Syntax | Action |
| :--- | :--- |
| `<search>` | Search installed applications, indexed files, and system settings |
| `:<port>` *(e.g. `:3000`)* | Inspect process listening on port and terminate on <kbd>Enter</kbd> |
| `:store` / `:plugin` | Browse and manage community extensions |
| `:theme` | Open dynamic theme switcher |
| `:update` | Check for updates and install latest GitHub release |
| `?<prompt>` | Query local AI via Model Context Protocol |
| `Alt + C` | Switch directly to Clipboard History tab |
| `Alt + P` | Switch directly to Port Inspector tab |
| `Ctrl + K` | Open contextual Action Drawer for selected item |
| `Esc` | Clear query or dismiss window to system tray |

---

## Contributor Economics and Governance

AltSpace operates under a sustainable **Open-Core and Contributor Treasury** governance model:

- **100% Free Core**: The core desktop application, search indexer, developer port killer, and extension sandbox are distributed under the **Apache License 2.0**.
- **The 70 / 20 / 10 Allocation Model**:
  - **70% Maintainer Engineering**: Funds full-time core Rust systems development, Win32 API integration, and security maintenance.
  - **20% Public Contributor Treasury**: Allocated directly to public community feature bounties on GitHub.
  - **10% Infrastructure Reserve**: Covers Authenticode code signing, build infrastructure, and hosting.
- **Transparent Bounty Tracking**: All funded community bounties are tracked on public GitHub issues with the [`bounty`](https://github.com/codecheesee/altspace/issues?q=is%3Aissue+is%3Aopen+label%3Abounty) label.
- **Tax-Compliant Payouts**: Payouts are administered via Polar.sh / Open Collective with automated IRS (W-8BEN / 1099) and Indian PAN/TDS compliance.

For complete financial, governance, and payout specifications, review [**TREASURY.md**](TREASURY.md).

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
# Run frontend unit tests and type checks
npm run build

# Run Rust unit and integration tests (26 test cases)
cd src-tauri
cargo test
```

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for terms and conditions.
