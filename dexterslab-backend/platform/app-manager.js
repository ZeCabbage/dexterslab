import { bus } from '../core/context-bus.js';

export class AppManager {
  constructor() {
    this.apps = new Map(); // appId -> App instance
    this.activeDisplayApp = null; // The single app that currently owns the display/TTS
  }

  /**
   * Register a new app instance.
   * The app should have a static manifest property and implement:
   *  - async onActivateDisplay()
   *  - async onDeactivateDisplay()
   *  - getRoutes() (optional)
   *  - getWsHandler() (optional)
   */
  registerApp(AppClass, platformServices) {
    const manifest = AppClass.manifest;
    if (!manifest || !manifest.id) {
      throw new Error('App must define a static manifest with an id');
    }

    if (this.apps.has(manifest.id)) {
      throw new Error(`App with id ${manifest.id} is already registered`);
    }

    const appInstance = new AppClass(platformServices);
    appInstance.manifest = manifest;
    
    this.apps.set(manifest.id, appInstance);
    console.log(`[Platform] Registered App: ${manifest.name} (${manifest.id}) [${manifest.mode || 'online'}]`);
    
    return appInstance;
  }

  getApp(appId) {
    return this.apps.get(appId);
  }

  getAllApps() {
    return Array.from(this.apps.values());
  }

  /**
   * Activates an app to claim exclusive hardware (like the display or TTS).
   * Deactivates the currently active app if there is one.
   */
  async activateDisplayApp(appId) {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App ${appId} not found`);

    if (this.activeDisplayApp === appId) return; // Already active

    if (this.activeDisplayApp) {
      await this.deactivateDisplayApp();
    }

    console.log(`[Platform] Activating Display App: ${app.manifest.name}`);
    
    if (typeof app.onActivateDisplay === 'function') {
      await app.onActivateDisplay();
    }
    
    this.activeDisplayApp = appId;
    
    bus.publish('app.activated', { appId, name: app.manifest.name });
  }

  /**
   * Deactivates the currently active display app.
   */
  async deactivateDisplayApp() {
    if (!this.activeDisplayApp) return;

    const app = this.apps.get(this.activeDisplayApp);
    if (app) {
      console.log(`[Platform] Deactivating Display App: ${app.manifest.name}`);
      if (typeof app.onDeactivateDisplay === 'function') {
        await app.onDeactivateDisplay();
      }
      bus.publish('app.deactivated', { appId: this.activeDisplayApp, name: app.manifest.name });
    }

    this.activeDisplayApp = null;
  }

  /**
   * Wire a WebSocketServer to auto-activate/deactivate an ONLINE app.
   * 
   * This is the canonical activation mechanism for online apps:
   *   - First display client connects  → app activates (claims TTS, subscribes to sensors)
   *   - Last display client disconnects → app deactivates (releases hardware)
   *   - The WebSocket connection IS the user being on the page — no REST calls needed.
   *
   * This should NOT be used for offline apps (Deadswitch, Offline Observer),
   * which run locally on the Pi without a PC backend connection.
   * Offline apps are activated via REST (SSH commands to Pi).
   */
  wsAutoActivate(appId, wss) {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`wsAutoActivate: App ${appId} not found`);

    wss.on('connection', (ws) => {
      // First display client → activate this app (guard against concurrent calls)
      if (this.activeDisplayApp !== appId && this._activatingApp !== appId) {
        this._activatingApp = appId;
        console.log(`[Platform] WS-Activate: ${app.manifest.name} (display client connected)`);
        this.activateDisplayApp(appId).catch(err => {
          console.error(`[Platform] WS-Activate failed for ${appId}:`, err.message);
        }).finally(() => {
          this._activatingApp = null;
        });
      }

      ws.on('close', () => {
        // Grace period: wait 500ms for page refresh reconnections before deactivating
        setTimeout(() => {
          const remaining = app.wsClients ? app.wsClients.size : 0;
          if (remaining === 0 && this.activeDisplayApp === appId) {
            console.log(`[Platform] WS-Deactivate: ${app.manifest.name} (no display clients)`);
            this.deactivateDisplayApp().catch(err => {
              console.error(`[Platform] WS-Deactivate failed for ${appId}:`, err.message);
            });
          }
        }, 500);
      });
    });

    console.log(`[Platform] WS-AutoActivate wired for: ${app.manifest.name}`);
  }
}
