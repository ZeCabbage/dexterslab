/**
 * Video Ingress — WebSocket Server
 *
 * Receives MJPEG frames from the Pi's edge-daemon over WebSocket.
 * Each binary WS message is a single JPEG frame.
 *
 * Previous architecture: ffmpeg listening on UDP port, demuxing MJPEG.
 * New architecture: Pi pipes ffmpeg stdout → WS client → this server.
 *                   Each WS message is already a clean JPEG frame.
 *
 * Registered on the main HTTP server via WSRouter at /ws/video.
 */

// JPEG markers for validation
const SOI = Buffer.from([0xff, 0xd8]);
const EOI_0 = 0xff;
const EOI_1 = 0xd9;

export class VideoIngressServer {
  constructor(wsRouter, eventEmitter) {
    this.wsRouter = wsRouter;
    this.events = eventEmitter;
    this.client = null;
    this.framesReceivedLastSecond = 0;
    this.fps = 0;
    this.fpsInterval = null;
    this.active = false;
    this.totalFrames = 0;
    this._lastFrameAt = 0;  // For stale connection detection
  }

  start() {
    this.active = true;

    const wss = this.wsRouter.registerPath('/ws/video');
    console.log('[VideoIngress] Registered WebSocket endpoint at /ws/video');

    wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;

      if (this.client) {
        // ── Stale Connection Detection ──
        // Cloudflare Tunnel can drop connections silently.
        // Video sends at ~15fps, so 5s of no frames is definitely dead.
        // ALWAYS replace — never reject the new connection.
        const staleMs = Date.now() - this._lastFrameAt;
        const isStale = this.client.readyState !== 1 || staleMs > 5000;

        if (isStale) {
          console.warn(`[VideoIngress] ♻ Replacing stale video client (last frame ${Math.round(staleMs/1000)}s ago, readyState=${this.client.readyState})`);
        } else {
          console.warn(`[VideoIngress] ♻ Replacing active video client for new connection from ${ip} (last frame ${Math.round(staleMs/1000)}s ago)`);
        }
        try { this.client.terminate(); } catch {}
        this.client = null;
      }

      this.client = ws;
      this._lastFrameAt = Date.now();
      console.log(`[VideoIngress] 📹 Pi video client connected from ${ip}`);

      ws.on('message', (data) => {
        // Each message should be a single JPEG frame (binary)
        if (!Buffer.isBuffer(data)) {
          // Could be a text control message
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
          } catch (e) {
            // Ignore
          }
          return;
        }

        // Validate it's a JPEG (starts with SOI marker)
        if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
          // Not a valid JPEG frame, skip
          return;
        }

        this.framesReceivedLastSecond++;
        this.totalFrames++;
        this._lastFrameAt = Date.now();
        this.events.emit('frame', data);
      });

      ws.on('close', () => {
        if (this.client === ws) {
          this.client = null;
          console.log('[VideoIngress] 📹 Pi video client disconnected');
        }
      });

      ws.on('error', (err) => {
        console.error('[VideoIngress] WebSocket error:', err.message);
        if (this.client === ws) {
          this.client = null;
        }
      });
    });

    // FPS counter
    this.fpsInterval = setInterval(() => {
      this.fps = this.framesReceivedLastSecond;
      this.framesReceivedLastSecond = 0;
    }, 1000);
  }

  stop() {
    this.active = false;
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  isActive() {
    return this.client !== null && this.client.readyState === 1; // 1 = OPEN
  }

  getFramesPerSecond() {
    return this.fps;
  }
}