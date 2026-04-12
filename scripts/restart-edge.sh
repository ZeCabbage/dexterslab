#!/bin/bash
chmod +x ~/dexterslab-edge/boot-protocol.sh
pkill -9 -f 'python main' 2>/dev/null || true
pkill -9 -f ffmpeg 2>/dev/null || true
sleep 2
fuser -k 8891/tcp 2>/dev/null || true
sleep 1
cd /home/deploy/dexterslab-edge
nohup ./venv/bin/python main.py > /tmp/edgelog.txt 2>&1 &
echo "STARTED PID=$!"
sleep 6
echo "=== DAEMON LOG ==="
tail -25 /tmp/edgelog.txt
