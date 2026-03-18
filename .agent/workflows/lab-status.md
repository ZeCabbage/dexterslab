---
description: Check experiment registry, Git status, and dev server health
---

# Lab Status

Quick health check of the Dexter's Lab environment.

// turbo-all

1. List all experiments from the registry:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; Get-Content .\dexterslab-frontend\data\experiments.json | ConvertFrom-Json | Format-Table -Property name, route, status, icon -AutoSize
```

2. Show current Git branch and uncommitted changes:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; Write-Host "Branch: $(git branch --show-current)"; git status --short
```

3. Check if dev servers are running:
```powershell
try { $r = Invoke-RestMethod -Uri "http://localhost:8888/api/health" -TimeoutSec 2; Write-Host "Backend:  ONLINE (platform: $($r.platform), uptime: $([math]::Round($r.uptime))s)" -ForegroundColor Green } catch { Write-Host "Backend:  OFFLINE" -ForegroundColor Red }; try { $null = Invoke-WebRequest -Uri "http://localhost:7777" -TimeoutSec 2; Write-Host "Frontend: ONLINE" -ForegroundColor Green } catch { Write-Host "Frontend: OFFLINE" -ForegroundColor Red }
```

4. List any experiment feature branches:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; git branch --list "experiment/*"
```

5. Report to user with a summary of:
   - All experiments and their statuses
   - Current branch + any uncommitted changes
   - Server health (backend + frontend)
   - Any active experiment branches
