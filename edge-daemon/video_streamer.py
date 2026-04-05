"""
Video Streamer — WebSocket Client

Captures MJPEG frames from the Pi camera via ffmpeg, extracts individual
JPEG frames from the stdout pipe, and sends each frame as a binary
WebSocket message to the PC backend.

Previous architecture: ffmpeg → UDP directly to PC
New architecture:      ffmpeg → stdout pipe → this code → WebSocket → PC

The stream is 320x240 MJPEG at 15fps (~100KB/s) — well within WebSocket capacity.
"""

import subprocess
import threading
import time
import logging
import asyncio
import ssl

try:
    import websockets
except ImportError:
    websockets = None

from config import Config

logger = logging.getLogger(__name__)

# JPEG Start-of-Image and End-of-Image markers
SOI = b'\xff\xd8'
EOI = b'\xff\xd9'


class VideoStreamer:
    def __init__(self, config: Config):
        self.config = config
        self._process = None
        self._capture_thread = None
        self._ws_thread = None
        self._running = False
        self._frame_queue = None

    def start(self):
        if self._running:
            return

        import queue
        self._frame_queue = queue.Queue(maxsize=30)
        self._running = True

        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._ws_thread = threading.Thread(target=self._ws_loop, daemon=True)
        self._capture_thread.start()
        self._ws_thread.start()

    def stop(self):
        self._running = False
        if self._process:
            self._process.terminate()
            try:
                self._process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._process.kill()
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=2)
        if self._ws_thread and self._ws_thread.is_alive():
            self._ws_thread.join(timeout=2)

    def is_running(self) -> bool:
        return (self._running and
                self._capture_thread is not None and
                self._capture_thread.is_alive() and
                self._ws_thread is not None and
                self._ws_thread.is_alive())

    def _capture_loop(self):
        """Run ffmpeg, read MJPEG from stdout, extract frames into queue."""
        import queue
        restarts = 0

        while self._running and restarts <= 3:
            cmd = [
                'ffmpeg',
                '-f', 'v4l2',
                '-input_format', 'mjpeg',
                '-video_size', f"{self.config.camera_width}x{self.config.camera_height}",
                '-framerate', str(self.config.camera_fps),
                '-i', self.config.camera_device,
                '-vcodec', 'copy',
                '-f', 'image2pipe',
                '-'
            ]

            logger.info(f"[VideoStreamer] Starting ffmpeg capture from {self.config.camera_device}")
            try:
                self._process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                )
            except FileNotFoundError:
                logger.error("[VideoStreamer] ffmpeg not found on PATH")
                break

            logger.info("[VideoStreamer] ffmpeg running, extracting JPEG frames from stdout")

            # Read stdout and extract JPEG frames using SOI/EOI markers
            buf = b''
            try:
                while self._running:
                    chunk = self._process.stdout.read(4096)
                    if not chunk:
                        break
                    buf += chunk
                    buf = self._extract_and_queue_frames(buf, queue)
            except Exception as e:
                logger.error(f"[VideoStreamer] Read error: {e}")

            self._process.wait()

            if not self._running:
                break

            restarts += 1
            if restarts <= 3:
                logger.warning(f"[VideoStreamer] ffmpeg exited (code {self._process.returncode}) — restarting in 5s")
                time.sleep(5)

        if self._running and restarts > 3:
            logger.error("[VideoStreamer] Fatal: max restarts exceeded")
            self._running = False

    def _extract_and_queue_frames(self, buf, queue_module):
        """Extract complete JPEG frames from buffer and put them in the queue."""
        while True:
            soi_idx = buf.find(SOI)
            if soi_idx == -1:
                return b''  # No frame start found, discard buffer

            eoi_idx = buf.find(EOI, soi_idx + 2)
            if eoi_idx == -1:
                # Incomplete frame — keep from SOI onwards
                return buf[soi_idx:]

            # Complete frame found
            frame = buf[soi_idx:eoi_idx + 2]
            buf = buf[eoi_idx + 2:]

            try:
                self._frame_queue.put_nowait(frame)
            except Exception:
                # Queue full — drop oldest frame
                try:
                    self._frame_queue.get_nowait()
                except Exception:
                    pass
                try:
                    self._frame_queue.put_nowait(frame)
                except Exception:
                    pass

    def _ws_loop(self):
        """WebSocket send loop — connects to PC backend and streams frames."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._async_ws_loop())
        loop.close()

    async def _async_ws_loop(self):
        import queue as queue_module

        uri = f"wss://{self.config.pc_backend_url}/ws/video"
        backoff = 1

        # Create SSL context that trusts default CAs (for wss://)
        ssl_ctx = ssl.create_default_context()

        while self._running:
            try:
                async with websockets.connect(
                    uri, ssl=ssl_ctx,
                    ping_interval=15,
                    ping_timeout=20,
                    close_timeout=5,
                    max_size=2**22,     # 4MB for video frames
                ) as ws:
                    logger.info(f"[VideoStreamer] Connected to {uri}")
                    backoff = 1

                    while self._running:
                        try:
                            frame = self._frame_queue.get(timeout=0.5)
                            await ws.send(frame)
                        except queue_module.Empty:
                            # No frames for 500ms — send a text keepalive
                            try:
                                await ws.send(b'')  # Empty binary = keepalive
                            except Exception:
                                break
                            continue

            except (Exception,) as e:
                if not self._running:
                    break
                logger.warning(f"[VideoStreamer] Connection failed ({e}). Reconnecting in {backoff}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5)  # Cap at 5s for fast recovery
