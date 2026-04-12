#!/bin/bash
# ═══════════════════════════════════════════
#  OBSERVER HUB — Kiosk Launcher
#  Launches Chromium in fullscreen kiosk mode
#  for the 5" circular display on Raspberry Pi.
#
#  Connects to the PC frontend via Cloudflare Tunnel.
#
#  Boot Gate Order:
#    1. Wait for local edge daemon to be healthy
#    2. Wait for PC backend to be reachable
#    3. Launch Chromium
#    4. Fallback to offline mode if both fail
# ═══════════════════════════════════════════

# ── Config ──
LOG_TAG="[OBSERVER-KIOSK]"
OBSERVER_URL="https://dexterslab.cclottaaworld.com/observer"
EDGE_HEALTH_URL="http://localhost:8891/health"
MAX_EDGE_WAIT=20    # seconds to wait for local edge daemon (should already be up)
MAX_SERVER_WAIT=45  # seconds to wait for PC backend
OFFLINE_SCRIPT="$HOME/Desktop/dexterslab/scripts/launch-offline-observer.sh"

echo "$LOG_TAG Starting kiosk launcher..."
echo "$LOG_TAG Target: $OBSERVER_URL"

# ── Gate 1: Wait for Local Edge Daemon ──
echo "$LOG_TAG [Gate 1] Waiting for edge daemon at $EDGE_HEALTH_URL..."
elapsed=0
edge_ready=false
while [ "$elapsed" -lt "$MAX_EDGE_WAIT" ]; do
  RESPONSE=$(curl -s --max-time 3 "$EDGE_HEALTH_URL" 2>/dev/null)
  if echo "$RESPONSE" | grep -q '"status"'; then
    echo "$LOG_TAG [Gate 1] ✓ Edge daemon is healthy!"
    echo "$LOG_TAG   Response: $RESPONSE"
    edge_ready=true
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  echo "$LOG_TAG [Gate 1]   waiting... (${elapsed}s / ${MAX_EDGE_WAIT}s)"
done

if [ "$edge_ready" = false ]; then
  echo "$LOG_TAG [Gate 1] ⚠ Edge daemon not ready after ${MAX_EDGE_WAIT}s"
  echo "$LOG_TAG   Continuing to check server anyway..."
fi

# ── Gate 2: Wait for PC Backend (via Cloudflare) ──
echo "$LOG_TAG [Gate 2] Waiting for server at $OBSERVER_URL..."
elapsed=0
server_ready=false
while [ "$elapsed" -lt "$MAX_SERVER_WAIT" ]; do
  if curl -s -o /dev/null -w '' "$OBSERVER_URL" 2>/dev/null; then
    echo "$LOG_TAG [Gate 2] ✓ Server is ready!"
    server_ready=true
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  echo "$LOG_TAG [Gate 2]   waiting... (${elapsed}s / ${MAX_SERVER_WAIT}s)"
done

if [ "$server_ready" = false ]; then
  echo "$LOG_TAG [Gate 2] ✕ Timed out waiting for server after ${MAX_SERVER_WAIT}s"
  echo "$LOG_TAG ⚠ Auto-launching OFFLINE OBSERVER fallback..."
  if [ -f "$OFFLINE_SCRIPT" ]; then
    bash "$OFFLINE_SCRIPT"
  else
    echo "$LOG_TAG ✕ Offline script not found at $OFFLINE_SCRIPT"
  fi
  exit 0
fi

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
