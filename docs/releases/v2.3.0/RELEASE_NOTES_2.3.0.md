# AltSpace 2.3.0 Release Notes

**Release:** AltSpace 2.3.0 — Smart Game Hub, Noise Filtering Engine & Ergonomics  
**Target Platform:** Windows 10 & Windows 11 (64-bit)  
**Package Identifier:** `codecheesee.altspace`  
**License:** Apache 2.0 (Core)  
**Release Date:** 2026-10-23  

AltSpace 2.3.0 brings major power-user quality-of-life enhancements, expanding the application from a high-performance command palette into an intelligent, zero-friction desktop launcher for PC gamers and developers alike.

---

## Highlights

### 1. Smart Game Hub & Multi-Store Game Launcher
AltSpace now scans your PC to detect installed games across every major digital distribution platform and standalone install directory:
- **Steam Integration:** Automatically reads `libraryfolders.vdf` and `appmanifest_*.acf` across all local drive letters (`C:`, `D:`, `E:`, `G:`, etc.) and launches games via the native URI scheme `steam://run/<appid>`.
- **Epic Games Store:** Parses `.item` manifests in `%PROGRAMDATA%\Epic\EpicGamesLauncher\Data\Manifests\` and launches titles directly with `com.epicgames.launcher://apps/<CatalogItemId>?action=launch`.
- **Xbox Game Pass & Windows Apps:** Resolves packaged applications under `shell:AppsFolder` and Start Menu game programs.
- **Standalone & Custom Directories:** Automatically surveys common game directories (`C:\Games`, `D:\Games`, `G:\Games`, etc.) for game executables.
- **Hero Launcher Card:** When a game is searched (e.g., `gta`, `grand theft auto v`, `cyberpunk`), AltSpace renders an interactive hero card displaying platform badges, installation status, disk footprint, and a direct launch button. If the title is not installed, an interactive card offers direct store acquisition links.

### 2. Search Noise & Least-Used Extension Filtering Engine
Windows system disks are filled with internal configuration, cache, and runtime files that clutter spotlight search results. AltSpace 2.3.0 introduces an intelligent noise filter:
- **34 Blocked Noise Extensions by Default:** Filters out `.ink`, `.ini`, `.log`, `.tmp`, `.dll`, `.sys`, `.dat`, `.bak`, `.old`, `.chk`, `.etl`, `.wer`, and other low-relevance extensions.
- **Power-User Override:** If you explicitly type an extension into the search query (e.g. `config.ini` or `.ink`), AltSpace gracefully disables the filter for that query and returns the requested file.
- **Granular Settings Panel:** Open the Action Drawer (`Ctrl + /` or `:settings`) to configure the **File Noise Filters**: toggle individual categories (System & Drivers, Runtimes, Cache & Temp, Shell Shortcuts) or add your own custom extensions.

### 3. Minimalist Omnibar & Pro Status Clarity
- **Sleek Trending Header:** The omnibar header has been redesigned to modern 2026 design standards. Free users see a clean, trending `Try Pro` button with a subtle purple sparkle.
- **Zero Promo Clutter for Pro & Sovereign Users:** Maintainers, Contributors, Supporters, and Pro subscribers experience a distraction-free, zero-promo omnibar.
- **Instant Sovereign Maintainer Verification:** Synchronous entitlement caching immediately recognizes sovereign maintainer status (@codecheesee) with zero delay or race condition upon app startup.

### 4. Single-Instance Window Presentation State Machine
- **EnumWindows Process Awakening:** Replaced fragile `FindWindowW` title-matching with top-level `EnumWindows` scanning. Double-clicking desktop or Start Menu shortcuts when AltSpace is already running instantly restores, unhides, and raises the existing window to the foreground without spawning zombie processes.
- **Startup Grace Period (`mark_window_shown`):** Added an 800ms presentation grace period and atomic `HAS_GAINED_FOCUS` state flag to prevent premature window dismissal when Windows focus events fire during WebView initialization.

---

## Upgrade & Installation

- **PowerShell (Instant One-Liner):**
  ```powershell
  irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
  ```
- **Direct Installer:** Download `AltSpace-Setup-x64.exe` from the GitHub Release page.
- **Portable ZIP:** Download `AltSpace-Portable-x64.zip`, extract to any directory, and run `AltSpace-Portable.exe`.
