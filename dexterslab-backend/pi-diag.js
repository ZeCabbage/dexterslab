/**
 * Pi Diagnostics — SSH-based
 *
 * Previous: Connected directly to Pi's Chrome DevTools Protocol via Tailscale IP
 * New: Runs diagnostic commands on the Pi via SSH through Cloudflare Tunnel
 *
 * Checks: service status, health endpoint, camera, audio, systemd logs
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SSH_HOST = 'pi-deploy'; // Must be configured in ~/.ssh/config with cloudflared proxy

async function runDiag(label, cmd) {
  try {
    const { stdout, stderr } = await execAsync(
      `ssh -o ConnectTimeout=10 ${SSH_HOST} "${cmd}"`,
      { timeout: 15000 }
    );
    console.log(`\n─── ${label} ───`);
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.log('[stderr]', stderr.trim());
  } catch (err) {
    console.log(`\n─── ${label} ───`);
    console.log('[ERROR]', err.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log(' DextersLab Pi Diagnostics (via SSH)');
  console.log('═══════════════════════════════════════');

  // Check SSH connectivity
  try {
    await execAsync(`ssh -o ConnectTimeout=10 ${SSH_HOST} "echo ok"`, { timeout: 15000 });
    console.log('\n✓ SSH connected via Cloudflare Tunnel');
  } catch (err) {
    console.error('✗ Cannot reach Pi via SSH. Check ~/.ssh/config and cloudflared.');
    process.exit(1);
  }

  await runDiag('System Info', 'hostname; uname -a; uptime');
  await runDiag('Service Status', 'systemctl is-active observer-capture.service; systemctl status observer-capture.service --no-pager -l | tail -20');
  await runDiag('Health Endpoint', 'curl -s http://localhost:8891/health');
  await runDiag('Camera Devices', 'ls -la /dev/video*');
  await runDiag('Audio Devices', 'arecord -l 2>/dev/null || echo "No audio devices found"');
  await runDiag('Network Interfaces', 'ip addr show | grep -E "inet |state "');
  await runDiag('Recent Logs (last 30 lines)', 'journalctl -u observer-capture.service --no-pager -n 30');
  await runDiag('Disk Space', 'df -h /');
  await runDiag('Memory', 'free -m');
  await runDiag('Cloudflared Status', 'systemctl is-active cloudflared 2>/dev/null || echo "cloudflared not running as service"');

  console.log('\n═══════════════════════════════════════');
  console.log(' Diagnostics complete');
  console.log('═══════════════════════════════════════');
}

main();
