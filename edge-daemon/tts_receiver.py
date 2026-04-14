"""
TTS Receiver — WebSocket Client (Pi-initiated connection)

Previous architecture: Pi runs a WS server on port 8890, PC connects to it
New architecture:      Pi connects to PC's /ws/tts endpoint as a client,
                       listens for TTS commands pushed down by the PC

This reversal is needed because Cloudflare Tunnel only proxies inbound
connections to the PC — the PC can't reach the Pi directly.
"""

import asyncio
import json
import logging
import subprocess
import threading
import ssl

try:
    import websockets
except ImportError:
    websockets = None

from config import Config

logger = logging.getLogger(__name__)


class TTSReceiver:
    def __init__(self, config: Config):
        self.config = config
        self._running = False
        self._thread = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    def _run_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._async_connect_loop())
        loop.close()

    async def _async_connect_loop(self):
        uri = f"wss://{self.config.pc_backend_url}/ws/tts"
        backoff = 1

        # SSL context for wss://
        ssl_ctx = ssl.create_default_context()

        while self._running:
            try:
                async with websockets.connect(
                    uri, ssl=ssl_ctx,
                    ping_interval=15,
                    ping_timeout=20,
                    close_timeout=5,
                ) as ws:
                    logger.info(f"[TTSReceiver] Connected to {uri}")
                    backoff = 1

                    # Listen for TTS commands from the PC
                    async for message in ws:
                        try:
                            data = json.loads(message)
                        except json.JSONDecodeError:
                            logger.warning(f"[TTSReceiver] Invalid JSON: {message[:50]}...")
                            continue

                        cmd_type = data.get("type")
                        if cmd_type == "tts":
                            text = data.get("text", "")
                            # Sanitize: limit length and strip non-printables
                            text = "".join(c for c in text if c.isprintable())[:500]
                            if text:
                                self._speak(text)
                                # Send acknowledgment back to PC
                                try:
                                    await ws.send(json.dumps({
                                        "type": "tts_ack",
                                        "text": text[:50]
                                    }))
                                except Exception:
                                    pass
                        else:
                            logger.warning(f"[TTSReceiver] Unknown command type: {cmd_type}")

            except (Exception,) as e:
                if not self._running:
                    break
                logger.warning(f"[TTSReceiver] Connection failed ({e}). Reconnecting in {backoff}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5)  # Cap at 5s for fast recovery

    def _speak(self, text: str):
        logger.info(f"[TTSReceiver] Speaking: {text}")
        try:
            card = self.config.audio_output_card

            # Set volume to 100% (LOUD) on the discovered speaker card
            if card >= 0:
                for control in ['PCM', 'Speaker', 'Master']:
                    result = subprocess.run(
                        ['amixer', '-c', str(card), 'set', control, '100%'],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=3
                    )
                    if result.returncode == 0:
                        logger.info(f"[TTSReceiver] Volume set to 100% on card {card} ({control})")
                        break
            else:
                subprocess.run(
                    ['amixer', 'set', 'Master', '100%'],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=3
                )

            # Route espeak-ng output through the correct ALSA device
            # espeak-ng --stdout produces WAV on stdout, pipe to aplay on the right card
            if card >= 0:
                # Use plughw: as primary — handles mono→stereo conversion for USB speakers
                # Raw hw: fails with "Channels count non available" for mono espeak-ng output
                alsa_device = f"plughw:{card},0"
                logger.info(f"[TTSReceiver] Routing audio: espeak-ng --stdout | aplay -D {alsa_device}")

                # Pipe: espeak-ng --stdout "text" | aplay -D hw:N,0
                espeak_proc = subprocess.Popen(
                    [self.config.tts_engine, '-v', 'en+klatt3', '-s', '160', '-p', '20', '-g', '5', '--stdout', text],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                )
                aplay_proc = subprocess.Popen(
                    ['aplay', '-D', alsa_device],
                    stdin=espeak_proc.stdout,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                espeak_proc.stdout.close()  # Allow espeak to receive SIGPIPE
                aplay_proc.wait(timeout=15)
                espeak_proc.wait(timeout=5)

                if aplay_proc.returncode != 0:
                    logger.warning(f"[TTSReceiver] aplay returned {aplay_proc.returncode}, trying hw directly")
                    # Fallback: try raw hw (in case plughw fails for some reason)
                    alsa_device = f"hw:{card},0"
                    espeak_proc = subprocess.Popen(
                        [self.config.tts_engine, '-v', 'en+klatt3', '-s', '160', '-p', '20', '-g', '5', '--stdout', text],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL,
                    )
                    aplay_proc = subprocess.Popen(
                        ['aplay', '-D', alsa_device],
                        stdin=espeak_proc.stdout,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    espeak_proc.stdout.close()
                    aplay_proc.wait(timeout=15)
                    espeak_proc.wait(timeout=5)
            else:
                # No specific card — let espeak-ng use system default
                subprocess.run(
                    [self.config.tts_engine, '-v', 'en+klatt3', '-s', '160', '-p', '20', '-g', '5', text],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10
                )

        except subprocess.TimeoutExpired:
            logger.warning("[TTSReceiver] TTS subprocess timed out")
            # Kill any lingering processes
            try:
                espeak_proc.kill()
            except Exception:
                pass
            try:
                aplay_proc.kill()
            except Exception:
                pass
        except Exception as e:
            logger.error(f"[TTSReceiver] TTS subprocess error: {e}")

