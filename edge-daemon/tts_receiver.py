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
            subprocess.run(
                [self.config.tts_engine, text],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10
            )
        except subprocess.TimeoutExpired:
            logger.warning("[TTSReceiver] TTS subprocess timed out")
        except Exception as e:
            logger.error(f"[TTSReceiver] TTS subprocess error: {e}")
