"""
OFFLINE OBSERVER DAEMON — V1 Protocol Restoration

Runs entirely on the Raspberry Pi with NO backend dependency.
Dual detection pipeline:
  1. Haar cascade  — face detection every frame (33fps, precise gaze tracking)
  2. TFLite COCO SSD MobileNet — object detection every 3rd frame (~10fps)
     Detects: person, remote, cell phone, cup, bottle, book, etc.

Entity fusion merges both pipelines, deduplicates, classifies hands.
Behavior model produces lifelike eye movements (sentinel, blink, curiosity).
Broadcasts eye_state + entity metadata at 30fps over local WebSocket.
"""

import json
import time
import asyncio
import cv2
import threading
import subprocess
import os
import re
import math
import numpy as np

LOG_TAG = "[OFFLINE-DAEMON]"
PORT = 8892

# ═══════════════════════════════════════════
#  COCO SSD Config
# ═══════════════════════════════════════════
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
HAAR_PATH = os.path.join(MODELS_DIR, 'haarcascade_frontalface_default.xml')
VOSK_PATH = os.path.join(MODELS_DIR, 'vosk-model-small-en-us')
TFLITE_MODEL_PATH = os.path.join(MODELS_DIR, 'coco-ssd', 'detect.tflite')
TFLITE_LABELS_PATH = os.path.join(MODELS_DIR, 'coco-ssd', 'labelmap.txt')

# Classes we care about (COCO label index → friendly name)
TRACKED_CLASSES = {
    'person': 'person',
    'remote': 'remote',
    'cell phone': 'cell phone',
    'cup': 'cup',
    'bottle': 'bottle',
    'book': 'book',
    'laptop': 'laptop',
    'tv': 'tv',
    'keyboard': 'keyboard',
    'mouse': 'mouse',
    'cat': 'cat',
    'dog': 'dog',
}

TFLITE_CONFIDENCE_THRESHOLD = 0.40
TFLITE_INFERENCE_INTERVAL = 3  # Run TFLite every Nth frame
HAAR_MIN_SIZE = (30, 30)

# ═══════════════════════════════════════════
#  Behavior Model Config
# ═══════════════════════════════════════════
LIMIT_X = 200   # Eye displacement range (pixels)
LIMIT_Y = 150
TRACKING_SMOOTH = 0.18
SENTINEL_SWEEP_RANGE = 160
SENTINEL_ENTER_DELAY = 2.0
BLINK_INTERVAL_MIN = 2.5
BLINK_INTERVAL_MAX = 6.0
BLINK_CLOSE_DURATION = 0.15
BLINK_OPEN_DURATION = 0.28
DOUBLE_BLINK_CHANCE = 0.15

# ═══════════════════════════════════════════
#  Eye State (broadcast to display client)
# ═══════════════════════════════════════════
eye_state = {
    'ix': 0, 'iy': 0, 'dilation': 1.0, 'blink': 0,
    'emotion': 'neutral', 'sentinel': True, 'visible': False,
    'entityCount': 0, 'overlayText': '', 'overlayType': '',
    'blush': 0, 'goodBoy': 0, 'thankYou': 0, 't': 0,
    'entities': [],  # [{type, confidence, x, y}]
    'navigate': '',  # Set to URL to tell display client to navigate away
}

# Behavior state (module-level for thread sharing)
_behavior = {
    'target_x': 0.0, 'target_y': 0.0,
    'current_x': 0.0, 'current_y': 0.0,
    'target_dilation': 1.0, 'current_dilation': 1.0,
    'sentinel_active': False, 'sentinel_target_x': 0.0, 'sentinel_target_y': 0.0,
    'sentinel_next_sweep': 0.0, 'sentinel_last_type': -1,
    'last_entity_time': time.time(),
    'blink_phase': 0.0, 'blink_stage': 'idle',
    'blink_start_time': 0.0, 'next_blink_time': time.time() + 3.0,
    'double_blink_pending': False,
    'emotion': 'neutral', 'emotion_end_time': 0.0,
    'last_entity_count': 0,
}

connected_clients = set()


# ═══════════════════════════════════════════
#  TTS
# ═══════════════════════════════════════════
def speak(text):
    print(f"{LOG_TAG} Speaking: {text}")
    try:
        speaker_card = None
        try:
            with open('/tmp/hw-manifest.json', 'r') as f:
                hw = json.load(f)
                if hw.get('speaker', {}).get('status') in ('ok', 'degraded'):
                    speaker_card = hw['speaker']['card']
        except Exception:
            pass

        if speaker_card:
            subprocess.run(['amixer', '-c', str(speaker_card), 'set', 'PCM', '100%'],
                         capture_output=True, timeout=3)
            espeak = subprocess.Popen(
                ['espeak-ng', '-v', 'en-us', '--stdout', text],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            aplay = subprocess.Popen(
                ['aplay', '-D', f'plughw:{speaker_card},0'],
                stdin=espeak.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            espeak.stdout.close()
            aplay.wait(timeout=15)
            espeak.wait(timeout=5)
        else:
            subprocess.run(['espeak-ng', '-v', 'en-us', text], check=False, timeout=10)
    except Exception as e:
        print(f"{LOG_TAG} TTS Error: {e}")


# ═══════════════════════════════════════════
#  Voice Commands (STT)
# ═══════════════════════════════════════════
def get_intent_response(text):
    text = text.lower()
    if re.search(r'\b(close|go home|go back|return|exit)\b', text):
        print(f"{LOG_TAG} CLOSE command detected — sending navigate signal")
        eye_state['navigate'] = 'hub'
        eye_state['overlayText'] = 'Returning to Hub...'
        eye_state['overlayType'] = 'oracle'
        return "Returning to hub."
    elif re.search(r'\b(status|report)\b', text):
        return "I am operating in local edge mode. PC connection is offline."
    elif re.search(r'\b(sleep|shutdown)\b', text):
        eye_state['blink'] = 1.0
        return "Hibernation protocol enacted."
    elif re.search(r'\b(wake|online)\b', text):
        eye_state['blink'] = 0.0
        return "Systems online. Greetings."
    elif re.search(r'\b(who are you|purpose)\b', text):
        return "I am the local sentinel. I observe."
    elif re.search(r'\b(thank you|good boy)\b', text):
        eye_state['dilation'] = 2.0
        return "You are welcome."
    return None


def audio_listener():
    try:
        from vosk import Model, KaldiRecognizer
        import pyaudio
    except ImportError:
        print(f"{LOG_TAG} Required audio modules not installed. Disabling STT.")
        return

    if not os.path.exists(VOSK_PATH):
        print(f"{LOG_TAG} Vosk model not found at {VOSK_PATH}. Disabling STT.")
        return

    print(f"{LOG_TAG} Loading Vosk model...")
    model = Model(VOSK_PATH)
    recognizer = KaldiRecognizer(model, 16000)

    # Use hw-manifest to find mic card
    mic_card = None
    try:
        with open('/tmp/hw-manifest.json', 'r') as f:
            hw = json.load(f)
            if hw.get('microphone', {}).get('status') in ('ok', 'degraded'):
                mic_card = int(hw['microphone']['card'])
    except Exception:
        pass

    p = pyaudio.PyAudio()
    if mic_card is not None:
        # Find PA device index for this ALSA card
        device_index = None
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info.get('maxInputChannels', 0) > 0 and f"hw:{mic_card}" in info.get('name', ''):
                device_index = i
                break
        stream = p.open(format=pyaudio.paInt16, channels=1, rate=16000,
                       input=True, frames_per_buffer=4000,
                       input_device_index=device_index)
    else:
        stream = p.open(format=pyaudio.paInt16, channels=1, rate=16000,
                       input=True, frames_per_buffer=4000)
    stream.start_stream()

    print(f"{LOG_TAG} Listening for commands...")
    while True:
        try:
            data = stream.read(4000, exception_on_overflow=False)
            if len(data) == 0:
                continue
            if recognizer.AcceptWaveform(data):
                res = json.loads(recognizer.Result())
                text = res.get('text', '')
                if text:
                    print(f"{LOG_TAG} Heard: {text}")
                    eye_state['overlayText'] = f'Mic: "{text}"'
                    eye_state['overlayType'] = 'ambient'

                    response = get_intent_response(text)
                    if response:
                        eye_state['overlayText'] = response
                        eye_state['overlayType'] = 'oracle'
                        speak(response)
        except Exception as e:
            print(f"{LOG_TAG} Audio Error: {e}")
            time.sleep(1)


# ═══════════════════════════════════════════
#  TFLite COCO SSD Detector
# ═══════════════════════════════════════════
class CocoDetector:
    def __init__(self):
        self.interpreter = None
        self.labels = []
        self.input_details = None
        self.output_details = None
        self.ready = False

    def init(self):
        if not os.path.exists(TFLITE_MODEL_PATH):
            print(f"{LOG_TAG} TFLite model not found at {TFLITE_MODEL_PATH}. Disabling object detection.")
            return False

        try:
            import tflite_runtime.interpreter as tflite
            print(f"{LOG_TAG} Loading COCO SSD MobileNet V1...")
            start = time.time()
            self.interpreter = tflite.Interpreter(model_path=TFLITE_MODEL_PATH)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()

            # Load labels
            if os.path.exists(TFLITE_LABELS_PATH):
                with open(TFLITE_LABELS_PATH, 'r') as f:
                    self.labels = [line.strip() for line in f.readlines()]

            elapsed = time.time() - start
            print(f"{LOG_TAG} COCO SSD model loaded in {elapsed:.2f}s ({len(self.labels)} classes)")
            self.ready = True
            return True
        except Exception as e:
            print(f"{LOG_TAG} TFLite init error: {e}")
            return False

    def detect(self, frame):
        """Run object detection on a BGR frame. Returns list of detections."""
        if not self.ready:
            return []

        try:
            # Resize to model input size (300x300 for SSD MobileNet)
            input_shape = self.input_details[0]['shape']  # [1, 300, 300, 3]
            h, w = input_shape[1], input_shape[2]
            resized = cv2.resize(frame, (w, h))
            input_data = np.expand_dims(resized, axis=0).astype(np.uint8)

            self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
            self.interpreter.invoke()

            # Output: boxes, classes, scores, count
            boxes = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
            classes = self.interpreter.get_tensor(self.output_details[1]['index'])[0]
            scores = self.interpreter.get_tensor(self.output_details[2]['index'])[0]
            count = int(self.interpreter.get_tensor(self.output_details[3]['index'])[0])

            detections = []
            for i in range(min(count, 10)):
                confidence = float(scores[i])
                if confidence < TFLITE_CONFIDENCE_THRESHOLD:
                    continue

                class_id = int(classes[i])
                if class_id < 0 or class_id >= len(self.labels):
                    continue

                label = self.labels[class_id]
                if label not in TRACKED_CLASSES:
                    continue

                # Box format: [ymin, xmin, ymax, xmax] normalized 0-1
                ymin, xmin, ymax, xmax = boxes[i]
                cx = (xmin + xmax) / 2.0
                cy = (ymin + ymax) / 2.0
                bw = xmax - xmin
                bh = ymax - ymin

                # Classify hand: small person bbox near edge of frame
                entity_type = TRACKED_CLASSES[label]
                if label == 'person' and bh < 0.4 and (xmin < 0.15 or xmax > 0.85 or ymin < 0.15 or ymax > 0.85):
                    entity_type = 'hand'

                detections.append({
                    'type': entity_type,
                    'label': label,
                    'confidence': round(confidence, 2),
                    'x': round(float(cx), 3),
                    'y': round(float(cy), 3),
                    'w': round(float(bw), 3),
                    'h': round(float(bh), 3),
                    'source': 'tflite',
                })

            return detections
        except Exception as e:
            print(f"{LOG_TAG} TFLite inference error: {e}")
            return []


# ═══════════════════════════════════════════
#  Behavior Model (port from backend)
# ═══════════════════════════════════════════
def update_blink(now):
    b = _behavior
    stage = b['blink_stage']

    if stage == 'idle':
        if now >= b['next_blink_time']:
            b['blink_stage'] = 'closing'
            b['blink_start_time'] = now
            b['double_blink_pending'] = (os.urandom(1)[0] / 255.0) < DOUBLE_BLINK_CHANCE

    elif stage == 'closing':
        t = min(1.0, (now - b['blink_start_time']) / BLINK_CLOSE_DURATION)
        b['blink_phase'] = t * t  # ease-in
        if t >= 1.0:
            b['blink_phase'] = 1.0
            b['blink_stage'] = 'opening'
            b['blink_start_time'] = now

    elif stage == 'opening':
        t = min(1.0, (now - b['blink_start_time']) / BLINK_OPEN_DURATION)
        b['blink_phase'] = 1.0 - (t * (2.0 - t))  # ease-out
        if t >= 1.0:
            b['blink_phase'] = 0.0
            if b['double_blink_pending']:
                b['double_blink_pending'] = False
                b['blink_stage'] = 'double_wait'
                b['next_blink_time'] = now + 0.12
            else:
                b['blink_stage'] = 'idle'
                interval = BLINK_INTERVAL_MIN + (os.urandom(1)[0] / 255.0) * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN)
                b['next_blink_time'] = now + interval

    elif stage == 'double_wait':
        if now >= b['next_blink_time']:
            b['blink_stage'] = 'closing'
            b['blink_start_time'] = now


def update_sentinel(now):
    b = _behavior
    if now < b['sentinel_next_sweep']:
        return

    sweep_type = int.from_bytes(os.urandom(1), 'big') % 4
    if sweep_type == b['sentinel_last_type']:
        sweep_type = (sweep_type + 1) % 4
    b['sentinel_last_type'] = sweep_type

    r = SENTINEL_SWEEP_RANGE
    rand1 = os.urandom(1)[0] / 255.0
    rand2 = os.urandom(1)[0] / 255.0
    rand3 = os.urandom(1)[0] / 255.0

    if sweep_type == 0:  # horizontal
        b['sentinel_target_x'] = (1 if rand1 > 0.5 else -1) * r * (0.6 + rand2 * 0.4)
        b['sentinel_target_y'] = (rand3 - 0.5) * 30
        b['sentinel_next_sweep'] = now + 2.5 + rand1 * 2.0
    elif sweep_type == 1:  # vertical
        b['sentinel_target_x'] = (rand1 - 0.5) * 40
        b['sentinel_target_y'] = (1 if rand2 > 0.5 else -1) * r * (0.4 + rand3 * 0.4)
        b['sentinel_next_sweep'] = now + 1.5 + rand1 * 2.0
    elif sweep_type == 2:  # diagonal
        b['sentinel_target_x'] = (1 if rand1 > 0.5 else -1) * r * (0.5 + rand2 * 0.5)
        b['sentinel_target_y'] = (1 if rand3 > 0.5 else -1) * r * (0.3 + rand1 * 0.4)
        b['sentinel_next_sweep'] = now + 2.0 + rand2 * 2.5
    else:  # wide erratic
        b['sentinel_target_x'] = (rand1 - 0.5) * r * 1.5
        b['sentinel_target_y'] = (rand2 - 0.5) * r * 0.8
        b['sentinel_next_sweep'] = now + 3.0 + rand3 * 3.0


def lerp(current, target, factor):
    return current + (target - current) * factor


# ═══════════════════════════════════════════
#  Vision Tracking Thread
# ═══════════════════════════════════════════
def vision_tracking():
    global eye_state
    b = _behavior

    # Initialize Haar cascade
    face_cascade = None
    if os.path.exists(HAAR_PATH):
        face_cascade = cv2.CascadeClassifier(HAAR_PATH)
        print(f"{LOG_TAG} Haar cascade loaded from {HAAR_PATH}")
    else:
        print(f"{LOG_TAG} Haar cascade not found at {HAAR_PATH}. Face detection disabled.")

    # Initialize COCO SSD detector
    coco = CocoDetector()
    coco_available = coco.init()

    # Open camera
    cap = None
    force_index = os.environ.get('CAMERA_INDEX')

    # Try hw-manifest first
    camera_device = None
    try:
        with open('/tmp/hw-manifest.json', 'r') as f:
            hw = json.load(f)
            if hw.get('camera', {}).get('status') == 'ok':
                camera_device = hw['camera']['device']
                print(f"{LOG_TAG} Camera from hw-manifest: {camera_device}")
    except Exception:
        pass

    if force_index is not None:
        idx = int(force_index)
        print(f"{LOG_TAG} Using FORCED camera index {idx}...")
        cap = cv2.VideoCapture(idx)
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx, cv2.CAP_V4L2)
    elif camera_device:
        print(f"{LOG_TAG} Opening camera: {camera_device}")
        cap = cv2.VideoCapture(camera_device, cv2.CAP_V4L2)
        if not cap.isOpened():
            cap = cv2.VideoCapture(camera_device)
    else:
        for i in range(5):
            print(f"{LOG_TAG} Trying to open camera index {i}...")
            temp_cap = cv2.VideoCapture(i, cv2.CAP_V4L2)
            if temp_cap.isOpened():
                ret, frame = temp_cap.read()
                if ret and frame is not None:
                    print(f"{LOG_TAG} Successfully opened camera at index {i}!")
                    cap = temp_cap
                    break
            if temp_cap:
                temp_cap.release()

    if cap is None or not cap.isOpened():
        print(f"{LOG_TAG} Cannot open any camera. Disabling vision.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print(f"{LOG_TAG} Vision started — Haar: {'ON' if face_cascade else 'OFF'} | COCO SSD: {'ON' if coco_available else 'OFF'}")

    frame_count = 0
    fps_frames = 0
    fps_last_time = time.time()
    last_tflite_entities = []

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.5)
            continue

        frame_count += 1
        fps_frames += 1
        now = time.time()
        fh, fw = frame.shape[:2]

        # FPS logging
        if now - fps_last_time >= 5.0:
            fps = fps_frames / (now - fps_last_time)
            print(f"{LOG_TAG} Vision: {fps:.1f}fps | frame#{frame_count} | entities: {eye_state['entityCount']}")
            fps_frames = 0
            fps_last_time = now

        all_entities = []

        # ── Haar cascade face detection (every frame) ──
        if face_cascade is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=HAAR_MIN_SIZE)

            for (x, y, w, h) in faces:
                cx = (x + w / 2.0) / fw
                cy = (y + h / 2.0) / fh
                all_entities.append({
                    'type': 'face',
                    'label': 'face',
                    'confidence': 1.0,
                    'x': round(cx, 3),
                    'y': round(cy, 3),
                    'w': round(w / fw, 3),
                    'h': round(h / fh, 3),
                    'source': 'haar',
                })

        # ── TFLite COCO SSD (every Nth frame) ──
        if coco_available and frame_count % TFLITE_INFERENCE_INTERVAL == 0:
            last_tflite_entities = coco.detect(frame)

        # Add cached TFLite detections
        for det in last_tflite_entities:
            # Deduplicate: skip person detections that overlap with face detections
            if det['type'] == 'person':
                overlaps_face = False
                for face_ent in all_entities:
                    if face_ent['type'] == 'face':
                        dx = abs(det['x'] - face_ent['x'])
                        dy = abs(det['y'] - face_ent['y'])
                        if dx < 0.2 and dy < 0.3:
                            overlaps_face = True
                            break
                if overlaps_face:
                    continue  # Don't add person if face covers same area
            all_entities.append(det)

        # ── Update behavior model ──
        if len(all_entities) > 0:
            b['last_entity_time'] = now
            b['sentinel_active'] = False

            # Pick primary target: face > person > hand > object
            priority = {'face': 0, 'person': 1, 'hand': 2}
            primary = min(all_entities, key=lambda e: (priority.get(e['type'], 10), -e['confidence']))

            # Map entity position to eye target (mirrored X)
            target_x = -(primary['x'] - 0.5) * 2.0 * LIMIT_X
            target_y = (primary['y'] - 0.5) * 2.0 * LIMIT_Y

            b['target_x'] = target_x
            b['target_y'] = target_y

            # Distance-based dilation
            size = primary.get('w', 0.1) * primary.get('h', 0.1)
            if size < 0.02:
                b['target_dilation'] = 1.0
            elif size < 0.08:
                proximity = (size - 0.02) / 0.06
                b['target_dilation'] = 1.0 + proximity * 0.45
            else:
                b['target_dilation'] = max(0.7, 1.45 - (size - 0.08) * 3.0)

            # Curiosity: new entities appeared
            if len(all_entities) > b['last_entity_count']:
                b['emotion'] = 'curious'
                b['emotion_end_time'] = now + 2.0
                b['target_dilation'] = min(1.8, b['target_dilation'] + 0.3)
            elif b['emotion'] != 'neutral' and now > b['emotion_end_time']:
                b['emotion'] = 'tracking'
                b['emotion_end_time'] = now + 5.0

            b['last_entity_count'] = len(all_entities)

            # Smooth tracking
            b['current_x'] = lerp(b['current_x'], b['target_x'], TRACKING_SMOOTH)
            b['current_y'] = lerp(b['current_y'], b['target_y'], TRACKING_SMOOTH)
            b['current_dilation'] = lerp(b['current_dilation'], b['target_dilation'], 0.12)

            eye_state['sentinel'] = False
            eye_state['visible'] = True
        else:
            # No entities — enter sentinel mode
            time_since_entity = now - b['last_entity_time']
            if time_since_entity > SENTINEL_ENTER_DELAY:
                if not b['sentinel_active']:
                    b['sentinel_active'] = True
                    b['sentinel_next_sweep'] = now
                update_sentinel(now)

                b['current_x'] = lerp(b['current_x'], b['sentinel_target_x'], 0.04)
                b['current_y'] = lerp(b['current_y'], b['sentinel_target_y'], 0.04)
                eye_state['sentinel'] = True
            else:
                # Decay to center
                b['current_x'] = lerp(b['current_x'], 0, 0.015)
                b['current_y'] = lerp(b['current_y'], 0, 0.015)
                eye_state['sentinel'] = False

            b['current_dilation'] = lerp(b['current_dilation'], 1.0, 0.025)
            eye_state['visible'] = False
            b['last_entity_count'] = 0

            if now > b['emotion_end_time']:
                b['emotion'] = 'neutral'

        # ── Update blink ──
        update_blink(now)

        # ── Pupil breathing rhythm ──
        breath = math.sin(now * math.pi * 2 * 0.12) * 0.04

        # ── Update eye_state ──
        eye_state['ix'] = b['current_x']
        eye_state['iy'] = b['current_y']
        eye_state['dilation'] = b['current_dilation'] + breath
        eye_state['blink'] = b['blink_phase']
        eye_state['emotion'] = b['emotion']
        eye_state['entityCount'] = len(all_entities)
        eye_state['entities'] = all_entities[:8]  # Max 8 entities in broadcast
        eye_state['t'] = now

        # Clear overlay after 4 seconds
        if eye_state['overlayText'] and eye_state.get('_overlay_set_time', 0):
            if now - eye_state['_overlay_set_time'] > 4.0:
                eye_state['overlayText'] = ''
                eye_state['overlayType'] = ''

        time.sleep(1.0 / 30.0)

    cap.release()


# ═══════════════════════════════════════════
#  WebSocket Server
# ═══════════════════════════════════════════
async def ws_handler(websocket):
    connected_clients.add(websocket)
    print(f"{LOG_TAG} Display client connected.")
    
    async def send_loop():
        try:
            while True:
                # Build compact payload (exclude internal keys)
                payload = {k: v for k, v in eye_state.items() if not k.startswith('_')}
                await websocket.send(json.dumps(payload))
                await asyncio.sleep(1.0 / 30.0)
        except Exception:
            pass

    async def recv_loop():
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except Exception:
                    continue
                
                action = data.get('action')
                if action == 'scan_wifi':
                    print(f"{LOG_TAG} Scanning WiFi...")
                    try:
                        result = subprocess.run(
                            ['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list'],
                            capture_output=True, text=True, timeout=10
                        )
                        networks = []
                        seen = set()
                        for line in result.stdout.strip().split('\n'):
                            if not line: continue
                            match = re.match(r'^(.*):(\d+):(.*)$', line)
                            if match:
                                ssid = match.group(1).replace(r'\:', ':')
                                signal = match.group(2)
                                sec = match.group(3)
                                if ssid and ssid != '--' and ssid not in seen:
                                    seen.add(ssid)
                                    networks.append({'ssid': ssid, 'signal': signal, 'security': sec})
                                    
                        networks.sort(key=lambda x: int(x['signal']), reverse=True)
                        await websocket.send(json.dumps({'type': 'wifi_results', 'networks': networks}))
                    except Exception as e:
                        print(f"{LOG_TAG} WiFi Scan Error: {e}")
                        await websocket.send(json.dumps({'type': 'wifi_results', 'networks': [], 'error': str(e)}))
                        
                elif action == 'join_wifi':
                    ssid = data.get('ssid')
                    password = data.get('password')
                    print(f"{LOG_TAG} Joining WiFi: {ssid}")
                    try:
                        cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
                        if password:
                            cmd.extend(['password', password])
                        result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                        success = result.returncode == 0
                        await websocket.send(json.dumps({
                            'type': 'wifi_join_status', 
                            'success': success, 
                            'message': result.stdout if success else result.stderr
                        }))
                    except Exception as e:
                        await websocket.send(json.dumps({'type': 'wifi_join_status', 'success': False, 'message': str(e)}))
        except Exception:
            pass

    send_task = asyncio.create_task(send_loop())
    recv_task = asyncio.create_task(recv_loop())
    
    done, pending = await asyncio.wait([send_task, recv_task], return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
        
    connected_clients.discard(websocket)
    print(f"{LOG_TAG} Display client disconnected.")


async def main():
    import websockets
    print(f"{LOG_TAG} ════════════════════════════════════════")
    print(f"{LOG_TAG}  OFFLINE OBSERVER DAEMON — V1 Protocol")
    print(f"{LOG_TAG}  Detection: Haar face + COCO SSD objects")
    print(f"{LOG_TAG}  Display: ws://0.0.0.0:{PORT}")
    print(f"{LOG_TAG} ════════════════════════════════════════")

    # Start background threads
    audio_thread = threading.Thread(target=audio_listener, daemon=True)
    vision_thread = threading.Thread(target=vision_tracking, daemon=True)

    audio_thread.start()
    vision_thread.start()

    # Boot announcement
    threading.Thread(target=lambda: speak("Offline observer active. Tracking enabled."), daemon=True).start()

    async with websockets.serve(ws_handler, "0.0.0.0", PORT):
        print(f"{LOG_TAG} Local display server running on ws://0.0.0.0:{PORT}")
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(main())
