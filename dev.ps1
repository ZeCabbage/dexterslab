# ═══════════════════════════════════════════
# DEXTER'S LAB — Dev Environment Startup (Windows)
# Starts backend (port 8888) + frontend (port 7777)
# ═══════════════════════════════════════════

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "dexterslab-backend"
$FrontendDir = Join-Path $ScriptDir "dexterslab-frontend"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║       DEXTER'S LAB — Dev Environment      ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check dependencies
if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) {
    Write-Host "  Installing backend dependencies..." -ForegroundColor Yellow
    Push-Location $BackendDir
    npm install
    Pop-Location
}

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "  Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    npm install
    Pop-Location
}

# Start backend
Write-Host "  Starting backend server (port 8888)..." -ForegroundColor Green
$env:PLATFORM = "windows"
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:BackendDir
    $env:PLATFORM = "windows"
    npm run dev
}

# Wait for backend to start
Start-Sleep -Seconds 2

# Start frontend
Write-Host "  Starting frontend dev server (port 7777)..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:FrontendDir
    npm run dev
}

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │  Backend:  http://localhost:8888         │" -ForegroundColor Cyan
Write-Host "  │  Frontend: http://localhost:7777         │" -ForegroundColor Cyan
Write-Host "  │  Hub:      http://localhost:7777/observer│" -ForegroundColor Cyan
Write-Host "  │                                         │" -ForegroundColor Cyan
Write-Host "  │  Press Ctrl+C to stop all servers       │" -ForegroundColor Cyan
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

# Stream output and wait
try {
    while ($true) {
        # Show any output from jobs
        Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue

        # Check if either job failed
        if ($backendJob.State -eq "Failed" -or $frontendJob.State -eq "Failed") {
            Write-Host "  A server has stopped unexpectedly." -ForegroundColor Red
            break
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "  All processes stopped." -ForegroundColor Green
}
