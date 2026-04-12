# ═══════════════════════════════════════════════════════════
#  DEXTER'S LAB — Boot Protocol Setup (Run as Administrator)
#
#  Registers the boot protocol as a Windows Scheduled Task.
#  Triggers: logon + wake from sleep (Kernel-Power event 107)
#
#  RUN THIS ONCE: Right-click PowerShell → Run as Administrator
#  Then run: .\scripts\setup-boot-protocol.ps1
# ═══════════════════════════════════════════════════════════

$taskName = "DextersLab-BootProtocol"
$oldTaskName = "DextersLab-WakeRecovery"
$scriptPath = "$env:USERPROFILE\OneDrive\Desktop\dexterslab\scripts\boot-protocol.ps1"

# ── Remove old tasks ──
Write-Host "`nRemoving old scheduled tasks..." -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName $oldTaskName -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Gray

# ── Create new task ──
Write-Host "Creating new boot protocol task..." -ForegroundColor Cyan

# Action: run the boot protocol script
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Trigger 1: At logon
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

# Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

# Register the task with highest privileges (needed to restart cloudflared)
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $triggerLogon `
    -Settings $settings `
    -Description "DextersLab: Start backend + frontend + cloudflared on boot/wake with watchdog" `
    -RunLevel Highest `
    -Force

# Add wake-from-sleep trigger (Kernel-Power event ID 107)
$task = Get-ScheduledTask -TaskName $taskName
$class = Get-CimClass MSFT_TaskEventTrigger root/Microsoft/Windows/TaskScheduler
$wakeTrigger = $class | New-CimInstance -ClientOnly
$wakeTrigger.Enabled = $true
$wakeTrigger.Subscription = '<QueryList><Query Id="0" Path="System"><Select Path="System">*[System[Provider[@Name=''Microsoft-Windows-Kernel-Power''] and (EventID=107)]]</Select></Query></QueryList>'

$task.Triggers += $wakeTrigger
$task | Set-ScheduledTask

# ── Success ──
Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  BOOT PROTOCOL INSTALLED SUCCESSFULLY     " -ForegroundColor Green
Write-Host "════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Task Name: $taskName" -ForegroundColor Cyan
Write-Host "Triggers:" -ForegroundColor Cyan
Write-Host "  1. At user logon"
Write-Host "  2. On resume from sleep (Kernel-Power event 107)"
Write-Host "Script: $scriptPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "What it does on boot/wake:" -ForegroundColor Yellow
Write-Host "  Layer 0: Kill zombie node processes on ports 7777/8888"
Write-Host "  Layer 1: Restart Cloudflared service"
Write-Host "  Layer 2: Start Express backend, verify /api/health"
Write-Host "  Layer 3: Start Next.js frontend (dev mode by default)"
Write-Host "  Layer 4: Validate both ports respond"
Write-Host "  Layer 5: Watchdog loop — auto-restart crashed services"
Write-Host ""
Write-Host "Logs: $env:USERPROFILE\.dexterslab\boot-protocol.log" -ForegroundColor Gray
Write-Host ""
Write-Host "To switch to production mode, set env var:" -ForegroundColor Gray
Write-Host "  `$env:DEXTERSLAB_PRODUCTION = '1'" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close"
