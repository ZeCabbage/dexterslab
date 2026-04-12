# DextersLab — Quick restart of backend only
# Usage: .\scripts\restart-backend.ps1

$ErrorActionPreference = "Continue"
$BackendDir = "C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-backend"

Write-Host "Stopping existing backend on port 8888..."

# Find and kill the process on port 8888
$portInfo = netstat -ano | Select-String "LISTENING" | Select-String ":8888\s"
foreach ($line in $portInfo) {
    $parts = $line.ToString().Trim() -split '\s+'
    $procId = $parts[-1]
    if ($procId -and $procId -ne "0") {
        Write-Host "  Killing PID $procId..."
        taskkill /F /PID $procId /T 2>&1 | Out-Null
    }
}

Start-Sleep -Seconds 3

# Verify port is free
$stillListening = netstat -ano | Select-String "LISTENING" | Select-String ":8888\s"
if ($stillListening) {
    Write-Host "WARNING: Port 8888 still in use. Trying harder..." -ForegroundColor Yellow
    foreach ($line in $stillListening) {
        $parts = $line.ToString().Trim() -split '\s+'
        $procId = $parts[-1]
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Host "Starting backend server..."
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" `
    -WorkingDirectory $BackendDir `
    -PassThru `
    -WindowStyle Normal

Write-Host "Backend started with PID $($proc.Id)"
Write-Host "Waiting 5s for initialization..."
Start-Sleep -Seconds 5

try {
    $health = Invoke-RestMethod -Uri "http://localhost:8888/api/health" -TimeoutSec 5
    Write-Host "Backend healthy: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Backend may still be initializing..." -ForegroundColor Yellow
}
