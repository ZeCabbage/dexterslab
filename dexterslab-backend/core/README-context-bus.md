# The Dexterslab Context Bus

The Context Bus (`context-bus.js`) is the central nervous system for inter-component communication across the entire Dexterslab Hub architecture. Built upon the Node `EventEmitter`, it implements a loosely-bound PUB/SUB namespace.

## Integration Pattern

This is the standard baseline implementation for injecting sub-project listeners logically outside of individual system execution tracks.

### Subscribing to Global Events
```javascript
import { bus } from '../core/context-bus.js';

// React to Observer seeing someone:
bus.subscribe('presence.detected', (payload) => {
  console.log(`Entity detected in ${payload.zone} at ${payload.timestamp}`);
  // inbox_buddy might pause background tasks here
  // rules_lawyer might prepare conversational context
});

// Wildcards are supported:
bus.subscribe('voice.*', (payload, originalType) => {
   if (originalType === 'voice.silence') {
     console.log('Room went quiet.');
   }
});
```

### Emitting Custom Sub-Project Events
To circumvent strict taxonomy validation designed for Core systems, prefix custom events using the reserved `app.` generic scope:

```javascript
// Publish sub-project events:
bus.publish('app.inbox_buddy.scan_complete', {
  emails_processed: 47,
  duration_ms: 1200
});
```

All `publish()` triggers are automatically, safely routed backward into the `MemoryEngine` (`sqlite3`) maintaining an active timestamp record logic loop available for data queries.
