# Contributing to AltSpace

Thank you for contributing to **AltSpace**. AltSpace is an open-source, keyboard-first desktop command palette and spotlight launcher for Windows, engineered in Rust and React.

All contributions to this repository are licensed under the **Apache License 2.0**.

---

## 1. Code Contribution Workflow

1. **Issue Selection**: Review existing issues or open a new discussion detailing the feature request or bug report.
2. **Fork and Branch**: Create a feature branch off `main` using descriptive naming (e.g. `feat/virtual-desktop-api`, `fix/mft-query-escape`).
3. **Automated Verification**:
   - Ensure the TypeScript frontend compiles cleanly and passes all 103 tests:
     ```bash
     cd frontend
     npm test
     npm run build
     ```
   - Ensure all 78 native Rust unit and integration tests pass:
     ```bash
     cd frontend/src-tauri
     cargo test
     ```
4. **Pull Request Submission**: Provide a concise summary of changes, reproduction steps for bug fixes, and benchmark results for performance-critical modifications.

---

## 2. Extension Architecture & Phase 3 Roadmap

AltSpace supports language-agnostic extension discovery. In v2.2.0, external script execution (.ps1, .bat, .cmd, .py, .js) is temporarily paused with BlockedForMigration status while we finalize the Phase 3 Signed Extension platform with cryptographic manifest verification.

### Extension Directory Structure

Each extension resides within an isolated subdirectory in `%LOCALAPPDATA%\AltSpace\plugins\<extension-id>\`:

```text
%LOCALAPPDATA%\AltSpace\plugins\<extension-id>/
├── manifest.json
└── run.ps1 (or run.js / run.py / run.bat)
```

### Manifest Specification (`manifest.json`)

```json
{
  "id": "dns-flusher",
  "name": "Flush DNS Cache",
  "description": "Clears the Windows DNS resolver cache to resolve network stale routes",
  "keyword": ":dns",
  "script": "flush.ps1",
  "icon": "globe",
  "author": "Your Name",
  "authorGithub": "yourusername",
  "sponsorUrl": "https://github.com/sponsors/yourusername"
}
```

### Security and Runtime Invariants

1. **Path Confinement**: All extension scripts must reside strictly within their designated directory. Path traversal attempts (e.g. `../`) are rejected by the Rust loader.
2. **Containment Safeguards**: External script and binary executions are blocked in the Rust backend to prevent workstation privilege escalation until the sandboxed, cryptographically signed extension engine arrives in Milestone 2.3.0.
3. **Preserved Manifests**: Existing plugins remain fully preserved and inspectable in safe read-only mode.
4. **Creator Attribution**: Authors may include their `sponsorUrl` in `manifest.json`. The in-app store renders direct sponsorship links with 0% platform fee.

---

## 3. Contributor Treasury and Bounty Program

AltSpace reserves 20% of all Supporter License revenue in a public Contributor Treasury to fund community feature development:

- Active bounties are tagged with the [`bounty`](https://github.com/codecheesee/altspace/issues?q=is%3Aissue+is%3Aopen+label%3Abounty) label on GitHub Issues.
- To claim a bounty, comment on the issue with an implementation proposal.
- Upon review and merge of the pull request, bounty disbursements are executed via Polar.sh / Open Collective with automated tax compliance (W-8BEN, Form 1099, Indian PAN/TDS).

For complete economic guidelines, refer to [**TREASURY.md**](../TREASURY.md).
