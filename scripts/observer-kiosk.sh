#!/bin/bash
# ═══════════════════════════════════════════
#  OBSERVER HUB — Kiosk Launcher
#  Launches Chromium in fullscreen kiosk mode
#  for the 5" circular display on Raspberry Pi.
#
#  Waits for the Next.js server, then opens
#  Chromium with all UI chrome hidden.
# ═══════════════════════════════════════════

OBSERVER_URL="http://localhost:3000/observer"
MAX_WAIT=90  # seconds to wait for the server

LOG_TAG="[observer-kiosk]"

echo "$LOG_TAG Starting kiosk launcher..."
echo "$LOG_TAG Target: $OBSERVER_URL"

# ── Wait for the Next.js server to be ready ──
echo "$LOG_TAG Waiting for Next.js server on port 3000..."
elapsed=0
while ! curl -s -o /dev/null -w '' "$OBSERVER_URL" 2>/dev/null; do
  sleep 2
  elapsed=$((elapsed + 2))
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "$LOG_TAG ✕ Timed out waiting for server after ${MAX_WAIT}s"
    exit 1
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
# Flags explained:
#   --app=URL                    : opens without browser chrome (no address bar, tabs)
#   --kiosk                      : fullscreen kiosk mode (no window decorations)
#   --start-fullscreen           : ensure fullscreen on Wayland
#   --noerrdialogs               : suppress error dialogs
#   --disable-infobars           : no "Chrome is being controlled" bar
#   --disable-session-crashed-bubble : no "restore pages" prompt
#   --no-first-run               : skip first-run wizard
#   --check-for-update-interval  : disable update checks (1 year)
#   --use-fake-ui-for-media-stream : auto-approve mic permissions (for STT)
#   --autoplay-policy            : allow auto-playing audio
#   --disable-features=TranslateUI : no translate popups
#   --disable-pinch              : disable pinch zoom on touch
#   --overscroll-history-navigation=0 : disable swipe navigation
#   --enable-features=UseOzonePlatform : Wayland support
#   --ozone-platform=wayland     : use Wayland backend
chromium-browser \
  --app="$OBSERVER_URL" \
  --kiosk \
  --start-fullscreen \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  --check-for-update-interval=31536000 \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --enable-features=UseOzonePlatform \
  --enable-experimental-web-platform-features \
  --ozone-platform=wayland
