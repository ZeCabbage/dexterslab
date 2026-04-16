#!/bin/bash
# launch-offline-hub.sh — Clean Online → Offline handoff
# Implements Mode Isolation Protocol

LOG_TAG="[OFFLINE-HUB-LAUNCH]"
MODE_FLAG="/tmp/mode.flag"
EDGE_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$HOME/Desktop/dexterslab/dexterslab-frontend/public"
HUB_HTML="file://$FRONTEND_DIR/offline-hub.html"
VENV_PYTHON="$EDGE_DIR/../venv/bin/python"

echo "$LOG_TAG ════════════════════════════════════════"
echo "$LOG_TAG  Switching to OFFLINE MODE"
echo "$LOG_TAG ════════════════════════════════════════"

# ── Step 1: Write mode flag ──
echo "offline" > "$MODE_FLAG"
echo "$LOG_TAG Mode flag set to 'offline'"

# ── Step 2: Gracefully stop the online edge daemon ──
echo "$LOG_TAG Stopping edge-daemon..."
sudo systemctl stop edge-daemon 2>/dev/null
sleep 1

# Also kill any stray main.py processes
pkill -f "main.py$" 2>/dev/null
pkill -f "main.py --offline" 2>/dev/null

# ── Step 3: Verify PIDs are dead ──
sleep 2
if pgrep -f "main.py" > /dev/null 2>&1; then
    echo "$LOG_TAG ⚠ main.py still running — force killing"
    pkill -9 -f "main.py" 2>/dev/null
    sleep 1
fi
echo "$LOG_TAG Edge daemon stopped"

# ── Step 4: Force-release hardware ──
echo "$LOG_TAG Releasing hardware devices..."
for card in 0 1 2 3 4; do
    fuser -k "/dev/snd/pcmC${card}D0c" 2>/dev/null
    fuser -k "/dev/snd/pcmC${card}D0p" 2>/dev/null
done
for vid in 0 1 2 3 4; do
    [ -e "/dev/video${vid}" ] && fuser -k "/dev/video${vid}" 2>/dev/null
done
# Kill orphaned ffmpeg
pkill -f "ffmpeg.*v4l2" 2>/dev/null
sleep 1
echo "$LOG_TAG Hardware released"

# ── Step 5: Kill any existing offline hub daemon ──
pkill -f "offline_hub_daemon.py" 2>/dev/null
sleep 1

# ── Step 6: Start Offline Hub daemon ──
echo "$LOG_TAG Starting Offline Hub daemon..."
if [ -x "$VENV_PYTHON" ]; then
    "$VENV_PYTHON" "$EDGE_DIR/offline_hub_daemon.py" &
else
    python3 "$EDGE_DIR/offline_hub_daemon.py" &
fi
HUB_PID=$!
echo "$LOG_TAG Hub daemon PID: $HUB_PID"

# Wait for WebSocket to be ready
sleep 3

# ── Step 7: Check if HTML file exists ──
if [ ! -f "$FRONTEND_DIR/offline-hub.html" ]; then
    echo "$LOG_TAG ✕ ERROR: offline-hub.html not found at $FRONTEND_DIR"
    echo "$LOG_TAG Attempting fallback path..."
    FRONTEND_DIR="/home/deploy/dexterslab/dexterslab-frontend/public"
    HUB_HTML="file://$FRONTEND_DIR/offline-hub.html"
    if [ ! -f "$FRONTEND_DIR/offline-hub.html" ]; then
        echo "$LOG_TAG ✕ FATAL: No offline-hub.html found"
        exit 1
    fi
fi

# ── Step 8: Open in Chromium kiosk ──
echo "$LOG_TAG Opening: $HUB_HTML"

# Kill existing Chromium instances
pkill -f "chromium" 2>/dev/null
sleep 1

DISPLAY=:0 chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --check-for-update-interval=31536000 \
  --disable-features=TranslateUI \
  --disable-component-update \
  --autoplay-policy=no-user-gesture-required \
  --window-size=1080,1080 \
  --window-position=0,0 \
  "$HUB_HTML" &

echo "$LOG_TAG ════════════════════════════════════════"
echo "$LOG_TAG  OFFLINE HUB ACTIVE"
echo "$LOG_TAG  Display: $HUB_HTML"
echo "$LOG_TAG  Daemon:  ws://0.0.0.0:8894"
echo "$LOG_TAG ════════════════════════════════════════"
