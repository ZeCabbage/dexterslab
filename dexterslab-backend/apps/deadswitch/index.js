import express from 'express';

export default class DeadswitchApp {
  static manifest = {
    id: 'deadswitch',
    name: 'Deadswitch',
    target: 'pi',
    mode: 'offline',  // Runs locally on Pi — no PC backend needed
    hardware: ['display', 'mic', 'tts'],
    wsPath: '/ws/deadswitch',
    frontendRoute: '/observer/deadswitch',
    icon: '☢',
    priority: 3,
    aliases: ['dead switch', 'survival', 'oracle', 'bunker']
  };

  constructor(platform) {
    this.platform = platform;
    this.wsClients = new Set();
    this.subscriptions = [];
    this.state = {
      status: 'idle',        // idle | listening | retrieving | generating | speaking | error
      query: '',
      answer: '',
      sources: [],
      ollamaOnline: false,
      knowledgeFiles: 0,
      lastQuery: null,
    };
  }

  /* ── lifecycle ────────────────────────────────── */

  async onActivateDisplay() {
    console.log('[Deadswitch] Activated — offline survival oracle');
    this.broadcastState();
  }

  async onDeactivateDisplay() {
    console.log('[Deadswitch] Deactivated');
    this.state.status = 'idle';
    this.state.query = '';
    this.state.answer = '';
  }

  /* ── WebSocket handler ────────────────────────── */

  getWsHandler() {
    if (!this.wsHandler) {
      this.wsHandler = (ws) => {
        this.wsClients.add(ws);
        // Send current state immediately on connect
        ws.send(JSON.stringify({ type: 'state', data: this.state }));

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw);
            this.handleWsMessage(msg, ws);
          } catch (err) {
            console.error('[Deadswitch] WS parse error:', err.message);
          }
        });

        ws.on('close', () => {
          this.wsClients.delete(ws);
        });
      };
    }
    return this.wsHandler;
  }

  handleWsMessage(msg, ws) {
    switch (msg.type) {
      case 'query':
        // Manual text query from frontend
        this.state.query = msg.text;
        this.state.status = 'retrieving';
        this.broadcastState();
        // The Pi daemon handles actual RAG — this is just state relay
        break;

      case 'pi-state':
        // State update from the Pi daemon
        Object.assign(this.state, msg.data);
        this.broadcastState();
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  broadcastState() {
    const payload = JSON.stringify({ type: 'state', data: this.state });
    for (const ws of this.wsClients) {
      try { ws.send(payload); } catch (e) { /* client gone */ }
    }
  }

  /* ── Express router ───────────────────────────── */

  getRoutes() {
    const router = express.Router();

    router.get('/status', (req, res) => {
      res.json({
        app: 'deadswitch',
        status: this.state.status,
        ollamaOnline: this.state.ollamaOnline,
        knowledgeFiles: this.state.knowledgeFiles,
        lastQuery: this.state.lastQuery,
      });
    });

    return router;
  }

  /* ── cleanup ──────────────────────────────────── */

  destroy() {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions = [];
    for (const ws of this.wsClients) {
      try { ws.close(); } catch (e) { /* ignore */ }
    }
    this.wsClients.clear();
  }
}
