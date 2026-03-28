import pyaudio
import threading
import queue
import logging
import asyncio
import websockets
import time
import json
import sys
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
                    logger.warning("[AudioStreamer] WARNING: Queue full, dropping frame. Check network connection.")
        finally:
            stream.stop_stream()
            stream.close()

    def _ws_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._async_ws_loop())
        loop.close()

    async def _async_ws_loop(self):
        uri = f"ws://{self.config.pc_tailscale_ip}:{self.config.audio_ws_port}/ws/audio"
        backoff = 1
        
        while self._running:
            try:
                async with websockets.connect(uri) as ws:
                    logger.info(f"[AudioStreamer] Connected to {uri}. Negotiating format...")
                    
                    try:
                        format_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        reqs = json.loads(format_msg)
                        
                        if reqs.get('type') != 'format_requirements':
                            raise ValueError(f"Expected format_requirements, got {reqs.get('type')}")
                            
                        if reqs.get('sampleRate') != self.config.audio_sample_rate:
                            logger.fatal(f"[AudioStreamer] AUDIO FORMAT MISMATCH: Server requires sampleRate {reqs.get('sampleRate')}, but config has {self.config.audio_sample_rate}")
                            sys.exit(1)
                        if reqs.get('channels') != self.config.audio_channels:
                            logger.fatal(f"[AudioStreamer] AUDIO FORMAT MISMATCH: Server requires channels {reqs.get('channels')}, but config has {self.config.audio_channels}")
                            sys.exit(1)
                            
                        await ws.send(json.dumps({"type": "format_ack"}))
                        logger.info("[AudioStreamer] Format negotiation successful")
                        
                    except Exception as e:
                        logger.fatal(f"[AudioStreamer] Failed format negotiation: {e}")
                        sys.exit(1)

                    backoff = 1
                    while self._running:
                        try:
                            # Use timeout to allow checking self._running
                            data = self._queue.get(timeout=0.1)
                            await ws.send(data)
                        except queue.Empty:
                            await asyncio.sleep(0.01)
                            continue
            except (websockets.exceptions.ConnectionClosed, OSError) as e:
                if not self._running:
                    break
                logger.warning(f"[AudioStreamer] Connection dropped ({e}). Reconnecting in {backoff}s (attempt...)")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
