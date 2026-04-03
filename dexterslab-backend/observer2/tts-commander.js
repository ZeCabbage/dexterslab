/**
 * TTS Commander — WebSocket Server (Pi-initiated connection)
 *
 * Previous architecture: PC connects TO Pi's WS server on port 8890
 * New architecture:      Pi connects TO PC's /ws/tts endpoint,
 *                        PC sends TTS commands DOWN that connection.
 *
 * This reversal is needed because Cloudflare Tunnel only proxies
 * inbound connections to the PC — we can't reach the Pi directly.
 */

export class TTSCommander {
  constructor() {
    this.wsRouter = null;
    this.client = null; // The connected Pi client
  }

  /**
   * Register the /ws/tts endpoint on the WSRouter.
   * Called during HardwareBroker.init().
   */
  connect(wsRouter) {
    this.wsRouter = wsRouter;

    const wss = wsRouter.registerPath('/ws/tts');
    console.log('[TTSCommander] Registered WebSocket endpoint at /ws/tts (waiting for Pi to connect)');

    wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;

      if (this.client) {
        console.warn(`[TTSCommander] Rejected duplicate TTS client from ${ip} — already connected`);
        ws.close(1008, 'TTS receiver already connected');
        return;
      }

      this.client = ws;
      console.log(`[TTSCommander] 🔊 Pi TTS receiver connected from ${ip}`);

      ws.on('close', () => {
        if (this.client === ws) {
          this.client = null;
          console.log('[TTSCommander] 🔊 Pi TTS receiver disconnected');
        }
      });

      ws.on('error', (err) => {
        console.error('[TTSCommander] WebSocket error:', err.message);
        if (this.client === ws) {
          this.client = null;
        }
      });

      // Pi may send ack/status messages back — log them
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tts_ack') {
            // Pi acknowledged it spoke the text
          } else if (msg.type === 'tts_error') {
            console.warn(`[TTSCommander] Pi TTS error: ${msg.message}`);
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
    });
  }

  /**
   * Send a TTS command to the connected Pi.
   * The Pi's tts_receiver.py will call espeak-ng.
   */
  speak(text) {
    if (!this.isConnected()) {
      console.warn('[TTSCommander] speak() called but Pi not connected — message dropped');
      return false;
    }

    try {
      this.client.send(JSON.stringify({ type: 'tts', text }));
      return true;
    } catch (err) {
      console.error('[TTSCommander] Failed to send speak command:', err);
      return false;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  isConnected() {
    return this.client !== null && this.client.readyState === 1; // 1 = OPEN (WebSocket.OPEN)
  }
}
