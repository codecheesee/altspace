# AltSpace Windows Command Palette & Launcher Installer / Updater
# Usage: irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex

param(
    [switch]$LocalOnly,
    [string]$Tag = '',
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\AltSpace",
    [string]$ExpectedPublisher = 'Codecheesee',
    [switch]$AllowUnsigned = $false
)

$ErrorActionPreference = 'Stop'
$TargetDir = $TargetDir.Trim()
$Repo = 'codecheesee/altspace'
$FallbackTag = 'v2.3.1'
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

function Assert-Authenticode([string]$FilePath, [string]$Publisher = '', [switch]$AllowUnsigned) {
    if (-not (Test-Path $FilePath -PathType Leaf)) {
        throw "Binary not found for Authenticode verification: $FilePath"
    }

    if (-not (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue)) {
        Import-Module Microsoft.PowerShell.Security -ErrorAction SilentlyContinue
    }

    $sig = Get-AuthenticodeSignature -FilePath $FilePath
    if ($sig.Status -eq 'Valid') {
        if ($Publisher) {
            $subject = $sig.SignerCertificate.Subject
            if ($subject -notmatch [regex]::Escape($Publisher)) {
                throw "Authenticode publisher mismatch for '$(Split-Path $FilePath -Leaf)'. Expected publisher matching '$Publisher' but found '$subject'. Installation aborted for security."
            }
        }
        Write-Host "[+] Authenticode signature verified for $(Split-Path $FilePath -Leaf) (Publisher: $($sig.SignerCertificate.Subject))" -ForegroundColor Green
        return
    }

    if ($sig.Status -in 'NotSigned', 'UnknownError') {
        Write-Host "[-] Notice: Binary '$(Split-Path $FilePath -Leaf)' is not Authenticode signed. Verified by cryptographic SHA-256 checksum." -ForegroundColor Yellow
        return
    }

    throw "Authenticode signature validation failed for '$(Split-Path $FilePath -Leaf)'. Status: $($sig.Status), Message: $($sig.StatusMessage). Installation aborted for security."
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

    $processNames = @("altspace", "AltSpace-Portable")
    $runningProcesses = Get-Process -Name $processNames -ErrorAction SilentlyContinue
    if ($runningProcesses) {
        $isUpdate = $true
        Write-Host "[*] Active AltSpace instance detected. Stopping process for update..." -ForegroundColor Yellow
        $runningProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        & taskkill.exe /F /IM altspace.exe /IM AltSpace-Portable.exe 2>$null | Out-Null

        # Grace period for OS handle release
        $timeout = [DateTime]::UtcNow.AddSeconds(4)
        while ([DateTime]::UtcNow -lt $timeout) {
            $remaining = Get-Process -Name $processNames -ErrorAction SilentlyContinue
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
        Assert-Authenticode -FilePath $localBin -Publisher $ExpectedPublisher -AllowUnsigned:$AllowUnsigned
        Safe-CopyFile -Source $localBin -Destination $BinaryPath
        if (Test-Path $localDll) { Safe-CopyFile -Source $localDll -Destination $DllPath }
    } else {
        Write-Host "[*] Resolving latest verified AltSpace release..." -ForegroundColor Green
        $headers = @{ "User-Agent" = "AltSpace-Installer"; "Accept" = "application/json" }
        $resolvedTag = $Tag
        $manifest = $null

        # 1. Query static CDN manifest first (instant, 0 rate limit)
        $manifestUrls = @(
            "https://codecheesee.github.io/altspace/latest-release.json",
            "https://raw.githubusercontent.com/codecheesee/altspace/main/distribution/latest-release.json"
        )
        if (-not $resolvedTag) {
            foreach ($mUrl in $manifestUrls) {
                try {
                    $manifest = Invoke-RestMethod -Uri $mUrl -Headers $headers -TimeoutSec 4 -ErrorAction Stop
                    if ($manifest -and $manifest.version) {
                        $resolvedTag = if ($manifest.version.StartsWith("v")) { $manifest.version } else { "v$($manifest.version)" }
                        Write-Host "[*] Resolved version from CDN manifest: $resolvedTag" -ForegroundColor Cyan
                        break
                    }
                } catch {}
            }
        }

        # 2. Query GitHub Releases API with short timeout if CDN unavailable
        if (-not $resolvedTag) {
            try {
                $ghRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers -TimeoutSec 4 -ErrorAction Stop
                if ($ghRelease -and $ghRelease.tag_name) {
                    $resolvedTag = $ghRelease.tag_name
                }
            } catch {}
        }

        # 3. Fallback to pinned verified tag if rate-limited or offline
        if (-not $resolvedTag) {
            $resolvedTag = $FallbackTag
            Write-Host "[-] Using verified fallback release ($resolvedTag)..." -ForegroundColor Yellow
        }

        $zipUrl = "https://github.com/$Repo/releases/download/$resolvedTag/AltSpace-Portable-x64.zip"
        $checksumUrl = "https://github.com/$Repo/releases/download/$resolvedTag/SHA256SUMS.txt"
        Write-Host "[*] Downloading AltSpace package ($resolvedTag)..." -ForegroundColor Green
        Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $portableZip -UseBasicParsing
        Invoke-WebRequest -Uri $checksumUrl -Headers $headers -OutFile $checksums -UseBasicParsing
        Assert-Sha256 $portableZip $checksums "AltSpace-Portable-x64.zip"
        Expand-Archive -Path $portableZip -DestinationPath $TempRoot -Force
        $selectedExe = $null
        if (Test-Path $portableExe) {
            $selectedExe = $portableExe
        } elseif (Test-Path $legacyExe) {
            $selectedExe = $legacyExe
        } else {
            throw 'Verified portable archive did not contain AltSpace-Portable.exe or altspace.exe.'
        }
        Assert-Authenticode -FilePath $selectedExe -Publisher $ExpectedPublisher -AllowUnsigned:$AllowUnsigned
        Safe-CopyFile -Source $selectedExe -Destination $BinaryPath
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
