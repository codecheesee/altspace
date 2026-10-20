# AltSpace Windows Command Palette & Launcher Installer / Updater
# Usage: irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex

param(
    [switch]$LocalOnly,
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\AltSpace"
)

$ErrorActionPreference = 'Stop'
$Repo = 'codecheesee/altspace'
$BinaryPath = Join-Path $TargetDir 'altspace.exe'
$DllPath = Join-Path $TargetDir 'Everything64.dll'
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ("AltSpaceInstaller-" + [Guid]::NewGuid().ToString('N'))

Write-Host '===========================================================' -ForegroundColor DarkCyan
Write-Host ' AltSpace - Native Windows Command Palette & Launcher' -ForegroundColor Cyan
Write-Host '===========================================================' -ForegroundColor DarkCyan

function Get-ReleaseAsset([object]$Release, [string]$Name) {
    $asset = $Release.assets | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if (-not $asset) { throw "Release asset '$Name' was not found in the latest AltSpace release." }
    return $asset
}

function Get-ReleaseAssetByNames([object]$Release, [string[]]$Names) {
    foreach ($name in $Names) {
        $asset = $Release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
        if ($asset) { return $asset }
    }
    throw "None of the expected release assets were found: $($Names -join ', ')"
}

function Assert-Sha256([string]$FilePath, [string]$ChecksumPath, [string]$AssetName) {
    $line = Get-Content $ChecksumPath | Where-Object { $_ -match ("\s" + [regex]::Escape($AssetName) + "$") } | Select-Object -First 1
    if (-not $line -or $line -notmatch '^\s*([0-9a-fA-F]{64})\s+') {
        throw "No valid SHA-256 entry exists for '$AssetName'."
    }
    $expected = $Matches[1].ToLowerInvariant()
    $actual = (Get-FileHash $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "SHA-256 verification failed for '$AssetName'. Expected $expected but received $actual."
    }
}

try {
    Write-Host '[*] Stopping the existing AltSpace process, if present...' -ForegroundColor Yellow
    Stop-Process -Name altspace -Force -ErrorAction SilentlyContinue
    Stop-Process -Name raycast-windows -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800

    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

    $portableExe = Join-Path $TempRoot 'AltSpace-Portable.exe'
    $legacyExe = Join-Path $TempRoot 'altspace.exe'
    $portableZip = Join-Path $TempRoot 'AltSpace-Portable-x64.zip'
    $checksums = Join-Path $TempRoot 'SHA256SUMS.txt'

    $localBin = Join-Path $PSScriptRoot 'bin\altspace.exe'
    $localDll = Join-Path $PSScriptRoot 'bin\Everything64.dll'
    if ($LocalOnly) {
        if (-not (Test-Path $localBin)) { throw "Local binary was not found: $localBin" }
        Write-Host "[*] Installing local binary: $localBin" -ForegroundColor Green
        Copy-Item $localBin $BinaryPath -Force
        if (Test-Path $localDll) { Copy-Item $localDll $DllPath -Force }
    } else {
        Write-Host "[*] Resolving the latest verified GitHub release for $Repo..." -ForegroundColor Green
        $headers = @{ 'User-Agent' = 'AltSpace-Installer'; 'Accept' = 'application/vnd.github+json' }
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers
        $zipAsset = Get-ReleaseAssetByNames $release @('AltSpace-Portable-x64.zip', 'altspace-portable-x64.zip')
        $checksumAsset = Get-ReleaseAsset $release 'SHA256SUMS.txt'
        Invoke-WebRequest -Uri $zipAsset.browser_download_url -Headers $headers -OutFile $portableZip -UseBasicParsing
        Invoke-WebRequest -Uri $checksumAsset.browser_download_url -Headers $headers -OutFile $checksums -UseBasicParsing
        Assert-Sha256 $portableZip $checksums $zipAsset.name
        Expand-Archive -Path $portableZip -DestinationPath $TempRoot -Force
        if (Test-Path $portableExe) {
            Copy-Item $portableExe $BinaryPath -Force
        } elseif (Test-Path $legacyExe) {
            Copy-Item $legacyExe $BinaryPath -Force
        } else {
            throw 'Verified portable archive did not contain AltSpace-Portable.exe or altspace.exe.'
        }
        $extractedDll = Join-Path $TempRoot 'Everything64.dll'
        if (-not (Test-Path $extractedDll)) { throw 'Verified portable archive did not contain Everything64.dll.' }
        Copy-Item $extractedDll $DllPath -Force
    }

    $startMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\AltSpace'
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut((Join-Path $startMenuDir 'AltSpace.lnk'))
    $shortcut.TargetPath = $BinaryPath
    $shortcut.Description = 'AltSpace - Instant Command Palette for Windows'
    $shortcut.WorkingDirectory = $TargetDir
    $shortcut.Save()

    $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathEntries = @($currentPath -split ';' | Where-Object { $_ })
    if ($pathEntries -notcontains $TargetDir) {
        [Environment]::SetEnvironmentVariable('Path', (($pathEntries + $TargetDir) -join ';'), 'User')
    }

    Write-Host '[+] Installation verified. Starting AltSpace...' -ForegroundColor Green
    Start-Process -FilePath $BinaryPath -WorkingDirectory $TargetDir
    Write-Host "`nAltSpace is now running." -ForegroundColor Cyan
    Write-Host 'Default Hotkey: Alt + Space (or Ctrl + Space)' -ForegroundColor Gray
    Write-Host 'Action Drawer:  Ctrl + K' -ForegroundColor Gray
} catch {
    Write-Error "AltSpace installation failed: $_"
    exit 1
} finally {
    if (Test-Path $TempRoot) { Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
