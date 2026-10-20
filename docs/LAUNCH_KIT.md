# 🚀 AltSpace — 2026 Viral Distribution & Launch Playbook

> **The definitive multi-platform playbook for launching, distributing, and growing AltSpace across Twitter/X, Reddit, Hacker News, and Product Hunt while scaling the 20% Contributor Treasury.**

---

## 📌 Executive Distribution Philosophy

Most developer tools fail to distribute because they market "features" instead of **eliminating daily visceral friction**. 

AltSpace wins developers through three psychological hooks:
1. **The Instant Friction Killer**: Killing stuck `node.exe` or Docker ports in 4 seconds without touching Task Manager.
2. **The Economic Novelty**: 20% of all Supporter revenue automatically streams into a public GitHub bounty treasury for open-source contributors.
3. **Extreme Performance Respect**: < 18MB RAM and sub-5ms search in pure Rust, contrasting sharply with bloated 400MB Electron alternatives.

---

## 1. 🐦 Twitter / X Launch Threads

Post during peak tech hours: **Tuesday or Wednesday between 8:00 AM – 10:30 AM EST (5:30 PM – 8:00 PM IST)**.

### Thread 1: The 7-Second Silent Video Hook (High Virality)

* **Media Asset**: 7-second high-framerate screen recording (60fps, 1080p, 16:9 or 1:1, no audio or low lo-fi beat).
* **Video Action**:
  - `0:00 - 0:02`: Terminal shows `Error: listen EADDRINUSE: address already in use :::3000`.
  - `0:02 - 0:04`: Hit `Alt+Space`. AltSpace palette appears instantly. Type `:3000`.
  - `0:04 - 0:06`: Press `Enter`. Confirmation pill: `⚡ Terminated node.exe (PID 18492)`.
  - `0:06 - 0:07`: Rerun `npm run dev` $\rightarrow$ Server starts with green checkmarks.

#### Tweet 1 (Main Hook)
```text
Tired of opening Windows Task Manager just to kill node.exe?

We built AltSpace: a blazing-fast, open-source Raycast alternative for Windows in Rust.

• Sub-5ms search
• Dev port killer (`:3000` + Enter)
• Local AI via MCP
• Runs in < 18MB RAM

100% Free Apache-2.0. Install in 1-line 👇
```

#### Tweet 2 (The 1-Line Installer)
```text
Install right now in PowerShell (no installer wizard needed):

irm https://altspace.dev/install.ps1 | iex

Or grab the portable .msi from our GitHub releases:
🔗 https://github.com/codecheesee/altspace
```

#### Tweet 3 (The Contributor Treasury Angle)
```text
Here is the coolest part: open-source monetization is usually broken.

With AltSpace, 20% of every Supporter License ($12 or ₹299 in India) automatically funds our Public GitHub Bounty Treasury.

Want to get paid $25–$120 to build a Windows plugin?
Check our open issues:
🔗 https://github.com/codecheesee/altspace/issues?q=label%3Abounty
```

#### Tweet 4 (Behind the Architecture)
```text
Why does it feel so fast?

• Core engine in Rust + Tauri v2 (no Electron bloat)
• Raw Win32 API hooks for global hotkey & virtual desktop snapping
• Local SQLite with time-decay frecency ranking
• 0 telemetry, 100% offline-first

Drop a ⭐ if you believe Windows deserves better developer tooling!
```

---

### Thread 2: "Open Source Monetization is Broken" (Narrative / Philosophy)

#### Tweet 1
```text
Most open-source maintainers burnout while VC-backed apps put basic features behind $20/month paywalls.

We are testing a new model with AltSpace:

70% to Founder
20% to Contributor Bounty Treasury
10% to Infrastructure Reserve

Here is how everyone gets paid in 2026 🧵👇
```

#### Tweet 2
```text
1/ The Problem:
Contributors submit amazing PRs, fix nasty edge cases, or write plugins — and get nothing except a thank-you emoji.

2/ The Mechanism:
Every time a user buys an AltSpace Supporter key (₹299/yr in India, $12/yr Global via Purchasing Power Parity), 20% enters the Treasury pool.
```

#### Tweet 3
```text
3/ Bounties are tracked directly on GitHub Issues:
• Small bug fix: ₹1,000 / $12
• Standard extension (e.g. Docker, Spotify, Linear): ₹3,500 / $42
• Major core feature: ₹10,000 / $120

When your PR is merged, your bounty is paid out instantly via Polar / Open Collective with proper tax invoices.
```

#### Tweet 4
```text
You can inspect the live Treasury balance right inside the app settings or on our repo:
👉 https://github.com/codecheesee/altspace/blob/main/TREASURY.md

Let's build a sustainable ecosystem together.
```

---

## 2. 👾 Reddit Distribution Playbook

> ⚠️ **Reddit Rules**: Always disclose that you are the author. Never post direct affiliate links. Answer every comment with genuine technical humility.

### A. Subreddit: `r/webdev`

* **Title**: *I built an open-source Raycast alternative for Windows in Rust because I was sick of zombie node.exe processes*
* **Flair**: `Showoff Saturday` or `Tool / Resource`
* **Body Draft**:
```markdown
Hey r/webdev,

Like many of you, I switch between Mac and Windows. On macOS, Raycast is the first tool I install. On Windows, while PowerToys Run and Flow Launcher exist, I kept missing a few specific developer workflows:

1. **The Zombie Port Killer**: Typing `kill-port 3000` or opening Task Manager when Vite crashes with `EADDRINUSE` is annoying. In AltSpace, you press `Alt+Space`, type `:3000`, hit enter, and the process is killed.
2. **Memory Footprint**: Raycast isn't on Windows, and Electron-based launchers often consume 300–500MB of RAM. AltSpace is built with Rust and Tauri v2, idling around 18MB of RAM.
3. **Local AI via MCP**: You can query local Ollama models or Claude through the Model Context Protocol without sending snippets to third-party servers.

It's 100% open-source under Apache 2.0. We also stream 20% of supporter license revenues into a public GitHub bounty treasury for community contributors.

- **GitHub**: https://github.com/codecheesee/altspace
- **Install (PowerShell)**: `irm https://altspace.dev/install.ps1 | iex`

I'd love feedback on what developer extensions you'd like to see next!
```

---

### B. Subreddit: `r/rust`

* **Title**: *AltSpace: Building a sub-5ms Spotlight Launcher on Windows using Rust, Tauri v2, and SQLite Frecency*
* **Flair**: `Project`
* **Body Draft**:
```markdown
Hi r/rust!

Over the last few months, I've been building AltSpace, an open-source launcher and productivity palette for Windows.

### Architectural Highlights:
- **Tauri v2 + Tokio**: Frontend rendered with modern React 19 / Tailwind v4 via WebView2, while all system operations (file indexing, port scanning, clipboard crypto) happen across non-blocking Tokio workers in Rust.
- **Frecency Engine**: Uses an in-memory SQLite store implementing Mozilla-style logarithmic time decay:
  `Score = VisitCount * (1.0 / (1.0 + DecayFactor * HoursElapsed))`
- **Win32 Hotkey Resilience**: Uses `RegisterHotKey` with custom message loops to ensure `Alt+Space` fires with sub-5ms latency without dropping keystrokes.
- **Memory Consumption**: Binary size ~14MB, active working set ~18MB.

All 26 unit and integration tests run in CI. Feedback and PRs welcome!

GitHub: https://github.com/codecheesee/altspace
```

---

### C. Subreddit: `r/windowsapps` & `r/pcmasterrace`

* **Title**: *AltSpace: A clean, bloat-free Spotlight Launcher for Windows 11 (Apache 2.0, <18MB RAM)*
* **Body Draft**:
Focus on Windows 11 Fluent design aesthetics, dark mode polish, offline-first security, and comparing responsiveness with legacy Windows Start Menu search.

---

## 3. 🌐 Hacker News (Show HN)

* **Submission Title**: 
  `Show HN: AltSpace – Open-source Raycast alternative for Windows with Local AI and Port Killer`
* **URL**: `https://github.com/codecheesee/altspace`
* **First Comment Draft**:
```text
Hi HN,

I built AltSpace because I wanted a keyboard-driven launcher for Windows that feels as cohesive and snappy as Raycast on macOS, but with an open ecosystem and zero telemetry.

Key technical decisions:
1. Built with Rust and Tauri v2 to keep baseline memory consumption around 18MB (versus 350MB+ for typical Electron wrappers).
2. SQLite-backed frecency algorithm with temporal decay so your most-used commands stay at the top.
3. Built-in developer utilities: instantaneous port inspection and killing (`:8080`), local encrypted clipboard history, and local AI integration using Anthropic's Model Context Protocol (MCP).
4. Sustainability model: AltSpace is Apache 2.0. For supporters who purchase an optional license (₹299 in India / $12 globally), 20% of proceeds automatically fund a public GitHub bounty pool for open-source extension authors.

Code: https://github.com/codecheesee/altspace
Landing: https://altspace.dev

I would love to hear your thoughts on the plugin security model and any Windows-specific friction you'd like to see solved.
```

---

## 4. 😸 Product Hunt Launch Kit

| Field | Content |
|---|---|
| **Product Name** | AltSpace |
| **Tagline** (<= 60 chars) | The modern extensible Raycast alternative for Windows |
| **Pricing** | Free (Apache 2.0) with optional Supporter License |
| **Topics** | Developer Tools, Open Source, Productivity, Windows |
| **Short Description** | Blazing-fast keyboard launcher for Windows. Sub-5ms search, dev port killer, clipboard history, local AI (MCP), and a 20% community bounty treasury. |

### Maker's First Comment on Product Hunt:
```markdown
Hello Product Hunt community! 👋

If you do web or software development on Windows, you know the pain:
- Stuck ports stopping your dev servers (`EADDRINUSE`)
- Slow, bloated search tools eating 500MB of RAM
- No simple way to trigger local AI workflows from the keyboard

We built **AltSpace** to solve this. It's written in Rust, runs in 18MB of RAM, and pops up in under 5 milliseconds.

🌟 **Top Features:**
- ⚡ **Instant Port Killer**: Type `:3000` to find and kill stuck processes in 1 keypress.
- 📋 **Encrypted Clipboard History**: Search recent snippets safely without cloud leakage.
- 🧠 **Local AI Integration**: Connect to Ollama or Claude via Model Context Protocol.
- 🤝 **20% Contributor Treasury**: 20% of every supporter purchase goes directly to GitHub contributors building extensions.

AltSpace is 100% free and open-source under Apache 2.0. Check it out and let us know your favorite shortcut!
```

---

## 5. 📧 Developer & Tech Influencer Outreach

Send via Twitter DM or business email to creators covering developer productivity (Theo, Fireship, ThePrimeagen, Kevin Stratvert, Tech With Tim):

```text
Subject: Open-source Raycast for Windows in Rust (with an instant port killer)

Hey [Name],

Huge fan of your content on developer tooling. 

Quick heads up: we just open-sourced AltSpace (https://github.com/codecheesee/altspace) — an extensible Raycast alternative built for Windows in Rust & Tauri v2.

It solves the classic "EADDRINUSE: port 3000" headache directly from the launcher (`Alt+Space` -> `:3000` -> Enter kills the process). It idles in < 18MB RAM and has zero telemetry.

We also do something unique with economics: 20% of all supporter proceeds go straight into a public GitHub bounty pool for developers building extensions.

No pitch, just thought you or your audience might enjoy a native, high-performance Windows tool. Happy to share a lifetime supporter key if you'd like to test it out!

Best,
[Your Name / @codecheesee]
```

---

## 6. 🖼️ Visual Asset Checklist & Dimensions

- [x] **OpenGraph Preview**: `landing/og-preview.svg` (1200 x 630 px)
- [x] **Favicons & Icons**: `frontend/public/favicon.ico` & `frontend/public/favicon.svg`
- [ ] **Demo Video / GIF**: 7-second demo recorded with OBS or ScreenToGif (1080p, 60fps)
- [ ] **Feature Screenshots**:
  - `01-launcher-ports.png`: Active `:3000` port killer with terminal background
  - `02-clipboard-search.png`: Clipboard history with syntax highlighting
  - `03-treasury-modal.png`: Live GitHub bounty treasury modal in Settings

---

*Verified for the 2026 Developer Tooling Ecosystem • Apache 2.0 License*
