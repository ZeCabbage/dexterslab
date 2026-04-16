#!/bin/bash
# Find Wayland display from the user's runtime dir
XDG_RUNTIME_DIR="/run/user/$(id -u)"
WAYLAND_DISPLAY=$(ls "$XDG_RUNTIME_DIR"/wayland-* 2>/dev/null | head -1 | xargs basename 2>/dev/null)

echo "XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
echo "WAYLAND_DISPLAY=$WAYLAND_DISPLAY"

if [ -z "$WAYLAND_DISPLAY" ]; then
  echo "WARN: No wayland socket found, trying wayland-0"
  WAYLAND_DISPLAY="wayland-0"
fi

export WAYLAND_DISPLAY
export XDG_RUNTIME_DIR

echo "=== Killing Chromium ==="
pkill -f chromium 2>/dev/null || true
sleep 2

echo "=== Clearing browser cache ==="
rm -rf ~/.config/chromium/Default/Cache 2>/dev/null
rm -rf ~/.config/chromium/Default/Code\ Cache 2>/dev/null
rm -rf ~/.config/chromium/Default/"Service Worker" 2>/dev/null
rm -rf ~/.cache/chromium 2>/dev/null
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences 2>/dev/null
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences 2>/dev/null
echo "Cache cleared"

echo "=== Restarting Chromium ==="
chromium-browser \
  --app="https://dexterslab.cclottaaworld.com/observer/eye-v2" \
  --kiosk --start-fullscreen --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --no-first-run \
  --check-for-update-interval=31536000 \
  --disable-features=TranslateUI,PipeWireCameraPortal \
  --disable-pinch --overscroll-history-navigation=0 \
  --enable-features=UseOzonePlatform \
  --enable-experimental-web-platform-features \
  --ozone-platform=wayland \
  --remote-debugging-port=9222 &

sleep 8
echo "=== Result ==="
curl -s http://localhost:9222/json | python3 -c "import json,sys;p=json.load(sys.stdin);print('URL:', p[0]['url'])"
