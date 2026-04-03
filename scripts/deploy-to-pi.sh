#!/bin/bash
set -euo pipefail

log() { echo -e "\n→ $1..."; }
success() { echo -e "✓ $1"; }
fail() { echo -e "✗ $1"; exit 1; }

# ── CONFIGURATION ──
# SSH host alias "pi-deploy" is defined in ~/.ssh/config with:
#   HostName = pi.dexterslab.cclottaaworld.com
#   User = deploy
#   ProxyCommand = cloudflared access ssh --hostname %h
SSH_HOST="pi-deploy"

# ── PRE-FLIGHT CHECKS ──

log "Checking edge-daemon/ directory"
if [ ! -d "edge-daemon" ]; then
  fail "edge-daemon/ directory does not exist locally"
fi
success "edge-daemon/ directory exists"

log "Checking .env.pi"
ENV_PI_FILE="edge-daemon/.env.pi"
if [ ! -f "$ENV_PI_FILE" ]; then
  ENV_PI_FILE=".env.pi"
  if [ ! -f "$ENV_PI_FILE" ]; then
    fail ".env.pi does not exist."
  fi
fi
success ".env.pi found at $ENV_PI_FILE"

log "Checking SSH connectivity to $SSH_HOST (via Cloudflare Tunnel)"
if ! ssh -o ConnectTimeout=10 "$SSH_HOST" "echo ok" &>/dev/null; then
  fail "Cannot reach Pi via SSH host alias '$SSH_HOST'. Check ~/.ssh/config and cloudflared."
fi
success "SSH connectivity verified (Cloudflare Tunnel)"

# ── DEPLOYMENT ──
log "RSYNC to Pi"
rsync -avz --delete \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.env*' \
  --exclude 'venv/' \
  --checksum \
  -e "ssh" \
  edge-daemon/ ${SSH_HOST}:~/dexterslab-edge/
success "rsync completed"

log "Deploying .env.pi via SCP"
scp "$ENV_PI_FILE" ${SSH_HOST}:~/dexterslab-edge/.env
success ".env deployed separately"

log "Restarting observer-capture.service via SSH"
ssh "$SSH_HOST" "sudo systemctl restart observer-capture.service"
success "Target service restarted"

log "Waiting 5 seconds for daemon to stabilize..."
sleep 5

log "Checking service status (is-active)"
if ! ssh "$SSH_HOST" "systemctl is-active observer-capture.service"; then
  fail "observer-capture.service is NOT active!"
fi
success "Service is active"

log "Checking edge daemon health endpoint (via SSH)"
RESPONSE=$(ssh "$SSH_HOST" "curl -s --max-time 5 http://localhost:8891/health" || echo "FAILED")
if ! echo "$RESPONSE" | grep -q '"status":"ok"'; then
  fail "Health check failed or did not return status:ok! Response: $RESPONSE"
fi
echo "$RESPONSE"
success "Health check passed!"

log "Checking journal for startup errors"
if ssh "$SSH_HOST" "journalctl -u observer-capture.service --since '5 seconds ago' | grep -iE 'error|fatal|traceback'"; then
  fail "Daemon started but logged fatal errors. Check journalctl on Pi."
fi
success "No startup errors detected in journal"

echo ""
success "DEPLOY COMPLETE: Edge Daemon is healthy!"
exit 0
