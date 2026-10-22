# AltSpace 2.2.0 Canonical Release Identity

> **Release Milestone:** 2.2.0  
> **Release Name:** AltSpace 2.2.0 — Security Hardening & Reliability Release  
> **Release Nature:** Security-focused major reliability release  
> **Target Platform:** Windows 10 & Windows 11 (x64, arm64)  
> **Application Identifier:** `com.altspace.launcher`

---

## 1. Unified Release Identity Specifications

| Attribute | Value | Verification Reference |
| :--- | :--- | :--- |
| **Release Version** | `2.2.0` | `frontend/src-tauri/Cargo.toml:3`, `frontend/package.json:4`, `frontend/src-tauri/tauri.conf.json:4` |
| **Release Tag** | `v2.2.0` | Proposed git tag (to be created upon final approval) |
| **Base Commit SHA** | `24c42c4f884b2d79d99357b135a5d6a01be225bf` | Branch `release/security-hardening-next` |
| **Installer Bundle** | `AltSpace-Setup-x64.exe` | Per-user NSIS package (`%LOCALAPPDATA%\Programs\AltSpace`) |
| **Enterprise Installer** | `AltSpace-MSI-x64.msi` | WiX MSI installer for Group Policy Active Directory deployment |
| **Portable Archive** | `AltSpace-Portable-x64.zip` | Standalone portable bundle with embedded `Everything64.dll` |
| **WinGet Identifier** | `codecheesee.altspace` | `distribution/winget/manifests/c/codecheesee/altspace/2.2.0/` |
| **WinGet Version** | `2.2.0` | `PackageVersion: 2.2.0` |
| **In-App Manifest** | `distribution/latest-release.json` | Version: `"2.2.0"` |
| **Product Registry** | `distribution/product-registry.json` | `currentVersion: "2.2.0"` |
| **PowerShell Installer** | `install.ps1` | `$FallbackTag = 'v2.2.0'` with Authenticode signature check |

---

## 2. Integrity & Manifest Consistency Audit

Every tracked manifest and configuration descriptor across the repository specifies identical version identity `2.2.0`:
- **Rust Backend (`Cargo.toml`)**: `2.2.0`
- **Frontend Core (`package.json`)**: `2.2.0`
- **Tauri Application Config (`tauri.conf.json`)**: `2.2.0`
- **Release Manifest (`latest-release.json`)**: `2.2.0`
- **Product Registry (`product-registry.json`)**: `2.2.0`
- **WinGet Manifests (`codecheesee.altspace.yaml`)**: `2.2.0`
- **In-App UI Version Indicators (`LicenseModal`, `DiagnosticsModal`, `UpdateModal`)**: `2.2.0`
- **GitHub Ingest Feedback (`ingest-feedback.yml`)**: `2.2.0`
- **WinGet Submission Workflow (`winget.yml`)**: `2.2.0`
- **PowerShell Installer Script (`install.ps1`)**: `v2.2.0`
