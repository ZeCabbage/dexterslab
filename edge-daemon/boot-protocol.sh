#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  DEXTER'S LAB — Pi Boot Protocol (Master Boot Script)
#
#  Called by: observer-boot.service (systemd)
#  Runs as:  $EDGE_USER (default: deploy)
#
#  Layer 0: Clean Slate — kill zombies from previous boot
#  Layer 1: Hardware — run hw-discover.sh
#  Layer 2: Network Gate — wait for DNS + Cloudflare
#  Layer 3: Services — start edge daemon, wait for health
#  Layer 4: Monitor — watchdog loop, auto-restart on failure
#
#  Note: Chromium kiosk is launched separately by the
#        desktop autostart (observer-kiosk.sh) — it gates
#        on the edge daemon health endpoint.
# ═══════════════════════════════════════════════════════════

set -uo pipefail

LOG_TAG="[BOOT-PROTOCOL]"
EDGE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/var/log/dexterslab-boot.log"
HEALTH_URL="http://localhost:8891/health"
PC_HEALTH_URL="https://dexterslab-api.cclottaaworld.com/api/health"
VENV_PYTHON="${EDGE_DIR}/venv/bin/python"

# Max wait times (kept aggressive — each service retries internally)
NETWORK_TIMEOUT=30
DAEMON_TIMEOUT=15
PC_TIMEOUT=90

log() {
    local msg="$(date '+%Y-%m-%d %H:%M:%S') $LOG_TAG $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

# Ensure log file is writable
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/dexterslab-boot.log"

log "═══════════════════════════════════════════"
log "  DEXTER'S LAB — Boot Protocol Starting"
log "  Edge Dir: $EDGE_DIR"
log "  User: $(whoami)"
log "  Date: $(date)"
log "═══════════════════════════════════════════"

# ══════════════════════════════════════════════
#  LAYER 0 — CLEAN SLATE
# ══════════════════════════════════════════════
log "[Layer 0] Cleaning up zombie processes..."

# Kill any leftover edge daemon instances
pkill -f "python.*main.py" 2>/dev/null || true

# Kill orphaned ffmpeg processes (from video streamer)
pkill -f "ffmpeg.*v4l2" 2>/dev/null || true

# Kill orphaned pyaudio processes
pkill -f "pyaudio" 2>/dev/null || true

# Remove stale PID files
rm -f /tmp/edge-daemon.pid 2>/dev/null || true

# Wait for processes to die
sleep 1

# Verify nothing is still listening on our health port
if command -v fuser &>/dev/null; then
    fuser -k 8891/tcp 2>/dev/null || true
fi

log "[Layer 0] ✓ Clean slate established"

# ══════════════════════════════════════════════
#  LAYER 1 — HARDWARE DISCOVERY
# ══════════════════════════════════════════════
log "[Layer 1] Running hardware discovery..."

HW_SCRIPT="${EDGE_DIR}/hw-discover.sh"
if [ -x "$HW_SCRIPT" ]; then
    bash "$HW_SCRIPT" 2>&1 | while IFS= read -r line; do log "  $line"; done
    HW_EXIT=${PIPESTATUS[0]}
    if [ "$HW_EXIT" -eq 0 ]; then
        log "[Layer 1] ✓ Hardware discovery complete"
    elif [ "$HW_EXIT" -eq 1 ]; then
        log "[Layer 1] ✕ Critical hardware failure — continuing anyway"
    else
        log "[Layer 1] ⚠ Partial hardware — continuing with degraded mode"
    fi
else
    log "[Layer 1] ⚠ hw-discover.sh not found or not executable, skipping"
fi

# ── Speaker Boot Test ──
# Set speaker to max volume and announce boot immediately
log "[Layer 1.5] Speaker self-test..."
SPEAKER_CARD=""
if [ -f /tmp/hw-manifest.json ]; then
    SPEAKER_CARD=$(cat /tmp/hw-manifest.json | grep -A2 '"speaker"' | grep '"card"' | grep -oP '"\K[^"]+' | head -1)
fi

if [ -n "$SPEAKER_CARD" ]; then
    # Set volume to maximum
    amixer -c "$SPEAKER_CARD" set PCM 100% 2>/dev/null || \
    amixer -c "$SPEAKER_CARD" set Speaker 100% 2>/dev/null || \
    amixer -c "$SPEAKER_CARD" set Master 100% 2>/dev/null || true
    log "[Layer 1.5] Volume set to 100% on card $SPEAKER_CARD"

    # Announce boot via espeak-ng routed to discovered speaker
    if command -v espeak-ng &>/dev/null; then
        espeak-ng --stdout "Observer systems online" 2>/dev/null | \
            aplay -D "plughw:${SPEAKER_CARD},0" 2>/dev/null || \
            espeak-ng "Observer systems online" 2>/dev/null || true
        log "[Layer 1.5] ✓ Boot announcement played"
    fi
else
    log "[Layer 1.5] ⚠ No speaker card discovered, skipping audio test"
fi

# ══════════════════════════════════════════════
#  LAYER 2 — NETWORK GATE
# ══════════════════════════════════════════════
log "[Layer 2] Waiting for network connectivity..."

elapsed=0
while true; do
    # Test DNS resolution first
    if host dexterslab-api.cclottaaworld.com &>/dev/null 2>&1; then
        log "[Layer 2] ✓ DNS resolution successful"
        break
    fi

    # Also try nslookup as fallback
    if nslookup dexterslab-api.cclottaaworld.com &>/dev/null 2>&1; then
        log "[Layer 2] ✓ DNS resolution successful (nslookup)"
        break
    fi

    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$NETWORK_TIMEOUT" ]; then
        log "[Layer 2] ⚠ Network timeout after ${NETWORK_TIMEOUT}s — continuing anyway"
        log "[Layer 2]   Edge daemon will retry WS connections on its own"
        break
    fi

    log "[Layer 2]   Waiting for network... (${elapsed}s / ${NETWORK_TIMEOUT}s)"
    sleep 2
done

# ══════════════════════════════════════════════
#  LAYER 3 — START EDGE DAEMON
# ══════════════════════════════════════════════
log "[Layer 3] Starting edge daemon..."

cd "$EDGE_DIR"

# Activate venv if it exists
if [ -f "$VENV_PYTHON" ]; then
    log "[Layer 3] Using venv Python: $VENV_PYTHON"
else
    VENV_PYTHON="python3"
    log "[Layer 3] ⚠ No venv found, using system python3"
fi

# Start the edge daemon in the background
$VENV_PYTHON main.py &
DAEMON_PID=$!
echo "$DAEMON_PID" > /tmp/edge-daemon.pid
log "[Layer 3] Edge daemon started with PID $DAEMON_PID"

# Wait for health endpoint to respond
elapsed=0
while true; do
    if curl -s --max-time 3 "$HEALTH_URL" 2>/dev/null | grep -q '"status"'; then
        HEALTH_RESPONSE=$(curl -s --max-time 3 "$HEALTH_URL" 2>/dev/null)
        log "[Layer 3] ✓ Edge daemon healthy: $HEALTH_RESPONSE"
        break
    fi

    # Check if daemon is still alive
    if ! kill -0 "$DAEMON_PID" 2>/dev/null; then
        log "[Layer 3] ✕ Edge daemon died! Restarting..."
        $VENV_PYTHON main.py &
        DAEMON_PID=$!
        echo "$DAEMON_PID" > /tmp/edge-daemon.pid
        log "[Layer 3] Restarted with PID $DAEMON_PID"
    fi

    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$DAEMON_TIMEOUT" ]; then
        log "[Layer 3] ⚠ Daemon health timeout after ${DAEMON_TIMEOUT}s — continuing with monitoring"
        break
    fi

    sleep 2
done

# ══════════════════════════════════════════════
#  LAYER 4 — PC BACKEND READINESS (non-blocking)
# ══════════════════════════════════════════════
log "[Layer 4] Checking PC backend availability..."

# This is informational — don't block boot on it
# The edge daemon handles reconnection internally
if curl -s --max-time 5 "$PC_HEALTH_URL" 2>/dev/null | grep -q '"status":"ok"'; then
    log "[Layer 4] ✓ PC backend is reachable and healthy"
else
    log "[Layer 4] ⚠ PC backend not reachable — edge daemon will auto-reconnect"
fi

# ══════════════════════════════════════════════
#  LAYER 5 — WATCHDOG LOOP
# ══════════════════════════════════════════════
log "[Layer 5] Entering watchdog mode (checking every 30s)..."
log "═══════════════════════════════════════════"
log "  BOOT PROTOCOL COMPLETE"
log "═══════════════════════════════════════════"

CONSECUTIVE_FAILURES=0
MAX_FAILURES=3

while true; do
    sleep 30

    # Offline mode: if flag file exists, skip watchdog (offline daemon owns the process)
    if [ -f /tmp/offline-mode.flag ]; then
        continue
    fi

    # Check if daemon process is alive
    if ! kill -0 "$DAEMON_PID" 2>/dev/null; then
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        log "[Watchdog] Edge daemon PID $DAEMON_PID is dead (failure $CONSECUTIVE_FAILURES/$MAX_FAILURES)"

        if [ "$CONSECUTIVE_FAILURES" -ge "$MAX_FAILURES" ]; then
            log "[Watchdog] Too many failures, cleaning up and restarting from scratch..."
            pkill -f "python.*main.py" 2>/dev/null || true
            pkill -f "ffmpeg.*v4l2" 2>/dev/null || true
            sleep 3

            # Re-run hardware discovery before restart
            if [ -x "$HW_SCRIPT" ]; then
                bash "$HW_SCRIPT" 2>/dev/null || true
            fi

            CONSECUTIVE_FAILURES=0
        fi

        # Restart daemon
        cd "$EDGE_DIR"
        # Release health port before restart (prevents "Address already in use")
        fuser -k 8891/tcp 2>/dev/null || true
        sleep 1
        $VENV_PYTHON main.py &
        DAEMON_PID=$!
        echo "$DAEMON_PID" > /tmp/edge-daemon.pid
        log "[Watchdog] Restarted edge daemon with PID $DAEMON_PID"
        sleep 10  # Grace period
        continue
    fi

    # Check health endpoint
    HEALTH=$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "FAILED")
    if echo "$HEALTH" | grep -q '"status":"ok"'; then
        if [ "$CONSECUTIVE_FAILURES" -gt 0 ]; then
            log "[Watchdog] ✓ Edge daemon recovered"
        fi
        CONSECUTIVE_FAILURES=0
    elif echo "$HEALTH" | grep -q '"status":"degraded"'; then
        log "[Watchdog] ⚠ Edge daemon is degraded: $HEALTH"
        # Don't restart for degraded — individual services handle their own reconnection
        CONSECUTIVE_FAILURES=0
    else
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        log "[Watchdog] Health check failed ($CONSECUTIVE_FAILURES/$MAX_FAILURES): $HEALTH"
    fi
done
