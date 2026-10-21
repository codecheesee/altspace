# AltSpace — Technical Distribution and Release Communications Playbook

This playbook provides structured release communication templates and channel strategies for launching AltSpace across technical developer communities, including Twitter/X, Reddit, Hacker News, and Product Hunt.

---

## Technical Positioning Principles

Developer tools succeed through clear demonstration of friction reduction and architectural superiority:
1. **Direct Problem Elimination**: Immediate termination of hung dev servers and port collisions (`:3000` + <kbd>Enter</kbd> in under 4 seconds).
2. **Minimal Resource Overhead**: Pure Rust runtime executing in < 18MB RAM, contrasting with 350MB+ Electron alternatives.
3. **Sustainable Open-Core Model**: 20% of revenue dedicated to a public Contributor Treasury for open-source extension authors.

---

## 1. Twitter / X Launch Threads

Publish during core technical engagement windows: **Tuesday or Wednesday between 08:00 – 10:30 EST (17:30 – 20:00 IST)**.

### Thread 1: The 7-Second Silent Video Hook

* **Asset**: 7-second screen recording (1080p, 60fps).
* **Sequence**:
  - `0:00 - 0:02`: Terminal displays `Error: listen EADDRINUSE: address already in use :::3000`.
  - `0:02 - 0:04`: Hotkey `Alt + Space` invokes AltSpace. User types `:3000`.
  - `0:04 - 0:06`: Press <kbd>Enter</kbd>. Pill indicates: `Terminated node.exe (PID 18492)`.
  - `0:06 - 0:07`: Server restarts with successful listening status.

#### Post 1 (Primary Announcement)
```text
Dealing with zombie dev processes and port collisions on Windows?

AltSpace is an open-source, keyboard-first desktop command palette and launcher engineered in Rust and Tauri v2.

- Sub-5ms search latency
- Instant port inspection and termination (:3000 + Enter)
- Local AI via Model Context Protocol (MCP)
- Working set memory < 18MB RAM

100% Free Apache-2.0. Install via PowerShell:
irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex
```

#### Post 2 (Architecture Deep Dive)
```text
Technical highlights:
- Rust backend built on Tauri v2 and Tokio
- Direct Win32 RegisterHotKey integration for sub-5ms cold invocation
- SQLite frecency ranking engine with logarithmic time decay
- Offline-first execution with zero tracking or telemetry

Source code on GitHub:
https://github.com/codecheesee/altspace
```

#### Post 3 (Contributor Treasury Model)
```text
AltSpace introduces a 70/20/10 revenue model:
- 70% Core Maintainer Engineering
- 20% Contributor Bounty Treasury
- 10% Infrastructure & Code Signing

20% of all supporter licenses directly fund community feature bounties on GitHub Issues.
https://github.com/codecheesee/altspace/blob/main/TREASURY.md
```

---

## 2. Reddit Distribution Playbook

*Transparency Note*: Maintainers must disclose project authorship and respond with detailed technical answers to community questions.

### A. Subreddit: `r/webdev`

* **Title**: *AltSpace: Open-source Windows command palette built in Rust to solve dev port collisions and memory bloat*
* **Post Copy**:
```markdown
Hello r/webdev,

When working on Windows, common developer workflows often encounter unnecessary friction:
- Port collisions (`EADDRINUSE: 3000`) requiring manual Task Manager searches.
- Heavy launcher alternatives consuming 300MB–500MB of RAM.
- Cloud-dependent AI assistants leaking local clipboard context.

To solve this, we built **AltSpace**: a native Windows command palette written in Rust and Tauri v2.

Key Features:
1. **Instant Port Inspector**: Type `:3000` into the palette to inspect the process ID, listening status, and terminate hung dev servers in 3ms.
2. **Resource Efficiency**: Idles at ~18MB RAM by utilizing native Win32 APIs instead of Electron.
3. **Local AI Execution**: Connects to local Ollama models via Model Context Protocol (MCP) for private, offline assistance.
4. **User-Level Extension Engine**: Write extensions in PowerShell, Node.js, or Python with automated 15-second process timeout controls.

AltSpace is 100% free under the Apache 2.0 license. 20% of optional supporter revenue is deposited into a public GitHub bounty pool for community extension developers.

- GitHub Repository: https://github.com/codecheesee/altspace
- PowerShell Installer: `irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex`

Feedback and feature suggestions are welcome!
```

---

### B. Subreddit: `r/rust`

* **Title**: *AltSpace: Sub-5ms Windows Command Palette engineered with Rust, Tauri v2, and SQLite Frecency*
* **Post Copy**:
```markdown
Hi r/rust,

I would like to share AltSpace, an open-source spotlight launcher and command palette built specifically for Windows.

### System Architecture:
- **Tauri v2 + Tokio**: UI rendered via WebView2 using React 19 and Tailwind CSS v4, while indexing, port scanning, and process manipulation execute on asynchronous Tokio worker threads.
- **Frecency Engine**: Backed by embedded SQLite implementing temporal decay:
  Score = VisitCount * (1.0 / (1.0 + DecayFactor * HoursElapsed))
- **Win32 Message Loop**: Uses raw Win32 bindings (`RegisterHotKey`, `AttachThreadInput`, `ShellExecuteW`) for low-latency invocation and window management.
- **Process Safeguards**: User-level child script execution with strict path verification and automated job object termination timeouts.

The full test suite (39 Rust tests, 70 Node/security tests, 109 total automated tests) runs in CI. Feedback on memory optimization and Win32 safety invariants is appreciated.

Repository: https://github.com/codecheesee/altspace
Download / Landing Page: https://codecheesee.github.io/altspace/
```

---

### C. Subreddit: `r/windowsapps`

* **Title**: *AltSpace: A modern, lightweight spotlight launcher for Windows 11 (Apache 2.0, <18MB RAM)*
* **Post Copy**:
Focus on Windows 11 Fluent aesthetic consistency, dark mode integration, rapid application launching, and the absence of intrusive advertising or background telemetry.

---

## 3. Hacker News (Show HN)

* **Submission Title**: `Show HN: AltSpace – Open-source Raycast alternative for Windows with Local AI and Port Killer`
* **Target URL**: `https://github.com/codecheesee/altspace`
* **Author Comment**:
```text
Hello Hacker News,

We built AltSpace to provide a keyboard-driven productivity launcher for Windows that combines the speed and responsiveness of native tooling with open-source extensibility.

Technical Design:
1. Implemented in Rust and Tauri v2 to maintain an active working set under 18MB RAM.
2. Fast filesystem search via Everything SDK / native indexed search and in-memory fallback scanning, eliminating CPU-heavy indexing services.
3. Built-in developer tooling: real-time port inspection and termination, token-masked clipboard history, and local AI via Anthropic's Model Context Protocol (MCP).
4. Sustainable Open-Core Governance: The core app is Apache 2.0. For supporters who purchase an optional license, 20% of revenue is dedicated to public GitHub bounties for extension authors.

Code: https://github.com/codecheesee/altspace
Website / Download: https://codecheesee.github.io/altspace/
Direct Installer: https://github.com/codecheesee/altspace/releases/download/v2.0.0-preview/AltSpace-Setup-x64.exe

We welcome discussion regarding our plugin security architecture and system integration choices.
```

---

## 4. Product Hunt Launch Kit

| Specification | Content |
| :--- | :--- |
| **Product Name** | AltSpace |
| **Tagline** (<= 60 chars) | The modern extensible Raycast alternative for Windows |
| **License & Pricing** | Free (Apache 2.0) with optional Supporter License |
| **Categories** | Developer Tools, Open Source, Productivity, Windows |
| **Summary** | High-performance keyboard launcher for Windows. Sub-5ms search, developer port inspector, clipboard history, local MCP AI, and a 20% contributor treasury. |

### Maker's Comment
```markdown
Hello Product Hunt community,

We are launching **AltSpace**, an open-source, keyboard-first command center engineered specifically for Windows developers and power users.

Key Capabilities:
- **Instant Port Killer**: Type `:3000` to inspect and terminate hung development processes.
- **Minimal Footprint**: Native Rust core running in less than 18MB RAM.
- **Local AI (MCP)**: Execute natural language desktop commands via local Ollama models.
- **20% Contributor Treasury**: 20% of supporter revenue is allocated to public bounties for extension authors.

AltSpace is free and open-source under Apache 2.0. We look forward to your feedback and extension ideas!
```

---

## 5. Developer & Tech Influencer Outreach

Outreach script for technical content creators and systems software advocates:

```text
Subject: AltSpace: Open-source Windows command palette in Rust

Hi [Name],

I follow your work on developer tooling and software architecture.

We have open-sourced AltSpace (https://github.com/codecheesee/altspace), a native Windows command palette engineered with Rust and Tauri v2.

It addresses common friction points on Windows:
- Instant port termination (:3000 + Enter) without opening Task Manager
- Sub-5ms search latency and < 18MB RAM baseline consumption
- User-level extensions in PowerShell, Node.js, and Python with timeout protection
- 20% of supporter revenue dedicated to a public GitHub Contributor Treasury

AltSpace is licensed under Apache 2.0 with zero telemetry. We would welcome your thoughts on its architecture and performance.

Best regards,
Narayan Gorai
AltSpace Maintainer
```

---

## 6. Visual Asset Checklist

- [x] **OpenGraph Preview**: `landing/og-preview.svg` (1200 x 630 px)
- [x] **Application Icons**: `frontend/public/favicon.ico` and `frontend/public/favicon.svg`
- [ ] **Technical Demonstration Clip**: 7-second demo recording (1080p, 60fps)
- [ ] **Architecture Diagram**: Systems interaction schematic for technical documentation
