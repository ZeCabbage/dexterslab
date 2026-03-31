import { EventEmitter } from 'events';

// Taxonomy of allowed events
const ALLOWED_TAXONOMY = new Set([
  'presence.detected',
  'presence.departed',
  'presence.sustained',
  'presence.zone_changed',
  'voice.command',
  'voice.navigation',
  'voice.partial',
  'voice.silence',
  'oracle.query',
  'oracle.response',
  'oracle.error',
  'system.startup',
  'system.shutdown',
  'system.pi_connected',
  'system.pi_disconnected',
  'system.health_degraded',
  'app.activated',
  'app.deactivated',
  'app.error',
  'hardware.camera.claimed',
  'hardware.camera.released',
  'hardware.mic.claimed',
  'hardware.mic.released',
  'hardware.tts.claimed',
  'hardware.tts.released'
]);

export class ContextBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    
    this.stats = {
      totalPublished: 0,
      activeSubscribers: 0,
      startTime: Date.now(),
      lastEventTimestamp: 0
    };

    this.pendingDispatches = 0;
    this.MAX_PENDING_DISPATCHES = 100;
    this.droppedEventCount = 0;
    this.DROPPABLE_PREFIXES = ['presence.', 'motion.'];
    this.NEVER_DROP_PREFIXES = ['voice.', 'oracle.', 'security.', 'system.'];
  }

  setMemoryEngine(memory, sessionId) {
    this._memory = memory;
    this._sessionId = sessionId;
  }

  _isValidType(eventType) {
    if (eventType.startsWith('app.')) return true;
    return ALLOWED_TAXONOMY.has(eventType);
  }

  publish(eventType, payload = {}) {
    if (!this._isValidType(eventType)) {
      console.warn(`[ContextBus] Dropping unregistered event: ${eventType}`);
      return;
    }

    const now = Date.now();
    this.stats.totalPublished++;
    this.stats.lastEventTimestamp = now;

    // 1. Log to SQLite memory asynchronously
    setImmediate(() => {
      if (this._memory && this._sessionId) {
        try {
          this._memory.queueObservation({
            source: 'context_bus',
            eventType: eventType,
            metadata: payload,
            sessionId: this._sessionId
          });
        } catch (e) {
          console.error('[ContextBus] DB logging failed:', e.message);
        }
      }
    });

    // 2. Dispatch to subscribers asynchronously
    this._emitAsync(eventType, payload);

    // 3. Dispatch to wildcard namespace (e.g. 'presence.*')
    const [domain] = eventType.split('.');
    if (domain) {
      this._emitAsync(`${domain}.*`, payload, eventType);
    }
  }

  _emitAsync(eventName, payload, originalEventType = eventName) {
    const listeners = this.listeners(eventName);
    if (listeners.length === 0) return;

    const isDroppable = this.DROPPABLE_PREFIXES.some(prefix => originalEventType.startsWith(prefix));
    const isNeverDrop = this.NEVER_DROP_PREFIXES.some(prefix => originalEventType.startsWith(prefix));

    if (isDroppable && !isNeverDrop) {
      if (this.pendingDispatches >= this.MAX_PENDING_DISPATCHES) {
        this.droppedEventCount++;
        
        if (this.droppedEventCount % 50 === 0) {
          console.warn(
            `[ContextBus] Backpressure: dropped ${this.droppedEventCount} ` +
            `events total. Current pending: ${this.pendingDispatches}`
          );
        }
        return; 
      }
    }

    this.pendingDispatches++;

    setImmediate(() => {
      try {
        for (const handler of listeners) {
          try {
            handler(payload, originalEventType);
          } catch (error) {
            console.error(`[ContextBus] Subscriber error on ${eventName}:`, error.message);
          }
        }
      } finally {
        this.pendingDispatches--;
      }
    });
  }

  subscribe(eventType, handler) {
    this.on(eventType, handler);
    this._updateSubscriberCount();
    
    return () => {
      this.off(eventType, handler);
      this._updateSubscriberCount();
    };
  }

  subscribeOnce(eventType, handler) {
    let fired = false;
    const wrapper = (payload, actualType) => {
      if (fired) return;
      fired = true;
      this.off(eventType, wrapper);
      try {
        handler(payload, actualType);
      } catch (error) {
        console.error(`[ContextBus] Subscriber error on ${eventType}:`, error.message);
      }
      this._updateSubscriberCount();
    };
    
    this.on(eventType, wrapper);
    this._updateSubscriberCount();
  }

  getEventHistory(eventType, limitMinutes) {
    if (!this._memory) return [];
    return this._memory.getRecentObservations({
      source: 'context_bus',
      eventType: eventType,
      limitMinutes: limitMinutes
    });
  }

  _updateSubscriberCount() {
    this.stats.activeSubscribers = this.eventNames().reduce((sum, name) => sum + this.listenerCount(name), 0);
  }

  getBusStats() {
    const elapsedMinutes = (Date.now() - this.stats.startTime) / 60000;
    const epm = elapsedMinutes > 0 ? this.stats.totalPublished / elapsedMinutes : 0;
    
    return {
      total_published: this.stats.totalPublished,
      active_subscribers: this.stats.activeSubscribers,
      events_per_minute: Math.round(epm * 100) / 100,
      last_event_timestamp: this.stats.lastEventTimestamp
    };
  }
  getStats() {
    return {
      pending_dispatches: this.pendingDispatches,
      dropped_events_total: this.droppedEventCount,
      registered_listeners: this.eventNames().length,
    };
  }
}

export const bus = new ContextBus();
