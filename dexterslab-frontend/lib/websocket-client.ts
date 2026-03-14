/**
 * WebSocket Client — Binary + JSON hybrid protocol.
 *
 * TRACKING DATA (hot path, 30fps):
 *   Binary frame — 20 bytes (5 × Float32):
 *   [x, y, dilation, visible, smooth]
 *   Unpacked via Float32Array — zero-copy, zero-GC.
 *
 * EVENTS (voice, oracle — irregular):
 *   JSON text frames — parsed with JSON.parse (not hot path).
 */

export type TrackingData = {
    type: 'tracking';
    x: number;
    y: number;
    smooth: number;
    dilation: number;
    visible: boolean;
    objects: { label: string; score: number }[];
};

export type OracleEvent = {
    type: 'oracle_response';
    text: string;
    response: string;
    category: string;
};

export type VoiceCommandEvent = {
    type: 'voice_command';
    command: 'sleep' | 'wake' | 'blush' | 'goodboy' | 'thankyou';
};

export type VoicePartialEvent = {
    type: 'voice_partial';
    text: string;
};

export type ServerMessage = TrackingData | OracleEvent | VoiceCommandEvent | VoicePartialEvent;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 2000;
    private reconnectAttempts = 0;
    private static readonly MAX_RECONNECT_DELAY = 30000;
    private static readonly MAX_RECONNECT_ATTEMPTS = 20;

    onTracking: ((data: TrackingData) => void) | null = null;
    onOracle: ((data: OracleEvent) => void) | null = null;
    onCommand: ((data: VoiceCommandEvent) => void) | null = null;
    onPartial: ((data: VoicePartialEvent) => void) | null = null;
    onConnectionChange: ((connected: boolean) => void) | null = null;

    constructor(url?: string) {
        // Auto-detect: use localhost in dev, Cloudflare tunnel in production
        if (!url) {
            const isLocal = typeof window !== 'undefined'
                && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            url = isLocal
                ? 'ws://localhost:8888/ws'
                : 'wss://thecabbagepatch.cclottaworld.com/ws';
        }
        this.url = url;
    }

    connect() {
        try {
            this.ws = new WebSocket(this.url);

            // ── CRITICAL: Enable binary ArrayBuffer reception ──
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log('📡 Connected to backend (binary protocol)');
                this.reconnectDelay = 2000;
                this.reconnectAttempts = 0;
                this.onConnectionChange?.(true);
            };

            this.ws.onmessage = (event) => {
                // ── BINARY FRAME: tracking data (20 bytes, 5 × Float32) ──
                if (event.data instanceof ArrayBuffer) {
                    const view = new Float32Array(event.data);
                    // Layout: [x, y, dilation, visible, smooth]
                    const tracking: TrackingData = {
                        type: 'tracking',
                        x: view[0],
                        y: view[1],
                        dilation: view[2],
                        visible: view[3] > 0.5,
                        smooth: view[4],
                        objects: [],  // Objects not in binary path
                    };
                    this.onTracking?.(tracking);
                    return;
                }

                // ── TEXT FRAME: JSON events (voice, oracle) ──
                try {
                    const data: ServerMessage = JSON.parse(event.data);
                    switch (data.type) {
                        case 'tracking':
                            // Fallback: legacy JSON tracking (shouldn't happen)
                            this.onTracking?.(data);
                            break;
                        case 'oracle_response':
                            this.onOracle?.(data);
                            break;
                        case 'voice_command':
                            this.onCommand?.(data);
                            break;
                        case 'voice_partial':
                            this.onPartial?.(data as VoicePartialEvent);
                            break;
                    }
                } catch (e) {
                    console.error('WebSocket parse error:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('📡 Disconnected from backend');
                this.onConnectionChange?.(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                this.ws?.close();
            };
        } catch {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        if (this.reconnectAttempts >= WebSocketClient.MAX_RECONNECT_ATTEMPTS) {
            console.warn('📡 Max reconnect attempts reached. Giving up.');
            this.onConnectionChange?.(false);
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay, WebSocketClient.MAX_RECONNECT_DELAY);
        console.log(`📡 Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts}/${WebSocketClient.MAX_RECONNECT_ATTEMPTS})...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, WebSocketClient.MAX_RECONNECT_DELAY);
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
    }
}
