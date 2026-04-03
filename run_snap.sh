#!/bin/bash
pkill -f 'main.py' || true
cd ~/dexterslab-edge
source venv/bin/activate
python3 /tmp/snap0.py
