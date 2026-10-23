$sh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = $sh.CreateShortcut("$desktop\AltSpace.lnk")
$binDir = (Resolve-Path "$PSScriptRoot\..\bin").Path
$exe = Join-Path $binDir "altspace.exe"
if (-not (Test-Path $exe)) {
    $exe = Join-Path $binDir "altspace.exe"
}
$ico = (Resolve-Path "$PSScriptRoot\..\frontend\src-tauri\icons\icon.ico").Path

$lnk.TargetPath = $exe
$lnk.WorkingDirectory = $binDir
$lnk.Description = "AltSpace — Command Palette (Alt+Space)"
$lnk.IconLocation = $ico
$lnk.Save()
Write-Output "SHORTCUT_VERIFIED"
