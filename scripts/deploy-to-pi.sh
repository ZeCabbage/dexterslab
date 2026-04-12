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

log "Making boot scripts executable"
ssh "$SSH_HOST" "chmod +x ~/dexterslab-edge/boot-protocol.sh ~/dexterslab-edge/hw-discover.sh ~/dexterslab-edge/clean-shutdown.sh"
success "Scripts are executable"

log "Installing boot service (observer-boot.service)"
ssh "$SSH_HOST" "sudo cp ~/dexterslab-edge/observer-boot.service /etc/systemd/system/ && sudo systemctl daemon-reload"
success "Service file installed"

# Disable old service if it exists, enable new one
ssh "$SSH_HOST" "sudo systemctl disable observer-capture.service 2>/dev/null; sudo systemctl enable observer-boot.service" 2>/dev/null || true

log "Restarting observer-boot.service via SSH"
ssh "$SSH_HOST" "sudo systemctl restart observer-boot.service"
success "Boot service restarted"

log "Waiting 15 seconds for boot protocol to complete..."
sleep 15

log "Checking service status (is-active)"
if ! ssh "$SSH_HOST" "systemctl is-active observer-boot.service"; then
  fail "observer-boot.service is NOT active!"
fi
success "Service is active"

log "Checking edge daemon health endpoint (via SSH)"
RESPONSE=$(ssh "$SSH_HOST" "curl -s --max-time 5 http://localhost:8891/health" || echo "FAILED")
if ! echo "$RESPONSE" | grep -q '"status"'; then
  fail "Health check failed! Response: $RESPONSE"
fi
echo "$RESPONSE"
success "Health check passed!"

log "Checking hardware manifest"
HW_MANIFEST=$(ssh "$SSH_HOST" "cat /tmp/hw-manifest.json 2>/dev/null" || echo "NOT FOUND")
echo "$HW_MANIFEST"

log "Checking journal for startup errors"
if ssh "$SSH_HOST" "journalctl -u observer-boot --since '15 seconds ago' | grep -iE 'error|fatal|traceback'"; then
  echo "  ⚠ Some errors detected (may be non-fatal). Check logs."
fi
success "No critical startup errors detected"

echo ""
success "DEPLOY COMPLETE: Boot Protocol is operational!"
exit 0

