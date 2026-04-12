---
description: Verify boot protocol health on Pi and PC
---

# Boot Protocol Verification

Checks that all layers of the boot protocol are functioning correctly.

## Steps

### 1. Check PC Backend Health
```powershell
Invoke-RestMethod -Uri http://localhost:8888/api/health
```
Expected: `status: ok`

### 2. Check PC Boot Check (Comprehensive)
```powershell
Invoke-RestMethod -Uri http://localhost:8888/api/boot-check | ConvertTo-Json -Depth 5
```
Expected: All layers show `status: ok`

### 3. Check PC Boot Protocol Log
```powershell
Get-Content $env:USERPROFILE\.dexterslab\boot-protocol.log -Tail 30
```

### 4. Check PC Scheduled Task
```powershell
Get-ScheduledTask -TaskName "DextersLab-BootProtocol" | Format-List
```

// turbo
### 5. SSH into Pi and Check Edge Daemon
```powershell
ssh pi-deploy "systemctl is-active observer-boot.service && echo 'SERVICE: OK' || echo 'SERVICE: DOWN'"
```

// turbo
### 6. Check Pi Health Endpoint
```powershell
ssh pi-deploy "curl -s http://localhost:8891/health"
```

// turbo
### 7. Check Pi Hardware Manifest
```powershell
ssh pi-deploy "cat /tmp/hw-manifest.json"
```

// turbo
### 8. Check Pi Boot Logs
```powershell
ssh pi-deploy "journalctl -u observer-boot --since '1 hour ago' -n 30"
```

### 9. Verify End-to-End Connectivity
Check that the PC backend sees the Pi connected:
```powershell
(Invoke-RestMethod -Uri http://localhost:8888/api/boot-check).layers.hardware | ConvertTo-Json
```
Expected: `pi_audio_connected: true`, `pi_tts_connected: true`, `video_stream_active: true`
