$ErrorActionPreference = 'Stop'
$dist = Join-Path $PSScriptRoot '..\dist_artifacts'
New-Item -ItemType Directory -Path $dist -Force | Out-Null

$releaseBinary = Join-Path $PSScriptRoot '..\frontend\src-tauri\target\release\raycast-windows.exe'
$nsisSetup = Join-Path $PSScriptRoot '..\frontend\src-tauri\target\release\bundle\nsis\altspace_2.0.0_x64-setup.exe'
$dll = Join-Path $PSScriptRoot '..\bin\Everything64.dll'
$installerScript = Join-Path $PSScriptRoot '..\install.ps1'

if (-not (Test-Path $releaseBinary)) {
    throw "Release binary not found at $releaseBinary"
}
if (-not (Test-Path $nsisSetup)) {
    throw "NSIS setup not found at $nsisSetup"
}

Copy-Item $releaseBinary (Join-Path $dist 'altspace.exe') -Force
Copy-Item $releaseBinary (Join-Path $dist 'AltSpace-Portable.exe') -Force
Copy-Item $nsisSetup (Join-Path $dist 'AltSpace-Setup-x64.exe') -Force
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

$hashLines = foreach ($f in $files) {
    $full = Join-Path $dist $f
    $hash = (Get-FileHash -Path $full -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $f"
}

[IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS.txt'), $hashLines)
Write-Host "Artifacts successfully generated in $dist"
