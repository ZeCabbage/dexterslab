---
description: Start the dev environment (backend + frontend servers)
---

# Start Dev Environment

Start both the backend and frontend servers for local development.

// turbo-all

1. Kill any existing Node processes that might be holding ports:
```powershell
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Host "Cleared old Node processes"
```

2. Start the backend server (port 8888):
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-backend && node --watch server.js
```
> Wait for the "DEXTER'S LAB — Backend Server" banner to confirm it started.

3. Start the frontend server (port 7777):
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-frontend && npx next dev -p 7777
```
> Wait for "✓ Ready" to confirm it started.

4. Confirm both servers are running:
```powershell
Invoke-RestMethod -Uri "http://localhost:8888/api/health" | ConvertTo-Json
```

5. Report to user:
> Dev environment is running:
> - Frontend: http://localhost:7777
> - Backend: http://localhost:8888
> - Observer Hub: http://localhost:7777/observer
> - Live site: dexterslab.cclottaaworld.com (via Cloudflare Tunnel)
