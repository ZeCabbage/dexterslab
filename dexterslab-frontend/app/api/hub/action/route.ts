import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Platform detection: check env var first (set in .env), then auto-detect from OS
function getPlatform(): 'windows' | 'mac' | 'pi' {
  const envPlatform = process.env.PLATFORM?.toLowerCase();
  if (envPlatform === 'windows' || envPlatform === 'pc') return 'windows';
  if (envPlatform === 'mac') return 'mac';
  if (envPlatform === 'pi') return 'pi';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'mac';
  return 'pi';
}

const PLATFORM = getPlatform();

// Get the repo directory based on platform
function getRepoDir(): string {
  switch (PLATFORM) {
    case 'windows': return 'C:\\Users\\holme\\OneDrive\\Desktop\\dexterslab';
    case 'mac': return '/Users/dexterholmes/Documents/GitHub/dexterslab';
    default: return '/home/thecabbage/Desktop/dexterslab';
  }
}

const BASE_DIR = process.env.OBSERVER_BASE_DIR || '/home/thecabbage/Desktop/The-Observer';
const VENV_PYTHON = `${BASE_DIR}/backend/venv/bin/python`;

async function killObserverProcesses(): Promise<string[]> {
  if (PLATFORM === 'windows' || PLATFORM === 'mac') {
    // Windows/Mac: no Pi processes to manage
    console.log(`[${PLATFORM}] Kill action — no processes to manage`);
    return [`(${PLATFORM}-simulated)`];
  }

  const patterns = [
    'python.*server:app',
    'uvicorn.*server:app',
    'python.*server.py',
  ];
  const killed: string[] = [];

  for (const pat of patterns) {
    try {
      const { stdout } = await execAsync(`pgrep -f "${pat}" 2>/dev/null`);
      for (const pid of stdout.trim().split('\n')) {
        if (pid.trim()) {
          try {
            await execAsync(`kill ${pid.trim()}`);
            killed.push(pid.trim());
          } catch {}
        }
      }
    } catch {}
  }

  // Kill Chromium showing Observer pages
  try {
    await execAsync('pkill -f chromium 2>/dev/null');
  } catch {}

  return killed;
}

async function startVersion(version: number): Promise<void> {
  if (PLATFORM === 'windows' || PLATFORM === 'mac') {
    // Windows/Mac: just log the action
    console.log(`[${PLATFORM}] Start version ${version} — simulated`);
    return;
  }

  await killObserverProcesses();
  await new Promise((r) => setTimeout(r, 2000));

    exec(
      `${VENV_PYTHON} -m uvicorn server:app --host 0.0.0.0 --port 8000`,
      { cwd: `${BASE_DIR}/backend` }
    );
    try {
      await execAsync('sudo systemctl restart observer-v2-client', { timeout: 10000 });
    } catch {}

  await new Promise((r) => setTimeout(r, 3000));

  // Refresh Chromium (Pi only)
  const route = '/observer/eye-v2';
  const ts = Math.floor(Date.now() / 1000);
  const url = `http://localhost:7777${route}?v=${ts}`;
  try {
    const env = 'WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 DISPLAY=:0';
    exec(
      `${env} chromium-browser --app="${url}" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run </dev/null >/dev/null 2>&1 &`
    );
  } catch {}
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start_v2': {
        await startVersion(2);
        return NextResponse.json({ success: true, message: 'Observer V2 launched' });
      }

      case 'kill': {
        const killed = await killObserverProcesses();
        return NextResponse.json({
          success: true,
          message: (PLATFORM === 'windows' || PLATFORM === 'mac')
            ? `Kill simulated (${PLATFORM} mode)`
            : killed.length > 0
              ? `Killed PIDs: ${killed.join(', ')}`
              : 'No processes found',
        });
      }

      case 'return_hub': {
        return NextResponse.json({
          success: true,
          message: 'Returning to hub',
          navigate: '/observer',
        });
      }

      case 'wifi_scan': {
        if (PLATFORM === 'windows') {
          // Windows: use netsh wlan
          try {
            const { stdout } = await execAsync(
              'netsh wlan show networks mode=bssid',
              { timeout: 10000 }
            );
            const networks: { ssid: string; signal: number; security: string; inUse: boolean }[] = [];
            const seen = new Set<string>();
            const blocks = stdout.split(/\n(?=SSID\s+\d+\s*:)/);

            for (const block of blocks) {
              const ssidMatch = block.match(/SSID\s+\d+\s*:\s*(.+)/);
              const signalMatch = block.match(/Signal\s*:\s*(\d+)%/);
              const authMatch = block.match(/Authentication\s*:\s*(.+)/);
              if (ssidMatch) {
                const ssid = ssidMatch[1].trim();
                if (!ssid || seen.has(ssid)) continue;
                seen.add(ssid);
                networks.push({
                  ssid,
                  signal: signalMatch ? parseInt(signalMatch[1]) : 0,
                  security: authMatch ? authMatch[1].trim() : '',
                  inUse: false,
                });
              }
            }

            // Mark current network
            try {
              const { stdout: ifaceOut } = await execAsync('netsh wlan show interfaces');
              const currentMatch = ifaceOut.match(/\bSSID\s*:\s*(.+)/);
              if (currentMatch) {
                const current = currentMatch[1].trim();
                const found = networks.find(n => n.ssid === current);
                if (found) found.inUse = true;
              }
            } catch {}

            networks.sort((a, b) => b.signal - a.signal);
            return NextResponse.json({ success: true, networks });
          } catch {
            return NextResponse.json({ success: true, networks: [], message: 'WiFi scan not available' });
          }
        }

        if (PLATFORM === 'mac') {
          // Mac: try airport scan
          try {
            const { stdout } = await execAsync(
              '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s 2>/dev/null'
            );
            const lines = stdout.trim().split('\n').slice(1);
            const networks = lines.map(line => {
              const match = line.trim().match(/^(.+?)\s+([0-9a-f:]+)\s+(-?\d+)/i);
              if (match) {
                const rssi = parseInt(match[3]);
                return {
                  ssid: match[1].trim(),
                  signal: Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100))),
                  security: 'WPA2',
                  inUse: false,
                };
              }
              return null;
            }).filter(Boolean);
            return NextResponse.json({ success: true, networks });
          } catch {
            return NextResponse.json({ success: true, networks: [], message: 'WiFi scan not available on this Mac' });
          }
        }

        // Pi / Linux
        try {
          await execAsync('nmcli device wifi rescan', { timeout: 10000 });
          await new Promise((r) => setTimeout(r, 2000));
          const { stdout } = await execAsync(
            'nmcli -t -f SSID,SIGNAL,SECURITY,IN-USE device wifi list',
            { timeout: 10000 }
          );
          const networks: { ssid: string; signal: number; security: string; inUse: boolean }[] = [];
          const seen = new Set<string>();
          for (const line of stdout.trim().split('\n')) {
            if (!line.trim()) continue;
            const parts = line.split(':');
            if (parts.length >= 3) {
              const ssid = parts[0].trim();
              if (!ssid || seen.has(ssid)) continue;
              seen.add(ssid);
              networks.push({
                ssid,
                signal: parseInt(parts[1]) || 0,
                security: parts[2] || '',
                inUse: (parts[3] || '').includes('*'),
              });
            }
          }
          networks.sort((a, b) => b.signal - a.signal);
          return NextResponse.json({ success: true, networks });
        } catch {
          return NextResponse.json({ success: false, networks: [], message: 'WiFi scan not available' });
        }
      }

      case 'git_pull': {
        const repoDir = getRepoDir();
        const results: string[] = [];
        const isWin = PLATFORM === 'windows';
        const sep = isWin ? '\\' : '/';

        // 1. Git pull
        try {
          const { stdout, stderr } = await execAsync('git pull origin main', {
            cwd: repoDir,
            timeout: 30000,
          });
          const output = (stdout || '').trim();
          results.push(`git pull: ${output || 'done'}`);
          if (stderr && !stderr.includes('Already up to date')) {
            results.push(`git stderr: ${stderr.trim()}`);
          }
        } catch (err: any) {
          results.push(`git pull failed: ${err.message || 'unknown error'}`);
          return NextResponse.json({
            success: false,
            message: `Git pull failed: ${err.message || 'unknown error'}`,
            details: results,
          });
        }

        // 2. Install backend deps
        try {
          await execAsync('npm install', {
            cwd: `${repoDir}${sep}dexterslab-backend`,
            timeout: 60000,
          });
          results.push('backend: npm install done');
        } catch (err: any) {
          results.push(`backend npm install warning: ${err.message}`);
        }

        // 3. Install frontend deps
        try {
          await execAsync('npm install', {
            cwd: `${repoDir}${sep}dexterslab-frontend`,
            timeout: 60000,
          });
          results.push('frontend: npm install done');
        } catch (err: any) {
          results.push(`frontend npm install warning: ${err.message}`);
        }

        // 4. Rebuild frontend (production only on Pi)
        if (PLATFORM === 'pi') {
          try {
            await execAsync('npm run build', {
              cwd: `${repoDir}${sep}dexterslab-frontend`,
              timeout: 120000,
            });
            results.push('frontend: build done');
          } catch (err: any) {
            results.push(`frontend build warning: ${err.message}`);
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Code synced successfully',
          details: results,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

