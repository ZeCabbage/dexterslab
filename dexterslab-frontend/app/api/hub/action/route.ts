import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IS_MAC = process.platform === 'darwin';

const BASE_DIR = process.env.OBSERVER_BASE_DIR || '/home/thecabbage/Desktop/The-Observer';
const VENV_PYTHON = `${BASE_DIR}/backend/venv/bin/python`;

async function killObserverProcesses(): Promise<string[]> {
  if (IS_MAC) {
    // Mac: just log, don't kill anything
    console.log('[Mac] Kill action — no processes to manage');
    return ['(mac-simulated)'];
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
  if (IS_MAC) {
    // Mac: just log the action
    console.log(`[Mac] Start version ${version} — simulated`);
    return;
  }

  await killObserverProcesses();
  await new Promise((r) => setTimeout(r, 2000));

  if (version === 1) {
    exec(
      `${VENV_PYTHON} -m uvicorn server:app --host 0.0.0.0 --port 8000`,
      { cwd: `${BASE_DIR}/backend` }
    );
  } else if (version === 2) {
    try {
      await execAsync('sudo systemctl restart observer-v2-client', { timeout: 10000 });
    } catch {}
  }

  await new Promise((r) => setTimeout(r, 3000));

  // Refresh Chromium
  const route = version === 2 ? '/observer/v2' : '/observer/v1';
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
      case 'start_v1': {
        await startVersion(1);
        return NextResponse.json({ success: true, message: 'Observer V1 launched' });
      }

      case 'start_v2': {
        await startVersion(2);
        return NextResponse.json({ success: true, message: 'Observer V2 launched' });
      }

      case 'kill': {
        const killed = await killObserverProcesses();
        return NextResponse.json({
          success: true,
          message: IS_MAC
            ? 'Kill simulated (Mac testing mode)'
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
        if (IS_MAC) {
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
        const repoDir = IS_MAC
          ? '/Users/dexterholmes/Documents/GitHub/dexterslab'
          : '/home/thecabbage/Desktop/dexterslab';

        const results: string[] = [];

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
            cwd: `${repoDir}/dexterslab-backend`,
            timeout: 60000,
          });
          results.push('backend: npm install done');
        } catch (err: any) {
          results.push(`backend npm install warning: ${err.message}`);
        }

        // 3. Install frontend deps
        try {
          await execAsync('npm install', {
            cwd: `${repoDir}/dexterslab-frontend`,
            timeout: 60000,
          });
          results.push('frontend: npm install done');
        } catch (err: any) {
          results.push(`frontend npm install warning: ${err.message}`);
        }

        // 4. Rebuild frontend (production only on Pi)
        if (!IS_MAC) {
          try {
            await execAsync('npm run build', {
              cwd: `${repoDir}/dexterslab-frontend`,
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
