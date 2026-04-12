#!/bin/bash
# Pi Audio Self-Test: Play a known sentence on speaker, record from mic, then run STT
# Usage: Run this script on the Pi as the deploy user

set -e

TESTFILE="/tmp/mic_selftest.wav"
SPEAKER_CARD=2
MIC_CARD=3

echo "=== Pi Audio Self-Test ==="
echo ""

# Set volumes
amixer -c $SPEAKER_CARD set PCM 90% > /dev/null 2>&1
amixer -c $MIC_CARD set Mic 90% > /dev/null 2>&1
echo "[OK] Volumes set to 90%"

# Start recording in background (8 seconds)
echo "[>>] Recording 8 seconds from mic (card $MIC_CARD)..."
arecord -D plughw:${MIC_CARD},0 -f S16_LE -r 16000 -c 1 -d 8 "$TESTFILE" &
REC_PID=$!
sleep 0.5

# Play test sentence
echo "[>>] Playing test sentence on speaker (card $SPEAKER_CARD)..."
espeak-ng -s 130 -a 200 "Hello. This is a test. One two three four five."
echo "[OK] Sentence played"

# Wait for recording to finish
wait $REC_PID 2>/dev/null
echo "[OK] Recording saved: $TESTFILE"
ls -la "$TESTFILE"

# Check amplitude (basic peak analysis)
echo ""
echo "=== Audio Level Analysis ==="
# Use sox if available, otherwise check file size
if command -v sox > /dev/null 2>&1; then
    sox "$TESTFILE" -n stat 2>&1 | head -10
else
    FILESIZE=$(wc -c < "$TESTFILE")
    echo "File size: $FILESIZE bytes"
    EXPECTED=$((16000 * 2 * 8))  # 16kHz * 2 bytes * 8 seconds
    echo "Expected:  $EXPECTED bytes"
    if [ $FILESIZE -lt $((EXPECTED / 2)) ]; then
        echo "WARNING: File is smaller than expected - possible recording issue"
    else
        echo "File size looks correct"
    fi
fi

echo ""
echo "=== Done ==="
echo "Recording at: $TESTFILE"
