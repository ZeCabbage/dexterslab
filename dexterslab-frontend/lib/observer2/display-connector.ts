import { EyeState, OracleResponse } from './types';

export class DisplayConnector {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectDelay = 1000;
    private maxReconnectDelay = 15000;
    private connected = false;
    private shouldReconnect = true;

    // Callbacks
    public onStateUpdate: ((state: EyeState) => void) | null = null;
    public onOracleResponse: ((data: OracleResponse) => void) | null = null;
    public onConnectionChange: ((state: 'connecting'|'connected'|'disconnected'|'error') => void) | null = null;

    constructor() {
        if (typeof window === 'undefined') {
            this.url = 'ws://localhost:8888/ws/observer2';
            return;
        }

        const envUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
        if (envUrl) {
            let proto = envUrl.startsWith('https') || envUrl.startsWith('wss') ? 'wss' : 'ws';
            const host = envUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/$/, '');
            // Append path if the env URL is just the origin
            const path = host.includes('/ws/observer2') ? '' : '/ws/observer2';
            this.url = `${proto}://${host}${path}`;
        } else {
            const hostname = window.location.hostname;
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
            if (isLocal) {
                this.url = 'ws://localhost:8888/ws/observer2';
            } else if (/^192\.168\.|^10\.|^100\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
                this.url = `ws://${hostname}:8888/ws/observer2`;
            } else {
                this.url = 'wss://dexterslab-api.cclottaaworld.com/ws/observer2';
            }
        }
    }

    connect(
        onStateUpdate?: (state: EyeState) => void,
        onConnectionChange?: (state: 'connecting'|'connected'|'disconnected'|'error') => void
    ) {
        if (onStateUpdate) {
            this.onStateUpdate = onStateUpdate;
        }
        if (onConnectionChange) {
            this.onConnectionChange = onConnectionChange;
        }
        
        if (this.ws?.readyState === WebSocket.OPEN) return;

        this.onConnectionChange?.('connecting');

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectDelay = 1000;
                // Redact tokens in query string if any exist
                let displayUrl = this.url;
                if (displayUrl.includes('?')) {
                    const parts = displayUrl.split('?');
                    displayUrl = `${parts[0]}?...[REDACTED]`;
                }
                console.log(`👁 Observer 2 Display Connector connected to ${displayUrl}`);
                this.onConnectionChange?.('connected');
            };

            this.ws.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'oracle_response') {
                            this.onOracleResponse?.(msg as OracleResponse);
                        } else if (msg.ix !== undefined) {
                            // EyeState packet
                            this.onStateUpdate?.(msg as EyeState);
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.onConnectionChange?.('disconnected');
                if (this.shouldReconnect) {
                    setTimeout(() => this.connect(this.onStateUpdate || undefined), this.reconnectDelay);
                    this.reconnectDelay = Math.min(this.maxReconnectDelay, this.reconnectDelay * 1.5);
                }
            };

            this.ws.onerror = () => {
                this.onConnectionChange?.('error');
                // onclose will fire after this
            };
        } catch {
            if (this.shouldReconnect) {
                setTimeout(() => this.connect(this.onStateUpdate || undefined), this.reconnectDelay);
            }
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        this.ws?.close();
        this.ws = null;
    }

    isConnected(): boolean {
        return this.connected;
    }

    sendInteraction(message: object) {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify(message));
    }
}
