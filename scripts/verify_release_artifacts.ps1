param(
    [string]$ArtifactDir = (Join-Path $PSScriptRoot '..\dist_artifacts')
)

$ErrorActionPreference = 'Stop'
$required = @(
    'altspace.exe',
    'AltSpace-Portable.exe',
    'AltSpace-Setup-x64.exe',
    'AltSpace-MSI-x64.msi',
    'AltSpace-Portable-x64.zip',
    'Everything64.dll',
    'install.ps1',
    'SHA256SUMS.txt'
)

foreach ($name in $required) {
    $path = Join-Path $ArtifactDir $name
    if (-not (Test-Path $path -PathType Leaf)) {
        throw "Required release artifact is missing: $name"
    }
}

$checksumLines = Get-Content (Join-Path $ArtifactDir 'SHA256SUMS.txt')
foreach ($name in $required | Where-Object { $_ -ne 'SHA256SUMS.txt' }) {
    $line = $checksumLines | Where-Object { $_ -match ("\s" + [regex]::Escape($name) + "$") } | Select-Object -First 1
    if (-not $line -or $line -notmatch '^\s*([0-9a-fA-F]{64})\s+') {
        throw "Missing or malformed SHA-256 entry for $name"
    }
    $actual = (Get-FileHash (Join-Path $ArtifactDir $name) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Matches[1].ToLowerInvariant()) {
        throw "SHA-256 mismatch for $name"
    }
}

$zipEntries = Get-Command tar -ErrorAction SilentlyContinue
if ($zipEntries) {
    $listing = & tar -tf (Join-Path $ArtifactDir 'AltSpace-Portable-x64.zip')
    if ($listing -notcontains 'AltSpace-Portable.exe' -or $listing -notcontains 'Everything64.dll') {
        throw 'Portable archive is missing AltSpace-Portable.exe or Everything64.dll'
    }
}

Write-Host "Release artifact validation passed: $ArtifactDir"
