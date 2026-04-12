# DextersLab Service Manager — Auto-start with watchdog
# Runs both backend + frontend with auto-restart on crash
# Scheduled via Windows Task Scheduler to run at logon

$ErrorActionPreference = "Continue"
$LogFile = "$env:USERPROFILE\.dexterslab\service.log"
$PidFile = "$env:USERPROFILE\.dexterslab\pids.json"
$BackendDir = "C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-backend"
$FrontendDir = "C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-frontend"

# Ensure log dir exists
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.dexterslab" | Out-Null

function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $Message" | Tee-Object -FilePath $LogFile -Append
}

function Stop-ExistingServers {
    Write-Log "Stopping any existing servers on ports 8888 and 7777..."
    
    # Find and kill processes on our ports
    $portInfo = netstat -ano | Select-String "LISTENING" | Select-String "8888|7777"
    $pids = @()
    foreach ($line in $portInfo) {
        $parts = $line.ToString().Trim() -split '\s+'
        $procId = $parts[-1]
        if ($procId -and $procId -ne "0") { $pids += $procId }
    }
    $pids = $pids | Select-Object -Unique
    
    foreach ($procId in $pids) {
        try {
            taskkill /F /PID $procId /T 2>&1 | Out-Null
            Write-Log "  Killed PID $procId"
        } catch {
            Write-Log "  Could not kill PID $procId (may already be stopped)"
        }
    }
    Start-Sleep -Seconds 3
}

function Start-Backend {
    Write-Log "Starting backend server..."
    $proc = Start-Process -FilePath "node" -ArgumentList "--watch", "server.js" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput "$env:USERPROFILE\.dexterslab\backend.log" `
        -RedirectStandardError "$env:USERPROFILE\.dexterslab\backend-err.log"
    
    Write-Log "Backend started with PID $($proc.Id)"
    return $proc
}

function Start-Frontend {
    Write-Log "Starting frontend server..."
    $proc = Start-Process -FilePath "npx" -ArgumentList "next", "dev", "-p", "7777" `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput "$env:USERPROFILE\.dexterslab\frontend.log" `
        -RedirectStandardError "$env:USERPROFILE\.dexterslab\frontend-err.log"
    
    Write-Log "Frontend started with PID $($proc.Id)"
    return $proc
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

# ═══ Main ═══
Write-Log "═══ DextersLab Service Manager starting ═══"

Stop-ExistingServers

$backendProc = Start-Backend
$frontendProc = Start-Frontend

# Wait for servers to come up
Write-Log "Waiting for servers to initialize..."
Start-Sleep -Seconds 10

# Save PIDs
@{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile

# ═══ Watchdog Loop ═══
Write-Log "Entering watchdog loop (checking every 30s)..."
$backendFailCount = 0
$frontendFailCount = 0

while ($true) {
    Start-Sleep -Seconds 30
    
    # Check backend
    if (-not (Test-Port 8888)) {
        $backendFailCount++
        Write-Log "WARNING: Backend port 8888 not responding (fail $backendFailCount/3)"
        
        if ($backendFailCount -ge 3) {
            Write-Log "RESTARTING backend after 3 consecutive failures..."
            try { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
            Start-Sleep -Seconds 3
            $backendProc = Start-Backend
            $backendFailCount = 0
            @{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile
        }
    } else {
        if ($backendFailCount -gt 0) {
            Write-Log "Backend recovered"
        }
        $backendFailCount = 0
    }
    
    # Check frontend
    if (-not (Test-Port 7777)) {
        $frontendFailCount++
        Write-Log "WARNING: Frontend port 7777 not responding (fail $frontendFailCount/3)"
        
        if ($frontendFailCount -ge 3) {
            Write-Log "RESTARTING frontend after 3 consecutive failures..."
            try { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
            Start-Sleep -Seconds 3
            $frontendProc = Start-Frontend
            $frontendFailCount = 0
            @{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile
        }
    } else {
        if ($frontendFailCount -gt 0) {
            Write-Log "Frontend recovered"
        }
        $frontendFailCount = 0
    }
}
