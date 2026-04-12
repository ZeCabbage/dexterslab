#!/bin/bash
# Navigate Pi Chromium via JavaScript injection through Chrome DevTools REST API
TARGET_URL="${1:-https://dexterslab.cclottaaworld.com/observer}"
PAGE_ID=$(curl -s http://localhost:9222/json | python3 -c "import json,sys; p=json.load(sys.stdin); print(p[0]['id'])")

echo "Page: $PAGE_ID"
echo "Navigating to: $TARGET_URL"

# Use the evaluate endpoint to run window.location
# The DevTools REST API doesn't have a direct navigate, but we can use
# the CDP endpoint with a POST
curl -s -X PUT "http://localhost:9222/json/activate/$PAGE_ID" > /dev/null 2>&1

# Try window.location via the CDP webSocketDebuggerUrl
# Since we can't use websocket from bash, use python3 with built-in libs
python3 << 'PYEOF'
import json, sys, socket, hashlib, base64, struct, os

target_url = os.environ.get('TARGET_URL', 'https://dexterslab.cclottaaworld.com/observer')

# Get WebSocket URL
import urllib.request
data = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
ws_url = data[0]['webSocketDebuggerUrl']
# Parse ws://host:port/path
parts = ws_url.replace('ws://', '').split('/', 1)
host_port = parts[0].split(':')
host = host_port[0]
port = int(host_port[1]) if len(host_port) > 1 else 80
path = '/' + parts[1] if len(parts) > 1 else '/'

# Raw WebSocket handshake
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((host, port))
key = base64.b64encode(os.urandom(16)).decode()
handshake = f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
sock.sendall(handshake.encode())
response = sock.recv(4096)

# Send navigate command
cmd = json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": target_url}})
payload = cmd.encode()
mask = os.urandom(4)
if len(payload) < 126:
    header = struct.pack('!BB', 0x81, 0x80 | len(payload))
elif len(payload) < 65536:
    header = struct.pack('!BBH', 0x81, 0x80 | 126, len(payload))
else:
    header = struct.pack('!BBQ', 0x81, 0x80 | 127, len(payload))

masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
sock.sendall(header + mask + masked)

# Read response
import select
select.select([sock], [], [], 3)
try:
    resp = sock.recv(4096)
    # Parse WebSocket frame
    if len(resp) > 2:
        payload_len = resp[1] & 0x7f
        if payload_len == 126:
            data_start = 4
        elif payload_len == 127:
            data_start = 10
        else:
            data_start = 2
        msg = resp[data_start:].decode('utf-8', errors='ignore')
        print(f"Response: {msg[:200]}")
except:
    pass

sock.close()
print("Navigation sent!")
PYEOF
