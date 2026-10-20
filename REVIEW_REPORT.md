# AltSpace — v1.0.2 Reliability, Security, and Edge-Case Review

**Reviewed commit:** `e0d23c1` (`v1.0.2`)  
**Review date:** October 20, 2026  
**Platform:** Windows 10/11 x64  
**Scope:** Latest UI redesign, tray lifecycle, security-sensitive commands, plugins, updater, process handling, tests, and feature boundaries.

## Executive summary

The v1.0.2 UI redesign builds successfully and the existing frontend and Rust test suites pass. The reported tray quit failure was confirmed and fixed: the application was globally preventing every `ExitRequested` event, including the explicit tray menu exit action. Explicit quit now sets an exit state before calling `app.exit(0)`, while ordinary window close continues to hide the palette to the tray.

The hardening pass also adds mandatory confirmation for AI-routed shell commands, a 30-second timeout with process-tree cleanup for direct PowerShell execution, stricter plugin path and manifest validation, semantic update-version comparison, and safer port-process checks. Remote extensions without a SHA-256 script digest are now deferred rather than installed.

The application is in a substantially better state, but updater artifact signing and a full end-to-end UI/runtime test harness remain follow-up work. The local supporter license remains a client-side cosmetic entitlement and must not be treated as authorization.

## Changes implemented

### Tray and application lifecycle

**Root cause:** `frontend/src-tauri/src/lib.rs` used:

```rust
if let tauri::RunEvent::ExitRequested { api, .. } = event {
    api.prevent_exit();
}
```

This prevented both normal close requests and explicit tray exits. The tray menu correctly called `app.exit(0)`, but the global handler vetoed it.

**Fix:**

- Added managed `ExitState(AtomicBool)`.
- Tray menu `quit` sets the explicit-exit flag before calling `app.exit(0)`.
- Global `ExitRequested` handling only prevents exit when the request was not explicitly initiated.
- Ordinary window close still calls `prevent_close()` and hides the window.

Expected behavior:

| Action | Result |
|---|---|
| Close palette window | Hides to tray |
| Click tray icon | Shows/hides palette |
| Select **Exit AltSpace** from tray menu | Terminates process |
| Global hotkey after hide | Summons existing instance |
| Second process launch | Signals existing process and exits |

### AI and shell execution

- AI-routed shell commands now require an explicit confirmation modal.
- Confirmation supports `Run command`, `Cancel`, `Escape`, and `Enter`.
- No browser `alert()` or `prompt()` is used.
- Missing confirmation capability fails closed.
- User cancellation returns an explicit error result.
- The MCP command uses the registered `execute_shell_command` IPC identifier.
- Direct PowerShell execution now has a 30-second timeout.
- Timed-out commands are terminated with `taskkill /F /T /PID`.

This confirmation applies to AI/MCP execution. The explicit terminal command feature (`>` queries) remains a user-invoked developer tool and is not routed through the AI confirmation path.

### Plugin safety

- Plugin manifest script names must be single filenames without separators or traversal segments.
- Plugin scanning ignores manifests with invalid script filenames.
- Plugin execution now fails closed if canonicalization of either the script or plugin directory fails.
- Submitted manifest script name must match the submitted filename.
- Remote registry entries are accepted only when they include a valid 64-character SHA-256 digest.
- Remote script content is hashed in the frontend before installation.
- Built-in extensions remain installable without a remote digest.
- Remote extension installation is deferred when integrity metadata is absent or mismatched.

### Updater and version handling

- Update comparison now uses numeric semantic version components.
- Downgrades and equal versions no longer appear as available updates.
- Added regression coverage for newer, equal, and older versions.

The updater still uses the existing PowerShell installer flow. Release artifact signatures/checksums are not yet present, so the updater should not be described as cryptographically verified.

### Process safety

- Port termination rejects PID 0, PID 4, and the current AltSpace process.
- Existing protected-process denylist remains in place for critical Windows services.
- Port scan tests no longer assume that at least one listening port exists.
- Tests now validate sorting and duplicate elimination instead of depending on host state.

## Current feature assessment

| Feature | Status | Notes |
|---|---|---|
| App and file search | Working | Cached L1 search plus Everything-backed L2 search |
| Frecency ranking | Working | SQLite WAL mode, 90-day pruning, migration path |
| Clipboard history | Working | In-memory history and secret classification |
| Port inspector | Working | Process enumeration and protected termination |
| Window snapping | Working | Win32 foreground-window tracking |
| Games | Working | Steam/Epic/common-directory discovery; low-priority complexity |
| Extensions | Working with restrictions | Built-ins work; unsigned remote scripts are deferred |
| Local Ollama AI | Working | Streaming responses and local action intents |
| AI shell execution | Hardened | Explicit confirmation plus timeout |
| Supporter licensing | Working as local entitlement | Not a server-enforced authorization boundary |
| Self-update | Working with integrity limitation | Version comparison hardened; artifact signing remains |
| Tray lifecycle | Fixed | Explicit exit now bypasses hide-to-tray behavior |

## Edge cases reviewed

- Empty search and no-result states
- Queries beginning with `:`, `?`, `>`, `!`, and `ai:`
- Stale asynchronous search responses
- Empty listening-port lists
- Duplicate port/PID results
- Protected Windows process termination
- Current-process termination
- Plugin path traversal and symlink/canonicalization failures
- Manifest/script filename mismatch
- Plugin timeout cleanup
- Equal-version and downgrade update responses
- Missing Ollama service
- Missing cached applications
- Missing remote registry data
- Clipboard secret classification
- Local license expiration and storage fallback
- Ordinary window close versus explicit application exit

## Validation performed

| Check | Result |
|---|---|
| `npm run build` | Passed |
| Frontend TypeScript check | Passed |
| Vite production bundle | Passed |
| Node tests | 13 passed |
| Rust tests | 27 passed |
| `cargo clippy --all-targets --all-features -- -D warnings` | Passed |
| `git diff --check` | Passed |

The Rust suite increased from 26 to 27 tests due to updater version-comparison coverage.

## Remaining risks and recommended follow-up

1. **Release integrity:** publish SHA-256 checksums and Authenticode signatures, then verify them before applying updates.
2. **Remote plugin trust:** move from unsigned registry metadata to signed manifests or a trusted package-signing key.
3. **Runtime integration tests:** add a Windows UI test that opens the tray menu, selects Exit, and verifies process termination.
4. **Shell policy:** consider adding a command audit log and a stricter policy for high-impact commands even after confirmation.
5. **License semantics:** keep supporter status cosmetic unless validation moves to signed, server-issued entitlements.
6. **Silent failures:** replace remaining broad empty catches with structured logs and user-visible diagnostics where the failure affects functionality.
7. **Accessibility:** add automated keyboard/focus tests for modals, listbox navigation, and the shell confirmation dialog.

## Final verdict

The reported tray quit defect is fixed at its root cause, not worked around. The current build and test baseline is clean, and the highest-risk AI shell path now fails closed without explicit user approval. The application is suitable for continued beta testing, but signed release artifacts and signed remote extensions should be completed before positioning the distribution pipeline as fully trusted.
