import express from 'express';

export class RESTRouter {
  constructor(app) {
    this.app = app;
    console.log('[Platform] REST Router initialized');
  }

  /**
   * Registers an app's router under /api/{appId}
   */
  registerAppRoutes(appId, appRouter) {
    if (!appRouter) return;
    
    const prefix = `/api/${appId}`;
    this.app.use(prefix, appRouter);
    console.log(`[Platform][REST Router] Mounted ${appId} routes at ${prefix}`);
  }
}
