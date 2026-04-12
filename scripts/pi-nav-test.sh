#!/bin/bash
# Force hard reload via CDP - navigate to blank then back to flush cache
PAGE_ID=$(curl -s http://localhost:9222/json | python3 -c "import json,sys;p=json.load(sys.stdin);print(p[0]['id'])")
echo "Page: $PAGE_ID"

echo "Step 1: Navigate to about:blank to flush page..."
curl -s -o /dev/null "http://localhost:9222/json/navigate/${PAGE_ID}?url=about:blank"
sleep 2

echo "Step 2: Clear cache via CDP..."
# Use CDP WebSocket protocol to clear cache
python3 -c "
import json, websocket
ws_url = 'ws://localhost:9222/devtools/page/${PAGE_ID}'
ws = websocket.create_connection(ws_url, timeout=5)
# Clear browser cache
ws.send(json.dumps({'id':1,'method':'Network.clearBrowserCache'}))
print('Cache clear:', ws.recv())
# Disable cache
ws.send(json.dumps({'id':2,'method':'Network.setCacheDisabled','params':{'cacheDisabled':True}}))
print('Cache disabled:', ws.recv())
ws.close()
" 2>/dev/null || echo "CDP websocket not available, skipping cache clear"

sleep 1
echo "Step 3: Navigate to eye-v2..."
curl -s -o /dev/null "http://localhost:9222/json/navigate/${PAGE_ID}?url=https://dexterslab.cclottaaworld.com/observer/eye-v2"
echo "Done - page should show updated shader"
