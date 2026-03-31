#!/bin/bash
# ═══════════════════════════════════════════
#  DOWNLOAD OFFLINE MODELS (Vosk & OpenCV)
#  Run this script on the Raspberry Pi once to 
#  download the required models for offline mode.
# ═══════════════════════════════════════════

LOG_TAG="[DOWNLOAD]"
MODELS_DIR="$HOME/Desktop/dexterslab/edge-daemon/models"

mkdir -p "$MODELS_DIR"

echo "$LOG_TAG Downloading Vosk STT Model (vosk-model-small-en-us-0.15)..."
if [ ! -d "$MODELS_DIR/vosk-model-small-en-us" ]; then
  cd "$MODELS_DIR"
  wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
  unzip vosk-model-small-en-us-0.15.zip
  mv vosk-model-small-en-us-0.15 vosk-model-small-en-us
  rm vosk-model-small-en-us-0.15.zip
  echo "$LOG_TAG Vosk model downloaded and extracted."
else
  echo "$LOG_TAG Vosk model already exists."
fi

echo "$LOG_TAG Downloading OpenCV Haar Cascade (frontal face)..."
if [ ! -f "$MODELS_DIR/haarcascade_frontalface_default.xml" ]; then
  cd "$MODELS_DIR"
  wget https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml
  echo "$LOG_TAG Haar cascade downloaded."
else
  echo "$LOG_TAG Haar cascade already exists."
fi

echo "$LOG_TAG All offline models downloaded to $MODELS_DIR."
