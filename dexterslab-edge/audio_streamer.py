"""
Audio Streamer — WebSocket Client

Captures PCM audio from the Pi's microphone and streams it to
the PC backend over WebSocket.

Previous: Connected to ws://{tailscale_ip}:{port}/ws/audio
New:      Connected to wss://{cloudflare_hostname}/ws/audio
"""

import pyaudio
import threading
import queue
import logging
import asyncio
import time
import json
import ssl
import sys

try:
    import websockets
except ImportError:
    websockets = None

from config import Config

logger = logging.getLogger(__name__)


class AudioStreamer:
    def __init__(self, config: Config):
        self.config = config
        self._running = False
        self._capture_thread = None
        self._ws_thread = None
        self._queue = queue.Queue(maxsize=50)
        self._pyaudio = pyaudio.PyAudio()

    def start(self):
        if self._running:
            return
        self._running = True
        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._ws_thread = threading.Thread(target=self._ws_loop, daemon=True)
        self._capture_thread.start()
        self._ws_thread.start()

    def stop(self):
        self._running = False
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=2)
        if self._ws_thread and self._ws_thread.is_alive():
            self._ws_thread.join(timeout=2)
        self._pyaudio.terminate()

    def is_running(self) -> bool:
        return self._running and self._capture_thread is not None and self._capture_thread.is_alive() and self._ws_thread is not None and self._ws_thread.is_alive()

    def restart(self):
        """Restart the WS thread only (capture thread keeps running)."""
        logger.info("[AudioStreamer] Restarting WS connection thread...")
        # Stop old WS thread
        if self._ws_thread and self._ws_thread.is_alive():
            self._ws_thread.join(timeout=2)
        # Drain the queue to avoid stale data
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break
        # Start fresh WS thread
        self._ws_thread = threading.Thread(target=self._ws_loop, daemon=True)
        self._ws_thread.start()

    def _capture_loop(self):
        frames_per_buffer = int(self.config.audio_sample_rate * (self.config.audio_chunk_ms / 1000.0))
        stream = self._pyaudio.open(
            format=pyaudio.paInt16,
            channels=self.config.audio_channels,
            rate=self.config.audio_sample_rate,
            input=True,
            frames_per_buffer=frames_per_buffer
        )

        logger.info("[AudioStreamer] Capture active")
        try:
            while self._running:
                data = stream.read(frames_per_buffer, exception_on_overflow=False)
                try:
                    self._queue.put_nowait(data)
                except queue.Full:
                    try:
                        self._queue.get_nowait()
                    except queue.Empty:
                        pass
                    self._queue.put_nowait(data)
                    # Throttle this warning — only log every ~5s (50 chunks at 100ms each)
                    if not hasattr(self, '_queue_warn_count'):
                        self._queue_warn_count = 0
                    self._queue_warn_count += 1
                    if self._queue_warn_count % 50 == 1:
                        logger.warning("[AudioStreamer] Queue full, dropping frames. WS may be disconnected.")
        finally:
            stream.stop_stream()
            stream.close()

    def _ws_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._async_ws_loop())
        except Exception as e:
            # CRITICAL: Never let an unhandled exception kill this thread silently.
            # Log it and exit — main.py's watchdog will restart us.
            logger.error(f"[AudioStreamer] WS loop crashed: {e}")
        finally:
            loop.close()

    async def _async_ws_loop(self):
        uri = f"wss://{self.config.pc_backend_url}/ws/audio"
        backoff = 1

        # SSL context for wss://
        ssl_ctx = ssl.create_default_context()

        while self._running:
            try:
                async with websockets.connect(
                    uri, ssl=ssl_ctx,
                    ping_interval=15,   # Send WS ping every 15s (CF idle timeout is 100s)
                    ping_timeout=20,    # Allow 20s for pong (CF adds latency)
                    close_timeout=5,
                    max_size=2**20,     # 1MB
                ) as ws:
                    logger.info(f"[AudioStreamer] Connected to {uri}. Negotiating format...")

                    try:
                        format_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        reqs = json.loads(format_msg)

                        if reqs.get('type') != 'format_requirements':
                            logger.error(f"[AudioStreamer] Unexpected format message: {reqs}")
                            # Don't sys.exit — just reconnect
                            continue

                        if reqs.get('sampleRate') != self.config.audio_sample_rate:
                            logger.error(f"[AudioStreamer] AUDIO FORMAT MISMATCH: Server requires sampleRate {reqs.get('sampleRate')}, but config has {self.config.audio_sample_rate}")
                            # Don't sys.exit — just reconnect
                            continue

                        if reqs.get('channels') != self.config.audio_channels:
                            logger.error(f"[AudioStreamer] AUDIO FORMAT MISMATCH: Server requires channels {reqs.get('channels')}, but config has {self.config.audio_channels}")
                            continue

                        await ws.send(json.dumps({"type": "format_ack"}))
                        logger.info("[AudioStreamer] Format negotiation successful")

                    except asyncio.TimeoutError:
                        logger.warning("[AudioStreamer] Format negotiation timed out. Reconnecting...")
                        continue
                    except Exception as e:
                        logger.warning(f"[AudioStreamer] Format negotiation failed: {e}. Reconnecting...")
                        continue

                    backoff = 1  # Reset backoff on successful connection
                    idle_count = 0
                    while self._running:
                        try:
                            data = self._queue.get(timeout=0.1)
                            await ws.send(data)
                            idle_count = 0
                        except queue.Empty:
                            idle_count += 1
                            # Every ~5s of no data, send an explicit app-level keepalive
                            if idle_count > 50:
                                try:
                                    await ws.send(json.dumps({"type": "keepalive"}))
                                except Exception:
                                    break
                                idle_count = 0
                            await asyncio.sleep(0.01)
                            continue

            except Exception as e:
                # Catch ALL exceptions: ConnectionClosed, InvalidStatusCode (502),
                # OSError, SSL errors, DNS failures, etc.
                if not self._running:
                    break
                logger.warning(f"[AudioStreamer] Connection failed ({type(e).__name__}: {e}). Reconnecting in {backoff}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5)  # Cap at 5s for fast recovery
