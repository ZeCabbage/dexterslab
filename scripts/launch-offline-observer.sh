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

# ── Kill any existing Chromium instances to avoid session restore ──
pkill -f chromium 2>/dev/null
sleep 1

# ── Clear stale Chromium flags to prevent "restore pages" dialog ──
CHROMIUM_DIR="$HOME/.config/chromium/Default"
if [ -d "$CHROMIUM_DIR" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROMIUM_DIR/Preferences" 2>/dev/null
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROMIUM_DIR/Preferences" 2>/dev/null
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
  "--enable-features=UseOzonePlatform,FaceDetection" # Enable experimental FaceDetection API
  "--ozone-platform=wayland"
  "--allow-file-access-from-files"  # Crucial for local file access and local media
  "--use-fake-ui-for-media-stream"  # Auto-allow camera/mic permissions
)

chromium-browser "${FLAGS[@]}"
