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

    // ── Speaker→Mic Feedback Prevention ──
    // Tracks when the Pi is actively speaking so the HardwareBroker
    // can suppress STT transcripts during playback + echo decay.
    this.isSpeaking = false;
    this._speakSafetyTimeout = null;   // Auto-unmute if Pi never acks
    this._cooldownTimeout = null;      // Post-speech echo decay window

    // ── Streaming chunk tracking ──
    this._pendingChunks = 0;           // How many chunks sent but not yet acked
    this._lastChunkIndex = -1;         // Index of the last chunk in current stream
    this._streamingActive = false;     // Whether a streaming session is in progress
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
        // ── Stale Connection Detection ──
        // Cloudflare Tunnel can drop connections silently.
        // If the existing client is no longer OPEN, replace it.
        if (this.client.readyState !== 1) {
          console.warn(`[TTSCommander] ♻ Replacing stale TTS client (readyState=${this.client.readyState})`);
          try { this.client.terminate(); } catch {}
          this.client = null;
        } else {
          console.warn(`[TTSCommander] Rejected duplicate TTS client from ${ip} — existing client is alive`);
          ws.close(1008, 'TTS receiver already connected');
          return;
        }
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

      // Pi sends ack/status messages back — used for feedback loop prevention
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tts_ack') {
            // Pi confirmed speech finished — start post-speech cooldown
            // The cooldown lets the mic's echo of the speaker decay before
            // we resume feeding transcripts to the Oracle.
            clearTimeout(this._speakSafetyTimeout);
            clearTimeout(this._cooldownTimeout);
            this._cooldownTimeout = setTimeout(() => {
              this.isSpeaking = false;
              console.log('[TTSCommander] 🔇 Post-speech cooldown ended — STT resumed');
            }, 1500); // 1.5s for mic echo decay
          } else if (msg.type === 'tts_chunk_ack') {
            // Pi finished playing one chunk of a streamed response
            this._pendingChunks = Math.max(0, this._pendingChunks - 1);
            const ci = msg.chunkIndex;
            console.log(`[TTSCommander] 📦 Chunk ${ci} acked (${this._pendingChunks} pending)`);

            // If this was the last chunk and no more pending, start cooldown
            if (this._streamingActive && ci >= this._lastChunkIndex && this._pendingChunks === 0) {
              this._streamingActive = false;
              clearTimeout(this._speakSafetyTimeout);
              clearTimeout(this._cooldownTimeout);
              this._cooldownTimeout = setTimeout(() => {
                this.isSpeaking = false;
                console.log('[TTSCommander] 🔇 Stream cooldown ended — STT resumed');
              }, 1500);
            }
          } else if (msg.type === 'tts_error') {
            console.warn(`[TTSCommander] Pi TTS error: ${msg.message}`);
            // Unmute immediately on error — speech didn't happen
            clearTimeout(this._speakSafetyTimeout);
            clearTimeout(this._cooldownTimeout);
            this._pendingChunks = 0;
            this._streamingActive = false;
            this.isSpeaking = false;
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
      // Mark as speaking BEFORE sending — mutes STT immediately
      this.isSpeaking = true;
      console.log('[TTSCommander] 🔇 STT muted — Pi speaking');

      // Safety timeout: if Pi never sends tts_ack (crash, disconnect),
      // auto-unmute after 30s to prevent permanent STT lockout.
      clearTimeout(this._speakSafetyTimeout);
      clearTimeout(this._cooldownTimeout);
      this._speakSafetyTimeout = setTimeout(() => {
        if (this.isSpeaking) {
          console.warn('[TTSCommander] ⚠️ No ack after 30s — auto-unmuting STT');
          this.isSpeaking = false;
        }
      }, 30000);

      this.client.send(JSON.stringify({ type: 'tts', text }));
      return true;
    } catch (err) {
      console.error('[TTSCommander] Failed to send speak command:', err);
      this.isSpeaking = false; // Unmute on send failure
      return false;
    }
  }

  /**
   * Send a TTS chunk to the Pi as part of a streaming response.
   * Chunks are played sequentially by the Pi's playback queue.
   * @param {string} text - The sentence fragment to speak
   * @param {number} chunkIndex - Sequential index of this chunk
   * @param {boolean} isLast - Whether this is the final chunk
   */
  speakChunk(text, chunkIndex, isLast) {
    if (!this.isConnected()) {
      console.warn('[TTSCommander] speakChunk() called but Pi not connected — chunk dropped');
      return false;
    }

    // Skip empty chunks (completion signals with no text)
    if (!text || !text.trim()) {
      if (isLast && this._streamingActive && this._pendingChunks === 0) {
        // Last chunk was empty — start cooldown immediately
        this._streamingActive = false;
        clearTimeout(this._speakSafetyTimeout);
        clearTimeout(this._cooldownTimeout);
        this._cooldownTimeout = setTimeout(() => {
          this.isSpeaking = false;
          console.log('[TTSCommander] 🔇 Stream cooldown ended (empty final) — STT resumed');
        }, 1500);
      }
      return true;
    }

    try {
      // Mark as speaking on first chunk — mutes STT immediately
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this._streamingActive = true;
        this._pendingChunks = 0;
        console.log('[TTSCommander] 🔇 STT muted — streaming TTS started');

        // Safety timeout: auto-unmute after 45s if Pi never finishes
        clearTimeout(this._speakSafetyTimeout);
        this._speakSafetyTimeout = setTimeout(() => {
          if (this.isSpeaking) {
            console.warn('[TTSCommander] ⚠️ No stream completion after 45s — auto-unmuting STT');
            this.isSpeaking = false;
            this._streamingActive = false;
            this._pendingChunks = 0;
          }
        }, 45000);
      }

      this._pendingChunks++;
      if (isLast) {
        this._lastChunkIndex = chunkIndex;
      }

      this.client.send(JSON.stringify({
        type: 'tts_chunk',
        text: text.trim(),
        chunkIndex,
        isLast
      }));

      console.log(`[TTSCommander] 📦 Sent chunk ${chunkIndex}${isLast ? ' (FINAL)' : ''}: "${text.trim().substring(0, 50)}"`);
      return true;
    } catch (err) {
      console.error('[TTSCommander] Failed to send chunk:', err);
      this._pendingChunks = Math.max(0, this._pendingChunks - 1);
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
