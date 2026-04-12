"""
Vosk STT Self-Test: Feed a recording directly to Vosk and print results.
Tests both the small model and shows what Vosk actually produces.
"""
import sys
import json
import wave
import os

try:
    from vosk import Model, KaldiRecognizer
    import vosk
    vosk.SetLogLevel(-1)
except ImportError:
    print("ERROR: vosk not installed")
    sys.exit(1)

wav_file = sys.argv[1] if len(sys.argv) > 1 else "mic_selftest.wav"
model_path = os.environ.get("STT_MODEL_PATH", "./models/vosk-model-small-en-us-0.15")

print(f"=== Vosk STT Self-Test ===")
print(f"Audio file: {wav_file}")
print(f"Model: {model_path}")
print()

# Load model
model = Model(model_path)

# Open audio file
wf = wave.open(wav_file, "rb")
print(f"Audio format: {wf.getnchannels()} channels, {wf.getframerate()} Hz, {wf.getsampwidth()*8}-bit")
print(f"Duration: {wf.getnframes() / wf.getframerate():.1f}s")
print()

# Process with Vosk
rec = KaldiRecognizer(model, wf.getframerate())

# Collect all results
final_results = []
partial_results = []

print("--- Processing ---")
while True:
    data = wf.readframes(3200)
    if len(data) == 0:
        break
    if rec.AcceptWaveform(data):
        result = json.loads(rec.Result())
        if result.get("text", ""):
            final_results.append(result["text"])
            print(f"  FINAL: \"{result['text']}\"")
    else:
        partial = json.loads(rec.PartialResult())
        if partial.get("partial", ""):
            partial_results.append(partial["partial"])

# Get final chunk
final = json.loads(rec.FinalResult())
if final.get("text", ""):
    final_results.append(final["text"])
    print(f"  FINAL: \"{final['text']}\"")

wf.close()

print()
print("=== RESULTS ===")
print(f"Expected: \"Hello. This is a test. One two three four five.\"")
print(f"Got:      \"{' '.join(final_results)}\"")
print(f"")
print(f"Final segments: {len(final_results)}")
for i, r in enumerate(final_results):
    print(f"  [{i+1}] \"{r}\"")
print(f"Partial fragments seen: {len(partial_results)}")
if partial_results:
    # Show last few partials to see recognition quality
    for p in partial_results[-5:]:
        print(f"  partial: \"{p}\"")
