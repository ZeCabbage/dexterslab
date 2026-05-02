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
import random

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
    def __init__(self, config: Config, initial_delay: float = 0):
        self.config = config
        self._process = None
        self._capture_thread = None
        self._ws_thread = None
        self._running = False
        self._frame_queue = None
        self._initial_delay = initial_delay  # Staggered startup

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

        while self._running and restarts <= 10:
            # Find camera device (may have changed after USB reset)
            camera_device = self._find_camera_device()

            # ── Ensure camera device is free before starting ffmpeg ──
            if not self._wait_for_camera(camera_device):
                restarts += 1
                continue

            input_format = self._detect_camera_format(camera_device)
            if input_format == 'mjpeg':
                # Camera supports MJPEG natively — copy directly (zero CPU)
                cmd = [
                    'ffmpeg', '-y',
                    '-f', 'v4l2',
                    '-input_format', 'mjpeg',
                    '-video_size', f"{self.config.camera_width}x{self.config.camera_height}",
                    '-framerate', str(self.config.camera_fps),
                    '-i', camera_device,
                    '-vcodec', 'copy',
                    '-f', 'image2pipe',
                    '-'
                ]
            else:
                # Camera only supports YUYV — re-encode to MJPEG
                cmd = [
                    'ffmpeg', '-y',
                    '-f', 'v4l2',
                    '-input_format', 'yuyv422',
                    '-video_size', f"{self.config.camera_width}x{self.config.camera_height}",
                    '-framerate', str(self.config.camera_fps),
                    '-i', camera_device,
                    '-vcodec', 'mjpeg',
                    '-q:v', '5',  # Quality (2=best, 31=worst) — 5 is good balance
                    '-f', 'image2pipe',
                    '-'
                ]

            logger.info(f"[VideoStreamer] Starting ffmpeg capture from {camera_device} (format={input_format})")
            try:
                self._process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,  # Capture stderr for debugging
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

            # ── Proper cleanup before restart ──
            # Read any stderr output for debugging
            try:
                stderr_out = self._process.stderr.read(2048) if self._process.stderr else b''
                if stderr_out:
                    logger.warning(f"[VideoStreamer] ffmpeg stderr: {stderr_out.decode(errors='replace').strip()[-200:]}")
            except Exception:
                pass

            # Ensure ffmpeg is fully dead before we release the camera
            try:
                self._process.terminate()
                self._process.wait(timeout=3)
            except Exception:
                try:
                    self._process.kill()
                    self._process.wait(timeout=2)
                except Exception:
                    pass

            # Close pipes to fully release file descriptors
            for pipe in [self._process.stdout, self._process.stderr]:
                try:
                    if pipe:
                        pipe.close()
                except Exception:
                    pass

            if not self._running:
                break

            restarts += 1
            if restarts <= 10:
                exit_code = self._process.returncode
                logger.warning(f"[VideoStreamer] ffmpeg exited (code {exit_code}) — restarting in 5s")
                # Wait for camera device to fully release
                time.sleep(5)

        if self._running and restarts > 10:
            logger.error("[VideoStreamer] Fatal: max restarts exceeded")
            self._running = False

    def _find_camera_device(self):
        """Find the actual camera device. USB cameras can change /dev/videoN after resets."""
        import os
        import glob

        configured = self.config.camera_device

        # First, check if configured device exists
        if os.path.exists(configured):
            logger.info(f"[VideoStreamer] Using configured camera device: {configured}")
            return configured

        # Configured device missing — scan for any video capture device
        logger.warning(f"[VideoStreamer] {configured} not found — scanning for camera...")

        for dev in sorted(glob.glob('/dev/video*')):
            try:
                # Check if this device supports video capture
                result = subprocess.run(
                    ['v4l2-ctl', '--device', dev, '--all'],
                    capture_output=True, text=True, timeout=3
                )
                if 'Video Capture' in result.stdout and result.returncode == 0:
                    # Try to verify it's a real camera (has YUYV or MJPG)
                    fmt_result = subprocess.run(
                        ['v4l2-ctl', '--device', dev, '--list-formats'],
                        capture_output=True, text=True, timeout=3
                    )
                    if 'YUYV' in fmt_result.stdout or 'MJPG' in fmt_result.stdout:
                        logger.info(f"[VideoStreamer] Found camera at {dev}")
                        return dev
            except Exception:
                continue

        logger.error(f"[VideoStreamer] No camera device found!")
        return configured  # Return configured device as fallback

    def _wait_for_camera(self, device, timeout=15):
        """Wait for the camera device to be available (not held by another process).
        Kill any orphan ffmpeg processes holding it."""
        import os

        if not os.path.exists(device):
            logger.warning(f"[VideoStreamer] {device} does not exist — waiting for USB recovery...")
            for i in range(timeout):
                if not self._running:
                    return False
                time.sleep(1)
                if os.path.exists(device):
                    logger.info(f"[VideoStreamer] {device} appeared after {i+1}s")
                    break
            else:
                logger.error(f"[VideoStreamer] {device} did not appear within {timeout}s")
                return False

        # Check if another process holds the camera
        try:
            result = subprocess.run(
                ['fuser', device],
                capture_output=True, text=True, timeout=3
            )
            pids = result.stdout.strip()
            if pids:
                logger.warning(f"[VideoStreamer] {device} held by PIDs: {pids} — killing orphan ffmpeg...")
                # Only kill ffmpeg processes, not other things that might have the device
                subprocess.run(['pkill', '-9', '-f', f'ffmpeg.*{device}'],
                             capture_output=True, timeout=3)
                time.sleep(3)  # Wait for device release after kill
        except Exception as e:
            logger.warning(f"[VideoStreamer] fuser check failed ({e}) — proceeding anyway")

        return True

    def _detect_camera_format(self, device):
        """Detect if the camera supports MJPEG natively, otherwise fall back to YUYV."""
        try:
            result = subprocess.run(
                ['v4l2-ctl', '--device', device, '--list-formats'],
                capture_output=True, text=True, timeout=5
            )
            if 'MJPG' in result.stdout:
                logger.info(f"[VideoStreamer] Camera ({device}) supports MJPEG natively")
                return 'mjpeg'
            elif 'YUYV' in result.stdout:
                logger.info(f"[VideoStreamer] Camera ({device}) supports YUYV only — will re-encode to MJPEG")
                return 'yuyv422'
            else:
                logger.warning(f"[VideoStreamer] Camera ({device}) unknown format — trying YUYV")
                return 'yuyv422'
        except Exception as e:
            logger.warning(f"[VideoStreamer] Could not detect camera format ({e}) — defaulting to YUYV")
            return 'yuyv422'

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

        # Staggered startup — wait before first connection attempt
        if self._initial_delay > 0:
            logger.info(f"[VideoStreamer] Waiting {self._initial_delay}s before connecting (staggered startup)")
            await asyncio.sleep(self._initial_delay)

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
                jitter = random.uniform(0, 1.0)
                wait = backoff + jitter
                logger.warning(f"[VideoStreamer] Connection failed ({e}). Reconnecting in {wait:.1f}s")
                await asyncio.sleep(wait)
                backoff = min(backoff * 2, 10)
