import sys
import time
import signal
import logging
import argparse
import asyncio
import subprocess
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

    logger.info("═══════════════════════════════════════")
    logger.info("  EDGE DAEMON — Starting")
    logger.info(f"  Camera: {config.camera_device}")
    logger.info(f"  Mic Card: {config.audio_input_card}")
    logger.info(f"  Speaker Card: {config.audio_output_card}")
    logger.info(f"  Backend: {config.pc_backend_url}")
    logger.info("═══════════════════════════════════════")

    # ── Staggered startup ──
    # Connect in priority order with delays to prevent Cloudflare
    # Tunnel from being overwhelmed by 3 simultaneous WebSocket upgrades.
    # TTS first (0s) → Audio (2s delay) → Video (4s delay)
    tts = TTSReceiver(config)
    audio = AudioStreamer(config, initial_delay=2.0)
    video = VideoStreamer(config, initial_delay=4.0)
    health = HealthServer(config, video, audio, tts)

    logger.info("[Boot] Starting TTS receiver (priority 1, no delay)...")
    tts.start()
    logger.info("[Boot] Starting Audio streamer (priority 2, 2s delay)...")
    audio.start()
    logger.info("[Boot] Starting Video streamer (priority 3, 4s delay)...")
    video.start()
    try:
        health.start()
    except Exception as e:
        logger.error(f"[HealthServer] Failed to start (non-fatal): {e}")
        logger.error("[HealthServer] Continuing without health endpoint — services still running")

    logger.info("All services started (staggered connection in progress).")

    from diagnostics import attach as attach_diagnostics
    attach_diagnostics(video, audio, tts)

    # ── Watchdog Loop ──
    # Track consecutive failures per service for auto-restart
    fail_counts = {'video': 0, 'audio': 0, 'tts': 0}
    MAX_SERVICE_FAILURES = 5

    try:
        while running:
            time.sleep(5)  # Check every 5 seconds

            # Video watchdog
            if not video.is_running():
                fail_counts['video'] += 1
                if fail_counts['video'] >= MAX_SERVICE_FAILURES:
                    logger.warning(f"[Watchdog] Video failed {fail_counts['video']}x — restarting service")
                    try:
                        video.stop()
                    except Exception:
                        pass
                    # Kill orphaned ffmpeg processes before restart
                    try:
                        subprocess.run(['pkill', '-f', 'ffmpeg.*v4l2'],
                                     capture_output=True, timeout=3)
                    except Exception:
                        pass
                    time.sleep(2)
                    video = VideoStreamer(config, initial_delay=2.0)
                    video.start()
                    fail_counts['video'] = 0
                    logger.info("[Watchdog] Video service restarted")
                else:
                    logger.warning(f"[Watchdog] Video not running (fail {fail_counts['video']}/{MAX_SERVICE_FAILURES})")
            else:
                fail_counts['video'] = 0

            # Audio watchdog
            if not audio.is_running():
                fail_counts['audio'] += 1
                if fail_counts['audio'] >= MAX_SERVICE_FAILURES:
                    logger.warning(f"[Watchdog] Audio failed {fail_counts['audio']}x — restarting service")
                    try:
                        audio.stop()
                    except Exception:
                        pass
                    # Force-release ALSA mic device — kill any process holding it
                    try:
                        mic_card = config.audio_input_card
                        if mic_card >= 0:
                            subprocess.run(
                                ['fuser', '-k', f'/dev/snd/pcmC{mic_card}D0c'],
                                capture_output=True, timeout=3
                            )
                            logger.info(f"[Watchdog] Force-released /dev/snd/pcmC{mic_card}D0c")
                    except Exception:
                        pass
                    time.sleep(3)  # Wait for device to fully release
                    audio = AudioStreamer(config, initial_delay=1.0)
                    audio.start()
                    # Re-attach to health server
                    health.audio = audio
                    fail_counts['audio'] = 0
                    logger.info("[Watchdog] Audio service restarted")
                else:
                    logger.warning(f"[Watchdog] Audio not running (fail {fail_counts['audio']}/{MAX_SERVICE_FAILURES})")
            else:
                fail_counts['audio'] = 0

            # TTS watchdog
            if not tts.is_running():
                fail_counts['tts'] += 1
                if fail_counts['tts'] >= MAX_SERVICE_FAILURES:
                    logger.warning(f"[Watchdog] TTS failed {fail_counts['tts']}x — restarting service")
                    try:
                        tts.stop()
                    except Exception:
                        pass
                    time.sleep(2)
                    tts = TTSReceiver(config)
                    tts.start()
                    fail_counts['tts'] = 0
                    logger.info("[Watchdog] TTS service restarted")
                else:
                    logger.warning(f"[Watchdog] TTS not running (fail {fail_counts['tts']}/{MAX_SERVICE_FAILURES})")
            else:
                fail_counts['tts'] = 0

    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received.")
    finally:
        logger.info("Stopping services...")
        # Stop in reverse order
        health.stop()
        tts.stop()
        audio.stop()
        video.stop()

        # Kill any orphaned ffmpeg processes we spawned
        try:
            subprocess.run(['pkill', '-f', 'ffmpeg.*v4l2'],
                         capture_output=True, timeout=3)
        except Exception:
            pass

        logger.info("Edge daemon stopped.")

if __name__ == "__main__":
    main()
