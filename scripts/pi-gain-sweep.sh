#!/bin/bash
# Quick gain sweep - run directly on Pi
TESTMSG="Hello. This is a test. One two three four five."
amixer -c 2 set PCM 90% > /dev/null 2>&1

echo "=== Testing gain 40% ==="
amixer -c 3 set Mic 40% > /dev/null 2>&1
arecord -D plughw:3,0 -f S16_LE -r 16000 -c 1 -d 7 /tmp/mic_g40.wav 2>/dev/null &
sleep 0.5
espeak-ng -s 130 -a 200 "$TESTMSG" 2>/dev/null
wait
ls -la /tmp/mic_g40.wav

echo "=== Testing gain 20% ==="
amixer -c 3 set Mic 20% > /dev/null 2>&1
arecord -D plughw:3,0 -f S16_LE -r 16000 -c 1 -d 7 /tmp/mic_g20.wav 2>/dev/null &
sleep 0.5
espeak-ng -s 130 -a 200 "$TESTMSG" 2>/dev/null
wait
ls -la /tmp/mic_g20.wav

echo "=== Testing gain 10% ==="
amixer -c 3 set Mic 10% > /dev/null 2>&1
arecord -D plughw:3,0 -f S16_LE -r 16000 -c 1 -d 7 /tmp/mic_g10.wav 2>/dev/null &
sleep 0.5
espeak-ng -s 130 -a 200 "$TESTMSG" 2>/dev/null
wait
ls -la /tmp/mic_g10.wav

echo "=== Testing gain 5% ==="
amixer -c 3 set Mic 5% > /dev/null 2>&1
arecord -D plughw:3,0 -f S16_LE -r 16000 -c 1 -d 7 /tmp/mic_g05.wav 2>/dev/null &
sleep 0.5
espeak-ng -s 130 -a 200 "$TESTMSG" 2>/dev/null
wait
ls -la /tmp/mic_g05.wav

echo "=== Setting Mic to 20% (likely sweet spot) ==="
amixer -c 3 set Mic 20% > /dev/null 2>&1
echo "DONE"
