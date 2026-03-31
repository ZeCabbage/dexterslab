import json
import time
import asyncio
import cv2
import threading
import subprocess
import os
import re

LOG_TAG = "[OFFLINE-DAEMON]"
PORT = 8892

# Eye Display State (mirrors backend EyeState)
eye_state = {
    'ix': 0, 'iy': 0, 'dilation': 1.0, 'blink': 0,
    'emotion': 'neutral', 'sentinel': True, 'visible': False,
    'entityCount': 0, 'overlayText': '', 'overlayType': '',
    'blush': 0, 'goodBoy': 0, 'thankYou': 0, 't': 0,
}

connected_clients = set()

# Models paths
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
VOSK_PATH = os.path.join(MODELS_DIR, 'vosk-model-small-en-us')
HAAR_PATH = os.path.join(MODELS_DIR, 'haarcascade_frontalface_default.xml')

def speak(text):
    print(f"{LOG_TAG} Speaking: {text}")
    try:
        subprocess.run(['espeak-ng', '-v', 'en-us', text], check=False)
    except Exception as e:
        print(f"{LOG_TAG} TTS Error: {e}")

def get_intent_response(text):
    text = text.lower()
    if re.search(r'\b(status|report)\b', text):
        return "I am operating in local edge mode. PC connection is offline."
    elif re.search(r'\b(sleep|shutdown)\b', text):
        global eye_state
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

    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=4000)
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

def vision_tracking():
    if not os.path.exists(HAAR_PATH):
        print(f"{LOG_TAG} Haar cascade not found at {HAAR_PATH}. Disabling Face Tracking.")
        return

    face_cascade = cv2.CascadeClassifier(HAAR_PATH)
    cap = cv2.VideoCapture(0)
    
    # Try libcamera if OpenCV default fails on Pi
    if not cap.isOpened():
        print(f"{LOG_TAG} Default cv2 capture failed. Trying V4L2 backend...")
        cap = cv2.VideoCapture(0, cv2.CAP_V4L2)

    if not cap.isOpened():
        print(f"{LOG_TAG} Cannot open camera. Disabling vision.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print(f"{LOG_TAG} Starting local face tracking...")
    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(1)
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(30, 30))

        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
            x, y, w, h = faces[0]
            
            cx = x + w / 2
            cy = y + h / 2
            
            fnx = (cx / 320.0) - 0.5
            fny = (cy / 240.0) - 0.5
            
            LIMIT_X = 200
            LIMIT_Y = 150
            
            targetX = fnx * -2.0 * LIMIT_X
            targetY = fny * 2.0 * LIMIT_Y

            eye_state['sentinel'] = False
            eye_state['visible'] = True
            eye_state['entityCount'] = len(faces)
            
            eye_state['ix'] += (targetX - eye_state['ix']) * 0.2
            eye_state['iy'] += (targetY - eye_state['iy']) * 0.2
            eye_state['dilation'] += (1.4 - eye_state['dilation']) * 0.1
        else:
            eye_state['sentinel'] = True
            eye_state['visible'] = False
            eye_state['entityCount'] = 0
            eye_state['dilation'] += (1.0 - eye_state['dilation']) * 0.1

        time.sleep(1.0/30.0)

async def ws_handler(websocket):
    import websockets
    connected_clients.add(websocket)
    print(f"{LOG_TAG} Screen connected to edge daemon.")
    try:
        while True:
            payload = json.dumps(eye_state)
            await websocket.send(payload)
            await asyncio.sleep(1.0/30.0)
    except Exception:
        pass
    finally:
        connected_clients.remove(websocket)

async def main():
    import websockets
    print(f"{LOG_TAG} Starting Offline Edge Daemon...")
    
    audio_thread = threading.Thread(target=audio_listener, daemon=True)
    vision_thread = threading.Thread(target=vision_tracking, daemon=True)
    
    audio_thread.start()
    vision_thread.start()
    
    async with websockets.serve(ws_handler, "0.0.0.0", PORT):
        print(f"{LOG_TAG} Local display server running on ws://0.0.0.0:{PORT}")
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
