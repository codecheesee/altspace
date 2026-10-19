$content = [System.IO.File]::ReadAllText('C:\Program Files\WindowsApps\Raycast.Raycast_2.8.2.0_x64__qypenmj9wpt2a\Raycast\frontend\internal-extensions-DZRANhqM.js')
$matches = [System.Text.RegularExpressions.Regex]::Matches($content, 'id:\s*"([^"]+)"')
$ids = @()
foreach ($m in $matches) {
    $ids += $m.Groups[1].Value
}
$ids | Select-Object -Unique | Where-Object { $_ -match '^[a-z0-9-]+$' } | Sort-Object
