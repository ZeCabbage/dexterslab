import { WebSocketServer } from 'ws';

export class WSRouter {
  constructor(server) {
    this.server = server;
    this.servers = new Map(); // path -> wss instance

    // Default connection handling
    this.server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

      const wss = this.servers.get(pathname);

      if (wss) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        console.warn(`[Platform][WS Router] Rejected connection attempt on unknown path: ${request.url}`);
        socket.destroy();
      }
    });

    console.log('[Platform] WebSocket Router initialized');
  }

  /**
   * Registers a websocket server on a specific path.
   * E.g., '/ws/observer2'
   */
  registerPath(path) {
    if (this.servers.has(path)) {
      throw new Error(`[Platform][WS Router] Path ${path} is already registered`);
    }

    const wss = new WebSocketServer({ noServer: true });
    this.servers.set(path, wss);
    console.log(`[Platform][WS Router] Registered path: ${path}`);
    return wss;
  }
}
