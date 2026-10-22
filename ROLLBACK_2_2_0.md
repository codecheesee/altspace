# AltSpace 2.2.0 — Emergency Rollback Package

**Document ID:** `ROLLBACK_2_2_0`  
**Target Release:** `v2.2.0`  
**Purpose:** Precise, step-by-step procedure to revert release 2.2.0 in the event of an unexpected regression or deployment defect.

---

## 1. General Rollback Procedure

If a critical flaw is identified immediately after merging or tagging, execute the following staged rollback sequence. Do not delete Git history prematurely.

### Local Branch Rollback
```powershell
# 1. Ensure working directory is on main
git checkout main

# 2. Identify the commit hash prior to the merge (commit 691ea1f65476e9dd94236eccc02298a29a7490fc)
# Option A: Revert the merge commit (recommended for public branches)
git revert -m 1 HEAD -m "revert: rollback 2.2.0 release merge due to emergency incident"

# Option B: Reset branch (only if main was NOT yet pushed to remote)
# git reset --hard 691ea1f65476e9dd94236eccc02298a29a7490fc
```

---

## 2. Git Tag Rollback

If the `v2.2.0` tag was created and pushed to GitHub:

### Delete Tag Locally and Remotely
```powershell
# 1. Delete the local tag
git tag -d v2.2.0

# 2. Delete the remote tag on GitHub
git push origin :refs/tags/v2.2.0
```

---

## 3. GitHub Release Rollback

If the automated GitHub Actions CI workflow completed and published a GitHub Release for `v2.2.0`:

### Unpublish or Mark as Draft
```powershell
# 1. Using GitHub CLI to delete the release
gh release delete v2.2.0 --yes

# 2. Or using GitHub CLI to edit release to draft status (preserving asset downloads for forensic inspection)
# gh release edit v2.2.0 --draft
```

---

## 4. WinGet Package Rollback

If the WinGet package submission was dispatched or submitted to `microsoft/winget-pkgs`:

### Rollback WinGet Submission
1. **GitHub Action Cancel:** If `.github/workflows/winget.yml` is in progress, cancel the active workflow run:
   ```powershell
   gh run cancel $(gh run list --workflow=winget.yml --limit 1 --json databaseId --jq '.[0].databaseId')
   ```
2. **Pull Request Retraction:** If a PR was automatically created against `microsoft/winget-pkgs`:
   - Navigate to the PR opened on `microsoft/winget-pkgs`.
   - Close the PR with the reason: `Retracting release v2.2.0 due to maintainer rollback`.
3. **Emergency Fix PR:** If the PR was already merged into `microsoft/winget-pkgs`:
   - Submit an immediate PR reverting the manifest directory `manifests/c/codecheesee/altspace/2.2.0/` or submitting a patch `2.2.1` that re-establishes stable baseline binaries.

---

## 5. Documentation & Distribution Manifest Rollback

If static documentation portals or distribution manifests (`latest-release.json`, `product-registry.json`) were updated on GitHub Pages:

### Revert Manifests to Stable 2.1.0 Baseline
```powershell
# 1. Revert distribution manifest files
git checkout 691ea1f65476e9dd94236eccc02298a29a7490fc -- distribution/latest-release.json distribution/product-registry.json

# 2. Revert portal files
git checkout 691ea1f65476e9dd94236eccc02298a29a7490fc -- landing/index.html docs/index.html index.html install.ps1

# 3. Commit and push rollback documentation
git commit -m "chore(rollback): restore distribution manifests to v2.1.0 baseline"
git push origin main
```
