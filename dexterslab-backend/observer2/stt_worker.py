import sys
import os
import json
import time

try:
    from vosk import Model, KaldiRecognizer
except ImportError:
    print("Vosk library not found. Please run: pip install vosk", flush=True)
    sys.exit(1)

model_path = os.environ.get("STT_MODEL_PATH", "./models/vosk-model-small-en-us-0.15")

if not os.path.exists(model_path):
    print(f"""
CRITICAL ERROR: Vosk model not found at {model_path}
Please download the model:
  1. wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
  2. unzip vosk-model-small-en-us-0.15.zip
  3. mv vosk-model-small-en-us-0.15 {model_path}
  4. Edit STT_MODEL_PATH in .env if using a different directory.
""", flush=True)
    sys.exit(1)

# Disable verbose vosk logging
import vosk
vosk.SetLogLevel(-1)

start_time = time.time()
print(f"Loading Vosk model from {model_path}...", flush=True)
try:
    model = Model(model_path)
except Exception as e:
    print(f"Failed to load model: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
    
load_time = time.time() - start_time
print(f"Model loaded successfully in {load_time:.2f}s", flush=True)

rec = KaldiRecognizer(model, 16000)

print(f"Vosk worker ready, awaiting 16kHz PCM data on stdin...", flush=True)

try:
    while True:
        data = sys.stdin.buffer.read(3200)
        if len(data) == 0:
            break
            
        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            print(json.dumps(res), flush=True)
        else:
            res = json.loads(rec.PartialResult())
            if res.get("partial", "") != "":
                print(json.dumps(res), flush=True)
except KeyboardInterrupt:
    pass
except Exception as e:
    print(f"Python STT Worker exception: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
