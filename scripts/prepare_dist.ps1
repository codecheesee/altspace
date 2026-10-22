$ErrorActionPreference = 'Stop'
$dist = Join-Path $PSScriptRoot '..\dist_artifacts'
New-Item -ItemType Directory -Path $dist -Force | Out-Null

$candidateBinaries = @(
    (Join-Path $PSScriptRoot '..\target\release\raycast-windows.exe'),
    (Join-Path $PSScriptRoot '..\frontend\src-tauri\target\release\raycast-windows.exe')
) | Where-Object { Test-Path $_ } | Sort-Object { (Get-Item $_).LastWriteTime }
$releaseBinary = $candidateBinaries | Select-Object -Last 1

$candidateNsisDirs = @(
    (Join-Path $PSScriptRoot '..\target\release\bundle\nsis'),
    (Join-Path $PSScriptRoot '..\frontend\src-tauri\target\release\bundle\nsis')
) | Where-Object { Test-Path $_ }

$candidateMsiDirs = @(
    (Join-Path $PSScriptRoot '..\target\release\bundle\msi'),
    (Join-Path $PSScriptRoot '..\frontend\src-tauri\target\release\bundle\msi')
) | Where-Object { Test-Path $_ }
$dll = Join-Path $PSScriptRoot '..\bin\Everything64.dll'
$installerScript = Join-Path $PSScriptRoot '..\install.ps1'

if (-not (Test-Path $releaseBinary)) {
    throw "Release binary not found at $releaseBinary"
}

$nsisSetupItem = $candidateNsisDirs | ForEach-Object {
    Get-ChildItem -Path $_ -Filter '*_x64-setup.exe' -ErrorAction SilentlyContinue
} | Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $nsisSetupItem) {
    throw "NSIS setup not found in candidate bundle dirs: $($candidateNsisDirs -join ', ')"
}
$nsisSetup = $nsisSetupItem.FullName

$msiSetupItem = $candidateMsiDirs | ForEach-Object {
    Get-ChildItem -Path $_ -Filter '*_x64_en-US.msi' -ErrorAction SilentlyContinue
} | Sort-Object LastWriteTime | Select-Object -Last 1
$msiSetup = if ($msiSetupItem) { $msiSetupItem.FullName } else { $null }

Copy-Item $releaseBinary (Join-Path $dist 'altspace.exe') -Force
Copy-Item $releaseBinary (Join-Path $dist 'AltSpace-Portable.exe') -Force
Copy-Item $nsisSetup (Join-Path $dist 'AltSpace-Setup-x64.exe') -Force
if ($msiSetup -and (Test-Path $msiSetup)) {
    Copy-Item $msiSetup (Join-Path $dist 'AltSpace-MSI-x64.msi') -Force
}
Copy-Item $dll (Join-Path $dist 'Everything64.dll') -Force
Copy-Item $installerScript (Join-Path $dist 'install.ps1') -Force

# Create portable ZIP
$zipPath = Join-Path $dist 'AltSpace-Portable-x64.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $dist 'AltSpace-Portable.exe'), (Join-Path $dist 'Everything64.dll') -DestinationPath $zipPath -Force

# Generate SHA256SUMS.txt
$files = @(
    'altspace.exe',
    'AltSpace-Portable.exe',
    'AltSpace-Setup-x64.exe',
    'AltSpace-Portable-x64.zip',
    'Everything64.dll',
    'install.ps1'
)
if (Test-Path (Join-Path $dist 'AltSpace-MSI-x64.msi')) {
    $files += 'AltSpace-MSI-x64.msi'
}

$hashLines = foreach ($f in $files) {
    $full = Join-Path $dist $f
    $hash = (Get-FileHash -Path $full -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $f"
}

[IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS.txt'), $hashLines)
Write-Host "Artifacts successfully generated in $dist"
