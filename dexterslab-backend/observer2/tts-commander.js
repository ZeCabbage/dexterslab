import WebSocket from 'ws';

export class TTSCommander {
  constructor() {
    this.tailscaleIp = process.env.PI_TAILSCALE_IP;
    this.port = parseInt(process.env.TTS_COMMAND_PORT || '8890', 10);
    this.ws = null;
    this.reconnectTimer = null;
    this.backoffMs = 1000;
    this.active = false; // Whether we WANT to be connected
  }

  connect() {
    if (!this.tailscaleIp) {
      console.warn('[TTSCommander] Missing PI_TAILSCALE_IP. TTS disabled.');
      return;
    }
    
    this.active = true;
    this._doConnect();
  }

  _doConnect() {
    if (this.ws) return;

    const url = `ws://${this.tailscaleIp}:${this.port}/ws/tts`;
    console.log(`[TTSCommander] Connecting to Pi TTS at ${this.tailscaleIp}:${this.port}`);
    
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[TTSCommander] Connected');
      this.backoffMs = 1000; // reset backoff
    });

    this.ws.on('close', () => {
      this.ws = null;
      if (this.active) {
        console.log(`[TTSCommander] Disconnected — retrying in ${this.backoffMs / 1000}s`);
        this.reconnectTimer = setTimeout(() => this._doConnect(), this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, 30000); // Max 30s
      }
    });

    this.ws.on('error', () => {
      // Error is caught here, 'close' will fire right after
    });
  }

  speak(text) {
    if (!this.isConnected()) {
      console.warn('[TTSCommander] speak() called but not connected — message dropped');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ type: 'tts', text }));
      return true;
    } catch (err) {
      console.error('[TTSCommander] Failed to send speak command:', err);
      return false;
    }
  }

  disconnect() {
    this.active = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
