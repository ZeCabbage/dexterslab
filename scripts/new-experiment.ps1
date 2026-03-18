# ═══════════════════════════════════════════
# DEXTER'S LAB — New Experiment Scaffold
# Creates a new experiment route + registry entry + Git branch
# ═══════════════════════════════════════════
#
# Usage:
#   .\scripts\new-experiment.ps1 -Slug "my-app" -Name "MY APP" -Description "A cool experiment" -Icon "🔬"
#
# This will:
#   1. Create app/<slug>/page.tsx and app/<slug>/page.module.css
#   2. Add an entry to data/experiments.json with status "wip"
#   3. Create and checkout Git branch experiment/<slug>

param(
    [Parameter(Mandatory=$true)]
    [string]$Slug,

    [Parameter(Mandatory=$true)]
    [string]$Name,

    [Parameter(Mandatory=$true)]
    [string]$Description,

    [Parameter(Mandatory=$false)]
    [string]$Icon = "🧪"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FrontendDir = Join-Path $RepoRoot "dexterslab-frontend"
$AppDir = Join-Path $FrontendDir "app"
$DataDir = Join-Path $FrontendDir "data"
$ExperimentsFile = Join-Path $DataDir "experiments.json"

# Normalize slug (lowercase, hyphens only)
$Slug = $Slug.ToLower() -replace '[^a-z0-9-]', '-' -replace '-+', '-' -replace '^-|-$', ''

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   DEXTER'S LAB — New Experiment Scaffold  ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Name:        $Name" -ForegroundColor Green
Write-Host "  Slug:        $Slug" -ForegroundColor Green
Write-Host "  Route:       /$Slug" -ForegroundColor Green
Write-Host "  Icon:        $Icon" -ForegroundColor Green
Write-Host "  Description: $Description" -ForegroundColor Green
Write-Host ""

# ── 1. Create route folder ──
$RouteDir = Join-Path $AppDir $Slug

if (Test-Path $RouteDir) {
    Write-Host "  ERROR: Route folder already exists: $RouteDir" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $RouteDir -Force | Out-Null
Write-Host "  Created: app/$Slug/" -ForegroundColor Yellow

# ── 2. Create page.tsx ──
$PageContent = @"
'use client';

/**
 * $Name — Experiment Page
 * $Description
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function ${Slug -replace '-',''}Page() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.container}>
      {/* CRT scanlines */}
      <div className="crt-scanlines" />

      <div className={styles.content}>
        {/* Header */}
        <header className={styles.header}>
          <Link href="/" className={styles.backLink}>← BACK TO LAB</Link>
          <div className={styles.titleRow}>
            <span className={styles.icon}>$Icon</span>
            <h1 className={styles.title}>$Name</h1>
          </div>
          <p className={styles.subtitle}>$Description</p>
          <span className={styles.clock}>{time}</span>
        </header>

        {/* Main content — start building here */}
        <main className={styles.main}>
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>$Icon</span>
            <h2>EXPERIMENT INITIALIZED</h2>
            <p>This is your blank canvas. Start building!</p>
          </div>
        </main>
      </div>
    </div>
  );
}
"@

Set-Content -Path (Join-Path $RouteDir "page.tsx") -Value $PageContent -Encoding UTF8
Write-Host "  Created: app/$Slug/page.tsx" -ForegroundColor Yellow

# ── 3. Create page.module.css ──
$CssContent = @"
/* ═══════════════════════════════════════════
   $Name — Experiment Styles
   Dexter's Lab retro-futuristic theme
   ═══════════════════════════════════════════ */

.container {
  min-height: 100vh;
  background: var(--color-bg, #06060e);
  color: var(--color-text, #e0e0e0);
  position: relative;
  overflow: hidden;
}

.content {
  position: relative;
  z-index: 2;
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* ── Header ── */
.header {
  margin-bottom: 2rem;
  text-align: center;
}

.backLink {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--color-cyan, #00ffe0);
  text-decoration: none;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.backLink:hover {
  opacity: 1;
}

.titleRow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.icon {
  font-size: 2rem;
}

.title {
  font-family: 'Courier New', monospace;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--color-cyan, #00ffe0);
  text-shadow: 0 0 20px rgba(0, 255, 224, 0.3);
  margin: 0;
}

.subtitle {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: var(--color-muted, #556);
  letter-spacing: 0.1em;
  margin-top: 0.5rem;
}

.clock {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: var(--color-amber, #ffaa00);
  letter-spacing: 0.15em;
}

/* ── Main ── */
.main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.placeholder {
  border: 1px dashed var(--color-cyan, #00ffe0);
  border-radius: 8px;
  padding: 4rem 2rem;
  text-align: center;
  opacity: 0.6;
}

.placeholderIcon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
}

.placeholder h2 {
  font-family: 'Courier New', monospace;
  font-size: 1.2rem;
  color: var(--color-cyan, #00ffe0);
  letter-spacing: 0.15em;
  margin: 0 0 0.5rem;
}

.placeholder p {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: var(--color-muted, #556);
}
"@

Set-Content -Path (Join-Path $RouteDir "page.module.css") -Value $CssContent -Encoding UTF8
Write-Host "  Created: app/$Slug/page.module.css" -ForegroundColor Yellow

# ── 4. Update experiments.json ──
$experiments = Get-Content $ExperimentsFile -Raw | ConvertFrom-Json

# Check for duplicate route
$existingRoute = $experiments | Where-Object { $_.route -eq "/$Slug" }
if ($existingRoute) {
    Write-Host "  WARNING: Route /$Slug already exists in experiments.json, skipping registry update" -ForegroundColor Yellow
} else {
    $newExp = [PSCustomObject]@{
        name        = $Name
        route       = "/$Slug"
        description = $Description
        status      = "wip"
        icon        = $Icon
    }

    $experiments += $newExp
    $experiments | ConvertTo-Json -Depth 10 | Set-Content $ExperimentsFile -Encoding UTF8
    Write-Host "  Updated: data/experiments.json (added $Name)" -ForegroundColor Yellow
}

# ── 5. Create Git branch ──
Push-Location $RepoRoot
try {
    $branchName = "experiment/$Slug"
    $existingBranch = git branch --list $branchName 2>$null
    if ($existingBranch) {
        Write-Host "  Branch $branchName already exists, checking it out" -ForegroundColor Yellow
        git checkout $branchName
    } else {
        git checkout -b $branchName
        Write-Host "  Created branch: $branchName" -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │  Experiment scaffolded successfully!     │" -ForegroundColor Green
Write-Host "  │                                         │" -ForegroundColor Green
Write-Host "  │  Route:  http://localhost:7777/$Slug     " -ForegroundColor Green
Write-Host "  │  Branch: experiment/$Slug                " -ForegroundColor Green
Write-Host "  │                                         │" -ForegroundColor Green
Write-Host "  │  Run /start-dev to preview it           │" -ForegroundColor Green
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""
