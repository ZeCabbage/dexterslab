import asyncio
import websockets
import json
import logging
import subprocess
import threading
from config import Config

logger = logging.getLogger(__name__)

class TTSReceiver:
    def __init__(self, config: Config):
        self.config = config
        self._running = False
        self._server = None
        self._loop = None
        self._thread = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    def _run_loop(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        
        start_server = websockets.serve(
            self._handler, "0.0.0.0", self.config.tts_command_port
        )
        self._server = self._loop.run_until_complete(start_server)
        logger.info(f"[TTSReceiver] Listening on port {self.config.tts_command_port}")
        
        try:
            self._loop.run_forever()
        except Exception as e:
            logger.error(f"[TTSReceiver] Event loop error: {e}")
        finally:
            self._server.close()
            self._loop.run_until_complete(self._server.wait_closed())
            self._loop.close()

    async def _handler(self, websocket, path):
        # We only accept connections from PC_TAILSCALE_IP for security
        remote_ip = websocket.remote_address[0]
        if remote_ip != self.config.pc_tailscale_ip and remote_ip != "127.0.0.1":
            # Allowed localhost for local testing
            logger.warning(f"[TTSReceiver] Rejected connection from unauthorized IP: {remote_ip}")
            await websocket.close(1008, "Unauthorized IP")
            return

        logger.info(f"[TTSReceiver] Client connected from {remote_ip}")
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    logger.warning(f"[TTSReceiver] Invalid JSON received: {message[:50]}...")
                    continue
                
                cmd_type = data.get("type")
                if cmd_type == "tts":
                    text = data.get("text", "")
                    # Sanitize: limit length and strip non-printables
                    text = "".join(c for c in text if c.isprintable())[:500]
                    if text:
                        self._speak(text)
                else:
                    logger.warning(f"[TTSReceiver] Unknown command type: {cmd_type}")
        except websockets.exceptions.ConnectionClosed:
            logger.info("[TTSReceiver] Client disconnected")

    def _speak(self, text: str):
        logger.info(f"[TTSReceiver] Speaking: {text}")
        try:
            # Using list form for subprocess to avoid shell injection
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
