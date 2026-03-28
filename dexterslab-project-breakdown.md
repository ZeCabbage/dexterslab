# Dexter's Lab — Full Project Breakdown (Phases 1–7)

> **Purpose:** Comprehensive technical breakdown for expert developer audit. Use this to understand the full architecture, every data flow, all source files, and remaining work to get the Pi edge node fully operational.

---

## System Overview

**Dexter's Lab** is a PC + Raspberry Pi surveillance art installation. A Raspberry Pi with a camera, microphone, and small circular display acts as "The Observer" — a dystopian surveillance eye that tracks movement, responds to voice, and speaks back. All intelligence runs on the PC; the Pi is a thin edge node.

### Hardware Layout

| Device | Role | OS |
|--------|------|----|
| **Windows PC** | Hub — runs all Node.js backend, Next.js frontend, AI/ML, database | Windows 11 |
| **Raspberry Pi** | Edge node — camera capture, mic capture, TTS playback, Chromium kiosk display | Raspberry Pi OS (64-bit) |
| **Mac** | SSH client only — no code runs here | macOS |

---

## Invariant Port Map

```
PC Backend (HTTP + WS):    :8888   →  Express + WebSocket /ws/observer2
PC Audio Ingress (WS):     :8889   →  Receives raw PCM from Pi mic
PC TTS Commander (WS):     :8890   →  Sends TTS commands TO Pi
Pi Edge Health (HTTP):     :8891   →  /health endpoint on Pi daemon
PC Frontend (Next.js):     :3000   →  Next.js dev/prod server
Video UDP:                 :5600   →  Pi ffmpeg → PC video-ingress
```

### Networking: Tailscale VPN

All Pi↔PC communication uses **Tailscale IPs** — never raw LAN IPs. The Pi's Tailscale IP is configured in `.env.pi` as `PC_TAILSCALE_IP` (the PC's address from the Pi's perspective) and in the backend's `.env` as `PI_TAILSCALE_IP`.

---

## Data Flow Diagram

```
┌──────────────── RASPBERRY PI ────────────────┐    ┌──────────────── WINDOWS PC ────────────────┐
│                                               │    │                                             │
│  Camera (/dev/video0)                         │    │                                             │
│    └─► ffmpeg (MJPEG copy)                    │    │                                             │
│         └─► UDP :5600 ─────────────────────────────►  video-ingress.js (ffmpeg → JPEG frames)   │
│                                               │    │    └─► eye-state-machine.processFrame()     │
│  Microphone (PyAudio)                         │    │         └─► motion-processor.js             │
│    └─► audio_streamer.py                      │    │         └─► spatial-model.js                │
│         └─► WS :8889 /ws/audio ───────────────────►  audio-ingress.js (PCM frames)             │
│                                               │    │    └─► stt-engine.js → stt_worker.py (Vosk) │
│  espeak-ng speaker                            │    │         └─► oracle-v2.js (Gemini)           │
│    ◄── tts_receiver.py ◄── WS :8890 /ws/tts ──────  tts-commander.js                           │
│                                               │    │                                             │
│  Chromium Kiosk (5" display)                  │    │  Next.js Frontend (:3000)                   │
│    └─► http://PC:3000/observer/eye-v2 ────────────►  /observer/eye-v2 page                     │
│    │   Connects WS :8888 /ws/observer2 ───────────►  server.js → eye-state-machine 60fps tick  │
│    │   Receives EyeState JSON packets ◄───────────   broadcasts {ix, iy, blink, dilation, ...} │
│                                               │    │                                             │
│  health.py (HTTP :8891 /health)               │    │  SQLite DB (data/dexterslab-memory.db)      │
│                                               │    │  PM2 process manager                        │
└───────────────────────────────────────────────┘    └─────────────────────────────────────────────┘
```

---

## Phase 1: Project Foundation & Hub Framework

### What Was Built
The base monorepo structure with a Next.js frontend and Express backend that serves as a "lab hub" — a launcher/dashboard for sub-projects.

### Key Files

| File | Purpose |
|------|---------|
| `dexterslab-backend/server.js` (lines 1–362) | Express server: health, status, hub actions (start_v2, kill, wifi_scan) |
| `dexterslab-frontend/app/page.tsx` | Hub landing page |
| `dexterslab-frontend/app/layout.tsx` | Root layout |
| `dexterslab-frontend/app/globals.css` | Global styles |
| `ecosystem.config.js` | PM2 production config for frontend + backend |
| `dev.ps1` / `dev.sh` | Dev environment startup scripts |

### REST API (Phase 1)

```
GET  /api/health     → { status, platform, uptime }
GET  /api/status     → { wifi info, platform } — platform-aware (Windows/Mac/Pi)
POST /api/action     → Hub actions: start_v2, kill, launch_project, wifi_scan
```

### Technology Decisions
- **Backend:** Node.js + Express + ES Modules (`"type": "module"`)
- **Frontend:** Next.js (TypeScript)
- **Process Manager:** PM2 with `ecosystem.config.js`
- **Platform Detection:** Auto-detects Windows/Mac/Pi from `process.platform` or `PLATFORM` env var

---

## Phase 2: Observer V1 → V2 Architecture Pivot

### What Changed
The original Observer V1 ran motion detection in the browser on the Pi. V2 moved ALL computation to the PC — the Pi became a pure thin client that just streams sensor data and displays the rendered eye.

### Key Architecture Decision
- **Pi:** Dumb pipe — camera frames via UDP, mic audio via WebSocket, TTS via espeak-ng
- **PC:** All motion detection, entity tracking, behavior modeling, AI/Oracle responses
- **Display:** Pi's Chromium connects to PC's Next.js frontend via WebSocket, receives 60fps eye state packets

---

## Phase 3: Observer V2 — Core Intelligence Pipeline

### 3A: Motion Processing (`observer2/motion-processor.js` — 298 lines)

Server-side motion/entity detection from raw JPEG frames:

1. **Grayscale conversion** — ITU-R BT.601 luma
2. **Adaptive background subtraction** — learn rate 0.025
3. **Grid-based motion detection** — 4×4 pixel cells, 30% threshold
4. **Connected-component blob detection** — flood fill
5. **Entity merging** — blobs within 0.15 normalized distance merge
6. **Persistent ID tracking** — Hungarian-style nearest-neighbor matching across frames
7. **Max 8 entities** — capped for performance

**Config constants:** `CAPTURE_WIDTH=320`, `CAPTURE_HEIGHT=240`, `MOTION_THRESHOLD=28`, `MIN_BLOB_PIXELS=20`

### 3B: Behavior Model (`observer2/behavior-model.js` — 311 lines)

The "brain" that converts detected entities into lifelike gaze targets:

| Behavior | Description |
|----------|-------------|
| **Gaze Control** | Dwell on primary target 2–4.5s, glance at secondaries (35% chance, 0.5s) |
| **Curiosity** | Dilate pupil + lean toward new entities |
| **Startle** | Snap focus + dilate 1.6× on sudden motion (>15% scene change) |
| **Recognition** | Pupil pulse (1.45× dilation) when known entity returns |
| **Microsaccades** | Random jitter 2–5× per second, 3.5px amplitude |
| **Pupil Breathing** | Slow 0.15Hz oscillation ±0.06 dilation |
| **Fatigue** | Gradually shorter dwell times over sustained attention |
| **Boredom** | Slow drift to center when nothing changes |

**Output:** `{ x, y, dilation, emotion, visible, entityCount, saccadeX, saccadeY }`

### 3C: Eye State Machine (`observer2/eye-state-machine.js` — 831 lines)

The master 60fps tick loop that combines all inputs into a broadcast-ready packet:

```javascript
// Broadcast packet shape (sent to all WebSocket clients at 60fps)
{
  ix: float,          // iris X offset
  iy: float,          // iris Y offset  
  dilation: float,    // pupil size (0.5–1.8)
  blink: float,       // lid closure (0=open, 1=closed)
  emotion: string,    // 'neutral'|'curious'|'startled'|'tracking'
  sentinel: boolean,  // idle scanning mode
  visible: boolean,   // entities detected
  entityCount: int,
  overlayText: string, // Oracle response text
  overlayType: string, // 'oracle'|'blush'|'goodboy'|'thankyou'
  blush: float,
  goodBoy: float,
  thankYou: float,
  t: float            // timestamp
}
```

**Sub-systems managed:**
- **Blink controller** — natural timing (2.5–6s intervals), double blinks (15% chance), separate close/open speeds
- **Sentinel mode** — idle scanning when no entities for >2s, 4 sweep patterns (horizontal, vertical, diagonal, erratic)
- **Sleep/wake** — smooth lerp to closed/open
- **Reactions** — blush, good boy, thank you overlays with timed phases
- **Smooth lerp** — all outputs smoothly interpolated, different rates for tracking vs sentinel

**Security:** Input sanitization with prompt injection detection (10 regex patterns), 250-char limit, conversation buffer validation on boot.

**Gemini Rate Limiter:** 10 calls/min, 100 calls/hour, 3s minimum interval, with local fallback responses.

### 3D: Spatial Model (`observer2/spatial-model.js` — 159 lines)

Divides the 320×240 camera frame into a **3×3 grid** of named zones:

```
TOP_LEFT    | TOP_CENTER  | TOP_RIGHT
MID_LEFT    | CENTER      | MID_RIGHT
BOT_LEFT    | BOT_CENTER  | BOT_RIGHT
```

Tracks zone occupancy and emits semantic events: `entity_entered`, `entity_present`, `entity_departed`. Feeds into `getAttentionZone()` which overrides direct tracking with zone-based gaze targets.

### 3E: Entity Tracker (`observer2/entity-tracker.js` — 363 lines)

Identity tracking and behavioral pattern classification:

| Classification | Criteria |
|---------------|----------|
| **Resident** | ≥10 visits AND avg duration ≥300s |
| **Visitor** | ≥2 visits AND avg duration ≥60s |
| **Passerby** | avg duration ≤30s AND interaction rate <0.2 |
| **Unknown** | ≤2 visits OR fell through classifier |

**Profile data stored:** preferred zones, typical hours, interaction count/rate, avg duration. Entity matching uses time-based heuristics (recently seen = +5 score, same zone = +2, same hour = +1).

### 3F: Oracle V2 (`observer2/oracle-v2.js` — 269 lines)

Dual-mode response system:

1. **Keyword matching** (instant, no API call) — 9 categories: identity, purpose, existential, perception, knowledge, greeting, threat, time, self
2. **Gemini API** (`gemini-2.0-flash`) — dystopian surveillance persona, <50 words, bracket notation `[RESPONSE]`

**System prompt:** "You are THE OBSERVER, a dystopian surveillance AI... Never break character."

### 3G: STT Engine (`observer2/stt-engine.js` + `stt_worker.py`)

- Node.js spawns a Python subprocess running Vosk
- Raw PCM audio is piped via stdin
- Vosk outputs JSON results via stdout (partial + final transcripts)
- Auto-respawns on crash with 2s delay
- **Vosk model:** `models/vosk-model-small-en-us-0.15/` (local, no cloud API)

---

## Phase 4: Cognitive Layer — Memory & Event Bus

### 4A: Memory Engine (`core/memory-engine.js` — 406 lines)

**SQLite database** (`data/dexterslab-memory.db`) with WAL mode:

| Table | Purpose |
|-------|---------|
| `schema_version` | Tracks migration state (currently v1) |
| `observations` | All events: timestamp, source, event_type, zone, duration_ms, metadata, session_id |
| `entities` | Tracked presences: first_seen, last_seen, visit_count, profile (JSON), label |
| `sessions` | Observer sessions: start/end times, mode, summary |
| `context_state` | Key-value store with optional TTL |

**Write pipeline:** Batched writes via `queueObservation()` → flushed every 500ms in a single transaction. Max queue: 500. `recordObservationSync()` reserved for security events only.

**Maintenance:** Auto-prunes observations older than 30 days (configurable via `MEMORY_RETENTION_DAYS`), runs hourly.

### 4B: Context Bus (`core/context-bus.js` — 187 lines)

Pub/sub event system with taxonomy enforcement:

**Allowed event types:**
```
presence.detected | presence.departed | presence.sustained | presence.zone_changed
voice.command     | voice.partial     | voice.silence
oracle.query      | oracle.response   | oracle.error
system.startup    | system.shutdown   | system.pi_connected | system.pi_disconnected | system.health_degraded
```

**Backpressure:** Drops `presence.*` and `motion.*` events when pending dispatches >100. Never drops `voice.*`, `oracle.*`, `security.*`, or `system.*`.

All events are automatically logged to SQLite via the memory engine.

---

## Phase 5: Pi Edge Daemon (`edge-daemon/`)

A **Python daemon** that runs on the Raspberry Pi, managed by `systemd`.

### Files

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | 73 | Entry point: starts all services, monitors health, handles signals |
| `config.py` | 46 | Dataclass config loaded from `.env` (Tailscale IP, ports, camera params) |
| `video_streamer.py` | 80 | ffmpeg subprocess: camera → UDP MJPEG stream to PC |
| `audio_streamer.py` | 121 | PyAudio capture → WebSocket PCM stream to PC |
| `tts_receiver.py` | 99 | WebSocket server on :8890, receives TTS commands, runs `espeak-ng` |
| `health.py` | 74 | HTTP server on :8891, reports service status |
| `diagnostics.py` | ~100 | Diagnostic tooling |
| `requirements.txt` | — | `pyaudio`, `websockets`, `python-dotenv` |
| `observer-capture.service` | — | systemd unit file |

### Video Pipeline Detail

```bash
# Pi side (video_streamer.py spawns):
ffmpeg -f v4l2 -input_format mjpeg \
  -video_size 320x240 -framerate 15 \
  -i /dev/video0 \
  -vcodec copy -f mpegts \
  udp://{PC_TAILSCALE_IP}:5600

# PC side (video-ingress.js spawns):
ffmpeg -i udp://0.0.0.0:5600 \
  -f image2pipe -vcodec copy -
# Then extracts JPEG frames by scanning for SOI/EOI markers
```

### Audio Pipeline Detail

```
Pi: PyAudio → 16kHz mono S16LE PCM → WebSocket → PC:8889 /ws/audio
Format negotiation: server sends format_requirements, Pi replies format_ack
Queue: 50 frames, drops oldest on overflow
Reconnect: exponential backoff up to 30s
```

### TTS Pipeline Detail

```
PC: tts-commander.js connects → WS to Pi:8890 /ws/tts
Sends: { type: "tts", text: "..." }
Pi: tts_receiver.py → subprocess.run(["espeak-ng", text])
Security: Only accepts connections from PC_TAILSCALE_IP or localhost
```

### systemd Service

```ini
# observer-capture.service
[Service]
ExecStart=/home/deploy/dexterslab-edge/venv/bin/python main.py
WorkingDirectory=/home/deploy/dexterslab-edge
User=deploy
Restart=always
RestartSec=5
```

---

## Phase 6: Frontend & Admin Dashboard

### Observer Eye V2 (`dexterslab-frontend/app/observer/eye-v2/page.tsx`)

WebGL-rendered eye that connects to `ws://PC:8888/ws/observer2` and renders the eye state at 60fps. Displayed on the Pi's Chromium kiosk.

### Observer Hub (`dexterslab-frontend/app/observer/page.tsx`)

Landing page / launcher for observer sub-projects.

### Rules Lawyer Experiment (`dexterslab-frontend/app/observer/rules-lawyer/`)

Board game rules assistant powered by Gemini — separate experiment that shares the backend.

### Admin Dashboard (`dexterslab-frontend/app/admin/`)

Protected dashboard with:
- Memory stats (observations, entities, sessions, DB size)
- Entity list with labeling
- Observation log with filtering
- Heatmap visualization
- Conversation log
- CSV export

**Admin API endpoints (Phase 6):**
```
GET  /api/admin/stats              → Memory + bus + mood stats
GET  /api/admin/entities           → Entity profiles
POST /api/admin/label-entity       → Label an entity
GET  /api/admin/observations       → Filtered observations
GET  /api/admin/export-observations → CSV download
GET  /api/admin/heatmap            → Zone activity heatmap
GET  /api/admin/conversation-log   → Voice interaction history
```

### Kiosk Launcher (`scripts/observer-kiosk.sh`)

Launches Chromium in fullscreen kiosk mode on the Pi:
- Tries Cloudflare URL first (`dexterslab.cclottaaworld.com/observer/eye-v2`)
- Falls back to Tailscale direct (`http://PC_TAILSCALE_IP:3000/observer/eye-v2`)
- Hides cursor, clears crash state, enables Wayland, remote debugging on :9222

---

## Phase 7: Integration Testing & Field Deployment

### Integration Test Suite (`dexterslab-backend/tests/phase7-integration.test.js` — 17183 bytes)

Comprehensive test coverage for the full pipeline.

### Field Test Capture (`dexterslab-backend/diagnostics/field-test-capture.js`)

Captures real-time system telemetry to `.ndjson` files every ~3 seconds:
- Bus stats, memory stats, WebSocket connections
- Active since March 2026 with extensive diagnostic data

### Deployment Pipeline

```
PC → Pi deployment: scripts/deploy-to-pi.sh
  1. Reads PI_TAILSCALE_IP from .env
  2. Ping check
  3. rsync edge-daemon/ → deploy@PI:~/dexterslab-edge/
  4. SCP .env.pi → .env
  5. SSH: sudo systemctl restart observer-capture.service
  6. Wait 5s, check is-active
  7. curl health endpoint (:8891/health)
  8. Check journalctl for errors
```

### Pi Setup Runbook (`scripts/pi-setup-runbook.md`)

Complete setup checklist: OS, packages (ffmpeg, espeak-ng, python3-venv, portaudio19-dev), Tailscale, deploy user + SSH keys, venv, systemd service, Chromium kiosk.

---

## Current State & Remaining Work

### ✅ What's Working (PC Side)
- [x] Express backend server with full REST API
- [x] WebSocket server at /ws/observer2 (60fps broadcast)
- [x] Motion processor (server-side blob detection)
- [x] Behavior model (gaze, emotions, microsaccades)
- [x] Eye state machine (60fps tick with blink/sentinel/sleep)
- [x] Spatial model (9-zone grid)
- [x] Entity tracker with pattern classification
- [x] Oracle V2 (keyword + Gemini dual-mode)
- [x] Memory engine (SQLite with WAL, batched writes)
- [x] Context bus (pub/sub with backpressure)
- [x] STT engine (Vosk via Python subprocess)
- [x] Video ingress (ffmpeg UDP → JPEG extraction)
- [x] Audio ingress (WebSocket PCM receiver)
- [x] TTS commander (WebSocket client to Pi)
- [x] Admin dashboard with full API
- [x] PM2 deployment config
- [x] Field test capture (diagnostics)
- [x] Integration tests

### ✅ What's Working (Pi Side — Code Written)
- [x] Edge daemon entry point (`main.py`)
- [x] Config management from `.env`
- [x] Video streamer (ffmpeg subprocess)
- [x] Audio streamer (PyAudio + WebSocket)
- [x] TTS receiver (WebSocket server + espeak-ng)
- [x] Health server (HTTP :8891)
- [x] systemd service file
- [x] Deploy script (`deploy-to-pi.sh`)
- [x] Kiosk launcher script
- [x] Pi setup runbook

### 🔧 Remaining Infrastructure Work (Pi Operational Status)

> [!IMPORTANT]
> The code is written but the following items need verification or completion on the actual Pi hardware:

1. **Video Stream Verification**
   - Confirm ffmpeg is streaming MJPEG from `/dev/video0` over UDP
   - Verify PC's `video-ingress.js` is receiving and decoding frames
   - Check FPS via `/health` endpoint (`video_fps` field)

2. **Audio Stream Verification**
   - Confirm PyAudio is capturing from Pi mic
   - Verify WebSocket connection to PC:8889 succeeds
   - Test format negotiation handshake
   - Feed audio through Vosk STT and confirm transcripts appear

3. **TTS Verification**
   - Confirm `tts-commander.js` on PC can connect to Pi:8890
   - Test `curl http://PC:8888/api/test/tts?text=Hello` and confirm Pi speaks
   - Verify `espeak-ng` is installed and working

4. **Kiosk Display Verification**
   - Chromium launches in kiosk mode
   - Connects to `/observer/eye-v2`
   - WebSocket to `/ws/observer2` establishes
   - Eye renders and tracks movement

5. **End-to-End Pipeline Test**
   - Person walks in front of camera → eye tracks them
   - Person speaks → Vosk transcribes → Oracle responds → Pi speaks response
   - All data flows simultaneously without crashes

6. **Stability & Recovery**
   - systemd auto-restarts daemon on crash
   - ffmpeg restarts on camera disconnect (up to 3 retries)
   - WebSocket reconnects with exponential backoff
   - Memory engine prunes old data

### .env Configuration Required

**Pi `.env` (`edge-daemon/.env.pi`):**
```env
PC_TAILSCALE_IP=<PC's Tailscale IP>
VIDEO_UDP_PORT=5600
AUDIO_WS_PORT=8889
TTS_COMMAND_PORT=8890
HEALTH_PORT=8891
CAMERA_DEVICE=/dev/video0
CAMERA_WIDTH=320
CAMERA_HEIGHT=240
CAMERA_FPS=15
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_CHUNK_MS=100
TTS_ENGINE=espeak-ng
LOG_LEVEL=INFO
```

**PC Backend `.env` (`dexterslab-backend/.env`):**
```env
PORT=8888
PI_TAILSCALE_IP=<Pi's Tailscale IP>
GEMINI_API_KEY=<key>
MEMORY_DB_PATH=./data/dexterslab-memory.db
FFMPEG_PATH=<path to ffmpeg.exe>
```

---

## File Tree Summary

```
dexterslab/
├── dexterslab-backend/
│   ├── server.js                          # 1063 lines — main Express + WS server
│   ├── core/
│   │   ├── memory-engine.js               # 406 lines — SQLite persistence
│   │   └── context-bus.js                 # 187 lines — pub/sub event system
│   ├── observer2/
│   │   ├── eye-state-machine.js           # 831 lines — 60fps master tick
│   │   ├── motion-processor.js            # 298 lines — blob detection
│   │   ├── behavior-model.js              # 311 lines — gaze/emotion AI
│   │   ├── entity-tracker.js              # 363 lines — identity tracking
│   │   ├── spatial-model.js               # 159 lines — 9-zone grid
│   │   ├── oracle-v2.js                   # 269 lines — Gemini Oracle
│   │   ├── audio-ingress.js               # 109 lines — Pi mic WS receiver
│   │   ├── video-ingress.js               # 130 lines — ffmpeg JPEG extractor
│   │   ├── tts-commander.js               # 81 lines — PC→Pi TTS relay
│   │   ├── stt-engine.js                  # 84 lines — Node→Python Vosk bridge
│   │   └── stt_worker.py                  # Python Vosk subprocess
│   ├── diagnostics/
│   │   └── field-test-capture.js          # Telemetry capture
│   ├── tests/
│   │   └── phase7-integration.test.js     # Integration tests
│   └── models/
│       └── vosk-model-small-en-us-0.15/   # Local STT model
│
├── dexterslab-frontend/
│   └── app/
│       ├── observer/
│       │   ├── eye-v2/page.tsx            # WebGL eye renderer (Pi display)
│       │   ├── rules-lawyer/              # Board game assistant experiment
│       │   └── page.tsx                   # Observer hub page
│       ├── admin/
│       │   ├── page.tsx                   # Admin dashboard
│       │   └── login/page.tsx             # Admin login
│       └── api/admin/[...path]/route.ts   # Admin API proxy
│
├── edge-daemon/                           # RUNS ON PI ONLY
│   ├── main.py                            # Entry point
│   ├── config.py                          # Env-based config
│   ├── video_streamer.py                  # Camera → UDP
│   ├── audio_streamer.py                  # Mic → WebSocket
│   ├── tts_receiver.py                    # WS → espeak-ng
│   ├── health.py                          # HTTP health server
│   ├── diagnostics.py                     # Diagnostic helpers
│   ├── requirements.txt                   # pyaudio, websockets, python-dotenv
│   ├── observer-capture.service           # systemd unit
│   └── .env.pi                            # Pi environment config
│
├── scripts/
│   ├── deploy-to-pi.sh                    # Full rsync + restart deployment
│   ├── observer-kiosk.sh                  # Chromium kiosk launcher
│   ├── pi-setup-runbook.md                # Fresh Pi setup guide
│   ├── deploy-backend.sh                  # PC backend deploy
│   └── deploy-frontend.sh                 # PC frontend deploy
│
├── ecosystem.config.js                    # PM2 config (backend + frontend)
├── dev.ps1 / dev.sh                       # Dev environment launchers
└── .agent/workflows/                      # Agent workflow automations
```

---

## Key Design Patterns

1. **Thin Client Architecture** — Pi sends raw data, PC does all processing, sends back rendered state
2. **60fps Tick Loop** — `setInterval(16ms)` drives the eye state machine; all state changes are lerped
3. **Batched DB Writes** — Observations queued and flushed every 500ms to prevent I/O bottleneck
4. **Backpressure** — Context bus drops non-critical events when dispatch queue exceeds 100
5. **Graceful Degradation** — Each subsystem (video, audio, TTS) runs independently; failures reported via health endpoint
6. **Exponential Backoff** — All reconnection logic uses doubling backoff with caps (TTS: 30s, Audio: 30s)
7. **Security** — Prompt injection detection, transcript sanitization, IP whitelisting on TTS, conversation buffer validation
