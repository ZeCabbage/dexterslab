#!/bin/bash
# 1. Kill any existing ffmpeg processes owned by thecabbage
killall -u thecabbage ffmpeg 2>/dev/null
echo "Killed Chromium ffmpeg instances"

# 2. Check current page
PAGE_URL=$(curl -s http://localhost:9222/json | grep -o '"url": "[^"]*' | head -1 | cut -d'"' -f4)
echo "Current URL: $PAGE_URL"

# 3. Create a python CDP navigator script
cat > /tmp/nav.py << 'EOF'
import json, asyncio, websockets
import sys

async def fix():
    target = 'https://dexterslab.cclottaaworld.com/observer/eye-v2'
    ws_url = None
    
    # Get the websocket debugger URL
    import urllib.request
    try:
        req = urllib.request.urlopen("http://localhost:9222/json")
        pages = json.loads(req.read())
        for p in pages:
            if p.get('type') == 'page':
                ws_url = p.get('webSocketDebuggerUrl')
                break
    except Exception as e:
        print(f"Failed to get CDP pages: {e}")
        sys.exit(1)
        
    if not ws_url:
        print("No debuggable page found")
        sys.exit(1)

    print(f"Connecting to {ws_url}")
    ws = await websockets.connect(ws_url)
    
    print(f"Navigating to {target}")
    await ws.send(json.dumps({
        'id': 1,
        'method': 'Page.navigate',
        'params': {'url': target}
    }))
    r = await ws.recv()
    print('Result:', r)
    await ws.close()

asyncio.run(fix())
EOF

# 4. Run the python navigator script
python3 /tmp/nav.py

echo "--- Restarting Edge Daemon ---"
sleep 2

# 5. Restart edge daemon
pkill -u deploy -f 'python main.py'
sleep 1
cd /home/deploy/dexterslab-edge && nohup ./venv/bin/python main.py > /tmp/edge.log 2>&1 &
echo "Started."
sleep 4
tail -10 /tmp/edge.log
