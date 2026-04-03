# DextersLab — Project Memory

## Architecture Invariants (non-negotiable)

### Port Assignments
- WS:/ws/video — Pi Camera → PC video-ingress.js (via Cloudflare)
- WS:/ws/audio — Pi Mic → PC audio-ingress.js → Vosk STT (via Cloudflare)
- WS:/ws/tts — PC Backend → Pi tts_receiver.py → espeak-ng (Pi-initiated, via Cloudflare)
- WS:/ws/observer2 — PC Backend → Pi Chromium → WebGL eye renderer (via Cloudflare)

### Data Flow Direction
```
Pi Camera  → (WS /ws/video)    → PC video-ingress.js
Pi Mic     → (WS /ws/audio)    → PC audio-ingress.js → Vosk STT (Phase 3+)
PC Backend → (WS /ws/tts)      → Pi tts_receiver.py → espeak-ng
PC Backend → (WS /ws/observer2)→ Pi Chromium → WebGL eye renderer
```

### Connection Model
- All Pi↔PC connections are Pi-initiated WebSockets through Cloudflare Tunnel
- Pi is portable — works on any WiFi network with internet access
- PC runs cloudflared routing two hostnames:
  - `dexterslab.cclottaaworld.com` → localhost:3000 (Next.js frontend)
  - `dexterslab-api.cclottaaworld.com` → localhost:8888 (Express backend)
- Pi runs cloudflared for SSH access only:
  - `pi.dexterslab.cclottaaworld.com` → ssh://localhost:22

### What Runs Where
- **PC**: All Node.js, all Python AI/ML, all data persistence, Next.js build
- **Pi**: edge-daemon (Python), Chromium (display only)
- **Mac**: Nothing. SSH client only.

### Technology Choices (not up for debate)
- Video: ffmpeg + MJPEG copy piped to WebSocket (via Cloudflare Tunnel)
- STT: Vosk on PC — NO Google Speech API
- TTS: espeak-ng on Pi — NO browser SpeechSynthesis
- Networking: Cloudflare Tunnel — NO Tailscale, NO raw LAN IPs
- SSH: Ed25519 keys, cloudflared access ssh for Pi, ForwardAgent no

## Sub-Projects
- `dexterslab-backend/` — Node.js backend services (observer, audio, motion)
- `dexterslab-frontend/` — Next.js web dashboard
- `edge-daemon/` — Python edge daemon running on Pi
- `scripts/` — Deployment and utility scripts

## Coding Conventions
- Backend: Node.js ESM, camelCase, console.log with emoji prefixes for service identification
- Frontend: Next.js App Router, CSS modules
- Edge daemon: Python 3, snake_case
- PM2 for process management on PC
