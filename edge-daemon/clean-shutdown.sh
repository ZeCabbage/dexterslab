#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  DEXTER'S LAB — Clean Shutdown Script
#
#  Called by: observer-boot.service (ExecStopPost)
#  Ensures all child processes are killed cleanly on stop.
# ═══════════════════════════════════════════════════════════

LOG_TAG="[CLEAN-SHUTDOWN]"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_TAG $1"; }

log "Starting clean shutdown..."

# 1. Kill edge daemon (main.py)
if [ -f /tmp/edge-daemon.pid ]; then
    PID=$(cat /tmp/edge-daemon.pid)
    if kill -0 "$PID" 2>/dev/null; then
        log "Sending SIGTERM to edge daemon PID $PID"
        kill -TERM "$PID" 2>/dev/null
        # Wait up to 5 seconds for graceful shutdown
        for i in $(seq 1 5); do
            kill -0 "$PID" 2>/dev/null || break
            sleep 1
        done
        # Force kill if still alive
        if kill -0 "$PID" 2>/dev/null; then
            log "Force killing PID $PID"
            kill -9 "$PID" 2>/dev/null
        fi
    fi
    rm -f /tmp/edge-daemon.pid
fi

# 2. Kill any remaining Python processes from edge daemon
pkill -f "python.*main.py" 2>/dev/null || true

# 3. Kill orphaned ffmpeg processes (video streamer creates these)
pkill -f "ffmpeg.*v4l2" 2>/dev/null || true
pkill -f "ffmpeg.*image2pipe" 2>/dev/null || true

# 4. Free up the health port
if command -v fuser &>/dev/null; then
    fuser -k 8891/tcp 2>/dev/null || true
fi

# 5. Clean up temp files
rm -f /tmp/hw-manifest.json 2>/dev/null || true
rm -f /tmp/hw-test-frame.jpg 2>/dev/null || true
rm -f /tmp/hw-mic-test.wav 2>/dev/null || true

sleep 1
log "✓ Clean shutdown complete"
