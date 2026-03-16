#!/bin/bash
# ═══════════════════════════════════════════
#  OBSERVER HUB — Kiosk Launcher
#  Launches Chromium in kiosk mode on boot
#  pointing at the Observer Hub.
# ═══════════════════════════════════════════

OBSERVER_URL="http://localhost:7777/observer"
MAX_WAIT=60  # seconds to wait for the server

echo "[observer-kiosk] Waiting for Next.js server on port 7777..."

# Wait for the dev server to be ready
elapsed=0
while ! curl -s -o /dev/null -w '' "$OBSERVER_URL" 2>/dev/null; do
  sleep 2
  elapsed=$((elapsed + 2))
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "[observer-kiosk] Timed out waiting for server after ${MAX_WAIT}s"
    exit 1
  fi
done

echo "[observer-kiosk] Server is ready. Launching Chromium kiosk..."

# Hide the mouse cursor (for touchscreen / display-only setups)
unclutter -idle 0.5 -root &

# Launch Chromium in kiosk mode
# --app=URL         : opens without browser chrome (address bar, tabs)
# --kiosk           : fullscreen kiosk mode
# --noerrdialogs    : suppress error dialogs
# --disable-infobars: no "Chrome is being controlled" bar
# --no-first-run    : skip first-run wizard
# --check-for-update-interval=31536000 : disable update checks
# --use-fake-ui-for-media-stream : auto-approve mic permissions
chromium-browser \
  --app="$OBSERVER_URL" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  --check-for-update-interval=31536000 \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0
