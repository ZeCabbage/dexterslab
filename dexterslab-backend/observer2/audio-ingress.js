import { WebSocketServer } from 'ws';

export class AudioIngressServer {
  constructor(port, eventEmitter) {
    this.port = port;
    this.events = eventEmitter;
    this.wss = null;
    this.activeClient = null;
    this.formatNegotiated = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });
        
        this.wss.on('listening', () => {
          resolve();
        });

        this.wss.on('connection', (ws, req) => {
          const ip = req.socket.remoteAddress;

          if (this.activeClient) {
            console.warn(`[AudioIngress] Rejected duplicate audio client from ${ip}`);
            ws.close(1008, 'Audio stream already active');
            return;
          }

          this.activeClient = ws;
          this.formatNegotiated = false;
          console.log(`[AudioIngress] Pi audio client connected from ${ip}`);
          
          ws.send(JSON.stringify({
            type: 'format_requirements',
            sampleRate: 16000,
            channels: 1,
            format: 'S16LE'
          }));

          this.events.emit('client_connected');

          ws.on('message', (data) => {
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

            // data is raw PCM buffer
            this.events.emit('audio_frame', data);
          });

          ws.on('close', () => {
            if (this.activeClient === ws) {
              this.activeClient = null;
              console.log('[AudioIngress] Pi audio client disconnected');
              this.events.emit('client_disconnected');
            }
          });

          ws.on('error', (err) => {
            console.error(`[AudioIngress] WebSocket error:`, err);
            if (this.activeClient === ws) {
              this.activeClient = null;
              console.log('[AudioIngress] Pi audio client disconnected on error');
              this.events.emit('client_disconnected');
            }
          });
        });

        this.wss.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.activeClient) {
        this.activeClient.close();
        this.activeClient = null;
      }
      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isClientConnected() {
    return this.activeClient !== null && this.activeClient.readyState === 1; // 1 = OPEN
  }
}
