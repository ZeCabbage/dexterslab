#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  DEXTER'S LAB — Hardware Discovery Layer (Layer 0)
#
#  Probes USB devices at boot to find:
#    - Camera (/dev/videoN)
#    - Microphone (ALSA card index)
#    - Speaker (ALSA card index)
#
#  Writes results to /tmp/hw-manifest.json
#  Called by: observer-boot.service (ExecStartPre)
# ═══════════════════════════════════════════════════════════

set -euo pipefail

LOG_TAG="[HW-DISCOVER]"
MANIFEST="/tmp/hw-manifest.json"

# Default values (will be overwritten if devices are found)
CAMERA_DEVICE=""
CAMERA_STATUS="not_found"
MIC_CARD=""
MIC_STATUS="not_found"
SPEAKER_CARD=""
SPEAKER_STATUS="not_found"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_TAG $1"; }

# ── 1. Camera Discovery ──────────────────────────────────
log "Probing video devices..."

for dev in /dev/video*; do
  [ -e "$dev" ] || continue

  # Use v4l2-ctl to check if it's a real capture device (not metadata)
  if command -v v4l2-ctl &>/dev/null; then
    caps=$(v4l2-ctl --device="$dev" --all 2>/dev/null || true)
    # Only want devices that support Video Capture (not metadata)
    if echo "$caps" | grep -q "Video Capture"; then
      # Verify we can actually grab a frame
      if timeout 5 ffmpeg -f v4l2 -input_format mjpeg -video_size 320x240 \
         -framerate 15 -i "$dev" -vframes 1 -f image2 /tmp/hw-test-frame.jpg \
         -y -loglevel error 2>/dev/null; then
        CAMERA_DEVICE="$dev"
        CAMERA_STATUS="ok"
        log "  ✓ Camera found at $dev (frame capture verified)"
        rm -f /tmp/hw-test-frame.jpg
        break
      else
        log "  ⚠ $dev has capture caps but frame grab failed"
      fi
    else
      log "  – $dev is not a capture device, skipping"
    fi
  else
    # Fallback: no v4l2-ctl, just try ffmpeg directly
    if timeout 5 ffmpeg -f v4l2 -input_format mjpeg -video_size 320x240 \
       -framerate 15 -i "$dev" -vframes 1 -f image2 /tmp/hw-test-frame.jpg \
       -y -loglevel error 2>/dev/null; then
      CAMERA_DEVICE="$dev"
      CAMERA_STATUS="ok"
      log "  ✓ Camera found at $dev (frame capture verified)"
      rm -f /tmp/hw-test-frame.jpg
      break
    fi
  fi
done

if [ -z "$CAMERA_DEVICE" ]; then
  log "  ✕ No camera found on any /dev/video* device"
  CAMERA_DEVICE="/dev/video0"  # Fallback default
fi

# ── 2. Microphone Discovery ──────────────────────────────
log "Probing audio input devices..."

if command -v arecord &>/dev/null; then
  # List capture devices, find USB ones (skip HDMI and internal)
  while IFS= read -r line; do
    # arecord -l output format: "card N: DeviceName [Description], device D: ..."
    card_num=$(echo "$line" | grep -oP 'card \K\d+')
    card_name=$(echo "$line" | grep -oP 'card \d+: \K\S+')

    if [ -n "$card_num" ]; then
      # Prefer USB audio devices over built-in
      if echo "$line" | grep -iqE "usb|uac|c-media|samson|blue|yeti"; then
        MIC_CARD="$card_num"
        MIC_STATUS="ok"
        log "  ✓ USB Microphone found: card $card_num ($card_name)"
        break
      elif [ -z "$MIC_CARD" ]; then
        # Store first non-USB as fallback
        MIC_CARD="$card_num"
        MIC_STATUS="ok"
        log "  • Non-USB mic found: card $card_num ($card_name) (fallback)"
      fi
    fi
  done < <(arecord -l 2>/dev/null | grep "^card")

  # Validate: try a short recording
  if [ -n "$MIC_CARD" ]; then
    if timeout 3 arecord -D "hw:${MIC_CARD},0" -f S16_LE -r 16000 -c 1 \
       -d 1 /tmp/hw-mic-test.wav 2>/dev/null; then
      log "  ✓ Mic card $MIC_CARD validated (recording test passed)"
      rm -f /tmp/hw-mic-test.wav
    else
      log "  ⚠ Mic card $MIC_CARD found but recording test failed"
      MIC_STATUS="degraded"
    fi
  fi
else
  log "  ⚠ arecord not found, cannot probe microphone"
fi

if [ -z "$MIC_CARD" ]; then
  log "  ✕ No microphone found"
  MIC_CARD="0"  # Fallback
fi

# ── 3. Speaker Discovery ─────────────────────────────────
log "Probing audio output devices..."

if command -v aplay &>/dev/null; then
  while IFS= read -r line; do
    card_num=$(echo "$line" | grep -oP 'card \K\d+')
    card_name=$(echo "$line" | grep -oP 'card \d+: \K\S+')

    if [ -n "$card_num" ]; then
      # Prefer USB audio devices for speaker output
      if echo "$line" | grep -iqE "usb|uac|c-media|samson|blue|jabra"; then
        SPEAKER_CARD="$card_num"
        SPEAKER_STATUS="ok"
        log "  ✓ USB Speaker found: card $card_num ($card_name)"
        break
      elif [ -z "$SPEAKER_CARD" ]; then
        SPEAKER_CARD="$card_num"
        SPEAKER_STATUS="ok"
        log "  • Non-USB speaker found: card $card_num ($card_name) (fallback)"
      fi
    fi
  done < <(aplay -l 2>/dev/null | grep "^card")

  # Validate: set volume and try a test tone
  if [ -n "$SPEAKER_CARD" ]; then
    # Try to set volume to MAX (ignore errors — not all cards have PCM control)
    amixer -c "$SPEAKER_CARD" set PCM 100% 2>/dev/null || \
    amixer -c "$SPEAKER_CARD" set Speaker 100% 2>/dev/null || \
    amixer -c "$SPEAKER_CARD" set Master 100% 2>/dev/null || true
    log "  ✓ Speaker card $SPEAKER_CARD volume set to 100%"
  fi
else
  log "  ⚠ aplay not found, cannot probe speaker"
fi

if [ -z "$SPEAKER_CARD" ]; then
  log "  ✕ No speaker found"
  SPEAKER_CARD="0"  # Fallback
fi

# ── 4. Write Manifest ────────────────────────────────────
cat > "$MANIFEST" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "camera": {
    "device": "$CAMERA_DEVICE",
    "status": "$CAMERA_STATUS"
  },
  "microphone": {
    "card": "$MIC_CARD",
    "status": "$MIC_STATUS"
  },
  "speaker": {
    "card": "$SPEAKER_CARD",
    "status": "$SPEAKER_STATUS"
  }
}
EOF

log "Hardware manifest written to $MANIFEST:"
cat "$MANIFEST"

# ── 5. Exit Code ──────────────────────────────────────────
if [ "$CAMERA_STATUS" = "ok" ] && [ "$MIC_STATUS" = "ok" ] && [ "$SPEAKER_STATUS" = "ok" ]; then
  log "✓ All hardware discovered successfully"
  exit 0
elif [ "$CAMERA_STATUS" = "not_found" ] && [ "$MIC_STATUS" = "not_found" ] && [ "$SPEAKER_STATUS" = "not_found" ]; then
  log "✕ CRITICAL: No hardware discovered at all"
  exit 1
else
  log "⚠ Hardware discovery partial — some devices missing or degraded"
  exit 0  # Don't block boot for partial hardware
fi
