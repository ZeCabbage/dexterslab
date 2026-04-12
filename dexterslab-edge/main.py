import sys
import time
import signal
import logging
import argparse
import asyncio
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

# ── Service Watchdog ──────────────────────────────────────────
# Tracks restart attempts per service. After MAX_RESTARTS, we
# stop trying and let systemd handle it (via process exit or
# the health endpoint reporting degradation).
MAX_RESTARTS = 5
RESTART_COOLDOWN = 3  # seconds between restart attempts

def signal_handler(sig, frame):
    global running
    logger.info(f"Received signal {sig}, shutting down...")
    running = False

def main():
    parser = argparse.ArgumentParser(description="Edge Daemon for Dexterslab")
    parser.add_argument("--offline", action="store_true", help="Start the offline standalone daemon")
    args = parser.parse_args()

    if args.offline:
        logger.info("Initializing OFFLINE EDGE MODE...")
        import offline_daemon
        try:
            asyncio.run(offline_daemon.main())
        except KeyboardInterrupt:
            logger.info("Offline mode shutdown.")
        sys.exit(0)

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

    # Track restart counts
    restart_counts = {'video': 0, 'audio': 0, 'tts': 0}

    try:
        while running:
            # ── Watchdog: check and restart dead services ──
            if not audio.is_running() and restart_counts['audio'] < MAX_RESTARTS:
                restart_counts['audio'] += 1
                logger.warning(f"[Watchdog] AudioStreamer died — restarting (attempt {restart_counts['audio']}/{MAX_RESTARTS})")
                try:
                    audio.restart()
                except Exception as e:
                    logger.error(f"[Watchdog] AudioStreamer restart failed: {e}")
                time.sleep(RESTART_COOLDOWN)
                continue

            if not tts.is_running() and restart_counts['tts'] < MAX_RESTARTS:
                restart_counts['tts'] += 1
                logger.warning(f"[Watchdog] TTSReceiver died — restarting (attempt {restart_counts['tts']}/{MAX_RESTARTS})")
                try:
                    tts.restart()
                except Exception as e:
                    logger.error(f"[Watchdog] TTSReceiver restart failed: {e}")
                time.sleep(RESTART_COOLDOWN)
                continue

            # Reset restart counters when services are healthy for 60s
            if audio.is_running() and restart_counts['audio'] > 0:
                restart_counts['audio'] = 0
            if tts.is_running() and restart_counts['tts'] > 0:
                restart_counts['tts'] = 0

            # Log if services are permanently down
            if not audio.is_running() and restart_counts['audio'] >= MAX_RESTARTS:
                logger.critical("[Watchdog] AudioStreamer exhausted restart attempts. Mic will be offline.")
            if not tts.is_running() and restart_counts['tts'] >= MAX_RESTARTS:
                logger.critical("[Watchdog] TTSReceiver exhausted restart attempts. Speaker will be offline.")

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
