# Windows PC — Dexter's Lab Setup

Guide for setting up the PC as the primary dev/production server.

## Prerequisites

- Windows 10/11
- Node.js 18+ (`winget install OpenJS.NodeJS.LTS`)
- Git (`winget install Git.Git`)
- Cloudflare Tunnel (`cloudflared`) configured

## Step 1: Clone the Repo

```powershell
cd ~/Desktop
git clone https://github.com/ZeCabbage/dexterslab.git
cd dexterslab
```

## Step 2: Install Dependencies

```powershell
cd dexterslab-backend && npm install && cd ..
cd dexterslab-frontend && npm install && cd ..
```

## Step 3: Configure Environment

Create `dexterslab-backend/.env`:
```
GEMINI_API_KEY=your_key_here
PORT=8888
```

Create `dexterslab-frontend/.env.local`:
```
GEMINI_API_KEY=your_key_here
```

> ⚠️ **Never commit `.env` files.** They are gitignored.

## Step 4: Build Frontend for Production

```powershell
cd dexterslab-frontend
npm run build
cd ..
```

## Step 5: Run with PowerShell Script

For development:
```powershell
.\dev.ps1
```

For production (backend + pre-built frontend):
```powershell
# Terminal 1: Backend
cd dexterslab-backend && npm start

# Terminal 2: Frontend
cd dexterslab-frontend && npm run start:local
```

## Step 6: Cloudflare Tunnel

The tunnel should route:
- `dexterslab.cclottaaworld.com` → `http://localhost:7777` (frontend)
- `dexterslab-api.cclottaaworld.com` → `http://localhost:8888` (backend)

Check tunnel status:
```powershell
cloudflared tunnel info
```

## Updating from Mac

When code is pushed from the Mac:
```powershell
cd ~/Desktop/dexterslab
git pull origin main
cd dexterslab-frontend && npm run build && cd ..
```

Or use the SYNC button on the Observer Hub dashboard.
