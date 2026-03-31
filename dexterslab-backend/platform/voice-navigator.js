import { bus } from '../core/context-bus.js';

/**
 * VoiceNavigator — Central voice command router for the Dexterslab pipeline.
 *
 * Listens to `voice.command` on the Context Bus and determines if the
 * transcript is a navigation intent (open/close app) or should be passed
 * through to the active app's conversational handler.
 *
 * Navigation commands are intercepted BEFORE any app-level STT subscriber
 * sees them, using bus priority (VoiceNavigator subscribes first).
 *
 * Supported intents:
 *   OPEN:  "open [app]", "launch [app]", "start [app]"
 *   CLOSE: "close application", "close app", "go home", "return to hub"
 *
 * On match, the VoiceNavigator:
 *   1. Activates/deactivates the app via AppManager
 *   2. Broadcasts { type:'navigate', route } over /ws/system to the frontend
 *   3. Optionally speaks TTS confirmation via the HardwareBroker
 */
export class VoiceNavigator {
  constructor(appManager, wsRouter, hardwareBroker = null) {
    this.appManager = appManager;
    this.hardwareBroker = hardwareBroker;
    this.wsClients = new Set();

    // Track the last command to prevent duplicate processing
    this._lastCommandText = '';
    this._lastCommandTime = 0;
    this._DEDUP_MS = 2000; // Ignore identical commands within 2s

    console.log('[Platform] Voice Navigator initialized');

    // ── Register /ws/system WebSocket path ──
    const wss = wsRouter.registerPath('/ws/system');

    wss.on('connection', (ws) => {
      this.wsClients.add(ws);
      console.log(`[VoiceNav] System listener connected (total: ${this.wsClients.size})`);

      ws.on('close', () => this.wsClients.delete(ws));
      ws.on('error', () => this.wsClients.delete(ws));
    });

    // ── Listen to voice.command on the Context Bus ──
    bus.subscribe('voice.command', (data) => {
      this.handleVoiceCommand(data.text);
    });

    // ── React to AppManager state changes ──
    bus.subscribe('app.activated', (data) => {
      const route = this._routeForApp(data.appId);
      this._broadcast(route);
    });

    bus.subscribe('app.deactivated', () => {
      this._broadcast('/observer');
    });
  }

  // ══════════════════════════════════════════
  //  Voice Command Parser
  // ══════════════════════════════════════════

  /**
   * Returns true if this transcript was consumed as a navigation command.
   * Apps should check `bus.lastVoiceWasNavigation` (set here) to decide
   * whether to pass the transcript to their conversational handler.
   */
  handleVoiceCommand(text) {
    if (!text) return false;
    const clean = text.toLowerCase().trim();
    if (!clean) return false;

    // ── Dedup ──
    const now = Date.now();
    if (clean === this._lastCommandText && (now - this._lastCommandTime) < this._DEDUP_MS) {
      return false;
    }

    // ── Match CLOSE intent ──
    if (this._isCloseCommand(clean)) {
      this._lastCommandText = clean;
      this._lastCommandTime = now;

      console.log('[VoiceNav] ✓ CLOSE command recognized');
      this._markAsNavigation();
      this.appManager.deactivateDisplayApp().catch(e =>
        console.error('[VoiceNav] Failed to deactivate:', e)
      );
      this._speakConfirmation('Returning to hub.');
      return true;
    }

    // ── Match OPEN intent ──
    const targetPhrase = this._extractOpenTarget(clean);
    if (targetPhrase) {
      const matched = this._matchApp(targetPhrase);
      if (matched) {
        this._lastCommandText = clean;
        this._lastCommandTime = now;

        console.log(`[VoiceNav] ✓ OPEN command recognized → ${matched.manifest.id}`);
        this._markAsNavigation();
        this.appManager.activateDisplayApp(matched.manifest.id).catch(e =>
          console.error('[VoiceNav] Failed to activate:', e)
        );
        this._speakConfirmation(`Opening ${matched.manifest.name}.`);
        return true;
      }
    }

    return false; // Not a navigation command — let apps handle it
  }

  // ═══ Intent Matchers ═══

  _isCloseCommand(text) {
    const CLOSE_PATTERNS = [
      'close application', 'close app', 'close the app', 'close the application',
      'go home', 'go back', 'go to hub', 'return to hub', 'return home',
      'back to hub', 'exit', 'exit application', 'exit app',
    ];
    return CLOSE_PATTERNS.some(p => text.includes(p));
  }

  _extractOpenTarget(text) {
    const OPEN_PREFIXES = ['open ', 'launch ', 'start ', 'switch to ', 'show '];
    for (const prefix of OPEN_PREFIXES) {
      if (text.startsWith(prefix)) {
        return text.substring(prefix.length).trim();
      }
    }
    return null;
  }

  // ═══ App Matching (fuzzy) ═══

  /**
   * Matches a spoken target phrase to a registered app using multiple strategies:
   *  1. Exact name match
   *  2. App ID match (with dashes replaced by spaces)
   *  3. Voice aliases defined in manifests
   *  4. Substring containment
   *  5. Word-overlap scoring as a fallback
   */
  _matchApp(targetPhrase) {
    const apps = this.appManager.getAllApps();
    const target = targetPhrase.toLowerCase().replace(/the /g, '');

    // Strategy 1 & 2: Exact or ID match
    for (const app of apps) {
      const name = app.manifest.name.toLowerCase();
      const idName = app.manifest.id.replace(/-/g, ' ');
      if (name === target || idName === target) return app;
    }

    // Strategy 3: Voice aliases (e.g. "eye" → observer-eye)
    const VOICE_ALIASES = {
      'observer-eye': ['eye', 'observer', 'observer eye', 'eye v2', 'observer v2', 'i v2', 'i v two', 'i b two', 'observer i'],
      'record-clerk':  ['record clerk', 'clerk', 'records', 'dandelion', 'record', 'vinyl'],
      'rules-lawyer':  ['rules lawyer', 'rules', 'lawyer', 'dnd', 'd&d', 'rule'],
      'dungeon-buddy': ['dungeon buddy', 'dungeon', 'buddy', 'character', 'characters'],
    };

    for (const [appId, aliases] of Object.entries(VOICE_ALIASES)) {
      if (aliases.some(a => target.includes(a) || a.includes(target))) {
        const app = this.appManager.getApp(appId);
        if (app) return app;
      }
    }

    // Strategy 4: Substring containment
    for (const app of apps) {
      const name = app.manifest.name.toLowerCase();
      const idName = app.manifest.id.replace(/-/g, ' ');
      if (name.includes(target) || target.includes(name) ||
          idName.includes(target) || target.includes(idName)) {
        return app;
      }
    }

    // Strategy 5: Word overlap scoring
    const targetWords = new Set(target.split(/\s+/));
    let bestApp = null;
    let bestScore = 0;

    for (const app of apps) {
      const nameWords = app.manifest.name.toLowerCase().split(/\s+/);
      let score = 0;
      for (const w of nameWords) {
        if (targetWords.has(w)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestApp = app;
      }
    }

    // Require at least 1 word overlap
    return bestScore >= 1 ? bestApp : null;
  }

  // ═══ Navigation Broadcasting ═══

  _routeForApp(appId) {
    if (!appId) return '/observer';
    const app = this.appManager.getApp(appId);
    return (app?.manifest?.frontendRoute) || '/observer';
  }

  _broadcast(route) {
    if (this.wsClients.size === 0) return;
    const packet = JSON.stringify({ type: 'navigate', route });
    for (const client of this.wsClients) {
      if (client.readyState === 1) client.send(packet);
    }
    console.log(`[VoiceNav] Broadcast navigate → ${route} (${this.wsClients.size} clients)`);
  }

  // ═══ Side-effects ═══

  _markAsNavigation() {
    // Publish a bus event so apps can check if the voice command was consumed
    bus.publish('voice.navigation', { consumed: true, timestamp: Date.now() });
  }

  _speakConfirmation(text) {
    if (!this.hardwareBroker) return;
    // Speak as system (bypass app TTS claim for navigation confirmations)
    if (this.hardwareBroker.ttsCommander?.isConnected()) {
      this.hardwareBroker.ttsCommander.speak(text);
    }
  }

  // ═══ REST test endpoint helper ═══

  /** Called from server.js to inject a manual voice command for testing */
  injectCommand(text) {
    console.log(`[VoiceNav] Manual inject: "${text}"`);
    bus.publish('voice.command', { text, timestamp: Date.now(), source: 'manual' });
  }
}
