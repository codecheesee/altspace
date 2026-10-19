$exe = Join-Path $PSScriptRoot "..\bin\altspace.exe"
if (-not (Test-Path $exe)) {
    $exe = Join-Path $PSScriptRoot "..\bin\raycast-windows.exe"
}
$results = @()

for ($i = 1; $i -le 4; $i++) {
    Stop-Process -Name "altspace","raycast-windows" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process -FilePath $exe -PassThru
    $sw.Stop()

    $results += [PSCustomObject]@{
        Run = $i
        SpawnMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 2)
        PID = $p.Id
    }

    Start-Sleep -Milliseconds 600
}

Write-Host "--- Cold Start Spawn Benchmarks ---"
$results | Format-Table -AutoSize

Write-Host ""
Write-Host "--- Mutex Duplicate Detection Benchmark ---"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$dup = Start-Process -FilePath $exe -PassThru
$dup.WaitForExit(3000)
$sw.Stop()
Write-Host "Duplicate instance exited in: $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms (Code: $($dup.ExitCode))"

Stop-Process -Name "altspace","raycast-windows" -Force -ErrorAction SilentlyContinue
