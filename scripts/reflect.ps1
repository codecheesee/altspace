Add-Type -Path 'C:\Program Files\WindowsApps\Raycast.Raycast_2.8.2.0_x64__qypenmj9wpt2a\Raycast\Raycast.dll'
$asm = [System.Reflection.Assembly]::LoadFrom('C:\Program Files\WindowsApps\Raycast.Raycast_2.8.2.0_x64__qypenmj9wpt2a\Raycast\Raycast.dll')
$types = $asm.GetExportedTypes() | Select-Object -ExpandProperty FullName
Write-Output "Total exported types: $($types.Count)"
$types | Select-Object -First 40
