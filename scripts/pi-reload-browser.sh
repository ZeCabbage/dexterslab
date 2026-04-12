#!/bin/bash
# Reload Pi Chromium via Chrome DevTools Protocol
PAGE_ID=$(curl -s http://localhost:9222/json | python3 -c "import json,sys; p=json.load(sys.stdin); print(p[0]['id'])")
echo "Page ID: $PAGE_ID"

# Navigate to observer hub (force reload)
curl -s -o /dev/null "http://localhost:9222/json/activate/$PAGE_ID"

# Use the JSON API to navigate (which also reloads)
curl -s -o /dev/null "http://localhost:9222/json/navigate/$PAGE_ID?url=https://dexterslab.cclottaaworld.com/observer"
echo "Navigated to Observer Hub"
