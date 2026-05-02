#!/usr/bin/env python3
"""Navigate Pi Chromium to the Offline Hub via CDP"""
import json, socket, urllib.request, os, struct, sys

CDP_URL = "http://localhost:9222"
target = sys.argv[1] if len(sys.argv) > 1 else "file:///home/thecabbage/Desktop/dexterslab/dexterslab-frontend/public/offline-hub.html"

pages = json.loads(urllib.request.urlopen(f"{CDP_URL}/json").read())
print(f"Found {len(pages)} pages, current: {pages[0]['url']}")
ws_url = pages[0]['webSocketDebuggerUrl']
host_port = ws_url.split("//")[1].split("/")[0]
host, port = host_port.split(":")
path = "/" + "/".join(ws_url.split("//")[1].split("/")[1:])

s = socket.create_connection((host, int(port)), timeout=10)
key = "dGhlIHNhbXBsZSBub25jZQ=="
handshake = f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
s.send(handshake.encode())
resp = s.recv(4096).decode()
if "101" not in resp:
    print("Handshake failed"); exit(1)

msg_id = 0
def send_cdp(method, params=None):
    global msg_id; msg_id += 1
    msg = json.dumps({"id": msg_id, "method": method, "params": params or {}})
    payload = msg.encode()
    mask_key = os.urandom(4)
    length = len(payload)
    frame = bytearray([0x81])
    if length < 126: frame.append(0x80 | length)
    elif length < 65536: frame.append(0x80 | 126); frame.extend(struct.pack(">H", length))
    frame.extend(mask_key)
    frame.extend(bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload)))
    s.send(frame)
    data = s.recv(65536)
    if len(data) < 2: return None
    b1 = data[1] & 0x7f
    offset = 2 if b1 < 126 else (4 if b1 == 126 else 10)
    try: return json.loads(data[offset:].decode())
    except: return {}

print(f"Navigating to: {target}")
r = send_cdp("Page.navigate", {"url": target})
print(f"Result: {r}")
s.close()
print("Done!")
