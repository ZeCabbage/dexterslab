import threading
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from config import Config

logger = logging.getLogger(__name__)

class _HealthHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Disable default logging

    def do_GET(self):
        if self.path == '/health':
            status = {
                "status": "ok",
                "video_streamer_active": self.server.video_streamer.is_running(),
                "audio_streamer_active": self.server.audio_streamer.is_running(),
                "tts_receiver_active": self.server.tts_receiver.is_running(),
                "platform": "pi"
            }
            code = 200
            if not all([status["video_streamer_active"], status["audio_streamer_active"], status["tts_receiver_active"]]):
                status["status"] = "degraded"
                code = 503
                
            response = json.dumps(status).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()

class HealthServer:
    def __init__(self, config: Config, video_streamer, audio_streamer, tts_receiver):
        self.config = config
        self.video_streamer = video_streamer
        self.audio_streamer = audio_streamer
        self.tts_receiver = tts_receiver
        self._running = False
        self._thread = None
        self._httpd = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._httpd = HTTPServer(('0.0.0.0', self.config.health_port), _HealthHandler)
        # Attach references to the server so handler can access them
        self._httpd.video_streamer = self.video_streamer
        self._httpd.audio_streamer = self.audio_streamer
        self._httpd.tts_receiver = self.tts_receiver
        
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    def _run_loop(self):
        logger.info(f"[HealthServer] Listening on port {self.config.health_port}")
        self._httpd.serve_forever()
