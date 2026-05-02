/**
 * Audio Ingress — WebSocket Server (via WSRouter)
 *
 * Receives raw PCM audio from the Pi's edge-daemon over WebSocket.
 * Previously ran on a standalone port (8889).
 * Now registered on the main HTTP server via WSRouter at /ws/audio.
 * This is required because Cloudflare Tunnel only routes to port 8888.
 *
 * Protocol:
 *   1. Pi connects to /ws/audio
 *   2. Server sends format_requirements (sampleRate, channels, format)
 *   3. Pi responds with format_ack
 *   4. Pi streams raw PCM buffers as binary WS messages
 *
 * Stale Connection Handling:
 *   Cloudflare Tunnel can silently drop WebSocket connections without
 *   sending a close frame. When the Pi reconnects, the old connection
 *   appears "open" but is actually dead. We detect this by tracking
 *   last_data_at timestamps and replacing stale connections.
 */

export class AudioIngressServer {
  constructor(wsRouter, eventEmitter) {
    this.wsRouter = wsRouter;
    this.events = eventEmitter;
    this.activeClient = null;
    this.formatNegotiated = false;
    this._lastDataAt = 0;  // Timestamp of last received data
  }

  async start() {
    const wss = this.wsRouter.registerPath('/ws/audio');
    console.log('[AudioIngress] Registered WebSocket endpoint at /ws/audio');

    wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;

      if (this.activeClient) {
        // ── Stale Connection Detection ──
        // Cloudflare Tunnel can drop the connection silently.
        // If the "active" client hasn't sent data in 10s, it's dead.
        const staleMs = Date.now() - this._lastDataAt;
        const isStale = this.activeClient.readyState !== 1 || staleMs > 10000;

        if (isStale) {
          console.warn(`[AudioIngress] ♻ Replacing stale audio client (last data ${Math.round(staleMs/1000)}s ago, readyState=${this.activeClient.readyState})`);
          try { this.activeClient.terminate(); } catch {}
          this.activeClient = null;
          this.events.emit('client_disconnected');
        } else {
          console.warn(`[AudioIngress] Rejected duplicate audio client from ${ip} (active client alive, last data ${Math.round(staleMs/1000)}s ago)`);
          ws.close(1008, 'Audio stream already active');
          return;
        }
      }

      this.activeClient = ws;
      this.formatNegotiated = false;
      this._lastDataAt = Date.now();
      console.log(`[AudioIngress] 🎤 Pi audio client connected from ${ip}`);

      ws.send(JSON.stringify({
        type: 'format_requirements',
        sampleRate: 16000,
        channels: 1,
        format: 'S16LE'
      }));

      this.events.emit('client_connected');

      ws.on('message', (data) => {
        this._lastDataAt = Date.now();

        if (!this.formatNegotiated) {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'format_ack') {
              console.log('[AudioIngress] Format negotiation successful');
              this.formatNegotiated = true;
            }
          } catch (e) {
            // Ignore parsing errors, it's just raw PCM
          }
          return;
        }

        // data is raw PCM buffer — skip any text keepalive messages
        if (!Buffer.isBuffer(data)) {
          // Text message (keepalive or control) — ignore
          return;
        }
        if (data.length === 0) return; // Empty keepalive
        this.events.emit('audio_frame', data);
      });

      ws.on('close', () => {
        if (this.activeClient === ws) {
          this.activeClient = null;
          console.log('[AudioIngress] 🎤 Pi audio client disconnected');
          this.events.emit('client_disconnected');
        }
      });

      ws.on('error', (err) => {
        console.error(`[AudioIngress] WebSocket error:`, err);
        if (this.activeClient === ws) {
          this.activeClient = null;
          console.log('[AudioIngress] 🎤 Pi audio client disconnected on error');
          this.events.emit('client_disconnected');
        }
      });
    });
  }

  async stop() {
    if (this.activeClient) {
      this.activeClient.close();
      this.activeClient = null;
    }
  }

  isClientConnected() {
    return this.activeClient !== null && this.activeClient.readyState === 1; // 1 = OPEN
  }
}
