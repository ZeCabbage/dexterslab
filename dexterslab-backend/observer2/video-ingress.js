import { spawn, spawnSync } from 'child_process';
// SOI = 0xFF 0xD8, EOI = 0xFF 0xD9
const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
function checkFfmpegAvailable() {
  try {
    const result = spawnSync(FFMPEG_BIN, ['-version'], {
      stdio: 'pipe',
      timeout: 5000,
      windowsHide: true
    });
    return result.status === 0;
  } catch (err) {
    console.error('[VideoIngress] checkFfmpegAvailable error:', err);
    return false;
  }
}
export class VideoIngressServer {
  constructor(port, eventEmitter) {
    this.port = port;
    this.events = eventEmitter;
    this.ffmpeg = null;
    this.framesReceivedLastSecond = 0;
    this.fps = 0;
    this.buffer = Buffer.alloc(0);
    this.fpsInterval = null;
    this.restarts = 0;
    this.maxRestarts = 3;
    this.active = false;
  }
  start() {
    this.active = true;
    this.restarts = 0;
    this._startFfmpeg();
    this.fpsInterval = setInterval(() => {
      this.fps = this.framesReceivedLastSecond;
      this.framesReceivedLastSecond = 0;
    }, 1000);
  }
  _startFfmpeg() {
    if (!this.active) return;
    
    if (!checkFfmpegAvailable()) {
      console.warn('[VideoIngress] WARNING: ffmpeg not found on PATH.');
      console.warn('[VideoIngress] Video stream ingress is disabled.');
      console.warn('[VideoIngress] Install ffmpeg and restart to enable video.');
      console.warn('[VideoIngress] On Windows: winget install Gyan.FFmpeg');
      return; // Exit gracefully, do not crash
    }
    console.log(`[VideoIngress] Spawning ffmpeg to listen on UDP ${this.port}`);
    this.ffmpeg = spawn(FFMPEG_BIN, [
      '-f', 'mjpeg',
      '-i', `udp://0.0.0.0:${this.port}`,
      '-f', 'image2pipe',
      '-vcodec', 'copy',
      '-'
    ], {
      windowsHide: true
    });
    this.ffmpeg.stdout.on('data', (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this._extractFrames();
    });
    this.ffmpeg.stderr.on('data', () => {
      // Ignored to prevent log spam
    });
    this.ffmpeg.on('close', (code) => {
      console.log(`[VideoIngress] ffmpeg exited with code ${code}`);
      this.ffmpeg = null;
      if (this.active && this.restarts < this.maxRestarts) {
        this.restarts++;
        console.log(`[VideoIngress] Restarting ffmpeg (Attempt ${this.restarts}/${this.maxRestarts})`);
        setTimeout(() => this._startFfmpeg(), 1000);
      } else if (this.active) {
        console.error(`[VideoIngress] ffmpeg failed after ${this.maxRestarts} restarts.`);
      }
    });
    this.ffmpeg.on('error', (err) => {
      console.error(`[VideoIngress] ffmpeg error:`, err);
    });
  }
  _extractFrames() {
    let soiIndex = this.buffer.indexOf(SOI);
    while (soiIndex !== -1) {
      const eoiIndex = this.buffer.indexOf(EOI, soiIndex + 2);
      if (eoiIndex !== -1) {
        // Found a complete frame
        const frameBuffer = this.buffer.subarray(soiIndex, eoiIndex + 2);
        this.framesReceivedLastSecond++;
        this.events.emit('frame', frameBuffer);
        
        // Remove processed data from buffer
        this.buffer = this.buffer.subarray(eoiIndex + 2);
        soiIndex = this.buffer.indexOf(SOI);
      } else {
        // Incomplete frame, keep accumulating
        // Discard any junk before SOI to save memory
        if (soiIndex > 0) {
          this.buffer = this.buffer.subarray(soiIndex);
        }
        break;
      }
    }
    
    // Safety limit to prevent memory leak if malformed stream
    if (this.buffer.length > 5 * 1024 * 1024) { // 5MB max
      console.warn('[VideoIngress] Buffer overflow, dropping stream chunk');
      this.buffer = Buffer.alloc(0);
    }
  }
  stop() {
    this.active = false;
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }
    this.buffer = Buffer.alloc(0);
  }
  isActive() {
    return this.ffmpeg !== null && !this.ffmpeg.killed;
  }
  
  getFramesPerSecond() {
    return this.fps;
  }
}