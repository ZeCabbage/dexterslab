#!/usr/bin/env python3
"""
OFFLINE HUB DAEMON — Pi-Local System Control Interface

Runs entirely on the Raspberry Pi with NO backend dependency.
WebSocket server (:8894) provides hardware diagnostics, Ollama model
listing, app launching, WiFi configuration, and system stats to the
offline-hub.html display.

Protocol:
  → Client sends: { "action": "..." }
  ← Server pushes: { "type": "status", ... } every 2 seconds
  ← Server responds: { "type": "...", ... } to actions
"""

import os
import sys
import json
import time
import asyncio
import subprocess
import re
import logging
from datetime import datetime

try:
    import websockets
    try:
        from websockets.asyncio.server import serve as ws_serve
    except ImportError:
        from websockets.server import serve as ws_serve
except ImportError:
    print("[OfflineHub] websockets not installed — run: pip install websockets")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

LOG_TAG = "[OFFLINE-HUB]"
WS_PORT = 8894

# ═══════════════════════════════════════════
#  App Registry
# ═══════════════════════════════════════════
OFFLINE_APPS = [
    {
        "id": "offline-observer",
        "name": "Offline Observer",
        "icon": "⏣",
        "daemon_script": "offline_daemon.py",
        "port": 8892,
        "html": "offline-observer.html",
        "description": "Eye tracking + face detection (local)",
    },
    {
        "id": "deadswitch",
        "name": "Deadswitch",
        "icon": "☢",
        "daemon_script": "deadswitch_daemon.py",
        "port": 8893,
        "html": "deadswitch.html",
        "description": "Survival knowledge oracle (local RAG)",
    },
]

# ═══════════════════════════════════════════
#  State
# ═══════════════════════════════════════════
activity_log = []  # [{timestamp, type, message}]
MAX_LOG_ENTRIES = 100
ws_clients = set()


def log_activity(msg_type, message):
    """Add an entry to the activity log and print it."""
    entry = {
        "timestamp": time.time(),
        "time": datetime.now().strftime("%H:%M:%S"),
        "type": msg_type,  # system, hardware, app, wifi, error
        "message": message,
    }
    activity_log.append(entry)
    if len(activity_log) > MAX_LOG_ENTRIES:
        activity_log.pop(0)
    logger.info(f"{LOG_TAG} [{msg_type}] {message}")


# ═══════════════════════════════════════════
#  Hardware Detection
# ═══════════════════════════════════════════
def get_hw_manifest():
    """Read hw-manifest.json for hardware status."""
    try:
        with open('/tmp/hw-manifest.json', 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def check_camera():
    """Quick camera availability check."""
    hw = get_hw_manifest()
    cam = hw.get('camera', {})
    if cam.get('status') == 'ok':
        return {"status": "ok", "device": cam.get('device', '?'), "detail": "Camera available"}

    # Fallback: try to find /dev/video*
    for i in range(5):
        if os.path.exists(f'/dev/video{i}'):
            return {"status": "ok", "device": f"/dev/video{i}", "detail": "Device detected"}
    return {"status": "error", "device": "none", "detail": "No camera found"}


def check_microphone():
    """Quick mic availability check."""
    hw = get_hw_manifest()
    mic = hw.get('microphone', {})
    if mic.get('status') in ('ok', 'degraded'):
        return {
            "status": "ok",
            "card": mic.get('card', '?'),
            "name": mic.get('name', 'Unknown'),
            "detail": f"Card {mic.get('card')} — {mic.get('name', '?')}"
        }
    return {"status": "error", "card": "none", "name": "Unknown", "detail": "No mic detected"}


def check_speaker():
    """Quick speaker availability check."""
    hw = get_hw_manifest()
    spk = hw.get('speaker', {})
    if spk.get('status') in ('ok', 'degraded'):
        return {
            "status": "ok",
            "card": spk.get('card', '?'),
            "name": spk.get('name', 'Unknown'),
            "detail": f"Card {spk.get('card')} — {spk.get('name', '?')}"
        }
    return {"status": "error", "card": "none", "name": "Unknown", "detail": "No speaker detected"}


# ═══════════════════════════════════════════
#  Ollama Model Listing
# ═══════════════════════════════════════════
def list_ollama_models():
    """Get installed Ollama models."""
    try:
        result = subprocess.run(
            ['ollama', 'list'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return []

        models = []
        lines = result.stdout.strip().split('\n')
        if len(lines) < 2:
            return []

        # Skip header line
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 4:
                name = parts[0]
                model_id = parts[1]
                size = f"{parts[2]} {parts[3]}"
                models.append({
                    "name": name,
                    "id": model_id[:12],
                    "size": size,
                })
        return models
    except FileNotFoundError:
        return []  # Ollama not installed
    except Exception as e:
        logger.error(f"{LOG_TAG} Ollama list error: {e}")
        return []


def check_ollama_running():
    """Check if Ollama service is reachable."""
    try:
        result = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
             'http://127.0.0.1:11434/api/tags'],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() == '200'
    except Exception:
        return False


# ═══════════════════════════════════════════
#  System Stats
# ═══════════════════════════════════════════
def get_system_stats():
    """Get Pi system health metrics."""
    stats = {}

    # CPU temperature
    try:
        result = subprocess.run(
            ['vcgencmd', 'measure_temp'],
            capture_output=True, text=True, timeout=3
        )
        match = re.search(r'temp=([\d.]+)', result.stdout)
        if match:
            stats['cpu_temp'] = float(match.group(1))
    except Exception:
        stats['cpu_temp'] = None

    # Memory
    try:
        with open('/proc/meminfo', 'r') as f:
            meminfo = f.read()
        total = int(re.search(r'MemTotal:\s+(\d+)', meminfo).group(1)) // 1024
        available = int(re.search(r'MemAvailable:\s+(\d+)', meminfo).group(1)) // 1024
        stats['ram_total_mb'] = total
        stats['ram_available_mb'] = available
        stats['ram_used_pct'] = round((1 - available / total) * 100, 1) if total > 0 else 0
    except Exception:
        stats['ram_total_mb'] = 0
        stats['ram_available_mb'] = 0
        stats['ram_used_pct'] = 0

    # Disk
    try:
        result = subprocess.run(
            ['df', '-h', '/'],
            capture_output=True, text=True, timeout=3
        )
        lines = result.stdout.strip().split('\n')
        if len(lines) >= 2:
            parts = lines[1].split()
            stats['disk_total'] = parts[1]
            stats['disk_used'] = parts[2]
            stats['disk_available'] = parts[3]
            stats['disk_used_pct'] = parts[4]
    except Exception:
        stats['disk_total'] = '?'
        stats['disk_available'] = '?'
        stats['disk_used_pct'] = '?'

    # Uptime
    try:
        with open('/proc/uptime', 'r') as f:
            uptime_sec = float(f.read().split()[0])
        hours = int(uptime_sec // 3600)
        mins = int((uptime_sec % 3600) // 60)
        stats['uptime'] = f"{hours}h {mins}m"
        stats['uptime_seconds'] = uptime_sec
    except Exception:
        stats['uptime'] = '?'

    # IP address
    try:
        result = subprocess.run(
            ['hostname', '-I'],
            capture_output=True, text=True, timeout=3
        )
        ips = result.stdout.strip().split()
        stats['ip'] = ips[0] if ips else '---'
    except Exception:
        stats['ip'] = '---'

    return stats


# ═══════════════════════════════════════════
#  WiFi (reused from offline_daemon.py)
# ═══════════════════════════════════════════
async def scan_wifi():
    """Scan for available WiFi networks."""
    try:
        proc = await asyncio.create_subprocess_exec(
            'nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        networks = []
        seen = set()
        for line in stdout.decode().strip().split('\n'):
            if not line:
                continue
            match = re.match(r'^(.*):(\d+):(.*)$', line)
            if match:
                ssid = match.group(1).replace(r'\:', ':')
                signal = match.group(2)
                sec = match.group(3)
                if ssid and ssid != '--' and ssid not in seen:
                    seen.add(ssid)
                    networks.append({'ssid': ssid, 'signal': int(signal), 'security': sec})
        networks.sort(key=lambda x: x['signal'], reverse=True)
        return networks
    except Exception as e:
        logger.error(f"{LOG_TAG} WiFi scan error: {e}")
        return []


async def join_wifi(ssid, password=None):
    """Join a WiFi network."""
    try:
        cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
        if password:
            cmd.extend(['password', password])
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=25)
        success = proc.returncode == 0
        msg = stdout.decode().strip() if success else stderr.decode().strip()
        return {"success": success, "message": msg}
    except Exception as e:
        return {"success": False, "message": str(e)}


def get_wifi_status():
    """Get current WiFi connection info."""
    try:
        result = subprocess.run(
            ['nmcli', '-t', '-f', 'GENERAL.STATE,GENERAL.CONNECTION,WIFI.SSID,IP4.ADDRESS',
             'dev', 'show', 'wlan0'],
            capture_output=True, text=True, timeout=5
        )
        info = {'connected': False, 'ssid': '---', 'ip': '---', 'signal': 0}
        for line in result.stdout.strip().split('\n'):
            if 'GENERAL.CONNECTION:' in line:
                conn = line.split(':', 1)[1].strip()
                if conn and conn != '--':
                    info['ssid'] = conn
                    info['connected'] = True
            elif 'IP4.ADDRESS' in line:
                ip_part = line.split(':', 1)[1].strip()
                info['ip'] = ip_part.split('/')[0] if ip_part else '---'
        # Signal strength
        try:
            sig_result = subprocess.run(
                ['nmcli', '-t', '-f', 'IN-USE,SIGNAL', 'dev', 'wifi'],
                capture_output=True, text=True, timeout=5
            )
            for line in sig_result.stdout.strip().split('\n'):
                if line.startswith('*:'):
                    info['signal'] = int(line.split(':')[1])
                    break
        except Exception:
            pass
        return info
    except Exception:
        return {'connected': False, 'ssid': '---', 'ip': '---', 'signal': 0}


# ═══════════════════════════════════════════
#  App Management
# ═══════════════════════════════════════════
def check_app_running(app):
    """Check if an offline app's daemon is running."""
    try:
        result = subprocess.run(
            ['pgrep', '-f', app['daemon_script']],
            capture_output=True, text=True, timeout=3
        )
        return result.returncode == 0
    except Exception:
        return False


async def launch_app(app_id):
    """Launch an offline app (full handoff from hub)."""
    app = next((a for a in OFFLINE_APPS if a['id'] == app_id), None)
    if not app:
        return {"success": False, "message": f"Unknown app: {app_id}"}

    if check_app_running(app):
        return {"success": True, "message": f"{app['name']} already running", "navigate": app['html']}

    log_activity("app", f"Launching {app['name']}...")

    daemon_dir = os.path.dirname(os.path.abspath(__file__))
    daemon_path = os.path.join(daemon_dir, app['daemon_script'])
    venv_python = os.path.join(daemon_dir, '..', 'venv', 'bin', 'python')

    # Use venv python if available, else system python
    python = venv_python if os.path.exists(venv_python) else sys.executable

    try:
        subprocess.Popen(
            [python, daemon_path],
            cwd=daemon_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        await asyncio.sleep(2)  # Give it time to start

        if check_app_running(app):
            log_activity("app", f"{app['name']} started successfully")
            return {"success": True, "message": f"{app['name']} started", "navigate": app['html']}
        else:
            log_activity("error", f"{app['name']} failed to start")
            return {"success": False, "message": f"{app['name']} failed to start"}
    except Exception as e:
        log_activity("error", f"Launch error: {e}")
        return {"success": False, "message": str(e)}


async def stop_app(app_id):
    """Stop an offline app daemon."""
    app = next((a for a in OFFLINE_APPS if a['id'] == app_id), None)
    if not app:
        return {"success": False, "message": f"Unknown app: {app_id}"}

    try:
        subprocess.run(
            ['pkill', '-f', app['daemon_script']],
            capture_output=True, timeout=5
        )
        await asyncio.sleep(1)
        running = check_app_running(app)
        if not running:
            log_activity("app", f"{app['name']} stopped")
            return {"success": True, "message": f"{app['name']} stopped"}
        else:
            # Force kill
            subprocess.run(['pkill', '-9', '-f', app['daemon_script']],
                         capture_output=True, timeout=3)
            log_activity("app", f"{app['name']} force-killed")
            return {"success": True, "message": f"{app['name']} force-stopped"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ═══════════════════════════════════════════
#  Speaker Test
# ═══════════════════════════════════════════
async def test_speaker():
    """Play a test sound through the speaker."""
    hw = get_hw_manifest()
    speaker_card = hw.get('speaker', {}).get('card')

    try:
        if speaker_card:
            subprocess.run(['amixer', '-c', str(speaker_card), 'set', 'PCM', '90%'],
                         capture_output=True, timeout=3)
            espeak = subprocess.Popen(
                ['espeak-ng', '-v', 'en-us', '--stdout', 'Offline hub active. All systems nominal.'],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            aplay = subprocess.Popen(
                ['aplay', '-D', f'plughw:{speaker_card},0'],
                stdin=espeak.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            espeak.stdout.close()
            aplay.wait(timeout=15)
            espeak.wait(timeout=5)
        else:
            subprocess.run(
                ['espeak-ng', '-v', 'en-us', 'Offline hub active. All systems nominal.'],
                check=False, timeout=10
            )
        log_activity("hardware", "Speaker test: OK")
        return {"success": True, "message": "Speaker test played"}
    except Exception as e:
        log_activity("error", f"Speaker test failed: {e}")
        return {"success": False, "message": str(e)}


# ═══════════════════════════════════════════
#  Mode Switching
# ═══════════════════════════════════════════
MODE_FLAG = '/tmp/mode.flag'


def get_current_mode():
    """Read the current mode from flag file."""
    try:
        with open(MODE_FLAG, 'r') as f:
            return f.read().strip()
    except Exception:
        return 'offline'  # Default when running as offline hub


async def return_to_online():
    """Clean handoff: offline → online mode."""
    log_activity("system", "Returning to ONLINE mode...")

    # 1. Write mode flag
    try:
        with open(MODE_FLAG, 'w') as f:
            f.write('online\n')
    except Exception as e:
        logger.error(f"{LOG_TAG} Cannot write mode flag: {e}")

    # 2. Kill all offline daemons
    for app in OFFLINE_APPS:
        try:
            subprocess.run(['pkill', '-f', app['daemon_script']],
                         capture_output=True, timeout=3)
        except Exception:
            pass

    # 3. Wait and verify
    await asyncio.sleep(3)

    # 4. Force-release hardware
    try:
        subprocess.run(['fuser', '-k'] +
                      [f'/dev/snd/pcmC{i}D0c' for i in range(5)],
                      capture_output=True, timeout=3)
    except Exception:
        pass
    try:
        for i in range(5):
            if os.path.exists(f'/dev/video{i}'):
                subprocess.run(['fuser', '-k', f'/dev/video{i}'],
                             capture_output=True, timeout=3)
    except Exception:
        pass

    # 5. Start edge daemon
    try:
        subprocess.run(['sudo', 'systemctl', 'start', 'edge-daemon'],
                      capture_output=True, timeout=10)
        log_activity("system", "Edge daemon started — returning to online mode")
    except Exception as e:
        log_activity("error", f"Failed to start edge daemon: {e}")

    return {"success": True, "message": "Switching to online mode...", "navigate": "online"}


# ═══════════════════════════════════════════
#  Build Full Status Payload
# ═══════════════════════════════════════════
def build_status():
    """Build the full status payload for the display client."""
    return {
        "type": "status",
        "hardware": {
            "camera": check_camera(),
            "microphone": check_microphone(),
            "speaker": check_speaker(),
        },
        "system": get_system_stats(),
        "wifi": get_wifi_status(),
        "ollama": {
            "running": check_ollama_running(),
            "models": list_ollama_models(),
        },
        "apps": [
            {**app, "running": check_app_running(app)}
            for app in OFFLINE_APPS
        ],
        "mode": get_current_mode(),
        "log": activity_log[-20:],  # Last 20 entries
    }


# ═══════════════════════════════════════════
#  WebSocket Handler
# ═══════════════════════════════════════════
async def ws_handler(ws):
    """Handle display client connections."""
    ws_clients.add(ws)
    logger.info(f"{LOG_TAG} Display client connected (total: {len(ws_clients)})")
    log_activity("system", "Display client connected")

    # Send initial full status
    try:
        await ws.send(json.dumps(build_status()))
    except Exception:
        pass

    async def send_loop():
        """Push status updates every 2 seconds."""
        try:
            while True:
                await asyncio.sleep(2)
                status = build_status()
                await ws.send(json.dumps(status))
        except Exception:
            pass

    async def recv_loop():
        """Handle incoming actions from the display."""
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                action = msg.get('action')
                response = None

                if action == 'get_status':
                    response = build_status()

                elif action == 'test_speaker':
                    response = await test_speaker()
                    response['type'] = 'test_result'

                elif action == 'scan_wifi':
                    log_activity("wifi", "Scanning networks...")
                    networks = await scan_wifi()
                    response = {'type': 'wifi_results', 'networks': networks}
                    log_activity("wifi", f"Found {len(networks)} networks")

                elif action == 'join_wifi':
                    ssid = msg.get('ssid', '')
                    password = msg.get('password', '')
                    log_activity("wifi", f"Joining {ssid}...")
                    result = await join_wifi(ssid, password)
                    response = {'type': 'wifi_join_status', **result}
                    if result['success']:
                        log_activity("wifi", f"Connected to {ssid}")
                    else:
                        log_activity("error", f"Failed to join {ssid}")

                elif action == 'list_models':
                    models = list_ollama_models()
                    response = {'type': 'models', 'models': models,
                              'ollama_running': check_ollama_running()}

                elif action == 'launch_app':
                    app_id = msg.get('app_id', '')
                    response = await launch_app(app_id)
                    response['type'] = 'app_event'

                elif action == 'stop_app':
                    app_id = msg.get('app_id', '')
                    response = await stop_app(app_id)
                    response['type'] = 'app_event'

                elif action == 'return_online':
                    response = await return_to_online()
                    response['type'] = 'mode_switch'

                elif action == 'ping':
                    response = {'type': 'pong'}

                if response:
                    await ws.send(json.dumps(response))
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"{LOG_TAG} Handler error: {e}")

    send_task = asyncio.create_task(send_loop())
    recv_task = asyncio.create_task(recv_loop())

    done, pending = await asyncio.wait(
        [send_task, recv_task],
        return_when=asyncio.FIRST_COMPLETED
    )
    for task in pending:
        task.cancel()

    ws_clients.discard(ws)
    logger.info(f"{LOG_TAG} Display client disconnected (total: {len(ws_clients)})")


# ═══════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════
async def main():
    # Write mode flag
    try:
        with open(MODE_FLAG, 'w') as f:
            f.write('offline\n')
    except Exception:
        pass

    print(f"{LOG_TAG} ════════════════════════════════════════")
    print(f"{LOG_TAG}  OFFLINE HUB — Sentinel Mode")
    print(f"{LOG_TAG}  WebSocket: ws://0.0.0.0:{WS_PORT}")
    print(f"{LOG_TAG} ════════════════════════════════════════")

    # Initial hardware check
    cam = check_camera()
    mic = check_microphone()
    spk = check_speaker()
    print(f"{LOG_TAG}  Camera:  {cam['status']} — {cam['detail']}")
    print(f"{LOG_TAG}  Mic:     {mic['status']} — {mic['detail']}")
    print(f"{LOG_TAG}  Speaker: {spk['status']} — {spk['detail']}")

    # Ollama check
    ollama_up = check_ollama_running()
    models = list_ollama_models()
    print(f"{LOG_TAG}  Ollama:  {'ONLINE' if ollama_up else 'OFFLINE'} ({len(models)} models)")
    for m in models:
        print(f"{LOG_TAG}    → {m['name']} ({m['size']})")

    log_activity("system", "Offline Hub daemon started")
    log_activity("hardware", f"Camera: {cam['status']}")
    log_activity("hardware", f"Mic: {mic['status']}")
    log_activity("hardware", f"Speaker: {spk['status']}")
    log_activity("system", f"Ollama: {'online' if ollama_up else 'offline'} — {len(models)} models")

    async with ws_serve(ws_handler, "0.0.0.0", WS_PORT):
        print(f"{LOG_TAG}  Server ready on ws://0.0.0.0:{WS_PORT}")
        print()
        await asyncio.Future()  # Run forever


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{LOG_TAG} Shutdown.")
