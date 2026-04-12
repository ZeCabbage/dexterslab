# Dexter's Lab — Boot Protocol Runbook

A comprehensive guide to how the Pi and PC automatically recover from any power cycle.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                BOOT SEQUENCE                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  PI SIDE (systemd: observer-boot.service)        │
│  ├─ Layer 0: Clean Slate (kill zombies)          │
│  ├─ Layer 1: Hardware Discovery (hw-discover.sh) │
│  ├─ Layer 2: Network Gate (DNS + Cloudflare)     │
│  ├─ Layer 3: Edge Daemon Start + Health Check    │
│  ├─ Layer 4: PC Backend Readiness Check          │
│  └─ Layer 5: Watchdog Loop (30s interval)        │
│                                                  │
│  PI SIDE (desktop autostart: observer-kiosk.sh)  │
│  ├─ Gate 1: Wait for edge daemon health          │
│  ├─ Gate 2: Wait for PC backend via Cloudflare   │
│  └─ Fallback: Launch offline observer if timeout │
│                                                  │
│  PC SIDE (Task Scheduler: boot-protocol.ps1)     │
│  ├─ Layer 0: Clean Slate (kill zombie node procs)│
│  ├─ Layer 1: Restart Cloudflared service         │
│  ├─ Layer 2: Start Backend (port 8888)           │
│  ├─ Layer 3: Start Frontend (port 7777)          │
│  ├─ Layer 4: Validation                          │
│  └─ Layer 5: Watchdog Loop (30s interval)        │
│                                                  │
└─────────────────────────────────────────────────┘
```

## What Happens on Pi Boot

1. **systemd** starts `observer-boot.service` after network + sound targets
2. `hw-discover.sh` probes USB devices and writes `/tmp/hw-manifest.json`
3. `boot-protocol.sh` cleans zombies, waits for DNS, starts edge daemon
4. Edge daemon reads hw-manifest for camera/mic/speaker device indexes
5. Watchdog loop monitors daemon health and auto-restarts on failure
6. **Desktop autostart** launches `observer-kiosk.sh`
7. Kiosk waits for edge daemon health, then PC backend, then launches Chromium
8. If PC unreachable after 90s → falls back to offline observer mode

## What Happens on PC Boot/Wake

1. **Task Scheduler** triggers `boot-protocol.ps1`
2. Kills all zombie node processes on ports 7777 and 8888
3. Restarts Cloudflared Windows service
4. Starts backend server, waits for `/api/health` to return 200
5. Starts frontend dev server, waits for port 7777 to respond
6. Enters watchdog loop — restarts crashed services automatically

## Key Files

### Pi Side
| File | Purpose |
|------|---------|
| `edge-daemon/observer-boot.service` | systemd service (replaces observer-capture.service) |
| `edge-daemon/boot-protocol.sh` | Master boot script with layered gates |
| `edge-daemon/hw-discover.sh` | Dynamic USB device discovery |
| `edge-daemon/clean-shutdown.sh` | Kills all children on stop |
| `edge-daemon/main.py` | Edge daemon with per-service watchdog |
| `scripts/observer-kiosk.sh` | Chromium kiosk with edge daemon gate |

### PC Side
| File | Purpose |
|------|---------|
| `scripts/boot-protocol.ps1` | Master PC boot + watchdog |
| `scripts/setup-boot-protocol.ps1` | One-time admin installer (scheduled task) |

## Installation

### Pi — Install New Boot Service

```bash
# SSH into Pi
ssh pi-deploy

# Stop old service
sudo systemctl stop observer-capture.service
sudo systemctl disable observer-capture.service

# Install new service
sudo cp ~/dexterslab-edge/observer-boot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable observer-boot.service
sudo systemctl start observer-boot.service

# Make scripts executable
chmod +x ~/dexterslab-edge/boot-protocol.sh
chmod +x ~/dexterslab-edge/hw-discover.sh
chmod +x ~/dexterslab-edge/clean-shutdown.sh

# Verify
sudo systemctl status observer-boot.service
journalctl -u observer-boot -f
```

### PC — Install Boot Protocol

```powershell
# Run PowerShell as Administrator
.\scripts\setup-boot-protocol.ps1
```

## Troubleshooting

### Pi: Edge daemon won't start
```bash
# Check boot protocol logs
journalctl -u observer-boot -n 50

# Check hardware manifest
cat /tmp/hw-manifest.json

# Manual restart
sudo systemctl restart observer-boot.service
```

### Pi: Camera not found
```bash
# List video devices
ls -la /dev/video*
v4l2-ctl --list-devices

# Re-run hardware discovery
bash ~/dexterslab-edge/hw-discover.sh
```

### Pi: Audio device mismatch
```bash
# List audio devices
arecord -l  # Input devices
aplay -l    # Output devices

# Check current manifest
cat /tmp/hw-manifest.json
```

### PC: Services won't start
```powershell
# Check boot protocol log
Get-Content $env:USERPROFILE\.dexterslab\boot-protocol.log -Tail 50

# Check what's on ports
Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 7777 -ErrorAction SilentlyContinue

# Manual restart
.\scripts\boot-protocol.ps1
```

### PC: Cloudflared issues
```powershell
# Check service status
Get-Service Cloudflared
Restart-Service Cloudflared -Force
```

## Manual Override Commands

### Force restart everything on Pi
```bash
sudo systemctl restart observer-boot.service
```

### Force restart everything on PC
```powershell
.\scripts\boot-protocol.ps1
```

### Check full system health
```bash
# Pi health
curl http://localhost:8891/health

# PC backend health
curl http://localhost:8888/api/health

# PC boot check (comprehensive)
curl http://localhost:8888/api/boot-check
```
