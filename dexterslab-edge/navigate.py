#!/usr/bin/env python3
"""Navigate Pi Chromium to Observer Eye V2 via CDP."""
import json, sys, asyncio
import urllib.request
import websockets

async def navigate():
    tabs = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
    if not tabs:
        print("No tabs"); sys.exit(1)
    
    ws_url = tabs[0]['webSocketDebuggerUrl']
    print(f"Current: {tabs[0].get('url', '?')}")
    
    async with websockets.connect(ws_url) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Page.navigate", 
            "params": {"url": "https://dexterslab.cclottaaworld.com/observer/eye-v2"}
        }))
        # Don't wait for response - just fire and forget
        try:
            r = await asyncio.wait_for(ws.recv(), timeout=5)
            print(f"OK: {r}")
        except asyncio.TimeoutError:
            print("Navigate sent (timeout on response, but that's OK)")

asyncio.run(navigate())
