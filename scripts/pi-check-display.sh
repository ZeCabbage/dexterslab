#!/bin/bash
echo "Session type: $XDG_SESSION_TYPE"
echo "DISPLAY: $DISPLAY"
echo "WAYLAND_DISPLAY: $WAYLAND_DISPLAY"
# Check what's running
ps aux | grep -E "(wayland|Xorg|labwc|sway)" | grep -v grep | head -5
