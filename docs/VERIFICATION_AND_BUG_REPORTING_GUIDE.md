# AltSpace 2.2.0: Verification, Testing & Bug Reporting Guide

This guide provides developers, QA testers, and contributors with a step-by-step procedure to inspect all features of AltSpace, verify production binaries, run test suites, update documentation, and report bugs.

---

## Part 1: Automated Verification & Test Suites

AltSpace maintains a 100% passing automated test suite consisting of **166 tests** across the Rust backend, TypeScript frontend, and distribution validation scripts.

### 1.1 Run Full Verification in One Command
Open PowerShell from the repository root:

```powershell
# 1. Run all 88 frontend, security, and launch kit tests
npm test --prefix frontend

# 2. Run all 78 native Rust unit and integration tests
cargo test --manifest-path frontend/src-tauri/Cargo.toml

# 3. Verify compiled release distribution artifacts
powershell -ExecutionPolicy Bypass -File scripts/verify_release_artifacts.ps1
```

### 1.2 Verify Production Binary Builds
To re-compile and bundle release artifacts from scratch:

```powershell
# Build frontend static bundle
npm run build --prefix frontend

# Compile release Rust binary and generate NSIS & MSI installers
Set-Location frontend
cargo tauri build
Set-Location ..

# Assemble and verify dist_artifacts folder
powershell -ExecutionPolicy Bypass -File scripts/prepare_dist.ps1
powershell -ExecutionPolicy Bypass -File scripts/verify_release_artifacts.ps1
```

The resulting validated artifacts will be located in `dist_artifacts/`:
- `AltSpace-Setup-x64.exe` (NSIS per-user installer)
- `AltSpace-MSI-x64.msi` (Enterprise WiX MSI installer)
- `AltSpace-Portable-x64.zip` (Standalone portable bundle)
- `SHA256SUMS.txt` (Cryptographic verification checksums)

---

## Part 2: Interactive Smoke Testing Checklist

Follow this checklist to interactively test each subsystem in either development mode (`npm run tauri dev --prefix frontend`) or using the installed release binary (`AltSpace-Setup-x64.exe`).

### 1. Unified Capability Matrix & Hybrid Toggles
- [ ] **Option A (Settings)**:
  - Press <kbd>Ctrl</kbd>+<kbd>,</kbd> to open Settings.
  - Scroll to the **Capability Matrix** section.
  - Notice the circuit-breaker pill (`Healthy` in green).
  - Toggle off a capability (e.g., *Offline Developer Transforms*).
- [ ] **Invisibility Rule Verification**:
  - Close Settings with <kbd>Esc</kbd>.
  - Type `jwt` in the Omnibar.
  - **Expected**: No JWT transform card appears in search results or autocomplete.
  - Return to Settings and re-enable it. Type `jwt` again &mdash; the transform studio immediately appears.
- [ ] **Option C (Omnibar Hot-Toggle)**:
  - Type `> toggle developer_transforms` in the Omnibar and press <kbd>Enter</kbd>.
  - Notice the inline toast notification confirming state change.

### 2. Intelligent Port & Process Recovery
- [ ] Open the Omnibar and type `:port` (or press <kbd>Alt</kbd>+<kbd>P</kbd>).
- [ ] Click on any listening port (or type a specific port like `:5173` or `:3000`).
- [ ] Check the right forensic drawer:
  - Verify that the process ancestry tree shows parent PID and process name (e.g., `cmd.exe` &rarr; `node.exe`).
  - Verify project tag detection (looks for `package.json` in working directory).
- [ ] Click **"Free & Verify Port"**:
  - Notice the loading spinner as it invokes `kill_and_verify_port`.
  - Verify that the TCP table is verified post-kill before displaying the green confirmation badge.

### 3. Native Developer Transform Toolkit
- [ ] **JWT Inspector**:
  - Type `jwt` in the Omnibar.
  - Paste any sample JWT (e.g., `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsdFNwYWNlIERldmVsb3BlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`).
  - Verify formatted JSON payload, algorithm pill (`HS256`), and expiration status.
- [ ] **JSON &harr; YAML Studio**:
  - Type `json` or `yaml`.
  - Type `{"name": "AltSpace", "version": 2}` and click **"Convert to YAML"**.
  - Click **"Convert to JSON"** to test reverse transformation.
- [ ] **Regex Lab**:
  - Type `regex`.
  - Enter pattern `([A-Z]+)-(\d+)` and test string `ALT-2026`.
  - Verify matched substrings and capture groups are highlighted.
- [ ] **UUID & Hash**:
  - Type `uuid` &rarr; verify a valid UUID v4 is generated with 1-click copy.
  - Type `hash` &rarr; enter text and verify SHA-256 and MD5 outputs match standard calculations.

### 4. DPAPI Secret & Environment Switcher
- [ ] Open Settings with <kbd>Ctrl</kbd>+<kbd>,</kbd>.
- [ ] Under **Secure Profile Vault**, select or create a profile (`staging` or `prod`).
- [ ] Add a key-value pair (e.g. `API_SECRET` = `super_secret_token_123`).
- [ ] Click the eye icon to test masking / unmasking.
- [ ] Save profile &mdash; verify keys are encrypted with Windows DPAPI.
- [ ] Verify that launching a terminal command with the profile injects the variable into the child process without writing to disk.

### 5. Docker + WSL2 Environment Cockpit
- [ ] Type `docker` in the Omnibar:
  - If Docker Desktop is active: Verify container list, Compose project badges, image tags, and port bindings.
  - Click a container &rarr; verify in-place logs viewer and restart button.
- [ ] Type `wsl` in the Omnibar:
  - Verify installed Linux distributions, running state, and WSL version.
  - Check the `vmmemWSL` Hyper-V RAM monitor.
  - Click **"Reclaim WSL Memory"** &rarr; verify approval confirmation prompt appears before running `wsl.exe --shutdown`.

### 6. Private Local Copilot & Multi-Step Approved Actions
- [ ] **Deterministic Plan Invocation**:
  - Type `? fix 5173` in the Omnibar.
  - Verify that an **Action Plan Preview** card opens in the right preview pane with numbered steps, risk tier badges (`AlwaysApprove`), and targets.
  - Click **"Approve & Execute"** &rarr; observe real-time step execution pills and completion status.
  - Click **"Rollback Plan"** &rarr; verify action rollback is triggered via the Action Capability Broker.
- [ ] **WSL Memory Plan**:
  - Type `? reclaim memory` &rarr; verify step structure targeting `wsl.exe --shutdown`.
- [ ] **Shell Failure Auto-Recovery**:
  - In Omnibar, execute a failing command (e.g., `> powershell -c "exit 42"`).
  - Open Omnibar and type `?` &rarr; verify that the diagnosis engine pulls the failure context from the volatile ring buffer.
- [ ] **BYOK Key Management**:
  - Open Settings (<kbd>Ctrl</kbd>+<kbd>,</kbd>).
  - Under **Local Copilot & Action Broker**, switch provider to **Anthropic Claude** or **OpenAI**.
  - Enter a test key and click **Save to Hardware Vault** &rarr; verify it saves to DPAPI.

---

## Part 3: How to Update and Maintain Documentation

When you add new capabilities, modify commands, or resolve bugs, follow these steps to keep documentation synchronized:

### 3.1 Documentation File Roles
| File | Role | What to update when changing code |
| :--- | :--- | :--- |
| `README.md` | Primary landing documentation for GitHub visitors | Add new subsystems, omnibar syntax rows, and updated test counts. |
| `docs/FEATURE_MATRIX.md` | Commercial, security, and offline boundaries | Update Layer A vs Layer B classification and risk tiers. |
| `docs/THREAT_MODEL.md` | Security and IPC attack surface analysis | Document new Tauri IPC handlers, input sanitizers, or DPAPI keys. |
| `docs/LAUNCH_KIT.md` | Release distribution and store copy | Update feature bullets, version tags, and download URLs. |
| `landing/index.html` | Official website landing page | Update feature cards, code snippets, and release download links. |

### 3.2 Updating Command Syntax & Hotkeys
Whenever adding an Omnibar prefix (e.g., `:mytool` or `> mycommand`):
1. Add the syntax row to `## Command Palette Syntax` in `README.md`.
2. Update the capability matrix table in `docs/FEATURE_MATRIX.md`.
3. If the command involves a new test, ensure `npm test --prefix frontend` reflects the new test count.

### 3.3 Synchronizing Website & Landing Pages
When updating `landing/index.html`:
1. Maintain OpenGraph meta tags: ensure `<meta property="og:image" content="./og-preview.svg" />` is preserved.
2. Run `node scripts/verify_launch_kit.test.mjs` to ensure the landing page conforms to social card and tagline specifications.
3. If updating root `index.html` or `docs/index.html`, keep them aligned with `landing/index.html`.

---

## Part 4: Standardized Bug Reporting Template

If you encounter an issue during testing, copy this template to document the bug clearly:

```markdown
### Bug Report: [Short descriptive title]

**Subsystem**: [e.g. Intelligent Ports / Docker WSL / DPAPI Vault / Action Planner / Hybrid Toggles]
**Environment**:
- Windows OS Version: [e.g. Windows 11 Pro 23H2 / 24H2]
- AltSpace Version: [e.g. 2.2.0 (Git commit hash or installer)]
- Model Lane: [e.g. Local Ollama / Anthropic BYOK / OpenAI BYOK / Deterministic Fast Path]

**Steps to Reproduce**:
1. Summon AltSpace with Alt+Space.
2. Type `...` into the Omnibar.
3. Click on `...`.

**Expected Behavior**:
[What you expected to happen]

**Actual Behavior**:
[What actually happened, including any error messages or console logs]

**Log Output / Context**:
- Console error (from DevTools Ctrl+Shift+I):
  ```
  [Paste error here]
  ```
- Privacy Diagnostics export (Ctrl+Shift+D):
  ```
  [Paste sanitized diagnostics report here]
  ```

**Severity**:
- [ ] Critical (Crash, data corruption, security regression)
- [ ] High (Feature non-functional, UI freeze)
- [ ] Medium (Incorrect output, cosmetic glitch, animation stutter)
- [ ] Low (Typo, minor layout alignment)
```
