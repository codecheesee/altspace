# AltSpace — v2.0 Reliability, Security, Monetization, and Edge-Case Review

**Reviewed baseline:** `v1.0.3` upgraded to v2.0 architecture, zero-git authentication, entitlement boundary, and automated governance
**Review date:** October 2026
**Platform:** Windows 10/11 x64
**Scope:** Architecture boundaries, Lemon Squeezy entitlement contract, GitHub Device Flow identity, quota and trial enforcement, feedback automation, extension security, updater integrity, and test coverage.

---

## Executive Summary

AltSpace has completed a comprehensive architectural, security, and monetization overhaul. All contradictions identified across documentation, test suites, and implementation have been resolved with a single source of truth:

1. **Trial & Quota Single Source of Truth**: Centralized in `frontend/src/lib/quotaManager.ts`. Free forever for local app launching, ordinary search, calculator, Windows settings, port inspector, and clipboard. Premium actions (AI streaming, terminal commands, explicit multi-drive search) follow a **100 action allowance per rolling 30-day window**, with early warning at 80 actions and paywall at 100 actions.
2. **Provider-Neutral Entitlement Boundary**: Implemented in `frontend/src/lib/entitlementContract.ts`. Supports Lemon Squeezy HMAC-SHA256 signature verification, idempotency tracking, event state machine (`order_created`, `subscription_cancelled`, `subscription_expired`, `order_refunded`), and an 11-state client machine. Fails closed to Free tier on missing credentials or network errors.
3. **Zero-Git Identity**: RFC 8628 GitHub Device Flow implemented in `frontend/src/lib/authProvider.ts`. Users authenticate via browser device code without requiring local `git.exe` or credential manager.
4. **Decoupled Contributor Governance**: Contributor entitlement (`entitlements.json`) strictly requires $\ge 2$ merged pull requests and is quarantined in `contributors: []`, completely isolated from paying `sponsors: []`.
5. **Security & Wording Integrity**:
   - Extensions are explicitly documented and coded as **user-level privileged processes** (PowerShell, Node, Python) with path traversal validation and a 15-second timeout, removing false "sandboxed" claims.
   - Filesystem search is accurately specified as **Everything SDK / native indexed search plus an in-memory fallback scanner** (no direct MFT claims).
   - Release workflow (`.github/workflows/release.yml`) and `scripts/verify_release_artifacts.ps1` enforce SHA-256 checksums, minimum artifact sizes, and fail closed if Authenticode signing secrets are absent.

---

## Architectural & Security Hardening Details

### 1. Centralized Quota Engine (`quotaManager.ts`)
- Standardized 100 actions / 30-day rolling window with warning at 80.
- Replaced fragmented legacy limits (50/14 and 1,000/30).
- Pure classification function (`classifyPremiumAction`) ensures keystrokes, debounces, empty queries, and local actions never consume quota.
- In-memory idempotency cache (`consumePremiumAction`) ensures repeated in-flight requests or failed/cancelled requests are never billed.
- Role-based bypass: `Maintainer` (`@codecheesee`), `Pro`, `Supporter`, and `Contributor` receive unmetered access.

### 2. Commercial Boundary (`entitlementContract.ts` & `docs/LEMON_SQUEEZY_ENTITLEMENTS.md`)
- Client contains zero Lemon Squeezy API keys, webhook secrets, or signing keys.
- Webhook signature verification implemented with HMAC-SHA256 (`verifyLemonSqueezySignature`).
- Handles `order_refunded` with immediate revocation, `subscription_cancelled` with access maintained until period expiry, and `subscription_expired` with immediate downgrade to Free.
- Client state machine maps 11 distinct runtime states (`Free`, `ActiveSupporter`, `ActivePro`, `Expired`, `Refunded`, `CancelledActiveUntilExpiry`, `VerificationPending`, `VerificationUnavailable`, `CheckoutNotConfigured`, `OfflineGracePeriod`, `Revoked`).
- LocalStorage is treated as untrusted cache; authoritative paid state requires signed server validation.

### 3. Authentication & Zero-Git Identity (`authProvider.ts`)
- Implements RFC 8628 OAuth 2.0 Device Authorization Grant.
- Initiates `https://github.com/login/device/code`, copies user code, opens browser at verification URI, and polls access token with backoff.
- Retrieves GitHub user profile and cross-references against `entitlements.json`.
- Designed with modular `AuthProvider` interface for future SSO providers (Google Sign-In).

### 4. Community Feedback Automation (`FeedbackModal.tsx` & `.github/workflows/ingest-feedback.yml`)
- Modal captures user satisfaction rating (1-5 stars), category, description, and diagnostic telemetry (OS, architecture, app version).
- Automatically assigns triage labels:
  - 1-2 stars or bug report $\rightarrow$ `bug`
  - 4-5 stars with feature request $\rightarrow$ `enhancement` + `bounty-candidate`
- GitHub Actions workflow safely processes feedback dispatches using GitHub API and issues triage labels without exposing write tokens.

### 5. Extension & Filesystem Integrity
- Path traversal checks verify script files are canonicalized and reside inside `%LOCALAPPDATA%\AltSpace\plugins\`.
- Execution timeouts enforced via OS job objects (15 seconds).
- Clarified across UI and documentation that extensions run as privileged user-level code.
- Everything SDK FFI integration handles fast index queries, while in-memory recursive scanning serves as reliable fallback.

---

## Current Feature Assessment

| Feature | Status | Implementation Notes |
| :--- | :--- | :--- |
| **App & File Search** | Production Ready | In-memory L1 cache + Everything SDK L2 search + fallback scanner |
| **Frecency Ranking** | Production Ready | SQLite WAL mode, logarithmic time decay, 90-day pruning |
| **Port Inspector (`:port`)** | Production Ready | Enumerate listening ports, PID 0/4/self protection, process termination |
| **Clipboard History** | Production Ready | In-memory ring buffer, automatic token/key masking, zero disk persistence |
| **Local AI (MCP)** | Production Ready | Local Ollama streaming, mandatory explicit confirmation for shell actions |
| **Extension Runtime** | Production Ready | User-level process execution (.ps1, .js, .py), 15s timeout, path validation |
| **Licensing & Quota** | Production Ready | Centralized 100/80 30-day window, roles (Free, Supporter, Pro, Contributor, Maintainer) |
| **Identity & Auth** | Production Ready | RFC 8628 GitHub Device Flow (zero-git requirement) |
| **Feedback Automation** | Production Ready | Rating/review UI with auto-labeling GitHub workflow |
| **Release Verification** | Production Ready | SHA-256 validation, minimum artifact sizes, fail-closed Authenticode checks |

---

## Automated Test Verification

| Test Suite | File | Tests | Status |
| :--- | :--- | :--- | :--- |
| Quota & Trial Policy | `frontend/src/lib/quota.test.mjs` | 12 tests | **Passed** |
| Entitlements & Webhooks | `frontend/src/lib/entitlement.test.mjs` | 10 tests | **Passed** |
| First-Run & Privacy | `frontend/src/lib/firstRunPrivacy.test.mjs` | 8 tests | **Passed** |
| Bounty & Treasury Sync | `frontend/src/lib/bountySync.test.mjs` | 4 tests | **Passed** |
| Regional Pricing & Currency | `frontend/src/lib/checkout.test.mjs` | 5 tests | **Passed** |
| Launch Kit & Distribution Assets | `scripts/verify_launch_kit.test.mjs` | 4 tests | **Passed** |
| Rust Unit & Integration Tests | `frontend/src-tauri/src/*.rs` | 27 tests | **Passed** |

**Total Automated Coverage**: 43 Node.js test cases + 27 Rust test cases = 70 tests passing with zero failures.

---

## Final Verdict

The AltSpace repository is fully aligned across its code, tests, documentation, and CI workflows. Security boundaries fail closed, pricing and trial policies are strictly centralized, extensions and search capabilities are accurately described, and the release verification pipeline ensures artifact integrity before distribution.
