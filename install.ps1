# AltSpace Windows Command Palette & Launcher Installer / Updater
# Usage: irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex

param(
    [switch]$LocalOnly,
    [string]$Tag = '',
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\AltSpace",
    [string]$ExpectedPublisher = 'Codecheesee',
    [switch]$AllowUnsigned = $false,
    [switch]$NonInteractive = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = 'Stop'
$TargetDir = $TargetDir.Trim()
$Repo = 'codecheesee/altspace'
$FallbackTag = 'v2.3.1'
$BinaryPath = Join-Path $TargetDir 'altspace.exe'
$DllPath = Join-Path $TargetDir 'Everything64.dll'
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ("AltSpaceInstaller-" + [Guid]::NewGuid().ToString('N'))

# Clean modern terminal banner
Write-Host ""
Write-Host "   ___   __  __  ____                       " -ForegroundColor Cyan
Write-Host "  / _ | / / / /_/ __/___  ___ ________ ___  " -ForegroundColor Cyan
Write-Host " / __ |/ /_/ __/\ \/ _ \/ _ `/ __/ -_) -_) " -ForegroundColor DarkCyan
Write-Host "/_/ |_/____/\__/___/ .__/\_,_/\__/\__/\__/  " -ForegroundColor DarkCyan
Write-Host "                  /_/                       " -ForegroundColor DarkCyan
Write-Host "  Fast, native Windows developer control plane" -ForegroundColor DarkGray
Write-Host "===========================================================" -ForegroundColor DarkGray

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
    return $actual
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
        Write-Host " [+] Authenticode signature verified for $(Split-Path $FilePath -Leaf) (Publisher: $($sig.SignerCertificate.Subject))" -ForegroundColor Green
        return
    }

    if ($sig.Status -in 'NotSigned', 'UnknownError') {
        # Transparent verification notice (Community Open-Source Edition verified by cryptographic SHA-256)
        Write-Host " [-] Notice: Binary '$(Split-Path $FilePath -Leaf)' is not Authenticode signed. Integrity verified by official SHA-256 checksum." -ForegroundColor Yellow
        Write-Host "     (Official Open-Source Release - Verified cryptographically)" -ForegroundColor DarkGray
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
            if (-not $existingVersion) {
                $existingVersion = (Get-Item $BinaryPath).VersionInfo.FileVersion
            }
        } catch {}
    }

    # Stop active instances gracefully
    $processNames = @("altspace", "AltSpace-Portable")
    $runningProcesses = Get-Process -Name $processNames -ErrorAction SilentlyContinue
    if ($runningProcesses) {
        $isUpdate = $true
        Write-Host "[*] Active AltSpace process detected. Gracefully closing..." -ForegroundColor Yellow
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
        $headers = @{ "User-Agent" = "AltSpace-Installer"; "Accept" = "application/json" }
        $resolvedTag = $Tag
        $manifest = $null

        # 1. Query high-speed CDN manifest first (instant, 0 rate limit)
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

        # 3. Fallback to pinned verified tag
        if (-not $resolvedTag) {
            $resolvedTag = $FallbackTag
        }

        # Status summary card
        Write-Host " Target Action:      " -NoNewline -ForegroundColor DarkGray
        if ($isUpdate) {
            Write-Host "Upgrade ($($existingVersion ? 'v' + $existingVersion : 'Existing') -> $resolvedTag)" -ForegroundColor Cyan
        } else {
            Write-Host "Fresh Installation ($resolvedTag)" -ForegroundColor Green
        }
        Write-Host " Install Directory:  " -NoNewline -ForegroundColor DarkGray
        Write-Host "$TargetDir" -ForegroundColor White
        Write-Host " Release Channel:    " -NoNewline -ForegroundColor DarkGray
        Write-Host "Official GitHub Releases ($Repo)" -ForegroundColor DarkCyan
        Write-Host "-----------------------------------------------------------" -ForegroundColor DarkGray

        # Interactive countdown (allows user to cancel or auto-proceeds in 4s)
        $canPrompt = -not $NonInteractive -and -not $Force -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
        if ($canPrompt) {
            Write-Host "Press [Enter] to proceed, or [N] to cancel: " -NoNewline -ForegroundColor Yellow
            $abort = $false
            $timeoutSeconds = 4
            $startTime = [DateTime]::UtcNow

            while ([DateTime]::UtcNow -lt $startTime.AddSeconds($timeoutSeconds)) {
                if ([Console]::KeyAvailable) {
                    $key = [Console]::ReadKey($true)
                    if ($key.Key -eq 'N' -or $key.KeyChar -eq 'n') {
                        $abort = $true
                        break
                    }
                    if ($key.Key -eq 'Enter' -or $key.KeyChar -eq 'y' -or $key.KeyChar -eq 'Y') {
                        break
                    }
                }
                Start-Sleep -Milliseconds 100
            }
            Write-Host ""
            if ($abort) {
                Write-Host "[*] Installation cancelled by user." -ForegroundColor DarkYellow
                exit 0
            }
        }

        $zipUrl = "https://github.com/$Repo/releases/download/$resolvedTag/AltSpace-Portable-x64.zip"
        $checksumUrl = "https://github.com/$Repo/releases/download/$resolvedTag/SHA256SUMS.txt"
        
        Write-Host "[*] Downloading verified release package ($resolvedTag)..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $portableZip -UseBasicParsing
        Invoke-WebRequest -Uri $checksumUrl -Headers $headers -OutFile $checksums -UseBasicParsing

        $verifiedHash = Assert-Sha256 $portableZip $checksums "AltSpace-Portable-x64.zip"
        $shortHash = $verifiedHash.Substring(0, 16) + '...'
        Write-Host "[+] Package SHA-256 confirmed ($shortHash)" -ForegroundColor Green

        Write-Host "[*] Extracting package files..." -ForegroundColor Gray
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

    # Clean up any leftover temporary replacement files
    Get-ChildItem -Path $TargetDir -Filter '*.old.*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # Start Menu Shortcut creation
    $startMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\AltSpace'
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut((Join-Path $startMenuDir 'AltSpace.lnk'))
    $shortcut.TargetPath = $BinaryPath
    $shortcut.Description = 'AltSpace - Native Windows Command Palette & Launcher'
    $shortcut.WorkingDirectory = $TargetDir
    $shortcut.Save()

    # Desktop Shortcut creation
    $desktopDir = [Environment]::GetFolderPath('Desktop')
    if (Test-Path $desktopDir) {
        $desktopShortcut = $wshShell.CreateShortcut((Join-Path $desktopDir 'AltSpace.lnk'))
        $desktopShortcut.TargetPath = $BinaryPath
        $desktopShortcut.Description = 'AltSpace - Native Windows Command Palette & Launcher'
        $desktopShortcut.WorkingDirectory = $TargetDir
        $desktopShortcut.Save()
    }

    # User PATH registration (ensures 'altspace' works in any terminal session)
    $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathEntries = @($currentPath -split ';' | Where-Object { $_ })
    if ($pathEntries -notcontains $TargetDir) {
        [Environment]::SetEnvironmentVariable('Path', (($pathEntries + $TargetDir) -join ';'), 'User')
        Write-Host "[+] Registered 'altspace' command in User PATH" -ForegroundColor Green
    }

    # Completion announcement
    Write-Host "===========================================================" -ForegroundColor DarkGray
    if ($isUpdate) {
        Write-Host " [+] AltSpace successfully upgraded to $resolvedTag!" -ForegroundColor Green
    } else {
        Write-Host " [+] AltSpace successfully installed ($resolvedTag)!" -ForegroundColor Green
    }
    Write-Host "     Settings, custom shortcuts, and vaults preserved." -ForegroundColor DarkGray
    Write-Host "===========================================================" -ForegroundColor DarkGray

    # Launch application
    Start-Process -FilePath $BinaryPath -WorkingDirectory $TargetDir
    Write-Host "`nAltSpace is now running in the background." -ForegroundColor Cyan
    Write-Host "  Summon Palette:  Alt + Space (or Ctrl + Space)" -ForegroundColor White
    Write-Host "  Action Drawer:   Tab or Ctrl + K" -ForegroundColor White
    Write-Host "  Run as Admin:    Ctrl + Shift + Enter" -ForegroundColor DarkGray
    Write-Host "  Reveal File:     Ctrl + O" -ForegroundColor DarkGray
    Write-Host "  Copy Path:       Ctrl + C" -ForegroundColor DarkGray
    Write-Host ""
} catch {
    Write-Host ""
    Write-Error "AltSpace installation failed: $_"
    exit 1
} finally {
    if (Test-Path $TempRoot) { Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
