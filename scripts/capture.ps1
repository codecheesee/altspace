Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Start-Sleep -Milliseconds 600
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$outPath = Join-Path $PSScriptRoot "screenshot.png"
$bmp.Save($outPath)
$g.Dispose()
$bmp.Dispose()
Write-Output "Saved to $outPath"
