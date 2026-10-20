# AltSpace Windows Command Palette & Launcher Installer / Updater
# Usage: irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex

param(
    [switch]$LocalOnly,
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\AltSpace"
)

$ErrorActionPreference = 'Stop'

Write-Host "===========================================================" -ForegroundColor DarkCyan
Write-Host " AltSpace - Native Windows Command Palette & Launcher" -ForegroundColor Cyan
Write-Host " Architecture: Rust Core (Tauri v2) | License: Apache-2.0" -ForegroundColor Gray
Write-Host "===========================================================" -ForegroundColor DarkCyan

$BinaryPath = "$TargetDir\altspace.exe"
$Repo = "codecheesee/altspace"

Write-Host "[*] Terminating existing AltSpace instances..." -ForegroundColor Yellow
Stop-Process -Name altspace -Force -ErrorAction SilentlyContinue
Stop-Process -Name raycast-windows -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

# 1. Create Target Directory
if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# 2. Resolve Binary (Local or Remote Release)
$LocalBin = "$PSScriptRoot\bin\altspace.exe"
$LocalDll = "$PSScriptRoot\bin\Everything64.dll"
$DllPath = "$TargetDir\Everything64.dll"

if ((Test-Path $LocalBin) -and ($LocalOnly -or -not $PSScriptRoot -eq "")) {
    Write-Host "[*] Installing from local repository binary: $LocalBin" -ForegroundColor Green
    Copy-Item $LocalBin $BinaryPath -Force
    if (Test-Path $LocalDll) {
        Copy-Item $LocalDll $DllPath -Force
    }
} else {
    Write-Host "[*] Downloading verified release from GitHub ($Repo)..." -ForegroundColor Green
    $PrimaryUrl = "https://github.com/$Repo/releases/latest/download/altspace.exe"
    $FallbackUrl = "https://github.com/$Repo/releases/download/v1.0.1/altspace.exe"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $PrimaryUrl -OutFile $BinaryPath -UseBasicParsing
    } catch {
        Write-Host "[!] Primary latest endpoint redirected. Attempting release tag fallback..." -ForegroundColor Yellow
        try {
            Invoke-WebRequest -Uri $FallbackUrl -OutFile $BinaryPath -UseBasicParsing
        } catch {
            Write-Error "Failed to download AltSpace binary: $_"
            exit 1
        }
    }

    # Download required Win32 DLL dependency (NTFS MFT file indexing engine)
    Write-Host "[*] Resolving Win32 dependencies (Everything64.dll)..." -ForegroundColor Green
    $DllUrl = "https://raw.githubusercontent.com/$Repo/main/bin/Everything64.dll"
    try {
        Invoke-WebRequest -Uri $DllUrl -OutFile $DllPath -UseBasicParsing
    } catch {
        Write-Warning "Failed to fetch Everything64.dll from repository: $_"
    }
}

# 3. Create / Update Start Menu Shortcut
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\AltSpace"
if (!(Test-Path $StartMenuDir)) {
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$StartMenuDir\AltSpace.lnk")
$Shortcut.TargetPath = $BinaryPath
$Shortcut.Description = "AltSpace - Instant Command Palette for Windows"
$Shortcut.WorkingDirectory = $TargetDir
$Shortcut.Save()

# 4. Configure User PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$TargetDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$TargetDir", "User")
    Write-Host "[+] Registered $TargetDir in User PATH" -ForegroundColor Green
}

# 5. Launch AltSpace in Background
Write-Host "[+] Installation verified. Starting AltSpace..." -ForegroundColor Green
Start-Process -FilePath $BinaryPath

Write-Host "`nAltSpace is now running." -ForegroundColor Cyan
Write-Host "Default Hotkey: Alt + Space (or Ctrl + Space)" -ForegroundColor Gray
Write-Host "Action Drawer:  Ctrl + K" -ForegroundColor Gray
Write-Host "Updates:        Type ':update' into AltSpace anytime or re-run this script." -ForegroundColor Gray
