# Changelog

All notable changes to **AltSpace** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.0] - 2026-10-23

### Added
- **Smart Game Hub & Multi-Store Game Launcher**:
  - Native manifest engine automatically scans and discovers installed PC games across Steam (`appmanifest_*.acf` across all local drive letters), Epic Games Store (`.item` JSON manifests in `%PROGRAMDATA%\Epic\EpicGamesLauncher\Data\Manifests`), Xbox Game Pass / Windows Apps, Start Menu game shortcuts, and standalone install roots (`C:\Games`, `D:\Games`, `G:\Games`, etc.).
  - High-impact **Game Hero Launcher Card** with store badges (Steam, Epic, Xbox, Direct), executable verification, game size, and one-click/Enter instant launch via native URI schemes (`steam://run/`, `com.epicgames.launcher://apps/`) or direct execution.
  - Zero-noise fallback: If an exact game query (e.g., `gta5`, `grand theft auto v`) is entered but not installed, AltSpace renders an interactive installation card with store acquisition links.
- **Search Noise & Least-Used Extension Filtering Engine**:
  - Engineered high-performance noise filter blocking 34 non-user extensions by default (`.ink`, `.ini`, `.log`, `.tmp`, `.dll`, `.sys`, `.dat`, `.bak`, `.old`, `.chk`, etc.) to prevent clutter in spotlight search results.
  - Interactive **File Noise Filters** settings panel inside Action Drawer (`Ctrl + /` or `:settings`) with master toggle, individual category toggles (System, Runtime, Cache, Shell), and custom user-defined blocked extension list.
  - Power-user query override: If a user specifically types an extension (e.g. `settings.ini`, `setup.log`, `.ink`), the filter gracefully permits matching results.
- **Dynamic Sovereign Maintainer Entitlement Engine**:
  - Immediate client synchronization for Maintainer sovereign license (@codecheesee) with zero-delay auto-detection and cache persistence.
  - Maintainer & Community category in Action Drawer proudly displays verified `Maintainer` badge and Sovereign Lifetime status.

### Changed
- **Minimalist Omnibar & Trending Pro Header**:
  - Replaced legacy long promo text with a sleek, modern, trending `Try Pro` button with subtle purple sparkle visible exclusively to Free-tier users.
  - Completely removed promo clutter from omnibar header for Pro subscribers, Supporters, Contributors, and Sovereign Maintainers.
- **Documentation Overhaul & Repository Cleanliness**:
  - Consolidated and organized historical internal release artifacts from root into `docs/releases/v2.2.0/`.
  - Upgraded repository documentation to modern 2026 open-source standards.

### Fixed
- **Single-Instance Window Presentation State Machine**:
  - Replaced legacy `FindWindowW` with robust top-level `EnumWindows` scanning `AltSpace` across all window states, including hidden and background windows.
  - Added `mark_window_shown()` with an 800ms presentation grace period and atomic `HAS_GAINED_FOCUS` state flag to prevent premature window dismissal when background focus events fire during process initialization.
  - Double-clicking desktop or Start Menu shortcuts while AltSpace is already running smoothly summons and focuses the existing instance without orphaned processes or zombie states.
- **Search Normalizer Disambiguation**:
  - Fixed inverted catalog match priority bug where uninstalled catalog entries shadowed installed binaries.
  - Prevented false positive fuzzy matching between game acronyms (e.g. `cod` vs `gta`).
- **Rust Backend Compiler Warnings**:
  - Removed unused imports (`FindWindowW`) for clean compilation with zero warnings.

---

## [2.2.0] - 2026-10-22

### Security
- **Authoritative Rust Security Broker**: All Level 2/3 filesystem and process operations require backend-issued, single-use, 60-second challenge tokens bound to SHA-256 payload hashes.
- **Windows DPAPI Vault**: AI BYOK API keys and GitHub OAuth tokens encrypted natively using Windows DPAPI, zero plaintext tokens in WebView2 `localStorage`.
- **Shell Containment**: Removed unbrokered `execute_shell_command` IPC endpoint; external script execution (.ps1, .bat, .cmd, .py, .js) quarantined with `BlockedForMigration` status.
- **Subprocess Elimination**: Vortex Win32 Driver replaces CLI tools (`taskkill`, `netstat`) with native Win32 kernel calls (`GetExtendedTcpTable`, `Toolhelp32`).
- Detailed release documentation archived at [docs/releases/v2.2.0/](docs/releases/v2.2.0/).

---

## [2.1.0] - 2026-10-21

### Added
- Everything 64-bit SDK integration for instantaneous whole-drive MFT search indexation.
- Deep Windows 11 Fluent UI theme with mica/acrylic material backdrop.
- System actions palette for instant sleep, lock, shutdown, and restart commands.

---

## [2.0.0] - 2026-10-20

### Added
- Complete rewrite from Electron to Tauri v2 + Rust 2021 + React 19 + Tailwind CSS v4.
- Idle memory footprint reduced from ~250MB to < 18MB RAM.
- Cold invocation hotkey response reduced to sub-3.5ms via `RegisterHotKey`.
