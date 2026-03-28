#!/bin/bash
set -euo pipefail

log() { echo -e "\n→ $1..."; }
success() { echo -e "✓ $1"; }
fail() { echo -e "✗ $1"; exit 1; }

# Find .env.development
ENV_FILE="dexterslab-backend/.env.development"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env.development"
fi
if [ ! -f "$ENV_FILE" ]; then
  fail "Could not find .env.development"
fi

# Trim carriage returns using tr -d '\r' 
PI_TAILSCALE_IP=$(grep "^PI_TAILSCALE_IP=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '\r\n')
if [ -z "$PI_TAILSCALE_IP" ]; then
  fail "PI_TAILSCALE_IP not found in $ENV_FILE"
fi

# ── PRE-FLIGHT CHECKS ──
log "Pinging $PI_TAILSCALE_IP"
if ! ping -n 1 "$PI_TAILSCALE_IP" &>/dev/null && ! ping -c 1 "$PI_TAILSCALE_IP" &>/dev/null; then
  fail "Pi at $PI_TAILSCALE_IP is unreachable via ping"
fi
success "Pinged $PI_TAILSCALE_IP successfully"

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

# SSH host alias "pi-deploy" is defined in ~/.ssh/config with:
#   HostName = PI Tailscale IP, User = deploy, IdentityFile = ~/.ssh/id_ed25519
SSH_HOST="pi-deploy"
log "Checking SSH connectivity to $SSH_HOST"
if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "echo ok" &>/dev/null; then
  fail "Cannot reach Pi via SSH host alias '$SSH_HOST'. Check ~/.ssh/config and Tailscale."
fi
success "SSH connectivity verified"

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

log "Checking edge daemon health endpoint"
HEALTH_URL="http://${PI_TAILSCALE_IP}:8891/health"
RESPONSE=$(curl -s --max-time 5 "$HEALTH_URL" || echo "FAILED")
if ! echo "$RESPONSE" | grep -q '"status":"ok"'; then
  fail "Health check failed or did not return status:ok! Response: $RESPONSE"
fi
echo "$RESPONSE"
success "Health check passed!"

log "Checking journal for startup errors"
# If grep FINDS an error, it returns 0 (which triggers the if block to fail the deploy)
if ssh "$SSH_HOST" "journalctl -u observer-capture.service --since '5 seconds ago' | grep -iE 'error|fatal|traceback'"; then
  fail "Daemon started but logged fatal errors. Check journalctl on Pi."
fi
success "No startup errors detected in journal"

echo ""
success "DEPLOY COMPLETE: Edge Daemon is healthy!"
exit 0
