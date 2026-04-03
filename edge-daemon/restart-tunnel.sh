#!/bin/bash
# Restart cloudflared tunnel on Pi
pkill -f 'cloudflared tunnel run' 2>/dev/null
sleep 2
nohup /home/deploy/cloudflared tunnel run dexterslab-pi > /tmp/cloudflared.log 2>&1 &
sleep 3
cat /tmp/cloudflared.log | head -15
echo "---"
echo "Tunnel PID: $(pgrep -f 'cloudflared tunnel run')"
