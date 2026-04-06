#!/bin/bash
# ═══════════════════════════════════════════
#  OBSERVER HUB — Kiosk Launcher
#  Launches Chromium in fullscreen kiosk mode
#  for the 5" circular display on Raspberry Pi.
#
#  Connects to the PC frontend via Cloudflare Tunnel.
# ═══════════════════════════════════════════

# ── Config ──
LOG_TAG="[OBSERVER-KIOSK]"
OBSERVER_URL="https://dexterslab.cclottaaworld.com/observer"
MAX_WAIT=90  # seconds to wait for the server

echo "$LOG_TAG Starting kiosk launcher..."
echo "$LOG_TAG Target: $OBSERVER_URL"

# ── Wait for Cloudflare / server to be reachable ──
echo "$LOG_TAG Waiting for server at $OBSERVER_URL..."
elapsed=0
while ! curl -s -o /dev/null -w '' "$OBSERVER_URL" 2>/dev/null; do
  sleep 2
  elapsed=$((elapsed + 2))
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "$LOG_TAG ✕ Timed out waiting for server after ${MAX_WAIT}s"
    echo "$LOG_TAG ⚠ Auto-launching OFFLINE OBSERVER fallback..."
    bash "$HOME/Desktop/dexterslab/scripts/launch-offline-observer.sh"
    exit 0
  fi
  echo "$LOG_TAG   waiting... (${elapsed}s / ${MAX_WAIT}s)"
done

echo "$LOG_TAG ✓ Server is ready!"

# ── Hide the mouse cursor ──
if command -v unclutter &>/dev/null; then
  unclutter -idle 0.5 -root &
  echo "$LOG_TAG   Cursor hidden (unclutter)"
else
  echo "$LOG_TAG   ⚠ unclutter not installed — cursor will be visible"
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

echo "$LOG_TAG Launching Chromium kiosk..."

# ── Launch Chromium in fullscreen kiosk mode ──
# All connections go through Cloudflare (HTTPS), so no insecure-origin flags needed.
FLAGS=(
  # Opens without browser chrome (no address bar, tabs)
  "--app=$OBSERVER_URL"
  # Fullscreen kiosk mode (no window decorations)
  "--kiosk"
  # Ensure fullscreen on Wayland
  "--start-fullscreen"
  # Suppress error dialogs
  "--noerrdialogs"
  # No "Chrome is being controlled" bar
  "--disable-infobars"
  # No "restore pages" prompt
  "--disable-session-crashed-bubble"
  # Skip first-run wizard
  "--no-first-run"
  # Disable update checks (1 year)
  "--check-for-update-interval=31536000"
  # No translate popups and disable PipeWire camera portal
  "--disable-features=TranslateUI,PipeWireCameraPortal"
  # Disable pinch zoom on touch
  "--disable-pinch"
  # Disable swipe navigation
  "--overscroll-history-navigation=0"
  # Wayland support
  "--enable-features=UseOzonePlatform"
  # Enable experimental web features for WebGL/rendering
  "--enable-experimental-web-platform-features"
  # Use Wayland backend
  "--ozone-platform=wayland"
  # Enable remote debugging for headless diagnostics
  "--remote-debugging-port=9222"
)

chromium-browser "${FLAGS[@]}"
