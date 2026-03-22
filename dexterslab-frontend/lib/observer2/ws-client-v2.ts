/**
 * THE OBSERVER 2 — WebSocket Client V2 (Thin Client)
 *
 * Connects to /ws/observer2 on the backend.
 * Sends binary JPEG frames (camera) upstream.
 * Receives JSON EyeState packets downstream at 60fps.
 * Handles reconnection with exponential backoff.
 */

export interface EyeState {
    ix: number;
    iy: number;
    dilation: number;
    blink: number;
    emotion: string;
    sentinel: boolean;
    visible: boolean;
    entityCount: number;
    overlayText: string;
    overlayType: string;
    blush: number;
    goodBoy: number;
    thankYou: number;
    t: number;
}

export interface OracleResponse {
    response: string;
    category: string;
    emotion: string;
}

export class WSClientV2 {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectDelay = 1000;
    private maxReconnectDelay = 15000;
    private connected = false;
    private shouldReconnect = true;

    // Callbacks
    public onEyeState: ((state: EyeState) => void) | null = null;
    public onOracleResponse: ((data: OracleResponse) => void) | null = null;
    public onConnectionChange: ((connected: boolean) => void) | null = null;

    constructor() {
        // Connect to the backend WebSocket — supports multiple deployment modes:
        //   1. Localhost dev: ws://localhost:8888/ws/observer2
        //   2. LAN (Pi→PC):  ws://192.168.x.x:8888/ws/observer2
        //   3. Cloudflare:   wss://dexterslab-api.cclottaaworld.com/ws/observer2
        if (typeof window === 'undefined') {
            this.url = 'ws://localhost:8888/ws/observer2';
            return;
        }

        const envBackend = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (envBackend) {
            const proto = envBackend.startsWith('https') ? 'wss' : 'ws';
            const host = envBackend.replace(/^https?:\/\//, '').replace(/\/$/, '');
            this.url = `${proto}://${host}/ws/observer2`;
        } else {
            const hostname = window.location.hostname;
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
            if (isLocal) {
                this.url = 'ws://localhost:8888/ws/observer2';
            } else if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
                // LAN IP — connect directly to backend port on same host
                this.url = `ws://${hostname}:8888/ws/observer2`;
            } else {
                // External (Cloudflare Tunnel)
                this.url = 'wss://dexterslab-api.cclottaaworld.com/ws/observer2';
            }
        }
    }

    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        try {
            this.ws = new WebSocket(this.url);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectDelay = 1000;
                console.log('👁 Observer 2 WS connected');
                this.onConnectionChange?.(true);
            };

            this.ws.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'oracle_response') {
                            this.onOracleResponse?.(msg as OracleResponse);
                        } else if (msg.ix !== undefined) {
                            // EyeState packet (no type field, just raw state)
                            this.onEyeState?.(msg as EyeState);
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.onConnectionChange?.(false);
                if (this.shouldReconnect) {
                    setTimeout(() => this.connect(), this.reconnectDelay);
                    this.reconnectDelay = Math.min(this.maxReconnectDelay, this.reconnectDelay * 1.5);
                }
            };

            this.ws.onerror = () => {
                // onclose will fire after this
            };
        } catch {
            if (this.shouldReconnect) {
                setTimeout(() => this.connect(), this.reconnectDelay);
            }
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        this.ws?.close();
        this.ws = null;
    }

    /**
     * Send a raw JPEG frame (binary) to the backend for processing.
     */
    sendFrame(blob: Blob) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        blob.arrayBuffer().then(buffer => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(buffer);
            }
        });
    }

    /**
     * Send a voice/text query to the Oracle.
     */
    sendOracle(text: string) {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify({ type: 'oracle', text }));
    }

    /**
     * Send a command (sleep, wake, blush, etc.)
     */
    sendCommand(command: string) {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify({ type: 'command', command }));
    }

    get isConnected() {
        return this.connected;
    }
}
