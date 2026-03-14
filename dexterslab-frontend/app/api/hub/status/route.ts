import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  let version = 0;
  const wifi = { ssid: '---', signal: 0, ip: '---', connected: false };

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

  return NextResponse.json({ version, wifi });
}
