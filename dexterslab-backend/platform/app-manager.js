import { bus } from '../core/context-bus.js';

export class AppManager {
  constructor() {
    this.apps = new Map(); // appId -> App instance
    this.activeDisplayApp = null; // The single app that currently owns the display/TTS
  }

  /**
   * Register a new app instance.
   * The app should have a static manifest property and implement:
   *  - async activate()
   *  - async deactivate()
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
    console.log(`[Platform] Registered App: ${manifest.name} (${manifest.id})`);
    
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
}
