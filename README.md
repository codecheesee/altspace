# AltSpace — The Lightning-Fast Command Palette for Windows

[![CI / Release](https://github.com/codecheesee/altspace/actions/workflows/release.yml/badge.svg)](https://github.com/codecheesee/altspace/actions/workflows/release.yml)
[![Discord Community](https://img.shields.io/discord/1562508214061236364?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/EtVCN9m7JV)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(x64)-0078D6.svg?logo=windows)](https://github.com/codecheesee/altspace)
[![Stack: Rust + React 19 + Tailwind v4](https://img.shields.io/badge/Stack-Rust%20%7C%20React%2019%20%7C%20Tailwind%20v4-7928CA.svg)](https://github.com/codecheesee/altspace)
[![Memory Footprint](https://img.shields.io/badge/Memory-%3C%2018MB%20RAM-success.svg)](https://github.com/codecheesee/altspace)
[![AI Integration](https://img.shields.io/badge/AI-Local%20Ollama%20(MCP)-emerald.svg)](https://github.com/codecheesee/altspace)

AltSpace is an ultra-lightweight, keyboard-first desktop command palette and spotlight launcher engineered specifically for Windows 10 and Windows 11. Built from the ground up in native Rust, AltSpace replaces bulky Electron launchers with sub-3.5ms cold invocation and an idle memory footprint under 18 MB.

Whether you're killing blocked developer ports, finding files across multiple physical drives, launching your favorite games across stores, or interacting with private local AI models, AltSpace gives you instant keyboard control over your entire PC.

---

## Highlights

- ⚡ **Sub-3.5ms Cold Invocation**: Instant summoning with `Alt + Space` using native Windows hotkey registration.
- 🪶 **< 18 MB RAM**: Ultra-lightweight native Rust system daemon with zero Electron runtime bloat.
- 📁 **Instant Multi-Drive Search**: Blazing-fast indexing and whole-drive search across C:, D:, and external drives.
- 🎮 **Smart Game Hub**: One-stroke game launcher auto-detecting Steam, Epic Games, Xbox Game Pass, and standalone titles.
- 🛡️ **Zero Search Clutter**: Intelligent noise filtering keeps internal system caches, logs, and driver files out of your results.
- 🔌 **Developer Port Inspector**: Inspect and kill blocking dev server ports (`:3000`, `:8080`) with a single keystroke.
- 🤖 **Private Local AI**: Native Model Context Protocol (MCP) support connecting to local Ollama endpoints with zero cloud data egress.
- 📋 **In-Memory Clipboard History**: Search and restore clipboard snippets with automatic secret and credential masking.
- 🔒 **Local-First Privacy**: Windows DPAPI encryption at rest, zero background telemetry, and zero keystroke logging.

---

## Quickstart & Installation

### Option 1: Instant PowerShell One-Liner (Recommended)
Run this single command in PowerShell to automatically install, verify, and launch AltSpace:

```powershell
irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
```

### Option 2: Windows Package Manager (Winget)
```powershell
winget install codecheesee.altspace
```

### Option 3: Direct Download
- **Installer (.exe)**: [**AltSpace-Setup-x64.exe**](https://github.com/codecheesee/altspace/releases/latest) (Per-user setup, no admin privileges required)
- **Portable (.zip)**: [**AltSpace-Portable-x64.zip**](https://github.com/codecheesee/altspace/releases/latest) (Zero-install standalone executable)
- **Enterprise (.msi)**: [**AltSpace-MSI-x64.msi**](https://github.com/codecheesee/altspace/releases/latest) (WiX deployment for Group Policy)

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Alt</kbd> + <kbd>Space</kbd> | **Summon / Dismiss** | Toggle AltSpace from anywhere in Windows |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Navigate** | Move through search results |
| <kbd>Enter</kbd> | **Execute** | Launch application, open file, or run action |
| <kbd>Tab</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd> | **Action Drawer** | Open contextual actions menu for selected item |
| <kbd>Esc</kbd> | **Back / Clear** | Clear current search query or dismiss window |
| `:port` or `:<number>` | **Port Inspector** | Enumerate listening TCP ports (e.g. `:3000`) and terminate blocking processes |
| `:games` or `<game name>` | **Game Launcher** | Discover and launch installed PC games across Steam, Epic, and Xbox |
| `? <prompt>` | **Local AI** | Query local Ollama LLMs using clipboard context or plain language |
| `!cb` | **Clipboard** | Search in-memory clipboard history |
| `:settings` or <kbd>Ctrl</kbd> + <kbd>/</kbd> | **Preferences** | Toggle noise filters, customize themes, and adjust search options |

---

## Technical Specifications

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Backend Core** | Rust 2021 + Tauri v2 | Native Win32 system integration with zero subprocess overhead |
| **UI Engine** | React 19 + TypeScript + Tailwind CSS v4 | Hardware-accelerated WebView2 rendering |
| **Idle Memory** | ~18 MB RAM | Verified on Windows 11 Pro 23H2 |
| **Active Memory** | ~32 MB RAM | During deep multi-drive search queries |
| **Search Engine** | Everything SDK / MFT + In-Memory Fallback | Whole-drive indexing without background CPU churn |
| **License** | Apache 2.0 (Core) | 100% Free and open source for personal and enterprise use |

---

## Building from Source

### Prerequisites
- [Rust toolchain](https://rustup.rs/) (1.80+ stable)
- [Node.js](https://nodejs.org/) (v20+ or v22 LTS)
- Visual Studio 2022 C++ Build Tools (with Windows 10/11 SDK)

### Development Setup
```bash
# 1. Clone repository
git clone https://github.com/codecheesee/altspace.git
cd altspace

# 2. Install frontend dependencies
npm --prefix frontend install

# 3. Launch in development mode
npm --prefix frontend run tauri dev
```

### Running Tests
AltSpace maintains a comprehensive automated test harness covering security boundaries, installer verification, and native core features:

```bash
# Run 103 frontend unit and integration tests
npm --prefix frontend test

# Run 78 native Rust unit and integration tests
cargo test --manifest-path frontend/src-tauri/Cargo.toml

# Strict linting verification
npm --prefix frontend run lint
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

---

## Community & Contributing

- **Discord Community**: Join our official [Codecheesee Community Discord](https://discord.gg/EtVCN9m7JV) for announcements, roadmap voting, and developer discussions.
- **GitHub Discussions**: Propose feature requests or architecture enhancements in [GitHub Discussions](https://github.com/codecheesee/altspace/discussions).
- **Contributing**: Please read our [Contributing Guidelines](.github/CONTRIBUTING.md) before opening a pull request.
- **Sponsors & Treasury**: 20% of all project sponsorship funds are reserved for community bounties and contributor payouts. See [TREASURY.md](TREASURY.md) and [SPONSORS.md](SPONSORS.md).

---

## License

AltSpace is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for complete details.
