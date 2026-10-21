param(
    [string]$ArtifactDir = (Join-Path $PSScriptRoot '..\dist_artifacts'),
    [switch]$RequireSignature
)

$ErrorActionPreference = 'Stop'
$required = @(
    'altspace.exe',
    'AltSpace-Portable.exe',
    'AltSpace-Setup-x64.exe',
    'AltSpace-Portable-x64.zip',
    'Everything64.dll',
    'install.ps1',
    'SHA256SUMS.txt'
)

$minSizeBytes = @{
    'altspace.exe' = 500000;
    'AltSpace-Portable.exe' = 500000;
    'AltSpace-Setup-x64.exe' = 1000000;
    'AltSpace-MSI-x64.msi' = 1000000;
    'AltSpace-Portable-x64.zip' = 500000;
    'Everything64.dll' = 50000;
    'install.ps1' = 1000;
    'SHA256SUMS.txt' = 64;
}

foreach ($name in $required) {
    $path = Join-Path $ArtifactDir $name
    if (-not (Test-Path $path -PathType Leaf)) {
        throw "Required release artifact is missing: $name"
    }
    $item = Get-Item $path
    $min = $minSizeBytes[$name]
    if ($min -and $item.Length -lt $min) {
        throw "Artifact $name is suspiciously small ($($item.Length) bytes, expected at least $min bytes)"
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

if ($RequireSignature) {
    $executables = @('altspace.exe', 'AltSpace-Portable.exe', 'AltSpace-Setup-x64.exe')
    foreach ($exe in $executables) {
        $p = Join-Path $ArtifactDir $exe
        $sig = Get-AuthenticodeSignature -FilePath $p
        if ($sig.Status -ne 'Valid') {
            throw "Authenticode signature validation failed for $exe (Status: $($sig.Status), Message: $($sig.StatusMessage))"
        }
    }
}

Write-Host "Release artifact validation passed: $ArtifactDir"
