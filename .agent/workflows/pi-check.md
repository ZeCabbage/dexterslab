---
description: SSH into Raspberry Pi and check if services are running
---

# Pi Status Check

SSH into the Raspberry Pi and check system health.

> **Prerequisites**: SSH must be configured. Use `ssh pi` (via Cloudflare Tunnel) or `ssh -i ~/.ssh/id_ed25519 thecabbage@raspberrypi.local` (LAN/mDNS).

1. Check if the Pi is reachable (LAN first, then Cloudflare):
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "echo 'Pi is reachable (LAN)'" 2>&1
```
If this fails, try the Cloudflare route:
```powershell
ssh pi "echo 'Pi is reachable (via Cloudflare)'" 2>&1
```

2. Check disk space:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "df -h / | tail -1"
```

3. Check edge-daemon systemd service:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "sudo systemctl status edge-daemon --no-pager | head -15"
```

4. Check edge-daemon logs for errors:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "sudo journalctl -u edge-daemon --no-pager -n 20"
```

5. Check observer kiosk (Chromium):
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "pgrep -a chromium 2>/dev/null || echo 'Chromium is not running'"
```

6. Check system uptime and memory:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "uptime && free -h | head -2"
```

7. Check WebSocket connections from edge-daemon:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" thecabbage@raspberrypi.local "sudo ss -tnpa | grep python | grep ESTAB"
```
> Should show 3 ESTABLISHED connections (audio, video, tts).

8. Report findings to user with a summary table of what's running vs what's not.

