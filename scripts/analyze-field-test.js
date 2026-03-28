const fs = require('fs');
const path = require('path');

const reportDir = process.argv[2];
if (!reportDir) {
  console.error("Usage: node analyze-field-test.js [report-dir]");
  process.exit(1);
}

const pcLogs = [];
const edgeLogs = [];

try {
  const files = fs.readdirSync(reportDir);
  const pcFiles = files.filter(f => f.startsWith('field-test-') && !f.includes('edge') && f.endsWith('.ndjson'));
  const edgeFiles = files.filter(f => f.startsWith('field-test-edge') && f.endsWith('.ndjson'));

  for (const file of pcFiles) {
    const content = fs.readFileSync(path.join(reportDir, file), 'utf8');
    content.split('\n').filter(Boolean).forEach(line => {
      try { pcLogs.push(JSON.parse(line)); } catch(e) {}
    });
  }

  for (const file of edgeFiles) {
    const content = fs.readFileSync(path.join(reportDir, file), 'utf8');
    content.split('\n').filter(Boolean).forEach(line => {
      try { edgeLogs.push(JSON.parse(line)); } catch(e) {}
    });
  }
} catch (e) {
  console.log("Error reading logs:", e.message);
}

// ── PC METRICS ──
let pcTotalEvents = 0;
let pcFirstTs = 0;
let pcLastTs = 0;
let pcEventTypeCounts = {};
let pcMaxEvents10s = 0;
let pcMinEvents10s = Infinity;
let pcPeakMemoryMb = 0;
let pcPeakMemoryQueue = 0;
let pcPeakContextBus = 0;
const activeWsSnaps = [];

// Process PC Logs
for (const log of pcLogs) {
  if (log.type === 'metrics_snapshot') {
    const d = log.data || {};
    pcTotalEvents = Math.max(pcTotalEvents, d.events_total || 0);
    pcMaxEvents10s = Math.max(pcMaxEvents10s, d.events_last_10s || 0);
    pcMinEvents10s = Math.min(pcMinEvents10s, d.events_last_10s || 0);
    pcPeakMemoryMb = Math.max(pcPeakMemoryMb, d.nodejs_memory_mb || 0);
    pcPeakMemoryQueue = Math.max(pcPeakMemoryQueue, d.memory_queue_depth || 0);
    pcPeakContextBus = Math.max(pcPeakContextBus, d.context_bus_pending || 0);
    if (d.active_ws_connections !== undefined) {
      activeWsSnaps.push(d.active_ws_connections);
    }
    // Update event type counts from the latest snapshot
    if (d.event_type_counts && Object.keys(d.event_type_counts).length > 0) {
      pcEventTypeCounts = d.event_type_counts;
    }
  } else {
    if (!pcFirstTs) pcFirstTs = log.ts;
    pcLastTs = log.ts;
  }
}
if (pcMinEvents10s === Infinity) pcMinEvents10s = 0;
let pcDurationSec = (pcLastTs - pcFirstTs) / 1000.0;
if (pcDurationSec <= 0) pcDurationSec = 1;
const pcEventsPerSec = pcTotalEvents / pcDurationSec;

// ── EDGE METRICS ──
let edgeTotalVideo = 0;
let edgeTotalAudio = 0;
let edgeTotalTTS = 0;
let edgeFirstTs = 0;
let edgePeakCpu = 0;
let edgePeakMemMb = 0;
const edgeFpsSnaps = [];
let edgeFramesBelow10 = 0;
let edgeDurationSec = 0;

for (const log of edgeLogs) {
  if (!edgeFirstTs) edgeFirstTs = log.ts;
  
  if (log.type === 'metrics_snapshot') {
    const d = log.data || {};
    edgeTotalVideo = Math.max(edgeTotalVideo, d.video_frames_sent_total || 0);
    edgeTotalAudio = Math.max(edgeTotalAudio, d.audio_chunks_sent_total || 0);
    edgeTotalTTS = Math.max(edgeTotalTTS, d.tts_commands_received_total || 0);
    if (d.cpu_percent !== null) edgePeakCpu = Math.max(edgePeakCpu, d.cpu_percent || 0);
    if (d.memory_mb !== null) edgePeakMemMb = Math.max(edgePeakMemMb, d.memory_mb || 0);
    
    if (d.video_fps_actual !== undefined) {
      edgeFpsSnaps.push(d.video_fps_actual);
      if (d.video_fps_actual < 10) edgeFramesBelow10++;
    }
  }
}
if (edgeFirstTs > 0 && edgeLogs.length > 0) {
  edgeDurationSec = (edgeLogs[edgeLogs.length - 1].ts - edgeFirstTs) / 1000.0;
  if (edgeDurationSec <= 0) edgeDurationSec = 1;
}
const edgeAudioRate = edgeDurationSec > 0 ? (edgeTotalAudio / edgeDurationSec) : 0;
const edgeAvgFps = edgeDurationSec > 0 ? (edgeTotalVideo / edgeDurationSec) : 0;

let fpsStdDev = 0;
if (edgeFpsSnaps.length > 0) {
  const avg = edgeFpsSnaps.reduce((a, b) => a + b, 0) / edgeFpsSnaps.length;
  const variance = edgeFpsSnaps.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / edgeFpsSnaps.length;
  fpsStdDev = Math.sqrt(variance);
}

const timeDelta = (pcFirstTs > 0 && edgeFirstTs > 0) ? Math.abs(pcFirstTs - edgeFirstTs) : null;

// Output
console.log("FROM PC CAPTURE LOG:");
console.log(`Total events captured: ${pcTotalEvents}`);
console.log(`Duration of capture: ${pcDurationSec.toFixed(2)} seconds`);
console.log(`Events per second (average): ${pcEventsPerSec.toFixed(2)}`);
console.log(`Count per event type:`);
for (const [evt, cnt] of Object.entries(pcEventTypeCounts)) {
  console.log(`  ${evt}: ${cnt}`);
}
console.log(`Max events in any single 10-second window: ${pcMaxEvents10s}`);
console.log(`Min events in any single 10-second window: ${pcMinEvents10s}`);
console.log(`Peak nodejs_memory_mb recorded: ${pcPeakMemoryMb.toFixed(2)}`);
console.log(`Peak memory_queue_depth recorded: ${pcPeakMemoryQueue}`);
console.log(`Peak context_bus_pending recorded: ${pcPeakContextBus}`);
console.log(`Active WS connections at each snapshot: ${activeWsSnaps.join(', ')}`);
console.log("");
console.log("FROM EDGE DAEMON CAPTURE LOG:");
console.log(`Total video frames sent: ${edgeTotalVideo}`);
console.log(`Actual average video FPS: ${edgeAvgFps.toFixed(2)}`);
console.log(`FPS standard deviation across 10-second windows: ${fpsStdDev.toFixed(2)}`);
console.log(`Total audio chunks sent: ${edgeTotalAudio}`);
console.log(`Actual audio chunk rate: ${edgeAudioRate.toFixed(2)}`);
console.log(`Total TTS commands received: ${edgeTotalTTS}`);
console.log(`Peak CPU percent recorded: ${edgePeakCpu ? edgePeakCpu.toFixed(2) : 'null'}`);
console.log(`Peak memory MB recorded: ${edgePeakMemMb ? edgePeakMemMb.toFixed(2) : 'null'}`);
console.log("");
console.log("CROSS-LOG CORRELATION:");
console.log(`Time delta between first PC event and first edge daemon event: ${timeDelta !== null ? timeDelta + ' ms' : 'N/A'}`);
console.log(`Count of 10-second windows where edge FPS was below 10: ${edgeFramesBelow10}`);
console.log("");
console.log("RAW METRICS COMPLETE \u2014 READY FOR ANALYSIS");
