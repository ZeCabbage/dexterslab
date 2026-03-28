import sys
import time
import signal
import logging
from config import load_config
from video_streamer import VideoStreamer
from audio_streamer import AudioStreamer
from tts_receiver import TTSReceiver
from health import HealthServer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

running = True

def signal_handler(sig, frame):
    global running
    logger.info(f"Received signal {sig}, shutting down...")
    running = False

def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        config = load_config()
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        sys.exit(1)

    logger.setLevel(getattr(logging, config.log_level, logging.INFO))
    logger.info("Starting edge-daemon...")

    video = VideoStreamer(config)
    audio = AudioStreamer(config)
    tts = TTSReceiver(config)
    health = HealthServer(config, video, audio, tts)

    video.start()
    audio.start()
    tts.start()
    health.start()

    logger.info("All services started.")

    from diagnostics import attach as attach_diagnostics
    attach_diagnostics(video, audio, tts)

    try:
        while running:
            # Check if critical services failed
            if not video.is_running() or not audio.is_running() or not tts.is_running():
                logger.warning("A service failed, attempting to recover or letting health endpoint report degradation.")
                # We could implement restart logic here, but systemd controls daemon health based on process 
                # exit or via calling the health endpoint.
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received.")
    finally:
        logger.info("Stopping services...")
        health.stop()
        tts.stop()
        audio.stop()
        video.stop()
        logger.info("Edge daemon stopped.")

if __name__ == "__main__":
    main()
