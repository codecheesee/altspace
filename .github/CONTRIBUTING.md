# Contributing to AltSpace ⚡

Thank you for your interest in contributing to **AltSpace**! We are building a blazing-fast, keyboard-first developer HUD and launcher for Windows.

AltSpace is open-source and welcomes contributions of all kinds: bug fixes, new features, performance optimizations, documentation improvements, and custom plugins.

---

## 🧭 Codebase Architecture

AltSpace is built as a lightweight **Tauri v2** application:

```
altspace/
├── frontend/
│   ├── src/                  # React 19 + TypeScript + Tailwind CSS v4
│   │   ├── components/       # UI components (SearchTab, ClipboardTab, PortsTab, Modals)
│   │   ├── hooks/            # Search engine, plugins, and keybindings
│   │   └── lib/              # Frecency ranking, AI (Ollama), snippets, calc
│   └── src-tauri/            # Rust backend (Tauri v2 core)
│       └── src/              # Windows APIs, Everything IPC, SQLite frecency, ports, games
```

* **Backend (Rust)**: Handles native Windows APIs, global hotkeys (<kbd>Alt</kbd> + <kbd>Space</kbd>), IPC search, process & dev port inspection, in-memory clipboard monitor, and SQLite frecency database.
* **Frontend (TypeScript)**: Fast, glassmorphic HUD styled with **Tailwind CSS v4** and compiled with **Vite**.

---

## 🛠️ Local Development Setup

### Prerequisites
1. **Node.js**: v18 or later (Node 22+ recommended)
2. **Rust & Cargo**: Latest stable (1.80+)
3. **Tauri CLI**: (Optional if using `npm run tauri`)
4. **C++ Build Tools**: Visual Studio C++ Build Tools (required for compiling Windows native crates)

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
   *This starts the Vite dev server with Tailwind v4 HMR and launches the Rust/Tauri native window.*

4. **Run tests:**
   * Frontend:
     ```bash
     npm run build
     ```
   * Rust backend:
     ```bash
     cd src-tauri
     cargo test
     ```

---

## 💡 Ways to Contribute

### 1. Good First Issues
Look for issues labeled [`good first issue`](https://github.com/codecheesee/altspace/labels/good%20first%20issue). These are self-contained tasks perfect for getting familiar with the codebase.

### 2. Proposing a Plugin
AltSpace supports custom plugins in PowerShell and Python! If you have an idea for a plugin:
* Check existing plugins in `frontend/src/plugins/`.
* Open a [Plugin Proposal](https://github.com/codecheesee/altspace/issues/new?template=plugin_proposal.yml) to discuss ideas.

### 3. Reporting Bugs
If you find a bug:
* Search existing issues to ensure it hasn't been reported yet.
* Open a [Bug Report](https://github.com/codecheesee/altspace/issues/new?template=bug_report.yml) with your Windows version, reproduction steps, and any error logs.

### 4. Suggesting Features
Have an idea to make AltSpace faster or more useful?
* Open a [Feature Request](https://github.com/codecheesee/altspace/issues/new?template=feature_request.yml) or start a discussion in GitHub Discussions!

---

## 📋 Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names:
   * `feat/your-feature-name`
   * `fix/issue-description`
   * `docs/improvement`
2. **Pass All Tests**:
   * Ensure `cargo test` in `frontend/src-tauri` passes without errors.
   * Ensure `npm run build` in `frontend` compiles without TypeScript or Vite errors.
3. **Keep Commits Clean**: Write clear, descriptive commit messages.
4. **Submit PR**: Reference any related issue numbers (e.g., `Fixes #12`).

---

## 🌟 Recognition
All contributors are celebrated! Meaningful contributions are automatically credited in our README and release notes. Thank you for making AltSpace better for developers everywhere!
