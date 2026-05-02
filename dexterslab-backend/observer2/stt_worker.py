import sys
import os
import json
import time

try:
    from vosk import Model, KaldiRecognizer
except ImportError:
    print("Vosk library not found. Please run: pip install vosk", flush=True)
    sys.exit(1)

# ── Model selection: prefer full model, fall back to small ──
FULL_MODEL = os.environ.get("STT_MODEL_PATH_FULL", "./models/vosk-model-en-us-0.22")
SMALL_MODEL = os.environ.get("STT_MODEL_PATH", "./models/vosk-model-small-en-us-0.15")

model_path = None
if os.path.exists(FULL_MODEL):
    model_path = FULL_MODEL
    print(f"Using FULL Vosk model: {model_path}", flush=True)
elif os.path.exists(SMALL_MODEL):
    model_path = SMALL_MODEL
    print(f"Using SMALL Vosk model (full model not found at {FULL_MODEL}): {model_path}", flush=True)
else:
    print(f"""
CRITICAL ERROR: No Vosk model found.
Checked:
  Full:  {FULL_MODEL}
  Small: {SMALL_MODEL}
Please download a model from https://alphacephei.com/vosk/models
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
rec.SetWords(True)  # Enable word-level detail for confidence scoring

# ── Confidence filtering ──
# Reject transcripts where average word confidence is below this threshold.
# This prevents noise/garbled audio from being treated as real speech.
MIN_CONFIDENCE = float(os.environ.get("STT_MIN_CONFIDENCE", "0.40"))

# Larger read buffer (8000 bytes = 250ms at 16kHz mono 16-bit)
# This gives Vosk more context per chunk, reducing premature finalization
CHUNK_SIZE = 8000

# Sentence accumulation: collect finalized segments within a short window
# before emitting, so "launch" + "offline observer" become one transcript.
# Increased to 1.8s to capture full sentences with natural pauses.
# Partial activity tracking prevents premature emission while user is mid-sentence.
ACCUMULATION_WINDOW = 1.8  # seconds (default for general speech)
ACCUMULATION_WINDOW_QUESTION = 0.6  # seconds (shorter for detected questions — faster emission)
MIN_PARTIAL_SILENCE = 0.6  # seconds: user must stop speaking for this long before we emit
accumulated_text = []
last_final_time = 0
last_partial_time = 0  # Track when partials last flowed (user speaking indicator)

# ── Phantom noise word filter ──
# Vosk frequently hallucinates these words from mic hiss/background noise,
# often with full confidence (1.0). Solo occurrences are dropped entirely;
# leading/trailing occurrences in accumulated text are stripped.
PHANTOM_WORDS = {'the', 'a', 'an', 'and', 'but', 'or', 'in', 'it', 'is', 'i'}

# Navigation-related words (for logging purposes)
NAV_WORDS = {'open', 'launch', 'start', 'close', 'exit', 'stop', 'kill',
             'observer', 'offline', 'rules', 'lawyer', 'deadswitch', 'dead',
             'switch', 'record', 'clerk', 'dandelion', 'home', 'hub', 'go',
             'back', 'return', 'application', 'app', 'eye', 'version', 'buddy'}

def compute_confidence(result_dict):
    """Compute average word-level confidence from a Vosk result."""
    words = result_dict.get("result", [])
    if not words:
        return -1.0  # No word-level data available (model may not support it)
    confs = [w.get("conf", 0) for w in words]
    return sum(confs) / len(confs) if confs else 0.0

def is_nav_related(text):
    """Check if text contains navigation-related words (for logging)."""
    words = set(text.lower().split())
    return bool(words & NAV_WORDS)

def is_phantom(text):
    """Check if text is purely phantom noise words."""
    words = text.strip().lower().split()
    return all(w in PHANTOM_WORDS for w in words)

def strip_phantom(text):
    """Remove leading and trailing phantom words from text."""
    words = text.strip().split()
    # Strip from front
    while words and words[0].lower() in PHANTOM_WORDS:
        words.pop(0)
    # Strip from back
    while words and words[-1].lower() in PHANTOM_WORDS:
        words.pop()
    return " ".join(words)

# ── Fast-emit: navigation commands skip accumulation entirely ──
CLOSE_COMMANDS = frozenset([
    'go home', 'go back', 'return home', 'exit',
    'close app', 'close application', 'go to hub',
    'close the app', 'close the application',
    'return to hub', 'back to hub', 'exit application', 'exit app',
])

QUESTION_STARTERS_SET = frozenset([
    'who', 'what', 'when', 'where', 'why', 'how',
    'is', 'are', 'was', 'were', 'will', 'would',
    'can', 'could', 'do', 'does', 'did', 'should',
])

def is_complete_nav(text):
    """Check if text is a complete navigation command — emit immediately."""
    lower = text.lower().strip()
    words = lower.split()
    if not words:
        return False
    # Complete close/return patterns
    if lower in CLOSE_COMMANDS:
        return True
    # "open/launch/start/show [target]" with at least one real target word
    if words[0] in ('open', 'launch', 'start', 'show') and len(words) >= 2:
        target_words = [w for w in words[1:] if w not in PHANTOM_WORDS]
        return len(target_words) > 0
    # "close/stop/kill [specific app]" — generic close already in CLOSE_COMMANDS
    if words[0] in ('close', 'stop', 'kill') and len(words) >= 2:
        target_words = [w for w in words[1:] if w not in PHANTOM_WORDS]
        return len(target_words) > 0
    # "switch to X"
    if len(words) >= 3 and words[0] == 'switch' and words[1] == 'to':
        return True
    return False

print(f"Vosk worker ready (chunk={CHUNK_SIZE}b, accumulation={ACCUMULATION_WINDOW}s/{ACCUMULATION_WINDOW_QUESTION}s(q), min_confidence={MIN_CONFIDENCE})", flush=True)

try:
    while True:
        data = sys.stdin.buffer.read(CHUNK_SIZE)
        if len(data) == 0:
            break
            
        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            text = res.get("text", "").strip()
            if text:
                # Compute confidence
                avg_conf = compute_confidence(res)
                
                # If confidence data is available, check threshold
                if avg_conf >= 0 and avg_conf < MIN_CONFIDENCE:
                    nav_hint = " (NAV-RELATED)" if is_nav_related(text) else ""
                    print(json.dumps({
                        "rejected": text,
                        "confidence": round(avg_conf, 3),
                        "reason": "below_threshold"
                    }), flush=True)
                    continue
                
                # Drop pure phantom noise (e.g., solo "the", "the the", "a the")
                if is_phantom(text):
                    continue
                
                now = time.time()
                # If this final comes shortly after the last one, accumulate
                if accumulated_text and (now - last_final_time) < ACCUMULATION_WINDOW:
                    accumulated_text.append(text)
                else:
                    # Emit any previously accumulated text first
                    if accumulated_text:
                        combined = strip_phantom(" ".join(accumulated_text))
                        if combined:  # Only emit if there's real content after stripping
                            print(json.dumps({"text": combined, "confidence": round(avg_conf, 3)}), flush=True)
                    accumulated_text = [text]
                last_final_time = now

                # ── Fast-emit: complete nav commands skip accumulation wait ──
                combined_check = strip_phantom(" ".join(accumulated_text))
                if combined_check and is_complete_nav(combined_check):
                    print(json.dumps({"text": combined_check, "fast": True}), flush=True)
                    accumulated_text = []
        else:
            res = json.loads(rec.PartialResult())
            partial = res.get("partial", "")
            if partial:
                # User is still speaking — update partial timestamp
                last_partial_time = time.time()
                print(json.dumps({"partial": partial}), flush=True)
            else:
                # Empty partial = silence. Emit accumulated if enough time passed
                # Safety guard: also check that partials stopped flowing (user done speaking)
                now = time.time()
                silence_since_final = now - last_final_time
                silence_since_partial = now - last_partial_time
                # Dynamic window: shorter for questions, default for general speech
                effective_window = ACCUMULATION_WINDOW
                if accumulated_text:
                    first_word = " ".join(accumulated_text).split()[0].lower()
                    if first_word in QUESTION_STARTERS_SET:
                        effective_window = ACCUMULATION_WINDOW_QUESTION
                if accumulated_text and silence_since_final > effective_window and silence_since_partial > MIN_PARTIAL_SILENCE:
                    combined = strip_phantom(" ".join(accumulated_text))
                    if combined:  # Only emit if there's real content after stripping
                        print(json.dumps({"text": combined}), flush=True)
                    accumulated_text = []
                    
except KeyboardInterrupt:
    pass
except Exception as e:
    print(f"Python STT Worker exception: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
finally:
    # Flush any remaining accumulated text
    if accumulated_text:
        combined = strip_phantom(" ".join(accumulated_text))
        if combined:
            print(json.dumps({"text": combined}), flush=True)

