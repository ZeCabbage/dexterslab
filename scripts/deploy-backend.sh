#!/bin/bash
set -euo pipefail

log() { echo -e "\n→ $1..."; }
success() { echo -e "✓ $1"; }
fail() { echo -e "✗ $1"; exit 1; }

log "Git Status and Last 3 Commits"
git status
echo ""
git log -3 --oneline

cd dexterslab-backend

log "Running npm ci --production"
npm ci --production
success "npm ci finished"

log "Checking for .env"
if [ ! -f ".env" ]; then
  fail "dexterslab-backend/.env does not exist! Please duplicate .env.example to .env and configure."
fi
success ".env exists"

log "Running node:test syntax blockades"
node --test tests/phase7-integration.test.js || fail "Integration tests failed! Aborting deploy."
success "Tests passed cleanly"

log "Restarting via PM2"
if pm2 show dexterslab-backend &>/dev/null; then
  pm2 restart dexterslab-backend
else
  pm2 start server.js --name dexterslab-backend --cwd ./
fi
success "PM2 script applied"

log "Waiting 2 seconds..."
sleep 2

log "Hitting backend health endpoint"
RES=$(curl -s http://localhost:8888/health || echo "FAILED")
if echo "$RES" | grep -q '"status":"ok"'; then
  success "Health check ok"
else
  fail "Health check failed or did not return status:ok! Response: $RES"
fi
echo "$RES"

log "PM2 Logs for dexterslab-backend (last 10 lines)"
pm2 logs dexterslab-backend --lines 10 --nostream

exit 0
