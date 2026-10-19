# AltSpace 1-Line Modern Windows Installer
# Usage: irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

Write-Host @"
    ___    __  __  _____                         
   /   |  / / / /_/ ___/____  ____ _________    
  / /| | / / / __/\__ \/ __ \/ __ `/ ___/ _ \   
 / ___ |/ / / /_ ___/ / /_/ / /_/ / /__/  __/   
/_/  |_/_/_/\__//____/ .___/\__,_/\___/\___/    
                    /_/                         
  Raycast-Speed Native Command Palette for Windows
"@ -ForegroundColor Cyan

$InstallDir = "$env:LOCALAPPDATA\Programs\AltSpace"
$BinaryPath = "$InstallDir\altspace.exe"
$Repo = "codecheesee/altspace"

Write-Host "`n[*] Installing AltSpace into $InstallDir..." -ForegroundColor Yellow

# 1. Terminate running instance if updating
Stop-Process -Name altspace -Force -ErrorAction SilentlyContinue

# 2. Create Target Directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 3. Download or Copy Release Binary
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/altspace.exe"
$LocalBin = "$PSScriptRoot\bin\altspace.exe"

if (Test-Path $LocalBin) {
    Write-Host "[*] Using local release binary: $LocalBin" -ForegroundColor Green
    Copy-Item $LocalBin $BinaryPath -Force
} else {
    Write-Host "[*] Fetching latest release binary from GitHub..." -ForegroundColor Green
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $BinaryPath -UseBasicParsing
    } catch {
        Write-Warning "Could not fetch directly from GitHub ($DownloadUrl). Please ensure repository release asset exists."
        exit 1
    }
}

# 4. Create Start Menu Shortcut
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\AltSpace"
if (!(Test-Path $StartMenuDir)) {
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$StartMenuDir\AltSpace.lnk")
$Shortcut.TargetPath = $BinaryPath
$Shortcut.Description = "AltSpace — Instant Command Palette for Windows"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Save()

# 5. Add to User PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$InstallDir", "User")
    Write-Host "[+] Added $InstallDir to user PATH" -ForegroundColor Green
}

# 6. Launch AltSpace in background
Write-Host "[+] Installation Complete! Launching AltSpace..." -ForegroundColor Green
Start-Process -FilePath $BinaryPath

Write-Host @"

  =======================================================
  🚀 AltSpace is running!
  • Summon Launcher:  Alt + Space (or Ctrl + Space)
  • Actions Drawer:   Ctrl + K
  • Themes & Modes:   Ctrl + Shift + T  or  type :theme
  • System Tray:      Check the taskbar tray icon!
  =======================================================
"@ -ForegroundColor Cyan
