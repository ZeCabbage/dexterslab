import os
import json
import logging
from dataclasses import dataclass
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

HW_MANIFEST_PATH = '/tmp/hw-manifest.json'

@dataclass
class Config:
    pc_backend_url: str        # e.g. "dexterslab-api.cclottaaworld.com"
    pc_frontend_url: str       # e.g. "dexterslab.cclottaaworld.com"
    health_port: int
    camera_device: str
    camera_width: int
    camera_height: int
    camera_fps: int
    audio_sample_rate: int
    audio_channels: int
    audio_chunk_ms: int
    audio_input_card: int      # ALSA card index for microphone
    audio_output_card: int     # ALSA card index for speaker
    tts_engine: str
    log_level: str


def _load_hw_manifest():
    """Load hardware manifest written by hw-discover.sh at boot.
    Returns dict with discovered devices or empty dict if not found."""
    if not os.path.exists(HW_MANIFEST_PATH):
        logger.info(f"[Config] No hardware manifest at {HW_MANIFEST_PATH} — using .env defaults")
        return {}
    try:
        with open(HW_MANIFEST_PATH, 'r') as f:
            manifest = json.load(f)
        logger.info(f"[Config] Loaded hardware manifest: {json.dumps(manifest, indent=2)}")
        return manifest
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"[Config] Failed to load hardware manifest: {e}")
        return {}


def load_config() -> Config:
    # Load .env from the current directory
    load_dotenv()

    pc_backend_url = os.environ.get('PC_BACKEND_URL')
    if not pc_backend_url:
        raise ValueError("Missing required configuration field: PC_BACKEND_URL")

    # Load hardware manifest (written by hw-discover.sh at boot)
    hw = _load_hw_manifest()

    # Camera: prefer manifest discovery over .env
    camera_device = os.environ.get('CAMERA_DEVICE', '/dev/video0')
    if hw.get('camera', {}).get('status') == 'ok':
        camera_device = hw['camera']['device']
        logger.info(f"[Config] Camera overridden by hw-manifest: {camera_device}")

    # Audio input: prefer manifest discovery
    audio_input_card = int(os.environ.get('AUDIO_INPUT_CARD', -1))
    if hw.get('microphone', {}).get('status') in ('ok', 'degraded'):
        audio_input_card = int(hw['microphone']['card'])
        logger.info(f"[Config] Mic card overridden by hw-manifest: {audio_input_card}")

    # Audio output: prefer manifest discovery
    audio_output_card = int(os.environ.get('AUDIO_OUTPUT_CARD', -1))
    if hw.get('speaker', {}).get('status') in ('ok', 'degraded'):
        audio_output_card = int(hw['speaker']['card'])
        logger.info(f"[Config] Speaker card overridden by hw-manifest: {audio_output_card}")

    return Config(
        pc_backend_url=pc_backend_url,
        pc_frontend_url=os.environ.get('PC_FRONTEND_URL', 'dexterslab.cclottaaworld.com'),
        health_port=int(os.environ.get('HEALTH_PORT', 8891)),
        camera_device=camera_device,
        camera_width=int(os.environ.get('CAMERA_WIDTH', 320)),
        camera_height=int(os.environ.get('CAMERA_HEIGHT', 240)),
        camera_fps=int(os.environ.get('CAMERA_FPS', 15)),
        audio_sample_rate=int(os.environ.get('AUDIO_SAMPLE_RATE', 16000)),
        audio_channels=int(os.environ.get('AUDIO_CHANNELS', 1)),
        audio_chunk_ms=int(os.environ.get('AUDIO_CHUNK_MS', 100)),
        audio_input_card=audio_input_card,
        audio_output_card=audio_output_card,
        tts_engine=os.environ.get('TTS_ENGINE', 'espeak-ng'),
        log_level=os.environ.get('LOG_LEVEL', 'INFO').upper()
    )
