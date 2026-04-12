#!/usr/bin/env python3
"""Navigate Chromium on Pi via Chrome DevTools Protocol WebSocket"""
import json, sys, time
try:
    import websocket
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'websocket-client', '-q'])
    import websocket

import urllib.request

target_url = sys.argv[1] if len(sys.argv) > 1 else 'https://dexterslab.cclottaaworld.com/observer'

# Get page info
data = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
ws_url = data[0]['webSocketDebuggerUrl']
current_url = data[0]['url']
print(f"Current: {current_url}")
print(f"Target:  {target_url}")

if current_url == target_url:
    print("Already on target URL")
    sys.exit(0)

# Connect and navigate
ws = websocket.create_connection(ws_url, timeout=5)
ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": target_url}}))
result = ws.recv()
print(f"Navigate result: {result}")
ws.close()

time.sleep(2)
data2 = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
print(f"Now on: {data2[0]['url']}")
