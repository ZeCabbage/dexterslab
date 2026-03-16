---
description: Push code to GitHub and deploy to PC for Observer Hub (dexterslab.cclottaaworld.com)
---

# Push to Observer

Commit all changes, run security check, push to GitHub, and deploy on the PC.

## Pre-flight: Security Check

// turbo-all

1. Check for secrets, passwords, or API keys in staged files:
```bash
cd /Users/dexterholmes/Documents/GitHub/dexterslab && git diff --cached --name-only | xargs grep -l -E "(password|secret|api_key|apikey|token|GEMINI_API_KEY)" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.env" 2>/dev/null; echo "Security check complete"
```
If any files are flagged, STOP and review them before continuing. Never push `.env` files with real credentials.

2. Make sure `.env` files are gitignored:
```bash
cd /Users/dexterholmes/Documents/GitHub/dexterslab && grep -q ".env" .gitignore 2>/dev/null && echo ".env is gitignored" || echo "WARNING: .env is NOT in .gitignore"
```

## Push to GitHub

3. Stage all changes:
```bash
cd /Users/dexterholmes/Documents/GitHub/dexterslab && git add -A
```

4. Show what will be committed:
```bash
cd /Users/dexterholmes/Documents/GitHub/dexterslab && git status --short
```

5. Commit with a descriptive message (use context from recent changes):
```bash
cd /Users/dexterholmes/Documents/GitHub/dexterslab && git commit -m "<descriptive message based on changes>"
```

6. Push to origin main:
```bash
cd /Users/dexterholmes/Documents/GitHub/dexterslab && git push origin main
```

## Deploy on PC

7. SSH into PC and pull latest code:
```bash
ssh pc "cd C:\Users\holme\Desktop\dexterslab && git pull origin main"
```

8. Install dependencies on PC:
```bash
ssh pc "cd C:\Users\holme\Desktop\dexterslab\dexterslab-backend && npm install && cd ..\dexterslab-frontend && npm install"
```

9. Build frontend on PC:
```bash
ssh pc "cd C:\Users\holme\Desktop\dexterslab\dexterslab-frontend && npm run build"
```

10. Notify user that deploy is complete:
> Code pushed and deployed to PC. Live at `dexterslab.cclottaaworld.com`.
> If services need restarting, SSH in with `ssh pc` and restart them.
