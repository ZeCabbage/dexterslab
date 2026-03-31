import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

// Platform detection: check env var first (set in .env), then auto-detect from OS
function getPlatform(): 'windows' | 'mac' | 'pi' {
  const envPlatform = process.env.PLATFORM?.toLowerCase();
  if (envPlatform === 'windows' || envPlatform === 'pc') return 'windows';
  if (envPlatform === 'mac') return 'mac';
  if (envPlatform === 'pi') return 'pi';
  // Auto-detect
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'mac';
  return 'pi';
}

const PLATFORM = getPlatform();

export async function GET() {
  let version = 0;
  const wifi = { ssid: '---', signal: 0, ip: '---', connected: false };

  if (PLATFORM === 'windows') {
    // ── Windows: use netsh and OS network interfaces ──
    try {
      const { stdout } = await execAsync(
        'netsh wlan show interfaces',
        { timeout: 5000 }
      );
      const ssidMatch = stdout.match(/\bSSID\s*:\s*(.+)/);
      const signalMatch = stdout.match(/Signal\s*:\s*(\d+)%/);
      const stateMatch = stdout.match(/State\s*:\s*(connected|disconnected)/i);

      if (ssidMatch) {
        wifi.ssid = ssidMatch[1].trim();
      }
      if (signalMatch) {
        wifi.signal = parseInt(signalMatch[1]) || 0;
      }
      if (stateMatch && stateMatch[1].toLowerCase() === 'connected') {
        wifi.connected = true;
      }
    } catch {
      // WiFi might not be available (ethernet only)
    }

    // Get IP from OS network interfaces
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          wifi.ip = iface.address;
          break;
        }
      }
      if (wifi.ip !== '---') break;
    }
  } else if (PLATFORM === 'mac') {
    // ── Mac: use networksetup / airport ──
    try {
      const { stdout } = await execAsync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null'
      );
      const ssidMatch = stdout.match(/\bSSID:\s*(.+)/);
      const rssiMatch = stdout.match(/agrCtlRSSI:\s*(-?\d+)/);
      if (ssidMatch) {
        wifi.ssid = ssidMatch[1].trim();
        wifi.connected = true;
      }
      if (rssiMatch) {
        const rssi = parseInt(rssiMatch[1]);
        wifi.signal = Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100)));
      }
    } catch {
      try {
        const { stdout } = await execAsync('networksetup -getairportnetwork en0 2>/dev/null');
        const match = stdout.match(/Current Wi-Fi Network:\s*(.+)/);
        if (match) {
          wifi.ssid = match[1].trim();
          wifi.connected = true;
          wifi.signal = 75;
        }
      } catch {}
    }

    // Get IP on Mac
    try {
      const { stdout } = await execAsync('ipconfig getifaddr en0 2>/dev/null');
      wifi.ip = stdout.trim() || '---';
    } catch {
      const ifaces = os.networkInterfaces();
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal) {
            wifi.ip = iface.address;
            break;
          }
        }
        if (wifi.ip !== '---') break;
      }
    }
  } else {
    // ── Pi / Linux ──
    // Check which version is running
    try {
      const r = await execAsync('pgrep -f v2_pi_client 2>/dev/null');
      if (r.stdout.trim()) version = 2;
    } catch {}

    if (version === 0) {
      try {
        const r = await execAsync('pgrep -f "server:app" 2>/dev/null');
        if (r.stdout.trim()) version = 1;
      } catch {}
    }

    // Get WiFi info
    try {
      const { stdout } = await execAsync(
        'nmcli -t -f ACTIVE,SSID,SIGNAL device wifi list 2>/dev/null',
        { timeout: 5000 }
      );
      for (const line of stdout.trim().split('\n')) {
        const parts = line.split(':');
        if (parts.length >= 3 && parts[0].trim().toLowerCase() === 'yes') {
          wifi.ssid = parts[1].trim() || '---';
          wifi.signal = parseInt(parts[2].trim()) || 0;
          wifi.connected = true;
          break;
        }
      }
    } catch {
      wifi.ssid = 'N/A';
    }

    // Get IP
    try {
      const { stdout } = await execAsync('hostname -I 2>/dev/null', { timeout: 3000 });
      const ips = stdout.trim().split(/\s+/);
      wifi.ip = ips[0] || '---';
    } catch {}
  }

  let diagnostics = { health: null, entities: [], conversation: [] };
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8888';
    const [healthRes, entitiesRes, convoRes] = await Promise.all([
      fetch(`${backendUrl}/health`).catch(() => null),
      fetch(`${backendUrl}/api/admin/entities`).catch(() => null),
      fetch(`${backendUrl}/api/admin/conversation-log?limit=5`).catch(() => null),
    ]);

    diagnostics.health = healthRes ? await healthRes.json() : null;
    diagnostics.entities = entitiesRes ? await entitiesRes.json() : [];
    diagnostics.conversation = convoRes ? await convoRes.json() : [];
  } catch (err) {
    console.error('Failed to fetch diagnostics for hub:', err);
  }

  return NextResponse.json({ version, wifi, platform: PLATFORM, diagnostics });
}
