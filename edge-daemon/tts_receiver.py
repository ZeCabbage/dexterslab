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
import random

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

        # Start the playback worker thread for chunked TTS
        self._chunk_queue = __import__('queue').Queue(maxsize=20)
        self._playback_thread = threading.Thread(target=self._playback_worker, daemon=True)
        self._playback_thread.start()

    def stop(self):
        self._running = False
        # Signal the playback worker to stop
        if hasattr(self, '_chunk_queue'):
            try:
                self._chunk_queue.put(None, timeout=1)  # Poison pill
            except Exception:
                pass
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
        if hasattr(self, '_playback_thread') and self._playback_thread.is_alive():
            self._playback_thread.join(timeout=2)

    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    def _run_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._async_connect_loop())
        loop.close()

    def _playback_worker(self):
        """Dedicated thread that processes TTS chunks and raw PCM sequentially.
        While one chunk plays, the next is already waiting in the queue.
        This gives near-seamless back-to-back speech."""
        logger.info("[TTSReceiver] Playback worker started")
        while self._running:
            try:
                item = self._chunk_queue.get(timeout=1.0)
                if item is None:
                    break  # Poison pill — shutdown

                # Check if this is raw PCM audio (from Gemini Live)
                if isinstance(item, tuple) and len(item) == 2 and isinstance(item[0], bytes):
                    pcm_data, sample_rate = item
                    logger.info(f"[TTSReceiver] 🔊 Playing raw PCM ({len(pcm_data)} bytes, {sample_rate}Hz)")
                    self._play_raw_pcm(pcm_data, sample_rate)
                    continue

                text, chunk_index, is_last, ws_ref = item
                logger.info(f"[TTSReceiver] 🔊 Playing chunk {chunk_index}: \"{text[:50]}\"")
                self._speak(text)
                # Send ack back to PC
                try:
                    import asyncio as _aio
                    loop = _aio.new_event_loop()
                    loop.run_until_complete(ws_ref.send(json.dumps({
                        "type": "tts_chunk_ack",
                        "chunkIndex": chunk_index
                    })))
                    loop.close()
                except Exception as e:
                    logger.warning(f"[TTSReceiver] Failed to send chunk ack: {e}")
            except __import__('queue').Empty:
                continue
            except Exception as e:
                logger.error(f"[TTSReceiver] Playback worker error: {e}")

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
                            # Original batch TTS — speak immediately (blocking)
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

                        elif cmd_type == "tts_chunk":
                            # ── Streaming chunk TTS ──
                            # Queue the chunk for the playback worker thread.
                            # This returns immediately so we can receive more chunks
                            # while earlier ones are still being synthesized/played.
                            text = data.get("text", "")
                            text = "".join(c for c in text if c.isprintable())[:500]
                            chunk_index = data.get("chunkIndex", 0)
                            is_last = data.get("isLast", False)
                            if text:
                                try:
                                    self._chunk_queue.put_nowait(
                                        (text, chunk_index, is_last, ws)
                                    )
                                    logger.info(f"[TTSReceiver] 📦 Queued chunk {chunk_index}{' (FINAL)' if is_last else ''}")
                                except __import__('queue').Full:
                                    logger.warning(f"[TTSReceiver] Chunk queue full — dropping chunk {chunk_index}")
                                    try:
                                        await ws.send(json.dumps({
                                            "type": "tts_error",
                                            "message": f"Chunk queue full, dropped chunk {chunk_index}"
                                        }))
                                    except Exception:
                                        pass
                            elif is_last:
                                # Empty final chunk — just ack it
                                try:
                                    await ws.send(json.dumps({
                                        "type": "tts_chunk_ack",
                                        "chunkIndex": chunk_index
                                    }))
                                except Exception:
                                    pass

                        elif cmd_type == "tts_raw_audio":
                            # ── Gemini Live raw PCM audio ──
                            # Pre-synthesized audio from Gemini Live API.
                            # Queue for playback worker (non-blocking) so we
                            # can keep receiving more audio chunks.
                            import base64 as b64
                            audio_b64 = data.get("audio", "")
                            sample_rate = data.get("sampleRate", 24000)
                            if audio_b64:
                                try:
                                    pcm_data = b64.b64decode(audio_b64)
                                    self._chunk_queue.put_nowait(
                                        (pcm_data, sample_rate)
                                    )
                                except __import__('queue').Full:
                                    logger.warning("[TTSReceiver] Raw audio queue full — dropping chunk")
                                except Exception as e:
                                    logger.error(f"[TTSReceiver] Raw audio decode error: {e}")

                        else:
                            logger.warning(f"[TTSReceiver] Unknown command type: {cmd_type}")

            except (Exception,) as e:
                if not self._running:
                    break
                jitter = random.uniform(0, 1.0)
                wait = backoff + jitter
                logger.warning(f"[TTSReceiver] Connection failed ({e}). Reconnecting in {wait:.1f}s")
                await asyncio.sleep(wait)
                backoff = min(backoff * 2, 10)

    # ── Piper TTS config ──
    PIPER_BIN = '/home/deploy/dexterslab-edge/venv/bin/piper'
    PIPER_MODEL = '/home/deploy/piper-voices/en_GB-cori-medium.onnx'
    PIPER_SAMPLE_RATE = 22050  # Piper medium models output 22050 Hz

    def _speak(self, text: str):
        logger.info(f"[TTSReceiver] Speaking: {text}")
        try:
            card = self.config.audio_output_card

            # Set volume on the discovered speaker card
            if card >= 0:
                for control in ['PCM', 'Speaker', 'Master']:
                    result = subprocess.run(
                        ['amixer', '-c', str(card), 'set', control, '85%'],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=3
                    )
                    if result.returncode == 0:
                        logger.info(f"[TTSReceiver] Volume set to 85% on card {card} ({control})")
                        break
            else:
                subprocess.run(
                    ['amixer', 'set', 'Master', '85%'],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=3
                )

            alsa_device = f"plughw:{card},0" if card >= 0 else "default"

            # ── Try Piper TTS first (neural British female voice) ──
            if self._speak_piper(text, alsa_device, card):
                return

            # ── Fallback: espeak-ng (robotic but always available) ──
            logger.warning("[TTSReceiver] Piper failed — falling back to espeak-ng")
            self._speak_espeak(text, alsa_device, card)

        except subprocess.TimeoutExpired:
            logger.warning("[TTSReceiver] TTS subprocess timed out")
        except Exception as e:
            logger.error(f"[TTSReceiver] TTS subprocess error: {e}")

    def _speak_piper(self, text: str, alsa_device: str, card: int) -> bool:
        """Speak using Piper TTS (neural, natural-sounding British female voice).
        Returns True on success, False if Piper is unavailable."""
        import os
        if not os.path.exists(self.PIPER_BIN) or not os.path.exists(self.PIPER_MODEL):
            logger.warning(f"[TTSReceiver] Piper not found (bin={self.PIPER_BIN}, model={self.PIPER_MODEL})")
            return False

        try:
            logger.info(f"[TTSReceiver] Piper TTS → {alsa_device}")

            # Pipeline: echo "text" | piper --model X --output-raw | aplay -D device -r 22050 -f S16_LE -t raw
            echo_proc = subprocess.Popen(
                ['echo', text],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            piper_proc = subprocess.Popen(
                [self.PIPER_BIN, '--model', self.PIPER_MODEL, '--output-raw'],
                stdin=echo_proc.stdout,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            echo_proc.stdout.close()

            aplay_args = ['aplay', '-r', str(self.PIPER_SAMPLE_RATE), '-f', 'S16_LE', '-t', 'raw', '-']
            if card >= 0:
                aplay_args = ['aplay', '-D', alsa_device, '-r', str(self.PIPER_SAMPLE_RATE),
                              '-f', 'S16_LE', '-t', 'raw', '-']

            aplay_proc = subprocess.Popen(
                aplay_args,
                stdin=piper_proc.stdout,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            piper_proc.stdout.close()

            aplay_proc.wait(timeout=30)  # Piper needs more time than espeak-ng
            piper_proc.wait(timeout=5)

            if aplay_proc.returncode == 0:
                return True
            else:
                logger.warning(f"[TTSReceiver] Piper aplay returned {aplay_proc.returncode}")
                return False

        except subprocess.TimeoutExpired:
            logger.warning("[TTSReceiver] Piper TTS timed out")
            try:
                piper_proc.kill()
            except Exception:
                pass
            try:
                aplay_proc.kill()
            except Exception:
                pass
            return False
        except Exception as e:
            logger.warning(f"[TTSReceiver] Piper TTS error: {e}")
            return False

    def _speak_espeak(self, text: str, alsa_device: str, card: int):
        """Fallback: speak using espeak-ng (robotic but reliable)."""
        logger.info(f"[TTSReceiver] espeak-ng fallback → {alsa_device}")
        if card >= 0:
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

            if aplay_proc.returncode != 0:
                logger.warning(f"[TTSReceiver] espeak aplay returned {aplay_proc.returncode}, trying hw directly")
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
            subprocess.run(
                [self.config.tts_engine, '-v', 'en+klatt3', '-s', '160', '-p', '20', '-g', '5', text],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10
            )

    def _play_raw_pcm(self, pcm_data: bytes, sample_rate: int = 24000):
        """Play pre-synthesized PCM audio from Gemini Live API.

        Receives raw 16-bit signed little-endian PCM and plays it directly
        via aplay without any TTS synthesis step.
        """
        logger.info(f"[TTSReceiver] Playing raw PCM audio ({len(pcm_data)} bytes, {sample_rate}Hz)")
        try:
            card = self.config.audio_output_card

            # Set volume
            if card >= 0:
                for control in ['PCM', 'Speaker', 'Master']:
                    result = subprocess.run(
                        ['amixer', '-c', str(card), 'set', control, '85%'],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=3
                    )
                    if result.returncode == 0:
                        break
            else:
                subprocess.run(
                    ['amixer', 'set', 'Master', '85%'],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=3
                )

            alsa_device = f"plughw:{card},0" if card >= 0 else "default"

            # Play raw PCM directly via aplay
            # Format: signed 16-bit little-endian, mono, at given sample rate
            aplay_proc = subprocess.Popen(
                [
                    'aplay', '-D', alsa_device,
                    '-f', 'S16_LE',
                    '-r', str(sample_rate),
                    '-c', '1',
                    '-t', 'raw',
                    '-'
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            aplay_proc.communicate(input=pcm_data, timeout=30)

        except subprocess.TimeoutExpired:
            logger.warning("[TTSReceiver] Raw PCM playback timed out")
        except Exception as e:
            logger.error(f"[TTSReceiver] Raw PCM playback error: {e}")
