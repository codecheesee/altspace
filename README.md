# AltSpace — The Modern Extensible Raycast for Windows

[![CI / Release](https://github.com/codecheesee/altspace/actions/workflows/release.yml/badge.svg)](https://github.com/codecheesee/altspace/actions/workflows/release.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg?logo=windows)](https://github.com/codecheesee/altspace)
[![Stack: Rust + React 19 + Tailwind v4](https://img.shields.io/badge/Stack-Rust%20%7C%20React%2019%20%7C%20Tailwind%20v4-7928CA.svg)](https://github.com/codecheesee/altspace)
[![Model Context Protocol](https://img.shields.io/badge/AI-Model%20Context%20Protocol%20(MCP)-emerald.svg)](https://github.com/codecheesee/altspace)
[![Contributor Treasury: 20%](https://img.shields.io/badge/Treasury-20%25%20Contributor%20Bounties-amber.svg)](TREASURY.md)

> **AltSpace** is a lightning-fast, keyboard-first desktop command palette and launcher for Windows 10 & 11.  
> Engineered with **pure Rust**, **Tauri v2**, **React 19**, **Tailwind CSS v4**, and **SQLite Frecency Ranking**.  
> Features instant application launching, multi-drive NTFS indexing, local AI with Model Context Protocol (MCP) tool execution, developer port killer, clipboard manager with secret detection, and an in-app sandboxed community extension store.

---

## ⚡ 1-Line Modern Installation

Open PowerShell (Run as User or Administrator) and run:

```powershell
irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
```

### What happens automatically:
1. Resolves and downloads the latest release binary from GitHub.
2. Installs into `%LOCALAPPDATA%\Programs\AltSpace`.
3. Creates a Start Menu shortcut (`AltSpace.lnk`).
4. Adds AltSpace to your user `PATH`.
5. Starts the background tray daemon with global hotkey `Alt+Space`.

---

## 💎 Win-Win Contributor Treasury & Supporter Model

AltSpace pioneers a transparent, industry-standard **Open-Core & Contributor Bounty Model**:

- **100% Free & Open Source Forever**: The core app, search engine, dev tools, and community extensions are licensed under **Apache 2.0**.
- **The 70 / 20 / 10 Revenue Split**:
  - **70% Founder / Maintainer**: Funds full-time core Rust backend engineering, security reviews, and ongoing maintenance.
  - **20% Contributor Bounty Treasury**: Automatically set aside into public GitHub Feature Bounties (₹2,000–₹10,000 / $25–$120) for developers who build useful features and extensions.
  - **10% Infrastructure & Code Signing Reserve**: Funds Windows Authenticode EV Code Signing (to eliminate SmartScreen alerts), domain hosting, and build runners.
- **100% Direct Creator Tipping**: Every extension in the in-app Store features a direct **"Tip Creator"** button linking to the author's GitHub Sponsors / Ko-fi. Authors keep 100% of community tips with 0% platform fee.
- **Fair Global Pricing (Purchasing Power Parity)**:
  - India: **₹299 / year** (~₹25/mo)
  - US & International: **$12 / year** ($1/mo)

📖 Read the full governance charter in [**TREASURY.md**](TREASURY.md) and learn how to claim bounties in [**CONTRIBUTING.md**](.github/CONTRIBUTING.md).

---

## 🎯 Active & Funded Community Bounties

Want to get paid to contribute to open source? Check out our currently funded bounties:

| Bounty Issue | Feature Description | Bounty Amount | Status |
| :--- | :--- | :---: | :---: |
| [#42](https://github.com/codecheesee/altspace/issues) | **Bluetooth Device Switcher** (1-click headphone/device toggle) | **₹3,000** ($36) | Completed |
| [#56](https://github.com/codecheesee/altspace/issues) | **Spotify Desktop Mini-Controller** (playback, search & lyrics) | **₹2,500** ($30) | Claimed |
| [#61](https://github.com/codecheesee/altspace/issues) | **Obsidian Vault Quick Note Appender** (daily notes & capture) | **₹2,000** ($24) | **Open Bounty** |
| [#73](https://github.com/codecheesee/altspace/issues) | **Docker Container Metrics & Quick Restart** | **₹2,500** ($30) | Completed |

*Bounties are disbursed automatically via Polar.sh / GitHub Sponsors upon PR merge.*

---

## 🚀 Features at a Glance

### 1. Sub-5ms SQLite Frecency Ranking
Powered by an embedded SQLite database in Rust using exponential time-decay math ($F = \text{frequency} \times e^{-\lambda \Delta t}$). Your most relevant apps and documents appear instantly based on time-of-day usage patterns.

### 2. Local AI & Model Context Protocol (MCP) Tools
Connects directly to local Ollama (Llama 3.2 / Qwen 2.5) at `localhost:11434` for 100% private, zero-latency desktop AI. Native MCP tool execution allows the AI to execute local desktop actions safely:
- Ask `? kill port 3000` to terminate hung servers.
- Ask `? list open ports` to inspect dev servers.
- Ask `? snap left` to position foreground windows.

### 3. Developer Port Killer (`:3000`)
Type `:3000` or `:port` into the omnibar to instantly view running dev servers, PIDs, and process names. Press <kbd>Enter</kbd> to terminate rogue Node.js, Python, or Vite processes in 3ms.

### 4. Sandboxed Community Extension Store (`:store`)
Browse, install, and uninstall community extensions with 1 click. Features:
- Decoupled remote registry (new extensions arrive without app updates).
- Path traversal protection and 15-second execution timeouts.
- Direct "Tip Creator" buttons on every card.

### 5. Multi-Drive NTFS MFT Indexing
Blazing-fast deep search across all local NTFS drives via native Windows MFT IPC without background indexing CPU overhead.

### 6. Infinite Clipboard History & Secret Protection
Categorizes clipboard history by links, code, colors, and text. In-memory pattern matching automatically masks passwords, API tokens, and private keys.

---

## ⌨️ Default Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Alt + Space` | Summon / Dismiss AltSpace palette |
| `Enter` | Launch selected item / Execute primary action |
| `Ctrl + K` | Open Context Actions Drawer |
| `Ctrl + Enter` | Reveal selected item in File Explorer |
| `Ctrl + C` | Copy file path or clipboard content |
| `Alt + C` | Open Clipboard History tab directly |
| `Alt + P` | Open Dev Ports Inspector directly |
| `:store` | Open Community Extension Store |
| `:theme` | Open Dynamic Theme Selector (5 built-in themes) |
| `Esc` | Clear search query / Dismiss window to system tray |

---

## 🛠️ Building from Source

### Prerequisites
- [Rust](https://rustup.rs/) (stable toolchain 1.80+)
- [Node.js](https://nodejs.org/) (v20+ or v22)
- Visual Studio 2022 C++ Build Tools (for Windows SDK headers)

### Clone & Run

```bash
# 1. Clone repository
git clone https://github.com/codecheesee/altspace.git
cd altspace/frontend

# 2. Install dependencies
npm install

# 3. Launch in development mode
npm run tauri dev
```

### Run Automated Tests

```bash
# Frontend build & type check (React 19 + Tailwind v4 + Vite)
npm run build

# Rust unit & integration test suite (26 tests)
cd src-tauri
cargo test
```

---

## 📄 License & Community

- **License**: [Apache License 2.0](LICENSE) — 100% Free and Open Source.
- **Governance**: [TREASURY.md](TREASURY.md)
- **Contributing**: [CONTRIBUTING.md](.github/CONTRIBUTING.md)
- **Supporters**: [SPONSORS.md](SPONSORS.md)
