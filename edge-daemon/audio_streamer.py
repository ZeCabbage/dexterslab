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
            self._capture_thread.join(timeout=3)
        if self._ws_thread and self._ws_thread.is_alive():
            self._ws_thread.join(timeout=3)
        # Force-terminate PyAudio to release ALSA device handle
        try:
            self._pyaudio.terminate()
        except Exception:
            pass
        self._pyaudio = None
        logger.info("[AudioStreamer] Stopped and released audio device")

    def is_running(self) -> bool:
        return self._running and self._capture_thread is not None and self._capture_thread.is_alive() and self._ws_thread is not None and self._ws_thread.is_alive()

    def _find_device_index(self):
        """Find the pyaudio device index matching the configured ALSA card."""
        target_card = self.config.audio_input_card
        if target_card < 0:
            logger.info("[AudioStreamer] No specific mic card configured, using system default")
            return None  # Use default

        info = self._pyaudio.get_host_api_info_by_index(0)
        num_devices = info.get('deviceCount', 0)

        for i in range(num_devices):
            dev_info = self._pyaudio.get_device_info_by_host_api_device_index(0, i)
            if dev_info.get('maxInputChannels', 0) > 0:
                name = dev_info.get('name', '')
                # PyAudio ALSA device names contain "hw:N,D" pattern
                if f'hw:{target_card}' in name or f'card {target_card}' in name.lower():
                    logger.info(f"[AudioStreamer] Matched mic card {target_card} -> device index {i} ({name})")
                    return i
                # Also check by structural index for USB devices
                if dev_info.get('structuralUniqueId', '') and str(target_card) in str(dev_info):
                    logger.info(f"[AudioStreamer] Matched mic card {target_card} -> device index {i} ({name}) [structural]")
                    return i

        logger.warning(f"[AudioStreamer] Could not find device for ALSA card {target_card}, using default")
        return None

    def _capture_loop(self):
        frames_per_buffer = int(self.config.audio_sample_rate * (self.config.audio_chunk_ms / 1000.0))

        while self._running:
            retries = 0
            max_retries = 5

            while self._running and retries <= max_retries:
                try:
                    device_index = self._find_device_index()
                    open_kwargs = dict(
                        format=pyaudio.paInt16,
                        channels=self.config.audio_channels,
                        rate=self.config.audio_sample_rate,
                        input=True,
                        frames_per_buffer=frames_per_buffer
                    )
                    if device_index is not None:
                        open_kwargs['input_device_index'] = device_index

                    stream = self._pyaudio.open(**open_kwargs)
                    logger.info(f"[AudioStreamer] Capture active (device_index={device_index}, retry={retries})")
                    retries = 0  # Reset on successful open

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

                except Exception as e:
                    retries += 1
                    if retries > max_retries:
                        logger.error(f"[AudioStreamer] Failed after {max_retries} retries: {e}. Re-creating PyAudio...")
                        break  # Break inner loop to re-create PyAudio
                    wait_time = min(5 * retries, 15)
                    logger.warning(f"[AudioStreamer] Mic open failed ({e}), retrying in {wait_time}s ({retries}/{max_retries})")
                    time.sleep(wait_time)

            # If we're still running but exhausted retries, re-create PyAudio
            # This forces ALSA device re-enumeration (handles USB replug, driver resets)
            if self._running:
                logger.info("[AudioStreamer] Re-initializing PyAudio for fresh device enumeration...")
                try:
                    self._pyaudio.terminate()
                except Exception:
                    pass
                time.sleep(10)  # Wait for device to stabilize
                self._pyaudio = pyaudio.PyAudio()

    def _ws_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._async_ws_loop())
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
            except (websockets.exceptions.ConnectionClosed, OSError) as e:
                if not self._running:
                    break
                logger.warning(f"[AudioStreamer] Connection dropped ({e}). Reconnecting in {backoff}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5)  # Cap at 5s, not 30s — fast recovery
