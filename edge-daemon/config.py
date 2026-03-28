import os
from dataclasses import dataclass
from dotenv import load_dotenv

@dataclass
class Config:
    pc_tailscale_ip: str
    video_udp_port: int
    audio_ws_port: int
    tts_command_port: int
    health_port: int
    camera_device: str
    camera_width: int
    camera_height: int
    camera_fps: int
    audio_sample_rate: int
    audio_channels: int
    audio_chunk_ms: int
    tts_engine: str
    log_level: str

def load_config() -> Config:
    # Load .env from the current directory
    load_dotenv()

    pc_tailscale_ip = os.environ.get('PC_TAILSCALE_IP')
    if not pc_tailscale_ip:
        raise ValueError("Missing required configuration field: PC_TAILSCALE_IP")

    return Config(
        pc_tailscale_ip=pc_tailscale_ip,
        video_udp_port=int(os.environ.get('VIDEO_UDP_PORT', 5600)),
        audio_ws_port=int(os.environ.get('AUDIO_WS_PORT', 8889)),
        tts_command_port=int(os.environ.get('TTS_COMMAND_PORT', 8890)),
        health_port=int(os.environ.get('HEALTH_PORT', 8891)),
        camera_device=os.environ.get('CAMERA_DEVICE', '/dev/video0'),
        camera_width=int(os.environ.get('CAMERA_WIDTH', 320)),
        camera_height=int(os.environ.get('CAMERA_HEIGHT', 240)),
        camera_fps=int(os.environ.get('CAMERA_FPS', 15)),
        audio_sample_rate=int(os.environ.get('AUDIO_SAMPLE_RATE', 16000)),
        audio_channels=int(os.environ.get('AUDIO_CHANNELS', 1)),
        audio_chunk_ms=int(os.environ.get('AUDIO_CHUNK_MS', 100)),
        tts_engine=os.environ.get('TTS_ENGINE', 'espeak-ng'),
        log_level=os.environ.get('LOG_LEVEL', 'INFO').upper()
    )
