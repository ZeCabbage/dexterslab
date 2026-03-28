import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let logStream = null;
let logFilePath = null;
let eventCount = 0;
let eventsLast10s = 0;
let eventTypeCounts = {};
let metricsInterval = null;
let contextBusRef = null;
let originalPublish = null;

function logEvent(data) {
  if (logStream) {
    logStream.write(JSON.stringify(data) + '\n');
  }
}

function start(contextBus, memoryEngine, getWsConnectionCount) {
  if (logStream) return;

  const timestamp = Date.now();
  logFilePath = path.join(__dirname, `field-test-${timestamp}.ndjson`);
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  // Hook into bus.publish to intercept all events seamlessly
  contextBusRef = contextBus;
  if (contextBus && typeof contextBus.publish === 'function') {
    originalPublish = contextBus.publish.bind(contextBus);
    contextBus.publish = (eventName, payload) => {
      eventCount++;
      eventsLast10s++;
      eventTypeCounts[eventName] = (eventTypeCounts[eventName] || 0) + 1;

      let payloadStr = '';
      try {
        payloadStr = JSON.stringify(payload) || '';
      } catch (e) {
        payloadStr = '[Circular or Error]';
      }
      
      logEvent({
        seq: eventCount,
        ts: Date.now(),
        ts_hr: process.hrtime.bigint().toString(),
        event: eventName,
        payload_size_bytes: payloadStr.length,
        payload_summary: payloadStr.substring(0, 100)
      });
      
      // Call original publish
      return originalPublish(eventName, payload);
    };
  }

  metricsInterval = setInterval(() => {
    let memoryDepth = 0;
    if (memoryEngine && typeof memoryEngine.getQueueDepth === 'function') {
      memoryDepth = memoryEngine.getQueueDepth();
    } else if (memoryEngine && memoryEngine.writeQueue) {
      memoryDepth = memoryEngine.writeQueue.length;
    }
    
    let busPending = 0;
    if (contextBus && typeof contextBus.getStats === 'function') {
      const stats = contextBus.getStats();
      busPending = stats && stats.pending !== undefined ? stats.pending : 0;
    }

    logEvent({
      seq: eventCount + 1,
      ts: Date.now(),
      type: 'metrics_snapshot',
      data: {
        events_total: eventCount,
        events_last_10s: eventsLast10s,
        event_type_counts: { ...eventTypeCounts },
        nodejs_memory_mb: process.memoryUsage().heapUsed / 1048576,
        nodejs_uptime_seconds: process.uptime(),
        active_ws_connections: getWsConnectionCount(),
        memory_queue_depth: memoryDepth,
        context_bus_pending: busPending
      }
    });

    eventsLast10s = 0; // Reset 10s counter
  }, 10000);
}

function stop() {
  if (metricsInterval) clearInterval(metricsInterval);
  if (contextBusRef && originalPublish) {
    contextBusRef.publish = originalPublish;
  }
  if (logStream) {
    logStream.end();
  }
  const result = { totalEvents: eventCount, logFilePath: logFilePath ? path.basename(logFilePath) : null };
  
  logStream = null;
  logFilePath = null;
  eventCount = 0;
  eventsLast10s = 0;
  eventTypeCounts = {};
  metricsInterval = null;
  contextBusRef = null;
  originalPublish = null;

  return result;
}

function getStatus() {
  return {
    capture_active: !!logStream,
    log_file: logFilePath ? path.basename(logFilePath) : null,
    events_captured: eventCount
  };
}

export { start, stop, getStatus };
