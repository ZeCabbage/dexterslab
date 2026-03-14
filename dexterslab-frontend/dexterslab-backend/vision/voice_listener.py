"""
VoiceListener — Vosk-based offline speech recognition.

Runs in a background thread, captures audio from the mic,
and triggers callbacks on speech, commands, and partial results.
"""

import json
import threading
import time
from typing import Callable, Optional

import numpy as np


class VoiceListener:
    """Background voice recognition using Vosk."""

    # Commands recognized by the listener
    COMMANDS = {
        "go to sleep": "sleep",
        "wake up": "wake",
        "naughty": "blush",
        "good boy": "goodboy",
        "good dog": "goodboy",
        "thank you": "thankyou",
        "thanks": "thankyou",
    }

    def __init__(
        self,
        on_speech: Optional[Callable[[str], None]] = None,
        on_command: Optional[Callable[[str], None]] = None,
        on_partial: Optional[Callable[[str], None]] = None,
        model_path: str = "model",
        device: Optional[int] = None,
        sample_rate: int = 16000,
    ):
        self.on_speech = on_speech
        self.on_command = on_command
        self.on_partial = on_partial
        self.model_path = model_path
        self.device = device
        self.sample_rate = sample_rate
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Start the voice listener in a background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="VoiceListener")
        self._thread.start()

    def stop(self):
        """Stop the voice listener."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
            self._thread = None

    def _run(self):
        """Main listener loop — runs in background thread."""
        try:
            import sounddevice as sd
            from vosk import Model, KaldiRecognizer
        except ImportError as e:
            print(f"  ⚠️ VoiceListener: Missing dependency: {e}")
            return

        try:
            model = Model(self.model_path)
        except Exception as e:
            print(f"  ⚠️ VoiceListener: Cannot load Vosk model from '{self.model_path}': {e}")
            return

        rec = KaldiRecognizer(model, self.sample_rate)
        rec.SetWords(True)

        print(f"  🎙️ VoiceListener ready (device={self.device}, rate={self.sample_rate})")

        def audio_callback(indata, frames, time_info, status):
            if status:
                pass  # Ignore overflow
            audio_bytes = (indata[:, 0] * 32767).astype(np.int16).tobytes()

            if rec.AcceptWaveform(audio_bytes):
                result = json.loads(rec.Result())
                text = result.get("text", "").strip()
                if text:
                    # Check for commands
                    text_lower = text.lower()
                    for trigger, cmd_name in self.COMMANDS.items():
                        if trigger in text_lower:
                            if self.on_command:
                                self.on_command(cmd_name)
                            return

                    # Regular speech
                    if self.on_speech:
                        self.on_speech(text)
            else:
                partial = json.loads(rec.PartialResult())
                partial_text = partial.get("partial", "").strip()
                if partial_text and self.on_partial:
                    self.on_partial(partial_text)

        try:
            with sd.InputStream(
                samplerate=self.sample_rate,
                blocksize=4000,
                device=self.device,
                dtype="float32",
                channels=1,
                callback=audio_callback,
            ):
                while self._running:
                    time.sleep(0.1)
        except Exception as e:
            print(f"  ⚠️ VoiceListener: Audio stream error: {e}")
