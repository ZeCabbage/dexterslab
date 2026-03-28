import subprocess
import threading
import time
import logging
from config import Config

logger = logging.getLogger(__name__)

class VideoStreamer:
    def __init__(self, config: Config):
        self.config = config
        self._process = None
        self._thread = None
        self._running = False

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._process:
            self._process.terminate()
            try:
                self._process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._process.kill()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def is_running(self) -> bool:
        return (self._process is not None and 
                self._process.poll() is None)

    def _run_loop(self):
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
                '-f', 'mjpeg',
                f"udp://{self.config.pc_tailscale_ip}:{self.config.video_udp_port}"
            ]
            
            logger.info(f"[VideoStreamer] Starting ffmpeg stream to {self.config.pc_tailscale_ip}:{self.config.video_udp_port}")
            self._process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True
            )
            
            logger.info("[VideoStreamer] Stream active")
            
            # Read stderr for debugging
            for line in self._process.stderr:
                logger.warning(f"[VideoStreamer/ffmpeg] {line.strip()}")
                
            self._process.wait()
            
            if not self._running:
                break
                
            restarts += 1
            if restarts <= 3:
                logger.warning(f"[VideoStreamer] ffmpeg exited with code {self._process.returncode} — restarting in 5s")
                time.sleep(5)
                
        if self._running and restarts > 3:
            logger.error("[VideoStreamer] Fatal: max restarts exceeded")
            self._running = False
