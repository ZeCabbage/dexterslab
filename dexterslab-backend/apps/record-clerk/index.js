import { RecordClerkEngine } from '../../record-clerk/engine.js';
import { GoogleGenAI } from '@google/genai';

export default class RecordClerkApp {
  static manifest = {
    id: 'record-clerk',
    name: 'The Record Clerk',
    target: 'pi',
    hardware: ['camera', 'mic', 'tts', 'display'],
    wsPath: '/ws/recordclerk',
    frontendRoute: '/record-clerk',
    icon: '⊚',
    priority: 8
  };

  constructor(platform) {
    this.platform = platform;
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.engine = new RecordClerkEngine({ genai });
    this.wsHandler = null;
    this.wsClients = new Set();
    this.subscriptions = [];
  }

  async onActivateDisplay() {
    console.log('[RecordClerk] Activating...');
    this.platform.hardwareBroker.claimTTS(RecordClerkApp.manifest.id);

    this.subscriptions.push(
      this.platform.hardwareBroker.subscribeVideo((jpegBuffer) => {
        this.engine.processFrame(jpegBuffer);
      })
    );

    let lastNavTimestamp = 0;
    this.subscriptions.push(
      this.platform.bus.subscribe('voice.navigation', (data) => {
        lastNavTimestamp = data.timestamp || Date.now();
      })
    );

    this.subscriptions.push(
      this.platform.hardwareBroker.subscribeSTT(async (text) => {
        const elapsed = Date.now() - lastNavTimestamp;
        if (elapsed < 500) return;

        const result = await this.engine.handleConversation(text);
        if (result && result.response) {
          this.platform.hardwareBroker.speak(RecordClerkApp.manifest.id, result.response);
        }
      })
    );

    this.engine.start((state) => {
      if (this.wsClients.size === 0) return;
      const packet = JSON.stringify(state);
      for (const client of this.wsClients) {
        if (client.readyState === 1) client.send(packet);
      }
    });
  }

  async onDeactivateDisplay() {
    console.log('[RecordClerk] Deactivating...');
    this.engine.stop();
    this.platform.hardwareBroker.releaseTTS(RecordClerkApp.manifest.id);
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions = [];
  }

  getWsHandler() {
    if (!this.wsHandler) {
      const wss = this.platform.wsRouter.registerPath(RecordClerkApp.manifest.wsPath);
      wss.on('connection', (ws) => {
        this.wsClients.add(ws);
        console.log(`⊚ [RecordClerk] Client connected (total: ${this.wsClients.size})`);
        ws.on('close', () => {
          this.wsClients.delete(ws);
          console.log(`⊚ [RecordClerk] Client disconnected (remaining: ${this.wsClients.size})`);
        });
        ws.on('error', () => this.wsClients.delete(ws));
      });

      // Auto-activate/deactivate based on display client connections
      this.platform.appManager.wsAutoActivate(RecordClerkApp.manifest.id, wss);

      this.wsHandler = wss;
    }
    return this.wsHandler;
  }
}
