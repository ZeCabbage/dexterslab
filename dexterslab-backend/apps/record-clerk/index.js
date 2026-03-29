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
  }

  getWsHandler() {
    if (!this.wsHandler) {
      const wss = this.platform.wsRouter.registerPath(RecordClerkApp.manifest.wsPath);
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ error: 'Record Clerk is offline for maintenance.' }));
        ws.close();
      });
      this.wsHandler = wss;
    }
    return this.wsHandler;
  }
}
