# AltSpace Windows Command Palette & Launcher Installer / Updater
# Usage: irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex

param(
    [switch]$LocalOnly,
    [string]$Tag = '',
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\AltSpace"
)

$ErrorActionPreference = 'Stop'
$TargetDir = $TargetDir.Trim()
$Repo = 'codecheesee/altspace'
$FallbackTag = 'v2.0.0'
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

function Safe-CopyFile([string]$Source, [string]$Destination) {
    if (Test-Path $Destination) {
        try {
            Copy-Item -Path $Source -Destination $Destination -Force -ErrorAction Stop
            return
        } catch {
            # File may be held or locked. Rename old file and replace.
            $oldFile = "$Destination.old." + [Guid]::NewGuid().ToString('N').Substring(0, 8)
            try {
                Move-Item -Path $Destination -Destination $oldFile -Force -ErrorAction Stop
                Copy-Item -Path $Source -Destination $Destination -Force -ErrorAction Stop
                Remove-Item -Path $oldFile -Force -ErrorAction SilentlyContinue
                return
            } catch {
                throw "Failed to update '$Destination'. Ensure AltSpace is closed and try again. Error: $_"
            }
        }
    } else {
        Copy-Item -Path $Source -Destination $Destination -Force
    }
}

try {
    $isUpdate = $false
    $existingVersion = $null

    if (Test-Path $BinaryPath) {
        $isUpdate = $true
        try {
            $existingVersion = (Get-Item $BinaryPath).VersionInfo.ProductVersion
        } catch {}
    }

    $runningProcesses = Get-Process -Name altspace, raycast-windows -ErrorAction SilentlyContinue
    if ($runningProcesses) {
        $isUpdate = $true
        Write-Host '[*] Active AltSpace instance detected. Stopping process for update...' -ForegroundColor Yellow
        Stop-Process -Name altspace -Force -ErrorAction SilentlyContinue
        Stop-Process -Name raycast-windows -Force -ErrorAction SilentlyContinue

        # Grace period for OS handle release
        $timeout = [DateTime]::UtcNow.AddSeconds(4)
        while ([DateTime]::UtcNow -lt $timeout) {
            $remaining = Get-Process -Name altspace, raycast-windows -ErrorAction SilentlyContinue
            if (-not $remaining) { break }
            Start-Sleep -Milliseconds 250
        }
    }

    if ($isUpdate) {
        if ($existingVersion) {
            Write-Host "[*] Updating existing AltSpace installation (v$existingVersion) at $TargetDir..." -ForegroundColor Green
        } else {
            Write-Host "[*] Updating existing AltSpace installation at $TargetDir..." -ForegroundColor Green
        }
        Write-Host '[*] Preserving your user settings, shortcuts, extensions, and vaults.' -ForegroundColor Gray
    } else {
        Write-Host "[*] Installing fresh AltSpace into $TargetDir..." -ForegroundColor Green
    }

    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

    $portableExe = Join-Path $TempRoot 'AltSpace-Portable.exe'
    $legacyExe = Join-Path $TempRoot 'altspace.exe'
    $portableZip = Join-Path $TempRoot 'AltSpace-Portable-x64.zip'
    $checksums = Join-Path $TempRoot 'SHA256SUMS.txt'

    if ($LocalOnly) {
        $baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
        $localBin = Join-Path $baseDir 'bin\altspace.exe'
        $localDll = Join-Path $baseDir 'bin\Everything64.dll'
        if (-not (Test-Path $localBin)) {
            $distBin = Join-Path $baseDir 'dist_artifacts\altspace.exe'
            if (Test-Path $distBin) {
                $localBin = $distBin
                $localDll = Join-Path $baseDir 'dist_artifacts\Everything64.dll'
            } else {
                throw "Local binary was not found at '$localBin'."
            }
        }
        Write-Host "[*] Installing local binary from: $localBin" -ForegroundColor Green
        Safe-CopyFile -Source $localBin -Destination $BinaryPath
        if (Test-Path $localDll) { Safe-CopyFile -Source $localDll -Destination $DllPath }
    } else {
        Write-Host "[*] Resolving the latest verified GitHub release for $Repo..." -ForegroundColor Green
        $headers = @{ 'User-Agent' = 'AltSpace-Installer'; 'Accept' = 'application/vnd.github+json' }
        $release = $null

        if ($Tag) {
            try {
                $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$Tag" -Headers $headers -ErrorAction Stop
            } catch {}
        } else {
            try {
                $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases?per_page=5" -Headers $headers -ErrorAction Stop
                if ($releases -and $releases.Count -gt 0) { $release = $releases[0] }
            } catch {}
            if (-not $release) {
                try {
                    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers -ErrorAction Stop
                } catch {}
            }
        }

        if ($release) {
            Write-Host "[*] Selected release: $($release.tag_name) ($($release.name))" -ForegroundColor Cyan
            $zipAsset = Get-ReleaseAssetByNames $release @('AltSpace-Portable-x64.zip', 'altspace-portable-x64.zip')
            $checksumAsset = Get-ReleaseAsset $release 'SHA256SUMS.txt'
            Invoke-WebRequest -Uri $zipAsset.browser_download_url -Headers $headers -OutFile $portableZip -UseBasicParsing
            Invoke-WebRequest -Uri $checksumAsset.browser_download_url -Headers $headers -OutFile $checksums -UseBasicParsing
            Assert-Sha256 $portableZip $checksums $zipAsset.name
        } else {
            # Fallback to direct asset download if GitHub API rate-limited
            Write-Host "[*] GitHub API rate-limited or unavailable. Using direct release CDN ($FallbackTag)..." -ForegroundColor Yellow
            $zipUrl = "https://github.com/$Repo/releases/download/$FallbackTag/AltSpace-Portable-x64.zip"
            $checksumUrl = "https://github.com/$Repo/releases/download/$FallbackTag/SHA256SUMS.txt"
            Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $portableZip -UseBasicParsing
            Invoke-WebRequest -Uri $checksumUrl -Headers $headers -OutFile $checksums -UseBasicParsing
            Assert-Sha256 $portableZip $checksums 'AltSpace-Portable-x64.zip'
        }

        Expand-Archive -Path $portableZip -DestinationPath $TempRoot -Force
        if (Test-Path $portableExe) {
            Safe-CopyFile -Source $portableExe -Destination $BinaryPath
        } elseif (Test-Path $legacyExe) {
            Safe-CopyFile -Source $legacyExe -Destination $BinaryPath
        } else {
            throw 'Verified portable archive did not contain AltSpace-Portable.exe or altspace.exe.'
        }
        $extractedDll = Join-Path $TempRoot 'Everything64.dll'
        if (-not (Test-Path $extractedDll)) { throw 'Verified portable archive did not contain Everything64.dll.' }
        Safe-CopyFile -Source $extractedDll -Destination $DllPath
    }

    # Clean up any leftover .old files in target directory
    Get-ChildItem -Path $TargetDir -Filter '*.old.*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # Start Menu Shortcut
    $startMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\AltSpace'
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut((Join-Path $startMenuDir 'AltSpace.lnk'))
    $shortcut.TargetPath = $BinaryPath
    $shortcut.Description = 'AltSpace - Instant Command Palette for Windows'
    $shortcut.WorkingDirectory = $TargetDir
    $shortcut.Save()

    # Desktop Shortcut
    $desktopDir = [Environment]::GetFolderPath('Desktop')
    if (Test-Path $desktopDir) {
        $desktopShortcut = $wshShell.CreateShortcut((Join-Path $desktopDir 'AltSpace.lnk'))
        $desktopShortcut.TargetPath = $BinaryPath
        $desktopShortcut.Description = 'AltSpace - Instant Command Palette for Windows'
        $desktopShortcut.WorkingDirectory = $TargetDir
        $desktopShortcut.Save()
    }

    # User PATH registration
    $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathEntries = @($currentPath -split ';' | Where-Object { $_ })
    if ($pathEntries -notcontains $TargetDir) {
        [Environment]::SetEnvironmentVariable('Path', (($pathEntries + $TargetDir) -join ';'), 'User')
    }

    if ($isUpdate) {
        Write-Host '[+] AltSpace updated successfully! Launching updated version...' -ForegroundColor Green
    } else {
        Write-Host '[+] AltSpace installed successfully! Launching...' -ForegroundColor Green
    }

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
