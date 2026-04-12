# ═══════════════════════════════════════════════════════════
#  DEXTER'S LAB — PC Boot Protocol (Master Boot Script)
#
#  Triggered by: Windows Task Scheduler (logon + wake from sleep)
#  Also callable manually: .\scripts\boot-protocol.ps1
#
#  Layer 0: Clean Slate — kill zombie processes on ports 7777/8888
#  Layer 1: Cloudflare — restart cloudflared service
#  Layer 2: Backend — start Express server, verify health
#  Layer 3: Frontend — start Next.js dev server, verify response
#  Layer 4: Watchdog — monitor ports, auto-restart on failure
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

# ── Config ──
$DextersLabRoot = "$env:USERPROFILE\OneDrive\Desktop\dexterslab"
$BackendDir = "$DextersLabRoot\dexterslab-backend"
$FrontendDir = "$DextersLabRoot\dexterslab-frontend"
$LogDir = "$env:USERPROFILE\.dexterslab"
$LogFile = "$LogDir\boot-protocol.log"

$BackendPort = 8888
$FrontendPort = 7777
$BackendHealthUrl = "http://localhost:$BackendPort/api/health"

# Production mode: set DEXTERSLAB_PRODUCTION=1 env var to use production builds
$ProductionMode = $env:DEXTERSLAB_PRODUCTION -eq "1"

# ── Logging ──
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}

function Test-Port {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        # Get-NetTCPConnection is more reliable than netstat parsing
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            $procId = $conn.OwningProcess
            if ($procId -and $procId -ne 0) {
                Write-Log "  Killing PID $procId (port $Port)"
                # Use taskkill /T to kill the entire process tree (critical for node + child processes)
                taskkill /F /PID $procId /T 2>&1 | Out-Null
            }
        }
    } catch {
        Write-Log "  Could not enumerate port $Port (may be free): $_" "WARN"
    }
}

# ═══════════════════════════════════════════
#  LAYER 0 — CLEAN SLATE
# ═══════════════════════════════════════════
Write-Log "═══════════════════════════════════════════"
Write-Log "  DEXTER'S LAB — PC Boot Protocol Starting"
Write-Log "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "  Mode: $(if ($ProductionMode) { 'PRODUCTION' } else { 'DEVELOPMENT' })"
Write-Log "═══════════════════════════════════════════"

Write-Log "[Layer 0] Cleaning up zombie processes..."

Stop-ProcessOnPort $BackendPort
Stop-ProcessOnPort $FrontendPort

# Also kill any orphaned node processes that might be lingering
# (e.g., from a previous --watch session that spawned children)
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
foreach ($proc in $nodeProcs) {
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -and ($cmdLine -match "server\.js" -or $cmdLine -match "next")) {
            Write-Log "  Killing orphaned node process PID $($proc.Id): $($cmdLine.Substring(0, [Math]::Min(80, $cmdLine.Length)))"
            taskkill /F /PID $proc.Id /T 2>&1 | Out-Null
        }
    } catch {}
}

Start-Sleep -Seconds 3

# Verify ports are actually free
if (Test-Port $BackendPort) {
    Write-Log "[Layer 0] WARNING: Port $BackendPort still occupied, force killing..." "WARN"
    Stop-ProcessOnPort $BackendPort
    Start-Sleep -Seconds 2
}
if (Test-Port $FrontendPort) {
    Write-Log "[Layer 0] WARNING: Port $FrontendPort still occupied, force killing..." "WARN"
    Kill-ProcessOnPort $FrontendPort
    Start-Sleep -Seconds 2
}

Write-Log "[Layer 0] ✓ Clean slate established"

# ═══════════════════════════════════════════
#  LAYER 1 — CLOUDFLARE TUNNEL
# ═══════════════════════════════════════════
Write-Log "[Layer 1] Restarting Cloudflare tunnel..."

try {
    $cfService = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
    if ($cfService) {
        Restart-Service -Name "Cloudflared" -Force -ErrorAction Stop
        Start-Sleep -Seconds 5
        $cfService = Get-Service -Name "Cloudflared"
        Write-Log "[Layer 1] ✓ Cloudflared service: $($cfService.Status)"
    } else {
        Write-Log "[Layer 1] ⚠ Cloudflared service not found (may be running as tunnel)" "WARN"
    }
} catch {
    Write-Log "[Layer 1] ⚠ Could not restart Cloudflared: $_" "WARN"
}

# ═══════════════════════════════════════════
#  LAYER 2 — BACKEND SERVER
# ═══════════════════════════════════════════
Write-Log "[Layer 2] Starting backend server on port $BackendPort..."

if (-not (Test-Path $BackendDir)) {
    Write-Log "[Layer 2] ✕ FATAL: Backend directory not found at $BackendDir" "ERROR"
    exit 1
}

# Start backend in a hidden window
$backendProc = Start-Process -FilePath "node" -ArgumentList "server.js" `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput "$LogDir\backend-stdout.log" `
    -RedirectStandardError "$LogDir\backend-stderr.log"

Write-Log "[Layer 2] Backend process started with PID $($backendProc.Id)"

# Wait for health endpoint
$elapsed = 0
$maxWait = 30
$backendHealthy = $false
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 2
    $elapsed += 2

    try {
        $response = Invoke-RestMethod -Uri $BackendHealthUrl -TimeoutSec 3 -ErrorAction Stop
        Write-Log "[Layer 2] ✓ Backend healthy! (uptime: $([math]::Round($response.uptime, 1))s)"
        $backendHealthy = $true
        break
    } catch {
        Write-Log "[Layer 2]   waiting... (${elapsed}s / ${maxWait}s)"
    }
}

if (-not $backendHealthy) {
    Write-Log "[Layer 2] ⚠ Backend did not become healthy in ${maxWait}s — continuing anyway" "WARN"
}

# ═══════════════════════════════════════════
#  LAYER 3 — FRONTEND SERVER
# ═══════════════════════════════════════════
Write-Log "[Layer 3] Starting frontend server on port $FrontendPort..."

if (-not (Test-Path $FrontendDir)) {
    Write-Log "[Layer 3] ✕ FATAL: Frontend directory not found at $FrontendDir" "ERROR"
    exit 1
}

if ($ProductionMode) {
    # Production: build and serve
    Write-Log "[Layer 3] Production mode — building..."
    Start-Process -FilePath "npm" -ArgumentList "run", "build" `
        -WorkingDirectory $FrontendDir `
        -Wait `
        -WindowStyle Hidden
    $frontendProc = Start-Process -FilePath "npx" -ArgumentList "next", "start", "-p", "$FrontendPort" `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput "$LogDir\frontend-stdout.log" `
        -RedirectStandardError "$LogDir\frontend-stderr.log"
} else {
    # Development: dev server
    $frontendProc = Start-Process -FilePath "npx" -ArgumentList "next", "dev", "-p", "$FrontendPort" `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput "$LogDir\frontend-stdout.log" `
        -RedirectStandardError "$LogDir\frontend-stderr.log"
}

Write-Log "[Layer 3] Frontend process started with PID $($frontendProc.Id)"

# Wait for frontend to respond
$elapsed = 0
$maxWait = 60
$frontendHealthy = $false
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 3
    $elapsed += 3

    if (Test-Port $FrontendPort) {
        Write-Log "[Layer 3] ✓ Frontend responding on port $FrontendPort!"
        $frontendHealthy = $true
        break
    }
    Write-Log "[Layer 3]   waiting... (${elapsed}s / ${maxWait}s)"
}

if (-not $frontendHealthy) {
    Write-Log "[Layer 3] ⚠ Frontend did not become responsive in ${maxWait}s" "WARN"
}

# ═══════════════════════════════════════════
#  LAYER 4 — VALIDATION
# ═══════════════════════════════════════════
Write-Log "[Layer 4] Running validation checks..."

$checks = @{
    "Backend port $BackendPort" = (Test-Port $BackendPort)
    "Frontend port $FrontendPort" = (Test-Port $FrontendPort)
}

$allPassed = $true
foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Log "[Layer 4]   ✓ $($check.Key)"
    } else {
        Write-Log "[Layer 4]   ✕ $($check.Key)" "ERROR"
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Log "[Layer 4] ✓ All validation checks passed"
} else {
    Write-Log "[Layer 4] ⚠ Some checks failed — watchdog will attempt recovery" "WARN"
}

# Save PIDs for tracking
@{
    backend = $backendProc.Id
    frontend = $frontendProc.Id
    started = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    mode = if ($ProductionMode) { "production" } else { "development" }
} | ConvertTo-Json | Set-Content "$LogDir\pids.json" -ErrorAction SilentlyContinue

Write-Log "═══════════════════════════════════════════"
Write-Log "  BOOT PROTOCOL COMPLETE"
Write-Log "  Backend PID: $($backendProc.Id)"
Write-Log "  Frontend PID: $($frontendProc.Id)"
Write-Log "  Entering watchdog mode..."
Write-Log "═══════════════════════════════════════════"

# ═══════════════════════════════════════════
#  LAYER 5 — WATCHDOG LOOP
# ═══════════════════════════════════════════
$backendFailCount = 0
$frontendFailCount = 0
$maxFails = 3

while ($true) {
    Start-Sleep -Seconds 30

    # ── Check Backend ──
    if (-not (Test-Port $BackendPort)) {
        $backendFailCount++
        Write-Log "[Watchdog] Backend port $BackendPort not responding (fail $backendFailCount/$maxFails)" "WARN"

        if ($backendFailCount -ge $maxFails) {
            Write-Log "[Watchdog] Restarting backend after $maxFails consecutive failures..."
            Kill-ProcessOnPort $BackendPort
            Start-Sleep -Seconds 3
            $backendProc = Start-Process -FilePath "node" -ArgumentList "server.js" `
                -WorkingDirectory $BackendDir `
                -WindowStyle Hidden `
                -PassThru `
                -RedirectStandardOutput "$LogDir\backend-stdout.log" `
                -RedirectStandardError "$LogDir\backend-stderr.log"
            Write-Log "[Watchdog] Backend restarted with PID $($backendProc.Id)"
            $backendFailCount = 0

            # Update PIDs file
            @{
                backend = $backendProc.Id
                frontend = $frontendProc.Id
                started = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                mode = if ($ProductionMode) { "production" } else { "development" }
            } | ConvertTo-Json | Set-Content "$LogDir\pids.json" -ErrorAction SilentlyContinue
        }
    } else {
        if ($backendFailCount -gt 0) {
            Write-Log "[Watchdog] ✓ Backend recovered"
        }
        $backendFailCount = 0
    }

    # ── Check Frontend ──
    if (-not (Test-Port $FrontendPort)) {
        $frontendFailCount++
        Write-Log "[Watchdog] Frontend port $FrontendPort not responding (fail $frontendFailCount/$maxFails)" "WARN"

        if ($frontendFailCount -ge $maxFails) {
            Write-Log "[Watchdog] Restarting frontend after $maxFails consecutive failures..."
            Kill-ProcessOnPort $FrontendPort
            Start-Sleep -Seconds 3
            if ($ProductionMode) {
                $frontendProc = Start-Process -FilePath "npx" -ArgumentList "next", "start", "-p", "$FrontendPort" `
                    -WorkingDirectory $FrontendDir `
                    -WindowStyle Hidden `
                    -PassThru `
                    -RedirectStandardOutput "$LogDir\frontend-stdout.log" `
                    -RedirectStandardError "$LogDir\frontend-stderr.log"
            } else {
                $frontendProc = Start-Process -FilePath "npx" -ArgumentList "next", "dev", "-p", "$FrontendPort" `
                    -WorkingDirectory $FrontendDir `
                    -WindowStyle Hidden `
                    -PassThru `
                    -RedirectStandardOutput "$LogDir\frontend-stdout.log" `
                    -RedirectStandardError "$LogDir\frontend-stderr.log"
            }
            Write-Log "[Watchdog] Frontend restarted with PID $($frontendProc.Id)"
            $frontendFailCount = 0

            # Update PIDs file
            @{
                backend = $backendProc.Id
                frontend = $frontendProc.Id
                started = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                mode = if ($ProductionMode) { "production" } else { "development" }
            } | ConvertTo-Json | Set-Content "$LogDir\pids.json" -ErrorAction SilentlyContinue
        }
    } else {
        if ($frontendFailCount -gt 0) {
            Write-Log "[Watchdog] ✓ Frontend recovered"
        }
        $frontendFailCount = 0
    }
}
