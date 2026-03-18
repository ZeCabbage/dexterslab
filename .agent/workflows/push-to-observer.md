---
description: Push code to GitHub and deploy to PC for Observer Hub (dexterslab.cclottaaworld.com)
---

# Push to Observer

Commit all changes, run security check, push to GitHub.

// turbo-all

## Pre-flight: Security Check

1. Check for secrets, passwords, or API keys in staged files:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; git diff --cached --name-only | ForEach-Object { Select-String -Path $_ -Pattern "(password|secret|api_key|apikey|GEMINI_API_KEY|token)" -ErrorAction SilentlyContinue } ; Write-Host "Security check complete"
```
If any files are flagged, STOP and review them before continuing.

2. Make sure `.env` files are gitignored:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; if (Select-String -Path .gitignore -Pattern "\.env" -Quiet) { Write-Host ".env is gitignored" } else { Write-Host "WARNING: .env is NOT in .gitignore" }
```

## Push to GitHub

3. Stage all changes:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; git add -A
```

4. Show what will be committed:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; git status --short
```

5. Commit with a descriptive message (use context from recent changes):
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; git commit -m "<descriptive message based on changes>"
```

6. Push to origin main:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; git push origin main
```

7. Notify user that push is complete:
> Code pushed to GitHub. Live at `dexterslab.cclottaaworld.com` (served by Cloudflare Tunnel from this PC).
> If the dev servers aren't running, use `/start-dev` to start them.
