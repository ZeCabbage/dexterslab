---
description: Scaffold a new experiment (route, CSS, registry entry, Git branch)
---

# New Experiment

Create a new experiment in Dexter's Lab.

// turbo-all

## Gather Info

1. Ask the user for the following details:
   - **Name**: Display name (e.g. `MY COOL APP`)
   - **Slug**: URL-safe route (e.g. `my-cool-app`) — will become `localhost:7777/<slug>`
   - **Description**: One-line description of the experiment
   - **Icon**: Single emoji icon (default: 🧪)

## Scaffold

2. Run the scaffold script:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab; .\scripts\new-experiment.ps1 -Slug "<slug>" -Name "<NAME>" -Description "<description>" -Icon "<icon>"
```
> Confirm the script created the route folder, page files, updated the registry, and created the Git branch.

3. If dev servers aren't running, start them:
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-backend && node --watch server.js
```
```powershell
cd C:\Users\holme\OneDrive\Desktop\dexterslab\dexterslab-frontend && npx next dev -p 7777
```

4. Verify the experiment appears on the landing page by checking `http://localhost:7777` in a browser. The new card should show with "IN DEV" status.

5. Navigate to `http://localhost:7777/<slug>` to confirm the scaffold page loads.

6. Report to user:
> Experiment `<NAME>` scaffolded:
> - Route: `http://localhost:7777/<slug>`
> - Branch: `experiment/<slug>`
> - Registry: `data/experiments.json` updated
> - Ready to develop! Edit `app/<slug>/page.tsx` to build your experiment.
