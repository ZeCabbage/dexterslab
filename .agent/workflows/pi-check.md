---
description: SSH into Raspberry Pi and check if services are running
---

# Pi Status Check

SSH into the Raspberry Pi and check system health.

> **Prerequisites**: SSH must be configured. Use `ssh rpi` (local network) or `ssh rpi-remote` (via Cloudflare Tunnel).

1. Check if the Pi is reachable:
```powershell
ssh rpi "echo 'Pi is reachable'" 2>&1
```
If this fails, try the remote route:
```powershell
ssh rpi-remote "echo 'Pi is reachable (via Cloudflare)'" 2>&1
```

2. Check disk space:
```powershell
ssh rpi "df -h / | tail -1"
```

3. Check systemd services (Observer kiosk):
```powershell
ssh rpi "systemctl --user status observer-kiosk.service 2>/dev/null || echo 'observer-kiosk service not found'"
```

4. Check if Chromium kiosk is running:
```powershell
ssh rpi "pgrep -a chromium 2>/dev/null || echo 'Chromium is not running'"
```

5. Check Node.js processes:
```powershell
ssh rpi "pgrep -a node 2>/dev/null || echo 'No Node processes running'"
```

6. Check system uptime and memory:
```powershell
ssh rpi "uptime && free -h | head -2"
```

7. Report findings to user with a summary table of what's running vs what's not.
