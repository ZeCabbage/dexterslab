#!/usr/bin/env python3
"""Use CDP WebSocket to clear cache and navigate to eye-v2"""
import json
import socket
import urllib.request
import hashlib
import struct
import os
import time

CDP_URL = "http://localhost:9222"

# Get page info
pages = json.loads(urllib.request.urlopen(f"{CDP_URL}/json").read())
print(f"Found {len(pages)} pages")
page = pages[0]
print(f"Current URL: {page['url']}")
ws_url = page['webSocketDebuggerUrl']
print(f"WS: {ws_url}")

# Parse WS URL
# ws://localhost:9222/devtools/page/XXXXX
host_port = ws_url.split("//")[1].split("/")[0]
host, port = host_port.split(":")
path = "/" + "/".join(ws_url.split("//")[1].split("/")[1:])

# Connect WebSocket (minimal handshake)
s = socket.create_connection((host, int(port)), timeout=10)

# WebSocket handshake
key = "dGhlIHNhbXBsZSBub25jZQ=="
handshake = (
    f"GET {path} HTTP/1.1\r\n"
    f"Host: {host}:{port}\r\n"
    f"Upgrade: websocket\r\n"
    f"Connection: Upgrade\r\n"
    f"Sec-WebSocket-Key: {key}\r\n"
    f"Sec-WebSocket-Version: 13\r\n"
    f"\r\n"
)
s.send(handshake.encode())
response = s.recv(4096).decode()
if "101" not in response:
    print(f"Handshake failed: {response[:200]}")
    exit(1)
print("WebSocket connected")

msg_id = 0

def send_cdp(method, params=None):
    global msg_id
    msg_id += 1
    msg = json.dumps({"id": msg_id, "method": method, "params": params or {}})
    payload = msg.encode()
    # WebSocket frame: FIN + text, masked
    mask_key = os.urandom(4)
    length = len(payload)
    frame = bytearray()
    frame.append(0x81)  # FIN + text
    if length < 126:
        frame.append(0x80 | length)  # masked
    elif length < 65536:
        frame.append(0x80 | 126)
        frame.extend(struct.pack(">H", length))
    else:
        frame.append(0x80 | 127)
        frame.extend(struct.pack(">Q", length))
    frame.extend(mask_key)
    masked = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload))
    frame.extend(masked)
    s.send(frame)
    # Read response
    data = s.recv(65536)
    # Skip frame header
    if len(data) < 2:
        return None
    b1 = data[1] & 0x7f
    offset = 2
    if b1 == 126:
        offset = 4
    elif b1 == 127:
        offset = 10
    try:
        return json.loads(data[offset:].decode())
    except:
        return {"raw": data[offset:offset+200].decode(errors='replace')}

# Enable Network domain
print("Enabling Network...")
r = send_cdp("Network.enable")
print(f"  -> {r}")

# Clear browser cache
print("Clearing cache...")
r = send_cdp("Network.clearBrowserCache")
print(f"  -> {r}")

# Disable cache (bypass)
print("Disabling cache...")
r = send_cdp("Network.setCacheDisabled", {"cacheDisabled": True})
print(f"  -> {r}")

# Navigate to eye-v2
target = "https://dexterslab.cclottaaworld.com/observer/eye-v2"
print(f"Navigating to {target}...")
r = send_cdp("Page.navigate", {"url": target})
print(f"  -> {r}")

s.close()
print("Done! Browser should now show updated eye-v2.")
