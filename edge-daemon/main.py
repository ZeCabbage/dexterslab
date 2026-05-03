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

def _hardware_preflight(config):
    """Phase 0 — Hardware Pre-flight.

    Runs BEFORE any service starts to ensure the camera and audio devices
    are in a clean, usable state. This is the single most important step
    for reliable boots — it eliminates 'Device busy' and 'I/O error'
    failures that cascade through the entire daemon lifecycle.

    Steps:
      1. Kill any orphan ffmpeg processes from a previous crash
      2. Reset the USB camera to clear I/O errors
      3. Wait for the camera device node to appear
      4. Validate the camera can be queried via v4l2-ctl
      5. Verify audio devices are accessible
    """
    import os
    import glob

    logger.info("───────────────────────────────────────")
    logger.info("  Phase 0 — Hardware Pre-flight")
    logger.info("───────────────────────────────────────")

    # ── Step 1: Kill orphan ffmpeg processes ──
    logger.info("[Preflight] Killing orphan ffmpeg processes...")
    try:
        result = subprocess.run(
            ['pkill', '-9', '-f', 'ffmpeg.*v4l2'],
            capture_output=True, timeout=3
        )
        if result.returncode == 0:
            logger.info("[Preflight] ✓ Killed orphan ffmpeg processes")
            time.sleep(2)  # Wait for device release
        else:
            logger.info("[Preflight] ✓ No orphan ffmpeg processes found")
    except Exception:
        logger.info("[Preflight] ✓ No orphan ffmpeg processes found")

    # ── Step 2: USB camera reset ──
    logger.info("[Preflight] Resetting USB camera...")
    try:
        result = subprocess.run(
            ['usbreset', '2b46:bd01'],  # Centerm Camera vendor:product
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            logger.info("[Preflight] ✓ USB camera reset successful")
            time.sleep(3)  # Camera needs time to re-enumerate after reset
        else:
            logger.warning(f"[Preflight] ⚠ USB reset returned: {result.stderr.strip()}")
    except FileNotFoundError:
        logger.warning("[Preflight] ⚠ usbreset not installed — skipping camera reset")
    except Exception as e:
        logger.warning(f"[Preflight] ⚠ USB reset failed: {e}")

    # ── Step 3: Wait for camera device ──
    camera_dev = config.camera_device
    logger.info(f"[Preflight] Waiting for camera device {camera_dev}...")
    for i in range(10):
        if os.path.exists(camera_dev):
            logger.info(f"[Preflight] ✓ Camera device {camera_dev} ready")
            break
        time.sleep(1)
    else:
        # Scan for any video device
        video_devs = sorted(glob.glob('/dev/video*'))
        if video_devs:
            logger.warning(f"[Preflight] ⚠ {camera_dev} not found, but found: {video_devs}")
        else:
            logger.error("[Preflight] ✕ No camera device found — video will fail until camera reconnects")

    # ── Step 4: Validate camera with v4l2-ctl ──
    if os.path.exists(camera_dev):
        try:
            # Real frame capture test — the ONLY reliable camera validation
            result = subprocess.run(
                ['timeout', '8', 'ffmpeg', '-y',
                 '-f', 'v4l2', '-input_format', 'mjpeg',
                 '-video_size', '320x240', '-framerate', '15',
                 '-i', camera_dev,
                 '-vframes', '1', '-f', 'image2', '/tmp/hw-test-frame.jpg'],
                capture_output=True, text=True, timeout=12
            )
            import os as _os
            if result.returncode == 0 and _os.path.exists('/tmp/hw-test-frame.jpg'):
                size = _os.path.getsize('/tmp/hw-test-frame.jpg')
                logger.info(f"[Preflight] ✓ Camera capture test passed ({size} bytes)")
                _os.remove('/tmp/hw-test-frame.jpg')
                # CRITICAL: Wait for camera device to fully release after test
                # The Centerm USB camera holds the device node for ~3s after close
                logger.info("[Preflight] Waiting for camera device release...")
                time.sleep(5)
            else:
                # MJPEG failed — try YUYV
                logger.warning("[Preflight] ⚠ MJPEG capture failed — trying YUYV...")
                result2 = subprocess.run(
                    ['timeout', '8', 'ffmpeg', '-y',
                     '-f', 'v4l2', '-input_format', 'yuyv422',
                     '-video_size', '320x240', '-framerate', '15',
                     '-i', camera_dev,
                     '-vframes', '1', '-f', 'image2', '/tmp/hw-test-frame.jpg'],
                    capture_output=True, text=True, timeout=12
                )
                if result2.returncode == 0 and _os.path.exists('/tmp/hw-test-frame.jpg'):
                    size = _os.path.getsize('/tmp/hw-test-frame.jpg')
                    logger.info(f"[Preflight] ✓ Camera capture test passed (YUYV, {size} bytes)")
                    _os.remove('/tmp/hw-test-frame.jpg')
                    time.sleep(5)  # Same release wait
                else:
                    logger.warning(f"[Preflight] ⚠ Camera capture test FAILED — camera may need physical reconnection")
        except Exception as e:
            logger.warning(f"[Preflight] ⚠ Camera test error: {e}")

    # ── Step 5: Verify audio devices ──
    mic_card = config.audio_input_card
    spk_card = config.audio_output_card
    if mic_card >= 0 and os.path.exists(f'/dev/snd/pcmC{mic_card}D0c'):
        logger.info(f"[Preflight] ✓ Microphone card {mic_card} accessible")
    else:
        logger.warning(f"[Preflight] ⚠ Microphone card {mic_card} not accessible")

    if spk_card >= 0 and os.path.exists(f'/dev/snd/pcmC{spk_card}D0p'):
        logger.info(f"[Preflight] ✓ Speaker card {spk_card} accessible")
    else:
        logger.warning(f"[Preflight] ⚠ Speaker card {spk_card} not accessible")

    logger.info("───────────────────────────────────────")
    logger.info("  Phase 0 — Pre-flight complete")
    logger.info("───────────────────────────────────────")


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

    # ═══════════════════════════════════════
    #  Phase 0 — Hardware Pre-flight
    # ═══════════════════════════════════════
    # Ensure camera is in a clean state before any service starts.
    # This eliminates "Device busy" and "I/O error" on boot.
    _hardware_preflight(config)

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
                    logger.warning(f"[Watchdog] Video failed {fail_counts['video']}x — running recovery sequence")
                    try:
                        video.stop()
                    except Exception:
                        pass
                    # Kill orphaned ffmpeg processes before restart
                    try:
                        subprocess.run(['pkill', '-9', '-f', 'ffmpeg.*v4l2'],
                                     capture_output=True, timeout=3)
                    except Exception:
                        pass
                    time.sleep(2)
                    # USB camera reset — clear I/O errors from unstable USB
                    try:
                        result = subprocess.run(
                            ['usbreset', '2b46:bd01'],
                            capture_output=True, text=True, timeout=10
                        )
                        if result.returncode == 0:
                            logger.info("[Watchdog] ✓ USB camera reset successful")
                            time.sleep(3)  # Wait for re-enumeration
                        else:
                            logger.warning(f"[Watchdog] USB reset: {result.stderr.strip()}")
                    except Exception:
                        pass
                    video = VideoStreamer(config, initial_delay=2.0)
                    video.start()
                    fail_counts['video'] = 0
                    logger.info("[Watchdog] Video service restarted after USB recovery")
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
