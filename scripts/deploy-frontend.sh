#!/bin/bash
set -euo pipefail

log() { echo -e "\n→ $1..."; }
success() { echo -e "✓ $1"; }
fail() { echo -e "✗ $1"; exit 1; }

cd dexterslab-frontend

log "Checking for frontend .env.local"
if [ ! -f ".env.local" ]; then
  fail "dexterslab-frontend/.env.local does not exist!"
fi
success ".env.local exists"

log "Building frontend (npm run build)"
if ! OUTPUT=$(npm run build 2>&1); then
  echo "$OUTPUT" | tail -n 50
  fail "Frontend build failed!"
fi
success "Frontend built successfully"

log "Restarting via PM2"
if pm2 show dexterslab-frontend &>/dev/null; then
  pm2 restart dexterslab-frontend
else
  pm2 start npm --name dexterslab-frontend -- start --cwd ./
fi
success "PM2 applied for frontend"

log "Waiting 2 seconds..."
sleep 2

log "Hitting frontend root endpoint"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  success "HTTP 200 OK received from localhost:3000"
else
  fail "Frontend did not return HTTP 200. Returned: $HTTP_STATUS"
fi

log "PM2 Status for dexterslab-frontend"
pm2 status dexterslab-frontend

exit 0
