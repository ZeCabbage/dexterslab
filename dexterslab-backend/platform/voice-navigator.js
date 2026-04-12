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
 *
 * === Alias Matching Strategy ===
 *
 * To prevent "offline observer" matching the "observer" alias for observer-eye,
 * aliases are sorted LONGEST FIRST and matched using word-boundary logic.
 * This ensures more specific phrases always win over shorter substrings.
 *
 * "Virtual routes" are apps that exist in the frontend only (no backend App
 * class). They can be navigated to by voice but skip AppManager activation.
 * Example: offline-observer.
 */
export class VoiceNavigator {
  constructor(appManager, wsRouter, hardwareBroker = null) {
    this.appManager = appManager;
    this.hardwareBroker = hardwareBroker;
    this.wsClients = new Set();

    // Track the last command to prevent duplicate processing
    this._lastCommandText = '';
    this._lastCommandTime = 0;
    this._DEDUP_MS = 1200; // Ignore identical commands within 1.2s

    // ── Voice Alias Registry ──
    // Each entry maps an appId to its voice aliases and route.
    // Aliases are matched longest-first to prevent ambiguity.
    // 'virtual' flag means no AppManager app — just route broadcast.
    this._voiceRegistry = [
      {
        appId: 'observer-eye',
        virtual: false,
        route: '/observer/eye-v2',
        aliases: [
          'observer version two', 'observer version 2', 'observer v two',
          'observer v2', 'observer v 2', 'observer eye', 'eye v2',
          'eye v two', 'eye v 2', 'i v two', 'i v2', 'eye',
        ],
      },
      {
        appId: 'offline-observer',
        virtual: true,   // No backend App class — frontend-only
        route: '/offline-observer.html',
        aliases: [
          'offline observer', 'offline mode', 'observer offline',
          'observer version one', 'observer version 1', 'observer v1',
          'observer v one', 'offline',
        ],
      },
      {
        appId: 'rules-lawyer',
        virtual: false,
        route: '/observer/rules-lawyer',
        aliases: [
          'rules lawyer', 'rules', 'lawyer', 'dnd', 'd&d', 'rule',
        ],
      },
      {
        appId: 'record-clerk',
        virtual: false,
        route: '/record-clerk',
        aliases: [
          'record clerk', 'dandelion records', 'dandelion', 'record',
          'clerk', 'records', 'vinyl',
        ],
      },
      {
        appId: 'deadswitch',
        virtual: false,
        route: '/observer/deadswitch',
        aliases: [
          'dead switch', 'deadswitch', 'survival', 'bunker', 'doomsday',
        ],
      },
    ];

    // Pre-sort: build a flat list of (alias, entry) pairs sorted by alias
    // length descending so longest aliases match first.
    this._sortedAliases = [];
    for (const entry of this._voiceRegistry) {
      for (const alias of entry.aliases) {
        this._sortedAliases.push({ alias: alias.toLowerCase(), entry });
      }
    }
    this._sortedAliases.sort((a, b) => b.alias.length - a.alias.length);

    console.log('[Platform] Voice Navigator initialized');
    console.log(`[VoiceNav] ${this._voiceRegistry.length} apps registered, ${this._sortedAliases.length} voice aliases loaded`);

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

    // Note: VoiceNavigator broadcasts routes directly via _broadcast().
    // Online apps auto-activate via WS connection — no need to listen to
    // app.activated/deactivated events for navigation broadcasting.
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
      // Directly broadcast navigation to hub (don't rely solely on bus event)
      this._broadcast('/observer');
      // TTS confirmation disabled — causes speaker→mic feedback loop
      // this._speakConfirmation('COPY');
      return true;
    }

    // ── Match OPEN intent ──
    const targetPhrase = this._extractOpenTarget(clean);
    if (targetPhrase) {
      const matched = this._matchApp(targetPhrase);
      if (matched) {
        this._lastCommandText = clean;
        this._lastCommandTime = now;

        console.log(`[VoiceNav] ✓ OPEN command recognized → ${matched.appId} (virtual=${matched.virtual})`);
        this._markAsNavigation();

        // All apps: broadcast route navigation to frontend.
        // Online apps will auto-activate via WS connection when the page loads.
        // Virtual/offline apps just need the route broadcast.
        this._broadcast(matched.route);

        // TTS confirmation disabled — causes speaker→mic feedback loop
        // this._speakConfirmation('COPY');
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
    if (CLOSE_PATTERNS.some(p => text.includes(p))) return true;

    // Also match "close [app name]", "stop [app name]", "kill [app name]"
    const CLOSE_PREFIXES = ['close ', 'stop ', 'kill ', 'shut down '];
    for (const prefix of CLOSE_PREFIXES) {
      if (text.startsWith(prefix)) {
        const target = text.substring(prefix.length).trim();
        // If the target matches any known app, treat as close
        if (this._matchApp(target)) return true;
      }
    }
    return false;
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

  // ═══ App Matching (longest-alias-first, word-boundary aware) ═══

  /**
   * Matches a spoken target phrase to a registered app using the pre-sorted
   * alias list. Longer aliases are checked first to prevent "offline observer"
   * from matching the shorter "observer" alias of a different app.
   *
   * Matching strategies (in order):
   *  1. Exact alias match
   *  2. Alias contained in target phrase (word-boundary)
   *  3. Word overlap scoring for fuzzy fallback
   */
  _matchApp(targetPhrase) {
    const target = targetPhrase.toLowerCase().replace(/\bthe\b/g, '').trim();

    // ── Strategy 1 & 2: Exact or contains (longest-first) ──
    // Because _sortedAliases is sorted longest-first, "offline observer"
    // will always be checked before "observer".
    for (const { alias, entry } of this._sortedAliases) {
      // Strategy 1: Exact match
      if (target === alias) {
        // For non-virtual apps, verify they exist in AppManager
        if (!entry.virtual && !this.appManager.getApp(entry.appId)) continue;
        return entry;
      }

      // Strategy 2: Alias appears in target as whole word(s)
      // Use word-boundary regex to avoid partial-word matches
      try {
        const regex = new RegExp(`\\b${this._escapeRegex(alias)}\\b`, 'i');
        if (regex.test(target)) {
          if (!entry.virtual && !this.appManager.getApp(entry.appId)) continue;
          return entry;
        }
      } catch (e) {
        // If regex fails (special chars), fall back to includes
        if (target.includes(alias)) {
          if (!entry.virtual && !this.appManager.getApp(entry.appId)) continue;
          return entry;
        }
      }
    }

    // ── Strategy 3: App ID match (with dashes replaced by spaces) ──
    for (const entry of this._voiceRegistry) {
      const idName = entry.appId.replace(/-/g, ' ');
      if (target === idName || target.includes(idName)) {
        if (!entry.virtual && !this.appManager.getApp(entry.appId)) continue;
        return entry;
      }
    }

    // ── Strategy 4: Word overlap scoring (fuzzy fallback) ──
    const targetWords = new Set(target.split(/\s+/));
    let bestEntry = null;
    let bestScore = 0;

    for (const entry of this._voiceRegistry) {
      // Check each alias for word overlap
      for (const alias of entry.aliases) {
        const aliasWords = alias.toLowerCase().split(/\s+/);
        let score = 0;
        for (const w of aliasWords) {
          if (targetWords.has(w)) score++;
        }
        // Normalize by alias word count for specificity
        const normalized = aliasWords.length > 0 ? score / aliasWords.length : 0;
        if (score > 0 && normalized > bestScore) {
          bestScore = normalized;
          bestEntry = entry;
        }
      }
    }

    // Require at least 50% word overlap to count
    if (bestScore >= 0.5 && bestEntry) {
      if (bestEntry.virtual || this.appManager.getApp(bestEntry.appId)) {
        return bestEntry;
      }
    }

    return null;
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ═══ Navigation Broadcasting ═══

  _routeForApp(appId) {
    if (!appId) return '/observer';

    // Check voice registry first (handles virtual routes)
    const entry = this._voiceRegistry.find(e => e.appId === appId);
    if (entry) return entry.route;

    // Fall back to app manifest
    const app = this.appManager.getApp(appId);
    return (app?.manifest?.frontendRoute) || '/observer';
  }

  _broadcast(route) {
    const packet = JSON.stringify({ type: 'navigate', route });
    let sent = 0;
    for (const client of this.wsClients) {
      if (client.readyState === 1) {
        client.send(packet);
        sent++;
      }
    }
    console.log(`[VoiceNav] Broadcast navigate → ${route} (${sent}/${this.wsClients.size} clients)`);

    // Retry twice more with short delays to handle momentary WS reconnects
    if (this.wsClients.size > 0) {
      setTimeout(() => {
        for (const client of this.wsClients) {
          if (client.readyState === 1) client.send(packet);
        }
      }, 300);
      setTimeout(() => {
        for (const client of this.wsClients) {
          if (client.readyState === 1) client.send(packet);
        }
      }, 800);
    }
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
