# Contributing to AltSpace

Thank you for your interest in contributing to **AltSpace**! We are building a blazing-fast, keyboard-first developer command center and launcher for Windows.

AltSpace is open-source under the **Apache 2.0 License** and welcomes contributions of all kinds: building extensions, fixing bugs, performance optimizations, and documentation.

---

## 💎 The Contributor Bounty Program

We believe developers should be rewarded for building useful software. We allocate **20% of all Supporter License revenue into our Public Feature Bounty Treasury**.

### How to Earn Bounties:
1. **Find an Open Bounty**: Look for issues labeled [`bounty:open`](https://github.com/codecheesee/altspace/labels).
2. **Claim It**: Leave a comment stating you are working on the issue with a brief plan of your technical approach. A maintainer will assign it to you.
3. **Submit Your PR**: Reference the issue (e.g., `Resolves #42`).
4. **Get Paid**: Once your PR is reviewed and merged into `main`, the cash bounty (typically ₹2,000–₹10,000 / $25–$120) is automatically disbursed to your bank or Stripe via [Polar.sh](https://polar.sh) / GitHub Sponsors!

*For full details on the economic model, read [**TREASURY.md**](../TREASURY.md).*

---

## 🔌 Building an AltSpace Extension

AltSpace features a decoupled, sandboxed extension system. Anyone can write an extension using **PowerShell (`.ps1`)**, **Batch (`.bat`/`.cmd`)**, **Python (`.py`)**, or **Node.js (`.js`)**.

### Extension Directory Structure

Each extension lives in its own folder under `%LOCALAPPDATA%\AltSpace\plugins\<plugin-id>\`:

```
%LOCALAPPDATA%\AltSpace\plugins\my-extension/
├── manifest.json
└── run.ps1 (or run.js / run.py)
```

### Manifest Specification (`manifest.json`)

```json
{
  "id": "wifi-cleaner",
  "name": "Wi-Fi Profile Cleaner",
  "description": "Removes stale and unused Wi-Fi network profiles",
  "keyword": ":wificlean",
  "script": "clean.ps1",
  "icon": "network",
  "author": "Your Name",
  "authorGithub": "yourusername",
  "sponsorUrl": "https://github.com/sponsors/yourusername"
}
```

### Security & Sandboxing Rules

1. **Path Boundary**: All scripts must reside strictly inside their designated plugin directory. Path escapes (e.g. `../`) are rejected by the Rust backend.
2. **15-Second Hard Timeout**: Scripts that run longer than 15 seconds are automatically terminated via `taskkill` to prevent CPU lockups.
3. **Allowed Extensions**: Scripts must have `.ps1`, `.bat`, `.cmd`, `.py`, or `.js` extension. Raw executables (`.exe`) are not permitted in extensions.
4. **Direct Creator Tipping**: Include your `sponsorUrl` in `manifest.json`. AltSpace displays a direct **"Tip Creator"** button on your extension card in the in-app Store, and you keep 100% of all community donations.

---

## 🛠️ Local Development Setup

### Prerequisites
1. **Node.js**: v20 or later (Node 22 recommended)
2. **Rust & Cargo**: Latest stable (1.80+)
3. **Visual Studio C++ Build Tools**: Required for Windows native headers

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/codecheesee/altspace.git
   cd altspace/frontend
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run tauri dev
   ```
   *This starts the Vite dev server with Tailwind v4 and opens the native AltSpace window.*

4. **Run tests before opening a PR:**
   * Frontend (React 19 + TypeScript + Tailwind v4):
     ```bash
     npm run build
     ```
   * Rust backend (26 unit and integration tests):
     ```bash
     cd src-tauri
     cargo test
     ```

---

## 📋 Pull Request Guidelines

1. **Branch Naming**:
   - `feat/extension-name`
   - `fix/issue-description`
   - `docs/improvement`
2. **Clean Commits**: Write descriptive commit messages explaining *why* a change was made.
3. **Test Integrity**: All automated tests (`cargo test` and `npm run build`) must pass cleanly with 0 errors and 0 warnings.
4. **No Low-Effort PRs**: We do not merge automated AI spam or 1-line trivial edits for bounties. Ensure your code adds real value for users.
