# ═══════════════════════════════════════════════════════
# DEXTER'S LAB — Wake Recovery Script
# Restarts cloudflared + ensures dev servers are running
# Triggered by Windows Task Scheduler on resume from sleep
# ═══════════════════════════════════════════════════════

$LogFile = "$env:USERPROFILE\OneDrive\Desktop\dexterslab\logs\wake-recovery.log"
$LogDir = Split-Path $LogFile
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts | $msg" | Tee-Object -FilePath $LogFile -Append
}

Write-Log "=== WAKE RECOVERY STARTED ==="

# ─── 1. Restart cloudflared service ───────────────────
Write-Log "Restarting Cloudflared service..."
try {
    Restart-Service Cloudflared -Force -ErrorAction Stop
    Start-Sleep -Seconds 3
    $svc = Get-Service Cloudflared
    Write-Log "Cloudflared service: $($svc.Status)"
} catch {
    Write-Log "ERROR restarting Cloudflared: $_"
}

# ─── 2. Check / start Next.js frontend ────────────────
$frontendDir = "$env:USERPROFILE\OneDrive\Desktop\dexterslab\dexterslab-frontend"
$frontendRunning = $false

try {
    $conn = Test-NetConnection -ComputerName localhost -Port 7777 -WarningAction SilentlyContinue
    $frontendRunning = $conn.TcpTestSucceeded
} catch { $frontendRunning = $false }

if (-not $frontendRunning) {
    Write-Log "Frontend not responding on port 7777, starting..."
    Start-Process powershell -ArgumentList "-WindowStyle Hidden -Command `"cd '$frontendDir'; npx next dev -p 7777 2>&1 | Out-File '$LogDir\frontend.log'`"" -WindowStyle Hidden
    Write-Log "Frontend started (hidden window)"
} else {
    Write-Log "Frontend already running on port 7777"
}

# ─── 3. Check / start Express backend ─────────────────
$backendDir = "$env:USERPROFILE\OneDrive\Desktop\dexterslab\dexterslab-backend"
$backendRunning = $false

try {
    $conn = Test-NetConnection -ComputerName localhost -Port 8888 -WarningAction SilentlyContinue
    $backendRunning = $conn.TcpTestSucceeded
} catch { $backendRunning = $false }

if (-not $backendRunning) {
    Write-Log "Backend not responding on port 8888, starting..."
    Start-Process powershell -ArgumentList "-WindowStyle Hidden -Command `"cd '$backendDir'; node --watch server.js 2>&1 | Out-File '$LogDir\backend.log'`"" -WindowStyle Hidden
    Write-Log "Backend started (hidden window)"
} else {
    Write-Log "Backend already running on port 8888"
}

# ─── 4. Wait and verify ──────────────────────────────
Write-Log "Waiting 8 seconds for services to stabilize..."
Start-Sleep -Seconds 8

# Verify tunnel connectivity
try {
    $r = Invoke-WebRequest -Uri http://localhost:7777 -UseBasicParsing -TimeoutSec 10
    Write-Log "Frontend check: HTTP $($r.StatusCode) ($($r.Content.Length) bytes)"
} catch {
    Write-Log "WARNING: Frontend not responding after recovery: $_"
}

Write-Log "=== WAKE RECOVERY COMPLETE ==="
