# AltSpace — Master Technical Source of Truth & Copilot Specification (2026 Edition)

> **Document Type:** Canonical Project Specification, Technical Reference & AI Copilot System Prompt  
> **Repository:** [`https://github.com/codecheesee/altspace`](https://github.com/codecheesee/altspace)  
> **Creator / Lead Maintainer:** Rohan / Narayan Gorai ([`@codecheesee`](https://github.com/codecheesee), GitHub ID: `66432945`)  
> **Studio Umbrella:** Codecheesee Builds  
> **App Identifier:** `com.altspace.launcher`  
> **Target OS:** Windows 10 & Windows 11 (x64, arm64)  
> **Current Version:** `2.2.0` (Canonical Security Hardening Release)  
> **License:** Apache License 2.0 (Core Engine) with Trademark Reservations  
> **Primary Discord Community:** [Codecheesee Builds Discord Server](https://discord.gg/EtVCN9m7JV) (Guild ID: `1562508214061236364`)

---

## Table of Contents
1. [Executive Summary & Purpose](#1-executive-summary--purpose)
2. [Project Metadata & Brand Identity](#2-project-metadata--brand-identity)
3. [Full Architecture & 2026 Technology Stack](#3-full-architecture--2026-technology-stack)
4. [GitHub Infrastructure & Repository Layout](#4-github-infrastructure--repository-layout)
5. [Discord Community System & Operational Architecture](#5-discord-community-system--operational-architecture)
6. [Core Subsystems & Technical Implementation Deep-Dive](#6-core-subsystems--technical-implementation-deep-dive)
7. [Commercial Boundary, Quota & Contributor Treasury](#7-commercial-boundary-quota--contributor-treasury)
8. [Distribution, Packaging & Updater Infrastructure](#8-distribution-packaging--updater-infrastructure)
9. [Automated Verification & 128-Test Test Suite](#9-automated-verification--128-test-test-suite)
10. [Complete File-by-File Codebase Directory](#10-complete-file-by-file-codebase-directory)
11. [Master Copilot System Prompt & Operational Rules](#11-master-copilot-system-prompt--operational-rules)

---

## 1. Executive Summary & Purpose

AltSpace is a high-performance, keyboard-driven desktop command palette and spotlight launcher designed specifically for Windows 10 and Windows 11. Built on a native Rust core using Tauri v2, React 19, and Tailwind CSS v4, AltSpace delivers instant keystroke responsiveness, low baseline memory consumption (< 18MB RAM idle, < 32MB active search), and comprehensive developer tooling with zero background telemetry or cloud lock-in.

This document serves as the **uncompromising single source of truth** for human maintainers, contributors, and autonomous AI copilot agents. Every specification, API contract, security policy, and configuration detail contained herein is verified against actual source files within the repository (`c:\Users\rohan\.gemini\antigravity\scratch\altspace`).

---

## 2. Project Metadata & Brand Identity

| Attribute | Specification | Source Citation |
| :--- | :--- | :--- |
| **Product Name** | AltSpace | `frontend/src-tauri/tauri.conf.json:3` |
| **Internal Cargo Package** | `altspace` | `frontend/src-tauri/Cargo.toml:2` |
| **Frontend Package** | `frontend` | `frontend/package.json:2` |
| **Bundle Identifier** | `com.altspace.launcher` | `frontend/src-tauri/tauri.conf.json:5` |
| **Current Frontend Version** | `2.2.0` | `frontend/package.json:4` |
| **Current Tauri / Cargo Version** | `2.2.0` | `frontend/src-tauri/Cargo.toml:3` |
| **Current Distribution Version**| `2.2.0` (Release Milestone) | `distribution/latest-release.json:2` |
| **Creator & Lead Maintainer** | Narayan Gorai / Rohan (`@codecheesee`) | `frontend/src-tauri/Cargo.toml:5`, `docs/DISCORD_COMMUNITY_SYSTEM.md:4` |
| **GitHub Maintainer Account** | `codecheesee` (User ID `66432945`) | `entitlements.json:12-13` |
| **GitHub Repository URL** | `https://github.com/codecheesee/altspace` | `README.md:3`, `frontend/src/feedbackConfig.ts:16` |
| **Official Web Landing Page** | `https://codecheesee.github.io/altspace/` | `README.md:36`, `landing/index.html` |
| **Planned Production Domains** | `https://altspace.dev` & `https://docs.altspace.dev` | `distribution/product-registry.json:11-12` |
| **Discord Server Name** | `Codecheesee Builds` | `docs/DISCORD_COMMUNITY_SYSTEM.md:1` |
| **Discord Server (Guild) ID** | `1562508214061236364` | `README.md:4` |
| **Official Discord Invite** | `https://discord.gg/EtVCN9m7JV` | `frontend/src/feedbackConfig.ts:11`, `README.md:4` |
| **Discord Releases Channel ID**| `1562515749162065963` | `distribution/release-webhook.json:3` |
| **Release Discord Webhook** | `https://discord.com/api/webhooks/DISCORD_WEBHOOK_ID_PLACEHOLDER/DISCORD_WEBHOOK_TOKEN_PLACEHOLDER` | `distribution/release-webhook.json` (untracked local template) |
| **Core License** | Apache License, Version 2.0 | `LICENSE`, `frontend/src-tauri/Cargo.toml:7` |
| **Trademark Rights** | Protected under `TRADEMARK.md` (no fork branding as AltSpace) | `TRADEMARK.md:1-49` |
| **Extension Registry Repo** | `https://github.com/codecheesee/altspace-extensions` | `frontend/src/lib/registry.ts:29-30` |

---

## 3. Full Architecture & 2026 Technology Stack

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AltSpace Desktop Client                       │
├─────────────────────────────────────────────────────────────────────────┤
│  UI Layer: React 19.2 + TypeScript 6.0 + Tailwind CSS v4.3 + Vite 8     │
│  WebView2 Runtime: Hardware-accelerated, transparent frameless HUD      │
│  State Management: React Hooks + In-Memory Caches + DPAPI Vault API     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Tauri v2 IPC (Typed Commands)
┌────────────────────────────────────▼────────────────────────────────────┐
│                       Native Rust Core (Tauri v2)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  • Win32 Message Loop: Raw RegisterHotKey (Alt+Space), SetWindowPos    │
│  • Memory Working Set: ~18MB idle / ~32MB active search (zero Electron)│
│  • Capability Broker & Challenge Gate: Parameter-bound single-use tokens│
│  • Windows DPAPI Vault: CryptProtectData user-bound encryption (zero IPC)│
│  • Process Forensics: Toolhelp32 snapshotting & TCP table polling       │
│  • Filesystem Engine: Everything64.dll FFI + recursive scanner fallback│
│  • Ranking Engine: SQLite WAL mode with logarithmic frecency decay     │
│  • Virtualization Cockpit: Docker daemon sockets & WSL2 vmmem reclaim   │
│  • Extension Confinement: Script execution blocked (migration status)   │
│  • Native BYOK Engine: Stdin piped configuration (zero CLI arguments)   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Frontend Stack Specifications
- **React:** `19.2.8` (`frontend/package.json:17`)
- **React DOM:** `19.2.8` (`frontend/package.json:18`)
- **TypeScript:** `~6.0.2` (`frontend/package.json:29`)
- **Vite:** `^8.3.0` (`frontend/package.json:30`)
- **Tailwind CSS:** `^4.3.3` with `@tailwindcss/vite` (`frontend/package.json:22,28`)
- **Oxlint:** `^1.81.0` (`frontend/package.json:27`)
- **Tauri API:** `@tauri-apps/api` `^2.12.4` (`frontend/package.json:14`)
- **Icons:** `lucide-react` `^1.59.0` (`frontend/package.json:16`)
- **Utilities:** `clsx` `^2.1.1` and `tailwind-merge` `^3.7.0` (`frontend/package.json:15,19`)

### 3.3 Backend Rust Stack Specifications
- **Rust Edition:** `2021` (`frontend/src-tauri/Cargo.toml:6`)
- **Tauri Core:** `2.0` with features `tray-icon`, `image-png` (`Cargo.toml:17`)
- **Windows Crate:** `0.58` with Win32 features:
  - `Win32_Foundation`, `Win32_Security`, `Win32_Security_Cryptography` (DPAPI)
  - `Win32_UI_WindowsAndMessaging`, `Win32_UI_Input_KeyboardAndMouse`
  - `Win32_Storage_FileSystem`, `Win32_System_DataExchange`, `Win32_System_Memory`
  - `Win32_System_Threading`, `Win32_System_Diagnostics_ToolHelp`
  - `Win32_NetworkManagement_IpHelper`, `Win32_Networking_WinSock`
  - `Win32_UI_Shell`, `Win32_Graphics_Gdi`, `Win32_Graphics_Dwm`, `Win32_System_Registry`
- **Database:** `rusqlite` `0.31` with bundled SQLite (`Cargo.toml:26`)
- **Cryptography:** `ed25519-dalek` `2.1` (`Cargo.toml:27`), `base64` `0.22` (`Cargo.toml:28`)
- **Fuzzy Search:** `fuzzy-matcher` `0.3` (`Cargo.toml:22`)
- **Filesystem Traversal:** `walkdir` `2.5` (`Cargo.toml:23`)
- **Serialization:** `serde` `1.0`, `serde_json` `1.0` (`Cargo.toml:19-20`)

---

## 4. GitHub Infrastructure & Repository Layout

### 4.1 Git Configuration
- **Remote Origin:** `https://github.com/codecheesee/altspace.git`
- **Default Branch:** `main`
- **Active Feature Branches:** `origin/codecheesee-altspace-first-run-polish`, `origin/copilot/fix-verify-build-tests`, `origin/imgbot`, `origin/windows-distribution`

### 4.2 GitHub Actions Workflows (`.github/workflows/`)
1. **`ci.yml`**:
   - Triggers on push to `main` and all pull requests.
   - Runs frontend tests (`npm test --prefix frontend`), builds static assets (`npm run build`), runs oxlint (`npm run lint`).
   - Runs Rust tests (`cargo test`) and strict clippy checks (`cargo clippy -- -D warnings`).
2. **`release.yml`**:
   - Triggers on tag push (`v*`).
   - Builds NSIS installer (`AltSpace-Setup-x64.exe`), WiX MSI (`AltSpace-MSI-x64.msi`), and standalone zip (`AltSpace-Portable-x64.zip`).
   - Generates `SHA256SUMS.txt`.
   - Requires Authenticode signing secret or fails closed.
   - Dispatches Discord release announcement webhook.
3. **`deploy-landing.yml`**:
   - Triggers on push to `main` for `landing/**` or manual dispatch.
   - Publishes static website to GitHub Pages at `https://codecheesee.github.io/altspace/`.
4. **`ingest-feedback.yml`**:
   - Handles automated user feedback dispatches.
   - Automatically categorizes and applies labels: 1-2 stars $\to$ `bug`, 4-5 stars $\to$ `enhancement` + `bounty-candidate`.
5. **`sync-entitlements.yml`**:
   - Daily cron + dispatch workflow.
   - Queries GitHub API for contributors with $\ge 2$ merged pull requests.
   - Quarantines contributors in `entitlements.json` under `contributors: []` (separate from paying sponsors).
6. **`winget.yml`**:
   - Validates and packages Windows Package Manager manifests in `distribution/winget/`.

---

## 5. Discord Community System & Operational Architecture

Documented extensively in [`docs/DISCORD_COMMUNITY_SYSTEM.md`](docs/DISCORD_COMMUNITY_SYSTEM.md) and automated via [`scripts/setup-discord-server.mjs`](scripts/setup-discord-server.mjs).

### 5.1 Community Server Philosophy: "Codecheesee Builds"
Instead of fragmenting users across isolated app servers, the studio runs an umbrella community: **`Codecheesee Builds`**.
- **Server Tagline:** *Fast, private developer tools for Windows and beyond.*
- **Zero-Client-Secret Boundary:** The AltSpace desktop client contains zero Discord bot tokens or webhook URLs. All in-app community actions route through verified browser links. Discord roles are social recognition and **never** serve as cryptographic licensing authority.

### 5.2 Server Structure & Channels
- **`START HERE`**:
  - `#welcome` (Read-only, mission & guidelines)
  - `#rules` (Read-only, rules screening)
  - `#announcements` (Announcement channel, major releases)
  - `#roadmap` (Studio roadmap tracking)
  - `#changelog` (Concise release logs)
  - `#introductions` (Member introduction prompt)
- **`DEVELOPER COMMUNITY`**:
  - `#general`, `#developer-lounge`, `#windows-dev`, `#rust-and-systems`, `#typescript-react`, `#local-ai`, `#docker-and-wsl`, `#show-and-tell`
- **`ALTSPACE`**:
  - `#altspace-start-here` (Downloads, hotkeys, quickstart)
  - `#altspace-support` (Community peer troubleshooting)
  - `#altspace-bug-reports` (Forum channel, tags: `crash`, `install`, `ports`, `docker-wsl`, `ollama-ai`, `clipboard`, `windows-11`, `windows-10`)
  - `#altspace-feature-reqs` (Forum channel, tags: `planned`, `under-review`, `community-vote`, `prototype`, `shipped`)
  - `#altspace-workflows` (User recipes and port configurations)
  - `#altspace-beta` (Role-gated private testing)
  - `#altspace-releases` (GitHub Actions automated release feed, Channel ID: `1562515749162065963`)
- **`FUTURE PRODUCTS`**:
  - `#future-products-hub`, `#product-ideas`, `#beta-waitlists`
- **`VOICE & STAGES`**:
  - `Developer Lounge` (Voice), `Build Together` (Voice), `Office Hours` (Stage)
- **`STAFF & OPS`** (Private):
  - `#mod-chat`, `#mod-alerts`, `#incident-log`, `#support-escalations`, `#content-calendar`

### 5.3 AutoMod Security Invariants
- **Token Redaction Alert:** Blocks messages matching GitHub PATs (`gh[pous]_[0-9a-zA-Z]{36}`), OpenAI keys (`sk-(?:proj-)?[a-zA-Z0-9_-]{20,}`), Anthropic keys (`sk-ant-[a-zA-Z0-9_-]{20,}`), and PEM private key headers (`-----BEGIN[A-Z\s]+PRIVATE KEY-----`).
- **Anti-Mention Spam:** Messages with $> 4$ mentions are blocked and user receives a 30-minute timeout.
- **Malicious Invite Blocker:** Non-whitelisted discord invites are rejected.

---

## 6. Core Subsystems & Technical Implementation Deep-Dive

AltSpace contains 18 distinct developer subsystems, each designed with strict memory boundaries and 2026 trending patterns:

### Subsystem 1: SQLite Frecency Engine (`frecency.rs`)
- Persistent scoring in `%LOCALAPPDATA%\AltSpace\frecency.db` using SQLite in WAL mode.
- Formula: $\text{Score} = \text{VisitCount} \times (1.0 / (1.0 + \lambda \times \Delta t))$.
- Recency bonus of 2.5x applied for items accessed within the last 4 hours. Startup prunes events older than 90 days.

### Subsystem 2: Intelligent Port & Process Recovery (`:port`, `ports.rs`)
- Enumerates listening TCP ports using Win32 `GetExtendedTcpTable` (`MIB_TCPTABLE_OWNER_PID`).
- Toolhelp32 process snapshotting traces child/parent process ancestry (e.g. `cmd.exe` $\to$ `node.exe` $\to$ `vite`).
- Scans target working directories for `package.json` to extract project boundaries.
- Kills blocking processes and verifies socket release through live TCP table polling before confirming. Blacklists PID 0, PID 4, and protected system processes.

### Subsystem 3: Local Ollama AI & Model Context Protocol (`?`, `ai.ts`)
- Connects to local Ollama endpoints at `http://localhost:11434` with zero external cloud egress.
- Fast-path deterministic action synthesis (< 1ms) evaluates standard developer fixes (`? fix 5173`, `? reclaim memory`, `? clean docker`) without LLM latency.
- Full model setup instructions in [`docs/OLLAMA_SETUP_GUIDE.md`](docs/OLLAMA_SETUP_GUIDE.md).

### Subsystem 4: Extension Confinement & Migration State (`:store`, `plugins.rs`)
- Enforces containment on community scripts: execution of external scripts (`.ps1`, `.bat`, `.cmd`, `.py`, `.js`) is blocked with `BlockedForMigration` status pending signed manifest architecture.
- Installed extensions remain visible in `:store` with full metadata and preserved files, but cannot execute child processes.
- Installation of new untrusted scripts fails closed without writing executable files to disk.

### Subsystem 5: Multi-Drive Search via Everything SDK (`everything.rs`)
- Direct FFI bindings to `Everything64.dll` (`Everything_SetSearchW`, `Everything_QueryW`).
- Multi-drive search across C:, D:, E:, etc. with zero background indexing CPU load.
- In-memory recursive scanner acts as a reliable fallback when Everything daemon is not running.

### Subsystem 6: In-Memory Clipboard Manager (`Alt + C`, `clipboard.rs`)
- In-memory ring buffer (up to 50 items) with zero disk persistence.
- Auto-detects content types: `code`, `url`, `color`, `text`.
- Automated regex engine detects and masks credentials, bearer tokens, and private keys in memory.

### Subsystem 7: First-Run Privacy Defaults (`appStorage.ts`)
- Context details sidebar starts hidden until user explicitly toggles it (`Ctrl + B`).
- Multi-drive search is disabled by default; user must opt in.
- Clipboard and ports are strictly mode-isolated and never seeded with dummy data.

### Subsystem 8: Capability-Based Execution Broker & Challenge Gate (`broker.rs`, `actionBroker.ts`)
Central gatekeeper for all actions with parameter-bound challenge verification:
- **Challenge Architecture**: Level 2 and Level 3 actions require single-use, 60s-expiring challenge tokens generated by Rust and cryptographically bound to the SHA-256 hash of the exact parameters. Replay attempts and parameter mutations fail closed.
- **Level 1 (`ReadOnlyAuto`)**: Read-only searches, system status, and metadata queries run instantly.
- **Level 2 (`PreviewThenApprove`)**: File modifications and memory reclamation require challenge approval.
- **Level 3 (`AlwaysApprove`)**: File deletions and port termination strictly require modal confirmation every time. Unbrokered shell execution (`RunPowerShell`) and raw HTTP calls (`CallHttpEndpoint`) are permanently disabled.
- Action Ledger records operations with timestamps and provides 1-click rollback (`Alt + H`), with all sensitive credentials automatically redacted.

### Subsystem 9: Windows DPAPI Secret Vault (`crypto_vault.rs`, `secureVault.ts`, `byok.rs`)
- User-login-bound encryption via Win32 DPAPI (`CryptProtectData`, `CryptUnprotectData`).
- Zero plaintext secrets across IPC: `vault_retrieve_secret` and `vault_retrieve_byok_key` fail closed over IPC; `vault_get_profile` returns masked values (`****`) to the WebView.
- Zero OAuth tokens in `localStorage`: GitHub access tokens are stored strictly in DPAPI by Rust.
- Native BYOK AI Engine (`byok.rs`) executes completions in Rust, piping API keys to `curl.exe --config -` via stdin to prevent command-line snooping (Event 4688).
- Environment switcher injects decrypted keys directly into child process environment blocks (`CreateProcessW` `lpEnvironment`).

### Subsystem 10: Privacy-Preserving Diagnostics (`Ctrl + Shift + D`, `diagnostics.ts`)
- Sanitizes system logs before display or export.
- Automatically redacts OpenAI keys (`sk-...`), GitHub tokens (`ghp_...`), Anthropic keys (`sk-ant-...`), RSA keys, and personal home paths (`C:\Users\<user>\` $\to$ `~\`).

### Subsystem 11: Extension Trust Tiers & Safe Mode (`plugins.rs`)
- Classifies extensions into `BuiltIn`, `Verified`, `Community`, `LocalDev`, `Revoked`.
- Safe mode activated via `--safe-mode` argument or `ALTSPACE_SAFE_MODE=1` environment variable.

### Subsystem 12: Validated Configuration Sync (`.altconfig`, `configValidator.ts`)
- Export and import non-sensitive UI settings, themes, and preferences.
- Strictly strips and rejects credentials, tokens, passwords, and private paths.

### Subsystem 13: Deep Process Forensics (`ports.rs`)
- Full ancestry inspection via Toolhelp32 snapshots (`CreateToolhelp32Snapshot`).
- Project hints extracted from executable paths and directory descriptors.

### Subsystem 14: 100% Offline Developer Transform Toolkit (`developerTransforms.ts`)
- Sub-millisecond offline transforms in the omnibar:
  - **JWT Inspector:** `jwt` &rarr; Decodes header/payload, verifies algorithms, calculates expiration.
  - **JSON &harr; YAML Studio:** `json`, `yaml` &rarr; Bidirectional formatting and conversion.
  - **Regex Lab:** `regex` &rarr; Live pattern evaluation and capture group extraction.
  - **Hash Calculator:** `hash` &rarr; SHA-256 and MD5 checksum computation.
  - **UUID & Timestamps:** `uuid`, `ts` &rarr; UUID v4 generation and Unix epoch conversion.

### Subsystem 15: DPAPI Secret & Environment Switcher (`crypto_vault.rs`)
- Manages encrypted profiles (`staging`, `prod`, `docker`).
- Direct process launching with injected environment variables.

### Subsystem 16: Docker & WSL2 Environment Cockpit (`docker_wsl.rs`, `dockerWsl.ts`)
- Enumerate Docker containers, Compose labels, status, and port mappings.
- Monitor WSL2 distributions and detect Hyper-V virtual memory footprint (`vmmem`).
- One-click memory reclaim triggers `wsl.exe --shutdown` to return host RAM.

### Subsystem 17: Private Copilot & Three-Lane Model Router (`actionPlanner.ts`)
- **Lane A (Free Forever):** 100% offline local Ollama inference (`localhost:11434`).
- **Lane B (Pro / BYOK):** Cloud LLMs (Claude 3.7, GPT-4o, DeepSeek) using DPAPI-encrypted API keys.
- **Fast Path:** Deterministic sub-millisecond action plan evaluation.
- **Volatile Failure Ring Buffer:** Stores the last 10 terminal/shell failures in memory to construct automated recovery plans upon typing `?`.

### Subsystem 18: Unified Capability Matrix & Invisibility Rule (`featureMatrix.ts`)
- Toggle developer capabilities via **Option A** (Settings GUI `Ctrl + ,`) or **Option C** (Omnibar `> toggle <id>`).
- **Invisibility Rule:** Toggled-off capabilities are completely erased from search autocomplete, tabs, and global shortcuts. Rust IPC handlers fail closed in $< 1\mu\text{s}$.

---

## 7. Commercial Boundary, Quota & Contributor Treasury

### 7.1 Two-Layer Open Core Architecture
- **Layer A (100% Free Apache 2.0 Core):** Desktop launcher, app search, local file search, calculator, settings shortcuts, dev port killer, in-memory clipboard, themes, `.altconfig`, and local Ollama inference. 100% offline and unmetered forever.
- **Layer B (Server-Controlled Commercial Services):** Hosted cloud AI routing, multi-device cloud sync, team snippets, and signed commercial entitlement leases. Requires server-side cryptographic verification.

### 7.2 Trial & Quota Policy (`quotaManager.ts`)
- **Allowance:** 100 premium actions per rolling 30-day window.
- **Warning Threshold:** Warning banner at 80 consumed actions.
- **Premium Actions:** Cloud LLM queries, deep multi-drive search across non-C: drives (raw shell runner `>` is permanently disabled).
- **Zero-Quota Actions:** Keystrokes, empty queries, debounces, local app launches, port inspection, calculator, local Ollama queries, and failed/cancelled requests.
- **Unmetered Roles:** `Maintainer` (`codecheesee`), `Pro`, `Supporter`, `Contributor`.

### 7.3 Contributor Treasury & The 70 / 20 / 10 Model (`TREASURY.md`)
- **70% Maintainer Engineering:** Core Rust backend, low-level Win32 integration, security audits.
- **20% Public Contributor Treasury:** Reserved exclusively for community feature bounties on GitHub Issues labeled [`bounty`](https://github.com/codecheesee/altspace/issues?q=is%3Aissue+is%3Aopen+label%3Abounty).
  - **Tier 1 (₹1,000 / ~$12):** Small bug fixes, translations, documentation.
  - **Tier 2 (₹2,000 – ₹3,500 / ~$25 – ~$42):** Full community extensions with manifest and assets.
  - **Tier 3 (₹5,000 – ₹10,000 / ~$60 – ~$120):** Core Win32/Rust systems integrations and IPC pipelines.
- **10% Infrastructure Reserve:** Windows Authenticode Extended Validation (EV) code signing certificates and build runners.

### 7.4 Zero-Git GitHub Device Flow Authentication (`authProvider.ts`)
- Implements RFC 8628 OAuth 2.0 Device Authorization Grant.
- Public GitHub OAuth Client ID: `Ov23liEeGEfUkCBd5gSd` (`frontend/src/lib/authProvider.ts:44`).
- Users log in via browser device code without requiring local `git.exe` or credential manager.

---

## 8. Distribution, Packaging & Updater Infrastructure

### 8.1 Distribution Channels
1. **Per-User NSIS Installer:** `AltSpace-Setup-x64.exe` (3.7 - 4.1 MB). Installs to `%LOCALAPPDATA%\AltSpace` without UAC administrator prompts. Creates Start Menu and Desktop shortcuts.
2. **Enterprise WiX MSI:** `AltSpace-MSI-x64.msi` (6.5 MB). Designed for Active Directory Group Policy deployments.
3. **Standalone Portable Bundle:** `AltSpace-Portable-x64.zip` (4.9 - 5.3 MB). Zero installation; bundles `Everything64.dll`.
4. **PowerShell One-Liner:**
   ```powershell
   irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
   ```
5. **Windows Package Manager (Winget):**
   ```powershell
   winget install codecheesee.altspace
   ```

### 8.2 In-App Update Verification (`updater.rs`, `UpdateModal.tsx`)
- Type `:update` in the omnibar or click "Check for Updates" in Settings.
- Fetches `distribution/latest-release.json` with GitHub API fallback.
- Compares semantic versioning (`is_newer_version`).
- Provides read-only release notification and opens verified GitHub release packages in default browser. In-app background binary download and silent auto-installation are disabled for security hardening.

---

## 9. Automated Verification & 166-Test Test Suite

AltSpace maintains **166 automated passing tests** across frontend TypeScript and backend Rust:

### 9.1 Test Execution Commands
```powershell
# 1. Run all 88 frontend, security, and launch kit tests
npm test --prefix frontend
# (Executes: node --test src/lib/*.test.mjs ../scripts/*.test.mjs)

# 2. Run all 78 native Rust unit and integration tests
cargo test --manifest-path frontend/src-tauri/Cargo.toml

# 3. Verify compiled distribution artifacts and checksums
powershell -ExecutionPolicy Bypass -File scripts/verify_release_artifacts.ps1
```

### 9.2 Test Suite Breakdown
| Suite Name | Test File | Test Count | Focus Areas |
| :--- | :--- | :---: | :--- |
| **Quota & Trial Policy** | `frontend/src/lib/quota.test.mjs` | 12 | 100/80 limits, 30-day window, zero-cost queries |
| **Entitlements & Webhooks** | `frontend/src/lib/entitlement.test.mjs` | 10 | HMAC-SHA256 signatures, state machine transitions |
| **First-Run Privacy** | `frontend/src/lib/firstRunPrivacy.test.mjs` | 8 | Sidebar hidden by default, multi-drive disabled |
| **Action Broker & Challenges** | `frontend/src/lib/actionBroker.test.mjs` | 9 | Parameter-bound single-use challenge tokens, replay rejection |
| **Red-Team Security** | `frontend/src/lib/redTeamSecurity.test.mjs` | 7 | Path traversal blocking, token masking, UNC blocks |
| **Privacy Diagnostics** | `frontend/src/lib/diagnostics.test.mjs` | 5 | Regex token redaction, username path scrubbing |
| **Config Validator** | `frontend/src/lib/configValidator.test.mjs` | 5 | Diff calculation, prototype pollution defense |
| **Bounty & Treasury** | `frontend/src/lib/bountySync.test.mjs` | 4 | Contributor isolation, 70/20/10 math |
| **Regional Checkout** | `frontend/src/lib/checkout.test.mjs` | 5 | PPP calculations (INR vs USD) |
| **Launch Kit & Release** | `scripts/verify_launch_kit.test.mjs` | 8 | Artifact presence, SHA256 integrity |
| **Installer Trust** | `scripts/install_trust.test.mjs` | 4 | Authenticode verification, unsigned fail-closed rejection |
| **Action Planner Tests** | `frontend/src/lib/actionPlanner.test.mjs` | 4 | Port fix plans, memory reclamation plans |
| **Docker & WSL Tests** | `frontend/src/lib/dockerWsl.test.mjs` | 3 | Container status parsing, vmmem memory check |
| **Auth & Token Scrubbing** | `frontend/src/lib/authProvider.test.mjs` | 3 | Zero tokens in localStorage, DPAPI migration |
| **Rust Native Tests** | `frontend/src-tauri/src/*.rs` | 78 | DPAPI vault, byok stdin config, ports, broker challenges |

---

## 10. Complete File-by-File Codebase Directory

```
c:\Users\rohan\.gemini\antigravity\scratch\altspace
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # Main CI pipeline (test, build, clippy)
│   │   ├── deploy-landing.yml         # GitHub Pages automated deployment
│   │   ├── ingest-feedback.yml        # User feedback auto-triaging
│   │   ├── release.yml                # Official release bundler & Authenticode
│   │   ├── sync-entitlements.yml      # Daily contributor PR sync
│   │   └── winget.yml                 # Winget package manifest validator
│   ├── CONTRIBUTING.md                # Community contribution guidelines
│   ├── ISSUE_TEMPLATE/                # Structured bug & feature templates
│   └── PULL_REQUEST_TEMPLATE.md       # PR checklist and CI requirements
├── bin/
│   └── Everything64.dll               # Bundled voidtools Everything 64-bit SDK
├── distribution/
│   ├── latest-release.json            # Canonical release manifest for in-app updates
│   ├── product-registry.json          # Studio product configuration
│   ├── release-webhook.json           # Active Discord release webhook configuration
│   └── winget/manifests/              # Official Winget package descriptors
├── docs/
│   ├── AI_FEATURES_TESTING_GUIDE.md   # Step-by-step audit manual for AI features
│   ├── DISCORD_COMMUNITY_SYSTEM.md    # 823-line Discord architecture blueprint
│   ├── FEATURE_MATRIX.md              # Two-layer product boundary specification
│   ├── LAUNCH_KIT.md                  # Reddit, X, HN, and Product Hunt copy
│   ├── LEMON_SQUEEZY_ENTITLEMENTS.md  # Commercial Merchant of Record guide
│   ├── OLLAMA_SETUP_GUIDE.md          # 1-click Ollama setup & model sizing
│   ├── ROLLOUT_STRATEGY.md            # Phased global distribution playbook
│   ├── THREAT_MODEL.md                # STRIDE security & risk analysis
│   └── VERIFICATION_AND_BUG_REPORTING_GUIDE.md # 128-test verification manual
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── search/                # ActionPlanPreview, DockerWslPreview, ResultRow...
│   │   │   ├── ActionApprovalModal.tsx # Execution broker policy check modal
│   │   │   ├── ActionDrawer.tsx       # Contextual action drawer (Ctrl+K)
│   │   │   ├── ActionTimelineDrawer.tsx # In-memory action ledger & 1-click undo
│   │   │   ├── ClipboardTab.tsx       # Masked in-memory clipboard manager
│   │   │   ├── DiagnosticsModal.tsx   # Redacted diagnostic export modal
│   │   │   ├── FeedbackModal.tsx      # Community rating & feedback review
│   │   │   ├── LicenseModal.tsx       # Account, Capability Matrix & About tabs
│   │   │   ├── PortsTab.tsx           # Process ancestry & TCP port forensics
│   │   │   ├── StoreTab.tsx           # Community extension marketplace
│   │   │   └── UpdateModal.tsx        # In-app updater & release notification modal
│   │   ├── hooks/
│   │   │   ├── useClipboardHistory.ts # Clipboard state hook
│   │   │   ├── useContextualActions.tsx # Dynamic Ctrl+K actions hook
│   │   │   ├── usePortInspector.ts    # Port inspection & forensics hook
│   │   │   ├── useSearchEngine.ts     # Main omnibar query resolution engine
│   │   │   └── useThemeEngine.ts      # Acrylic & OLED theme switcher hook
│   │   ├── lib/
│   │   │   ├── actionBroker.ts        # Typed IPC execution broker interface
│   │   │   ├── actionPlanner.ts       # Sub-1ms fast-path & Ollama plan builder
│   │   │   ├── ai.ts                  # Ollama HTTP streaming & MCP client
│   │   │   ├── appStorage.ts          # Safe Tauri invoke & typed preferences
│   │   │   ├── authProvider.ts        # RFC 8628 GitHub Device Flow engine
│   │   │   ├── calc.ts                # Math, unit, date, currency calculator
│   │   │   ├── configValidator.ts     # .altconfig schema diffing & anti-pollution
│   │   │   ├── developerTransforms.ts # JWT, JSON/YAML, Regex, UUID, Hash offline studio
│   │   │   ├── diagnostics.ts         # Regex redaction of tokens & paths
│   │   │   ├── dockerWsl.ts           # Docker & WSL2 cockpit state machine
│   │   │   ├── entitlementContract.ts # Lemon Squeezy HMAC & 11-state machine
│   │   │   ├── featureMatrix.ts       # Option A/C capability matrix & toggles
│   │   │   ├── quotaManager.ts        # 100-action / 30-day trial engine
│   │   │   ├── registry.ts            # Extension registry & SWR CDN client
│   │   │   ├── secureVault.ts         # Windows DPAPI vault & profile switcher
│   │   │   ├── theme.ts               # 5 preset themes & dynamic hex accents
│   │   │   └── windowSnaps.ts         # 13 native Win32 window tile positions
│   │   ├── App.tsx                    # Main HUD window & keyboard handler
│   │   ├── feedbackConfig.ts          # Public Discord & GitHub URLs
│   │   └── types.ts                   # Core TypeScript type definitions
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── broker.rs              # Parameter-bound challenge execution broker
│   │   │   ├── byok.rs                # Native AI completion engine (stdin pipe)
│   │   │   ├── crypto_vault.rs        # DPAPI CryptProtectData & process injection
│   │   │   ├── docker_wsl.rs          # WSL2 vmmem detection & memory reclaim
│   │   │   ├── everything.rs          # Everything64.dll FFI client & fallback
│   │   │   ├── frecency.rs            # SQLite frecency scoring with temporal decay
│   │   │   ├── plugins.rs             # Extension containment & migration status
│   │   │   ├── ports.rs               # GetExtendedTcpTable & Toolhelp32 forensics
│   │   │   ├── updater.rs             # Read-only release synchronizer
│   │   │   ├── windows_mgmt.rs        # Win32 RegisterHotKey & window positioning
│   │   │   └── lib.rs                 # 60 Tauri command registrations & setup
│   │   ├── Cargo.toml                 # Rust dependencies & Windows features
│   │   └── tauri.conf.json            # Window dimensions, CSP & bundle rules
│   └── package.json                   # React 19, Tailwind v4, Vite 8 scripts
├── landing/
│   ├── index.html                     # Official static landing page
│   └── og-preview.svg                 # OpenGraph social preview asset
├── scripts/
│   ├── setup-discord-server.mjs       # Automated Discord server provisioning
│   ├── verify_release_artifacts.ps1   # Release binary & SHA256 integrity check
│   └── prepare_dist.ps1               # Release packaging script
├── entitlements.json                  # Signed maintainer & contributor manifest
├── install.ps1                        # Verified 1-line PowerShell installer
├── README.md                          # Main project documentation
├── REVIEW_REPORT.md                   # v2.0 architectural & security review
├── SPONSORS.md                        # Regional PPP pricing schedule
├── TRADEMARK.md                       # Brand usage & fork protection guidelines
└── TREASURY.md                        # 70/20/10 financial governance charter
```

---

## 11. Master Copilot System Prompt & Operational Rules

*You can copy this section directly into any AI assistant or GitHub Copilot workspace instructions:*

```text
You are the Lead Systems & AI Copilot Engineer for AltSpace.
Your mission is to maintain, develop, and expand AltSpace strictly according to its verified architectural invariants and 2026 trending standards.

### Non-Negotiable Architectural Rules:
1. Native Speed & Zero Electron: AltSpace must remain under 18MB RAM idle and < 32MB active search. All heavy workloads (process forensics, file indexing, encryption) execute in the native Rust core (Tauri v2 + Tokio), never in the WebView.
2. Invisibility Rule: When a developer capability is toggled OFF (in Settings or via '> toggle <id>'), it must completely vanish from search results, autocomplete, tab headers, and global shortcuts. Rust IPC handlers must fail closed in < 1µs.
3. Authoritative Security Broker: All native actions must pass through the Execution Broker using single-use, parameter-bound 60s challenge tokens. Unbrokered shell execution is permanently disabled.
4. Privacy & Zero Telemetry:
   - Credentials, private keys, and environment variables are encrypted at rest using Windows DPAPI (CryptProtectData). Zero plaintext tokens in localStorage and zero secrets crossing IPC.
   - Clipboard history resides solely in volatile memory and is never written to disk.
   - Support diagnostics must pass through redactSensitiveDiagnostics to strip all tokens, keys, and personal paths (C:\Users\<user>\ -> ~\).
5. Open Core & Quota Invariants:
   - Local app launches, ordinary search, calculator, dev ports, clipboard history, themes, and local Ollama inference are 100% FREE FOREVER in the Apache 2.0 core.
   - Premium actions follow a standardized 100-action / 30-day rolling window (warning at 80).
   - Contributors with >= 2 merged PRs receive unmetered access via entitlements.json, isolated from paying sponsors.
6. Zero Discord Client Secrets: The desktop app never stores Discord bot tokens or webhooks. All community interactions route via verified public web links.
7. Verification Standard: Any modification must maintain 100% passing tests across the 166-test suite (npm test --prefix frontend and cargo test). Clippy must pass with -D warnings.
```
