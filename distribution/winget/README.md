# Winget Distribution Guide for AltSpace

This directory contains the official [Windows Package Manager (winget)](https://github.com/microsoft/winget-pkgs) manifests for AltSpace.

## 1. Test Manifest Locally

To verify that the manifest installs AltSpace cleanly on Windows without submission:

```powershell
winget install --manifest distribution/winget/manifests/c/codecheesee/altspace/2.2.0/
```

## 2. Submit to Official Microsoft `winget-pkgs`

Once verified, you can submit AltSpace to Microsoft's global catalog using `wingetcreate`:

### Step 1: Install `wingetcreate`
```powershell
winget install Microsoft.WingetCreate
```

### Step 2: Submit with GitHub Token
```powershell
wingetcreate submit `
  --token <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN> `
  https://github.com/codecheesee/altspace/releases/download/v2.2.0/AltSpace-Setup-x64.exe
```

Or clone `microsoft/winget-pkgs`, copy `distribution/winget/manifests/c/codecheesee/altspace/2.2.0/` into `manifests/c/codecheesee/altspace/2.2.0/`, and open a Pull Request.

Once merged by Microsoft's automated CI, anyone worldwide can install AltSpace with:
```powershell
winget install codecheesee.altspace
```
