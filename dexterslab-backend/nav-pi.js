/**
 * Navigate Pi Chromium to a URL via SSH + xdotool
 *
 * Previous: Connected to Pi's Chrome DevTools Protocol (CDP) via Tailscale IP
 * New: Uses SSH through Cloudflare Tunnel since CDP port 9222 isn't exposed
 *
 * Note: The kiosk auto-navigates on boot, so this script is rarely needed.
 * Use it if you need to change the URL while the Pi is running.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SSH_HOST = 'pi-deploy'; // Must be configured in ~/.ssh/config with cloudflared proxy

async function navigatePi(targetUrl) {
  try {
    console.log('Navigating Pi Chromium via SSH + xdotool...');
    console.log(`Target: ${targetUrl}`);

    // Kill existing chromium and relaunch with new URL
    const cmd = `ssh -o ConnectTimeout=10 ${SSH_HOST} "pkill -f chromium; sleep 1; WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000 chromium-browser --app='${targetUrl}' --kiosk --start-fullscreen --noerrdialogs --disable-infobars --no-first-run --enable-features=UseOzonePlatform --ozone-platform=wayland --remote-debugging-port=9222 &"`;

    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
    console.log('Navigation command sent!');
  } catch (err) {
    console.error('Failed to navigate Pi Chromium:', err.message);
    process.exit(1);
  }
}

navigatePi('https://dexterslab.cclottaaworld.com/observer/eye-v2');
