"""Quick audio level analysis — check if the recording has meaningful signal"""
import wave
import struct
import math

wf = wave.open("mic_selftest.wav", "rb")
n = wf.getnframes()
data = wf.readframes(n)
wf.close()

samples = struct.unpack(f"<{n}h", data)
abs_samples = [abs(s) for s in samples]

# Overall stats
peak = max(abs_samples)
rms = math.sqrt(sum(s*s for s in samples) / n)
avg = sum(abs_samples) / n

print(f"Samples: {n} ({n/16000:.1f}s)")
print(f"Peak amplitude: {peak} / 32768 ({peak/327.68:.1f}%)")
print(f"RMS level: {rms:.0f} / 32768 ({rms/327.68:.1f}%)")
print(f"Average level: {avg:.0f} / 32768 ({avg/327.68:.1f}%)")
print()

# Analyze in 0.5s windows
window_size = 8000  # 0.5s at 16kHz
print("--- Level by 0.5s window ---")
for i in range(0, n, window_size):
    chunk = samples[i:i+window_size]
    if len(chunk) < window_size // 2:
        break
    chunk_rms = math.sqrt(sum(s*s for s in chunk) / len(chunk))
    chunk_peak = max(abs(s) for s in chunk)
    bar = "#" * int(chunk_rms / 100)
    t = i / 16000
    print(f"  {t:.1f}-{t+0.5:.1f}s  RMS={chunk_rms:6.0f}  Peak={chunk_peak:5d}  {bar}")
