# ═══════════════════════════════════════════════════════
# RUN THIS AS ADMIN (Right-click → Run as Administrator)
# Sets up automatic recovery when PC wakes from sleep
# ═══════════════════════════════════════════════════════

$taskName = "DextersLab-WakeRecovery"
$scriptPath = "$env:USERPROFILE\OneDrive\Desktop\dexterslab\scripts\wake-recovery.ps1"

# Create action: run the recovery script
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Trigger on ANY user session unlock or logon
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

# Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Register with highest privileges (needed to restart cloudflared service)
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $triggerLogon `
    -Settings $settings `
    -Description "Restart cloudflared + dev servers when PC wakes from sleep" `
    -RunLevel Highest `
    -Force

# Also add an event-based trigger for resume from sleep (Event ID 1)
# This catches wake without logon
$task = Get-ScheduledTask -TaskName $taskName
$class = Get-CimClass MSFT_TaskEventTrigger root/Microsoft/Windows/TaskScheduler
$wakeTrigger = $class | New-CimInstance -ClientOnly
$wakeTrigger.Enabled = $true
$wakeTrigger.Subscription = '<QueryList><Query Id="0" Path="System"><Select Path="System">*[System[Provider[@Name=''Microsoft-Windows-Kernel-Power''] and (EventID=107)]]</Select></Query></QueryList>'

$task.Triggers += $wakeTrigger
$task | Set-ScheduledTask

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " WAKE RECOVERY INSTALLED SUCCESSFULLY " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Task: $taskName" -ForegroundColor Cyan
Write-Host "Triggers:" -ForegroundColor Cyan
Write-Host "  1. At logon"
Write-Host "  2. On resume from sleep (Kernel-Power event 107)"
Write-Host "Script: $scriptPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "What it does:"
Write-Host "  - Restarts Cloudflared service (fixes stale QUIC connections)"
Write-Host "  - Ensures Next.js frontend is running on port 7777"
Write-Host "  - Ensures Express backend is running on port 8888"
Write-Host "  - Logs to dexterslab/logs/wake-recovery.log"
Write-Host ""
Read-Host "Press Enter to close"
