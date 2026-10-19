$content = [System.IO.File]::ReadAllText('C:\Program Files\WindowsApps\Raycast.Raycast_2.8.2.0_x64__qypenmj9wpt2a\Raycast\frontend\internal-extensions-DZRANhqM.js')
$matches = [System.Text.RegularExpressions.Regex]::Matches($content, 'key:\s*`([^`]+)`,\s*title:\s*`([^`]+)`')
foreach ($m in $matches) {
    Write-Output "$($m.Groups[1].Value) | $($m.Groups[2].Value)"
}
