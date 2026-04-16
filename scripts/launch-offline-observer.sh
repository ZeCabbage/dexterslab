#!/bin/bash
# ═══════════════════════════════════════════
#  OFFLINE OBSERVER — Kiosk Launcher
#  Launches Chromium in fullscreen kiosk mode
#  pointing to the local offline-observer.html
#  No Next.js backend, no WiFi required.
# ═══════════════════════════════════════════

LOG_TAG="[OFFLINE-OBSERVER]"

# The local standalone HTML file
TARGET_FILE="$HOME/Desktop/dexterslab/dexterslab-frontend/public/offline-observer.html"
OFFLINE_URL="file://$TARGET_FILE"

echo "$LOG_TAG Starting offline kiosk launcher..."
echo "$LOG_TAG Target: $OFFLINE_URL"

if [ ! -f "$TARGET_FILE" ]; then
  echo "$LOG_TAG ✕ ERROR: Offline HTML file not found at $TARGET_FILE"
  echo "$LOG_TAG   Please ensure dexterslab frontend is cloned correctly."
  exit 1
fi

# ── Hide the mouse cursor ──
if command -v unclutter &>/dev/null; then
  unclutter -idle 0.5 -root &
  echo "$LOG_TAG   Cursor hidden (unclutter)"
fi

# ── Kill any existing instances to avoid conflicts ──
pkill -f chromium 2>/dev/null
pkill -f ffmpeg 2>/dev/null
pkill -f "main.py --offline" 2>/dev/null
sleep 1

# ── Start Local Python Edge Daemon ──
echo "$LOG_TAG Starting local offline Python edge daemon..."
cd "$HOME/dexterslab-edge"
source venv/bin/activate 2>/dev/null || true
python3 main.py --offline &
DAEMON_PID=$!
sleep 2 # wait for ws to spin up

# ── Clear stale Chromium flags to prevent "restore pages" dialog ──
CHROMIUM_DIR="$HOME/.config/chromium/Default"
if [ -d "$CHROMIUM_DIR" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROMIUM_DIR/Preferences" 2>/dev/null
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROMIUM_DIR/Preferences" 2>/dev/null
fi

if [ "$1" == "--wifi" ]; then
  echo "$LOG_TAG Triggering WiFi config UI format..."
  OFFLINE_URL="${OFFLINE_URL}#wifi"
fi

echo "$LOG_TAG Launching Chromium kiosk directly to local file..."

# ── Launch Chromium in fullscreen kiosk mode ──
FLAGS=(
  "--app=$OFFLINE_URL"
  "--kiosk"
  "--start-fullscreen"
  "--noerrdialogs"
  "--disable-infobars"
  "--disable-session-crashed-bubble"
  "--no-first-run"
  "--check-for-update-interval=31536000"
  "--disable-features=TranslateUI,PipeWireCameraPortal"
  "--disable-pinch"
  "--overscroll-history-navigation=0"
  "--enable-features=UseOzonePlatform" 
  "--ozone-platform=wayland"
  "--allow-file-access-from-files"
)

chromium-browser "${FLAGS[@]}"

# Cleanup daemon on exit
kill $DAEMON_PID 2>/dev/null

