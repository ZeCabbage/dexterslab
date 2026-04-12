#!/bin/bash
# Pi Audio Calibration: Test multiple mic gain levels to find optimal for STT
# Must be run with edge-daemon stopped

SPEAKER_CARD=2
MIC_CARD=3
TEST_SENTENCE="Hello. This is a test. One two three four five."

echo "=== Pi Audio Calibration ==="
echo "Test sentence: $TEST_SENTENCE"
echo ""

# Set speaker to 90%
amixer -c $SPEAKER_CARD set PCM 90% > /dev/null 2>&1

# Test at different mic gain levels
for GAIN in 80 60 40 30 20 10 5; do
    echo "--- Testing Mic Gain: ${GAIN}% ---"
    amixer -c $MIC_CARD set Mic ${GAIN}% > /dev/null 2>&1
    
    # Record while playing
    arecord -D plughw:${MIC_CARD},0 -f S16_LE -r 16000 -c 1 -d 7 /tmp/mic_cal_${GAIN}.wav &
    REC_PID=$!
    sleep 0.5
    espeak-ng -s 130 -a 200 "$TEST_SENTENCE" 2>/dev/null
    wait $REC_PID 2>/dev/null
    
    # Quick amplitude check
    python3 -c "
import wave, struct, math
wf = wave.open('/tmp/mic_cal_${GAIN}.wav', 'rb')
n = wf.getnframes()
data = wf.readframes(n)
wf.close()
samples = struct.unpack('<${GAIN}h'.replace('${GAIN}', str(n)), data)
peak = max(abs(s) for s in samples)
rms = math.sqrt(sum(s*s for s in samples) / n)
clipping = sum(1 for s in samples if abs(s) >= 32000) / n * 100
print(f'  Peak: {peak} ({peak/327.68:.0f}%)  RMS: {rms:.0f} ({rms/327.68:.0f}%)  Clipping: {clipping:.1f}%')
" 2>/dev/null || echo "  (python3 not available for analysis)"
    
    echo ""
done

echo "=== Calibration recordings saved to /tmp/mic_cal_*.wav ==="
echo "Best gain is usually where Peak is 60-80% and Clipping < 1%"
