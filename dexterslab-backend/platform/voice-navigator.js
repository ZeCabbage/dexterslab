import { bus } from '../core/context-bus.js';

export class VoiceNavigator {
  constructor(appManager, wsRouter) {
    this.appManager = appManager;
    this.wsClients = new Set();

    console.log('[Platform] Voice Navigator routing initialized');

    // Register a global WebSocket route for the Hub / Frontend layout
    const wss = wsRouter.registerPath('/ws/system');
    
    wss.on('connection', (ws) => {
      this.wsClients.add(ws);
      console.log(`[Platform][VoiceNavigator] System listener connected (total: ${this.wsClients.size})`);
      
      // Removed automatic initial connection navigation to prevent hijacking the PC browser
      // ws.send(JSON.stringify({ type: 'navigate', route }));

      ws.on('close', () => {
        this.wsClients.delete(ws);
      });
      ws.on('error', () => {
        this.wsClients.delete(ws);
      });
    });

    // ── Listen to Voice Commands ──
    bus.subscribe('voice.command', (data) => {
      this.handleVoiceCommand(data.text);
    });

    // ── Bind to App State Changes ──
    bus.subscribe('app.activated', (data) => {
      const route = this.getFrontendRouteForApp(data.appId);
      this.broadcastNavigation(route);
    });

    bus.subscribe('app.deactivated', () => {
      // Default return to Hub
      this.broadcastNavigation('/observer');
    });
  }

  getFrontendRouteForApp(appId) {
    if (!appId) return '/observer'; // Default hub route
    const app = this.appManager.getApp(appId);
    if (app && app.manifest && app.manifest.frontendRoute) {
      return app.manifest.frontendRoute;
    }
    return '/observer'; 
  }

  broadcastNavigation(route) {
    if (this.wsClients.size === 0) return;
    const packet = JSON.stringify({ type: 'navigate', route });
    for (const client of this.wsClients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(packet);
      }
    }
    console.log(`[Platform][VoiceNavigator] Broadcasted navigate -> ${route}`);
  }

  handleVoiceCommand(text) {
    if (!text) return;
    const clean = text.toLowerCase().trim();

    // Trigger matchers
    const isLaunch = clean.startsWith('open ') || clean.startsWith('launch ') || clean.startsWith('start ');
    const isClose = clean.startsWith('close application') || clean.startsWith('close app') || clean.includes('go home') || clean.includes('return to hub');

    if (isClose) {
      console.log('[Platform][VoiceNavigator] Matched CLOSE command.');
      this.appManager.deactivateDisplayApp().catch(e => console.error('Failed to deactivate app', e));
      return;
    }

    if (isLaunch) {
      // Extract target phrase (e.g. "open observer eye" -> "observer eye")
      let targetPhrase = clean;
      if (clean.startsWith('open ')) targetPhrase = clean.substring(5);
      else if (clean.startsWith('launch ')) targetPhrase = clean.substring(7);
      else if (clean.startsWith('start ')) targetPhrase = clean.substring(6);

      // Match against known app names
      const apps = this.appManager.getAllApps();
      let matchedApp = null;
      let highestScore = 0;

      for (const app of apps) {
        const appName = app.manifest.name.toLowerCase();
        
        // Simple exact phrase match or substring match
        if (appName.includes(targetPhrase) || targetPhrase.includes(appName) || targetPhrase.includes(app.manifest.id.toLowerCase().replace('-', ' '))) {
          matchedApp = app;
          break; // Good enough for direct sub-string match
        }
      }

      if (matchedApp) {
        console.log(`[Platform][VoiceNavigator] Matched LAUNCH command for app: ${matchedApp.manifest.id}`);
        this.appManager.activateDisplayApp(matchedApp.manifest.id).catch(e => console.error('Failed to activate app', e));
      } else {
        console.log(`[Platform][VoiceNavigator] No matching app found for target phrase: "${targetPhrase}"`);
      }
    }
  }
}
