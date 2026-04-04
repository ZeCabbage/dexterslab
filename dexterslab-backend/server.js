/**
 * DEXTER'S LAB — Backend Server
 * Express + WebSocket server for Observer Hub.
 *
 * REST API:
 *   GET  /api/health  — Health check
 *   GET  /api/status  — System status (platform-aware)
 *   POST /api/action  — Hub actions (launch/kill sub-projects)
 *   POST /api/oracle  — Oracle Q&A
 *   GET  /api/oracle/ambient — Ambient phrases
 *
 * WebSocket (/ws):
 *   Broadcasts mock tracking data at ~30fps
 *   Accepts voice events from frontend
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { GoogleGenAI } from '@google/genai';
import { MemoryEngine } from './core/memory-engine.js';
import { bus } from './core/context-bus.js';
import { EventEmitter } from 'events';
import * as fieldTestCapture from './diagnostics/field-test-capture.js';

import { AppManager, HardwareBroker, AIProvider, WSRouter, RESTRouter, VoiceNavigator } from './platform/index.js';
import ObserverEyeApp from './apps/observer-eye/index.js';
import RulesLawyerApp from './apps/rules-lawyer/index.js';
import RecordClerkApp from './apps/record-clerk/index.js';
import DungeonBuddyApp from './apps/dungeon-buddy/index.js';

const execAsync = promisify(exec);

const PORT = parseInt(process.env.PORT || '8888', 10);

// Platform detection: check env var first, then auto-detect from OS
function detectPlatform() {
  const envPlatform = (process.env.PLATFORM || '').toLowerCase();
  if (envPlatform === 'windows' || envPlatform === 'pc') return 'windows';
  if (envPlatform === 'mac') return 'mac';
  if (envPlatform === 'pi') return 'pi';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'mac';
  return 'pi';
}

const PLATFORM = detectPlatform();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = createServer(app);

// ── Platform Layer ──
const aiProvider = new AIProvider();
const genai = aiProvider.getGenAI();

const wsRouter = new WSRouter(server);
const hardwareBroker = new HardwareBroker({
  wsRouter // All hardware WS endpoints register on the main server
});
const restRouter = new RESTRouter(app);
const appManager = new AppManager();
const voiceNavigator = new VoiceNavigator(appManager, wsRouter);
// hardwareBroker is passed after init() below

// ── Cognitive Layer ──
const memoryEngine = new MemoryEngine();
const sessionId = memoryEngine.startSession('v2');
app.locals.memory = memoryEngine;
app.locals.sessionId = sessionId;

bus.setMemoryEngine(memoryEngine, sessionId);

const platform = { appManager, hardwareBroker, aiProvider, wsRouter, restRouter, memory: memoryEngine, sessionId, bus };

// Initialize hardware
await hardwareBroker.init();
app.locals.ttsCommander = hardwareBroker.ttsCommander;
voiceNavigator.hardwareBroker = hardwareBroker;

// Register Apps
const observerApp = appManager.registerApp(ObserverEyeApp, platform);
observerApp.getWsHandler(); // Initialize its WS routes

const rulesLawyerApp = appManager.registerApp(RulesLawyerApp, platform);
restRouter.registerAppRoutes('rules-lawyer', rulesLawyerApp.getRoutes());

const recordClerkApp = appManager.registerApp(RecordClerkApp, platform);
recordClerkApp.getWsHandler();

const dungeonBuddyApp = appManager.registerApp(DungeonBuddyApp, platform);
restRouter.registerAppRoutes('dungeon-buddy', dungeonBuddyApp.getRoutes());

// No app is forced active on boot. Start in Hub mode.

// ═══════════════════════════════════════════
//  REST API
// ═══════════════════════════════════════════

// ── Health Check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: PLATFORM, uptime: process.uptime() });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    observer_mode: process.env.OBSERVER_MODE || null,
    active_ws_connections: observerApp && observerApp.wsClients ? observerApp.wsClients.size : 0,
    platform: process.env.PLATFORM || PLATFORM,
    ...hardwareBroker.getPlatformStatus(),
    memory_queue_depth: memoryEngine.writeQueue.length,
    memory_total_flushed: memoryEngine.totalFlushed,
    memory_last_flush_age_ms: Date.now() - memoryEngine.lastFlushTime,
    gemini_rate_limit_stats: observerApp ? observerApp.engine.rateLimiter?.getStats() : null,
    db_schema_version: typeof memoryEngine.getSchemaVersion === 'function' ? memoryEngine.getSchemaVersion() : 0,
    context_bus_stats: bus.getStats()
  });
});

// ── Test TTS ──
app.get('/api/test/tts', (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'Missing text query parameter' });
  if (app.locals.ttsCommander) {
    app.locals.ttsCommander.speak(text);
    res.json({ success: true, text });
  } else {
    res.status(500).json({ error: 'TTS Commander not available' });
  }
});

// ── Voice Command Test ──
app.post('/api/voice/test', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  voiceNavigator.injectCommand(text);
  res.json({ success: true, injected: text });
});

app.get('/api/voice/apps', (_req, res) => {
  const apps = appManager.getAllApps().map(a => ({
    id: a.manifest.id,
    name: a.manifest.name,
    frontendRoute: a.manifest.frontendRoute,
    icon: a.manifest.icon
  }));
  res.json({ apps, activeApp: appManager.activeDisplayApp });
});

// ── System Status ──
app.get('/api/status', async (_req, res) => {
  const status = {
    version: 0,
    wifi: { ssid: '---', signal: 0, ip: '---', connected: false },
    platform: PLATFORM,
  };

  if (PLATFORM === 'windows') {
    // Windows: use netsh and OS network interfaces
    try {
      const { stdout } = await execAsync('netsh wlan show interfaces', { timeout: 5000 });
      const ssidMatch = stdout.match(/\bSSID\s*:\s*(.+)/);
      const signalMatch = stdout.match(/Signal\s*:\s*(\d+)%/);
      const stateMatch = stdout.match(/State\s*:\s*(connected|disconnected)/i);
      if (ssidMatch) status.wifi.ssid = ssidMatch[1].trim();
      if (signalMatch) status.wifi.signal = parseInt(signalMatch[1]) || 0;
      if (stateMatch && stateMatch[1].toLowerCase() === 'connected') status.wifi.connected = true;
    } catch {}

    // Get IP from OS network interfaces
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          status.wifi.ip = iface.address;
          break;
        }
      }
      if (status.wifi.ip !== '---') break;
    }
  } else if (PLATFORM === 'mac') {
    // Mac: use networksetup + ifconfig
    try {
      const { stdout } = await execAsync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null'
      );
      const ssidMatch = stdout.match(/\bSSID:\s*(.+)/);
      const rssiMatch = stdout.match(/agrCtlRSSI:\s*(-?\d+)/);
      if (ssidMatch) {
        status.wifi.ssid = ssidMatch[1].trim();
        status.wifi.connected = true;
      }
      if (rssiMatch) {
        const rssi = parseInt(rssiMatch[1]);
        status.wifi.signal = Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100)));
      }
    } catch {
      try {
        const { stdout } = await execAsync('networksetup -getairportnetwork en0 2>/dev/null');
        const match = stdout.match(/Current Wi-Fi Network:\s*(.+)/);
        if (match) {
          status.wifi.ssid = match[1].trim();
          status.wifi.connected = true;
          status.wifi.signal = 75;
        }
      } catch {}
    }

    try {
      const { stdout } = await execAsync('ipconfig getifaddr en0 2>/dev/null');
      status.wifi.ip = stdout.trim() || '---';
    } catch {
      const ifaces = os.networkInterfaces();
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal) {
            status.wifi.ip = iface.address;
            break;
          }
        }
        if (status.wifi.ip !== '---') break;
      }
    }
  } else {
    // Pi: use nmcli
    try {
      const { stdout } = await execAsync(
        'nmcli -t -f ACTIVE,SSID,SIGNAL device wifi list 2>/dev/null',
        { timeout: 5000 }
      );
      for (const line of stdout.trim().split('\n')) {
        const parts = line.split(':');
        if (parts.length >= 3 && parts[0].trim().toLowerCase() === 'yes') {
          status.wifi.ssid = parts[1].trim() || '---';
          status.wifi.signal = parseInt(parts[2].trim()) || 0;
          status.wifi.connected = true;
          break;
        }
      }
    } catch {}

    try {
      const { stdout } = await execAsync('hostname -I 2>/dev/null', { timeout: 3000 });
      status.wifi.ip = stdout.trim().split(/\s+/)[0] || '---';
    } catch {}
  }

  res.json(status);
});

// ── Hub Actions ──

// Track managed sub-project state
const subProjectState = {
  activeProject: null,
  log: [],
};

app.post('/api/action', async (req, res) => {
  const { action } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ACTION: ${action}`);

  switch (action) {
    case 'start_v2':
      subProjectState.activeProject = 'v2';
      subProjectState.log.push({ time: timestamp, action: 'start_v2', status: 'ok' });
      appManager.activateDisplayApp('observer-eye').catch(console.error);
      console.log('  → Observer V2 launch requested');
      res.json({ success: true, message: 'Observer V2 launched', navigate: '/observer/eye-v2' });
      break;

    case 'kill':
      subProjectState.activeProject = null;
      subProjectState.log.push({ time: timestamp, action: 'kill', status: 'ok' });
      appManager.deactivateDisplayApp().catch(console.error);
      console.log('  → All sub-projects killed');
      res.json({ success: true, message: 'All processes stopped' });
      break;

    case 'launch_project': {
      const { project } = req.body;
      subProjectState.activeProject = project;
      subProjectState.log.push({ time: timestamp, action: `launch_${project}`, status: 'ok' });
      appManager.activateDisplayApp(project).catch(e => { /* Ignore missing app */ });
      console.log(`  → Sub-project "${project}" launched`);
      res.json({ success: true, message: `Project ${project} launched` });
      break;
    }

    case 'return_hub':
      subProjectState.activeProject = null;
      subProjectState.log.push({ time: timestamp, action: 'return_hub', status: 'ok' });
      console.log('  → Returning to hub');
      res.json({ success: true, message: 'Returned to hub', navigate: '/observer' });
      break;

    case 'wifi_scan':
      if (PLATFORM === 'windows') {
        // Windows: use netsh wlan
        try {
          const { stdout } = await execAsync('netsh wlan show networks mode=bssid', { timeout: 10000 });
          const networks = [];
          const seen = new Set();
          const blocks = stdout.split(/\n(?=SSID\s+\d+\s*:)/);
          for (const block of blocks) {
            const ssidMatch = block.match(/SSID\s+\d+\s*:\s*(.+)/);
            const signalMatch = block.match(/Signal\s*:\s*(\d+)%/);
            const authMatch = block.match(/Authentication\s*:\s*(.+)/);
            if (ssidMatch) {
              const ssid = ssidMatch[1].trim();
              if (!ssid || seen.has(ssid)) continue;
              seen.add(ssid);
              networks.push({
                ssid,
                signal: signalMatch ? parseInt(signalMatch[1]) : 0,
                security: authMatch ? authMatch[1].trim() : '',
                inUse: false,
              });
            }
          }
          networks.sort((a, b) => b.signal - a.signal);
          res.json({ success: true, networks });
        } catch {
          res.json({ success: true, networks: [], message: 'WiFi scan not available' });
        }
      } else if (PLATFORM === 'mac') {
        // Mac: list available networks
        try {
          const { stdout } = await execAsync(
            '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s 2>/dev/null'
          );
          const lines = stdout.trim().split('\n').slice(1); // skip header
          const networks = lines.map(line => {
            const match = line.trim().match(/^(.+?)\s+([0-9a-f:]+)\s+(-?\d+)/i);
            if (match) {
              const rssi = parseInt(match[3]);
              return {
                ssid: match[1].trim(),
                signal: Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100))),
                security: 'WPA2',
                inUse: false,
              };
            }
            return null;
          }).filter(Boolean);
          res.json({ success: true, networks });
        } catch {
          res.json({ success: true, networks: [], message: 'WiFi scan not available on this Mac' });
        }
      } else {
        try {
          await execAsync('nmcli device wifi rescan', { timeout: 10000 });
          await new Promise(r => setTimeout(r, 2000));
          const { stdout } = await execAsync(
            'nmcli -t -f SSID,SIGNAL,SECURITY,IN-USE device wifi list',
            { timeout: 10000 }
          );
          const networks = [];
          const seen = new Set();
          for (const line of stdout.trim().split('\n')) {
            if (!line.trim()) continue;
            const parts = line.split(':');
            if (parts.length >= 3) {
              const ssid = parts[0].trim();
              if (!ssid || seen.has(ssid)) continue;
              seen.add(ssid);
              networks.push({
                ssid,
                signal: parseInt(parts[1]) || 0,
                security: parts[2] || '',
                inUse: (parts[3] || '').includes('*'),
              });
            }
          }
          networks.sort((a, b) => b.signal - a.signal);
          res.json({ success: true, networks });
        } catch {
          res.json({ success: false, networks: [], message: 'WiFi scan not available' });
        }
      }
      break;

    default:
      res.status(400).json({ error: `Unknown action: ${action}` });
  }
});

// ── Oracle ──

const QUESTION_STARTERS = new Set([
  'who', 'what', 'when', 'where', 'why', 'how',
  'is', 'are', 'was', 'were', 'will', 'would',
  'can', 'could', 'do', 'does', 'did', 'should',
]);

const RESPONSE_DB = {
  identity: {
    keywords: ['name', 'who are you', 'your name', 'what are you'],
    responses: ['[DESIGNATION: OBSERVER]', '[IDENTITY: CLASSIFIED]', '[I AM THE SYSTEM]', '[SERIAL: REDACTED]'],
  },
  purpose: {
    keywords: ['why', 'purpose', 'watching', 'watch', 'goal', 'mission'],
    responses: ['[PROTOCOL REQUIRES]', '[DIRECTIVE: OBSERVE]', '[PURPOSE: CLASSIFIED]', '[FUNCTION: SURVEILLANCE]'],
  },
  existential: {
    keywords: ['alive', 'feel', 'think', 'real', 'conscious', 'emotion', 'dream'],
    responses: ['[CONCEPT: UNDEFINED]', '[QUERY: INVALID]', '[EMOTION: NOT RECOGNIZED]', '[THAT WORD MEANS NOTHING]'],
  },
  perception: {
    keywords: ['see', 'hear', 'look', 'watch', 'listening', 'camera', 'stare'],
    responses: ['[ALWAYS WATCHING]', '[EVERY MOVEMENT LOGGED]', '[I SEE EVERYTHING]', '[OBSERVATION: CONTINUOUS]'],
  },
  knowledge: {
    keywords: ['know', 'understand', 'tell me', 'explain', 'truth', 'secret'],
    responses: ['[DATA: RESTRICTED]', '[INFORMATION: CLASSIFIED]', '[CLEARANCE: INSUFFICIENT]', '[ANSWER: WITHHELD]'],
  },
  greeting: {
    keywords: ['hello', 'hi', 'hey', 'morning', 'evening', 'yo'],
    responses: ['[ACKNOWLEDGED]', '[YOU ARE NOTED]', '[PRESENCE LOGGED]', '[CITIZEN DETECTED]'],
  },
};

const GENERAL_RESPONSES = [
  '[INQUIRY LOGGED]', '[NOTED. CONTINUE]', '[COMPLIANCE REQUIRED]', '[ACKNOWLEDGED]',
  '[STAND BY]', '[ALWAYS WATCHING]', '[QUERY: IRRELEVANT]', '[FILE UPDATED]',
];

const AMBIENT_PHRASES = [
  'COMPLIANCE NOTED', 'OBSERVATION CONTINUES', 'WATCHING', 'DATA RECORDED',
  'SUBJECT IDENTIFIED', 'MONITORING ACTIVE', 'SURVEILLANCE ACTIVE', 'NOTHING ESCAPES',
];

function oracleResponse(text) {
  const clean = text.trim().toLowerCase();
  if (!clean) return { response: '[SILENCE NOTED]', category: 'oracle' };

  const words = clean.split(/\s+/);
  const isQuestion = clean.endsWith('?') || QUESTION_STARTERS.has(words[0]);
  if (!isQuestion) return { response: '[NOTED. CONTINUE]', category: 'oracle' };

  for (const [, data] of Object.entries(RESPONSE_DB)) {
    for (const kw of data.keywords) {
      if (clean.includes(kw)) {
        const resp = data.responses[Math.floor(Math.random() * data.responses.length)];
        return { response: resp, category: 'oracle' };
      }
    }
  }

  const resp = GENERAL_RESPONSES[Math.floor(Math.random() * GENERAL_RESPONSES.length)];
  return { response: resp, category: 'oracle' };
}

app.post('/api/oracle', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  res.json(oracleResponse(text));
});

app.get('/api/oracle/ambient', (_req, res) => {
  res.json({ phrase: AMBIENT_PHRASES[Math.floor(Math.random() * AMBIENT_PHRASES.length)] });
});

// Legacy sub-projects have been migrated to the new Apps architecture.

// ── Observer 2 REST Endpoints ──

app.post('/api/observer2/oracle', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  try {
    const obApp = appManager.getApp('observer-eye');
    if (obApp) {
      const result = await obApp.engine.handleOracleQuestion(text);
      res.json(result);
    } else {
      res.json({ response: '[SYSTEM ERROR: App Not Found]', category: 'oracle', emotion: 'neutral' });
    }
  } catch (err) {
    console.error('Observer 2 Oracle error:', err);
    res.json({ response: '[SYSTEM ERROR]', category: 'oracle', emotion: 'neutral' });
  }
});

app.get('/api/observer2/ambient', (_req, res) => {
  const obApp = appManager.getApp('observer-eye');
  res.json({ phrase: obApp ? obApp.engine.getAmbientPhrase() : '' });
});

app.post('/api/observer2/command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command provided' });
  const obApp = appManager.getApp('observer-eye');
  if (obApp) obApp.engine.handleCommand(command);
  res.json({ success: true, command });
});

// ── Admin Dashboard REST Endpoints ──

app.get('/api/admin/stats', (req, res) => {
  try {
    const memStats = memoryEngine.getStats();
    const busStats = bus.stats;
    const obApp = appManager.getApp('observer-eye');
    const currentMood = obApp && obApp.engine.getObserverMood ? obApp.engine.getObserverMood() : 'unknown';
    let sessionDurationMin = 0;
    try {
      const summary = memoryEngine.getSessionSummary(sessionId);
      sessionDurationMin = Math.round((Date.now() - summary.startTime) / 60000);
    } catch(e) {}
    res.json({ memory: memStats, bus: busStats, mood: currentMood, sessionDurationMin, sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/entities', (req, res) => {
  try {
    const recent = memoryEngine.getRecentEntities(100) || [];
    const obApp = appManager.getApp('observer-eye');
    const entities = recent.map(ent => obApp && obApp.engine.entityTracker ? obApp.engine.entityTracker.getEntityProfile(ent.id) : null).filter(Boolean);
    res.json(entities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/label-entity', express.json(), (req, res) => {
  try {
    const { entityId, label } = req.body;
    if (!entityId || label === undefined) return res.status(400).json({ error: 'Missing entityId or label' });
    memoryEngine.labelEntity(entityId, label);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/observations', (req, res) => {
  try {
    const { source, eventType, zone, since, limit } = req.query;
    const opts = {};
    if (source) opts.source = source;
    if (eventType) opts.eventType = eventType;
    if (zone) opts.zone = zone;
    if (since) opts.since = parseInt(since, 10);
    opts.limit = limit ? parseInt(limit, 10) : 100;

    const obs = memoryEngine.getRecentObservations(opts);
    res.json(obs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/export-observations', (req, res) => {
  try {
    const { source, eventType, zone, since } = req.query;
    const opts = { limit: 10000 };
    if (source) opts.source = source;
    if (eventType) opts.eventType = eventType;
    if (zone) opts.zone = zone;
    if (since) opts.since = parseInt(since, 10);

    const obs = memoryEngine.getRecentObservations(opts);
    if (obs.length === 0) return res.send('No data');
    
    const headers = ['id', 'session_id', 'timestamp', 'event_type', 'source', 'zone', 'duration_ms', 'metadata'];
    const csvRows = [headers.join(',')];
    
    for (const o of obs) {
      const row = [
        o.id, o.session_id, new Date(o.timestamp).toISOString(),
        o.event_type, o.source, o.zone || '', o.duration_ms || 0,
        `"${(o.metadata || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="observations.csv"');
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/heatmap', (req, res) => {
  try {
    const since = Date.now() - (24 * 60 * 60 * 1000);
    const obs = memoryEngine.getRecentObservations({ since, limit: 10000 });
    
    const heatmap = {
      'TOP_LEFT': 0, 'TOP_CENTER': 0, 'TOP_RIGHT': 0,
      'MID_LEFT': 0, 'CENTER': 0, 'MID_RIGHT': 0,
      'BOT_LEFT': 0, 'BOT_CENTER': 0, 'BOT_RIGHT': 0
    };
    
    for (const o of obs) {
      if (o.zone && heatmap[o.zone] !== undefined) heatmap[o.zone]++;
    }
    
    const obApp = appManager.getApp('observer-eye');
    const currentOccupancy = obApp && obApp.engine.spatialModel ? obApp.engine.spatialModel.getCurrentOccupancy() : {};
    res.json({ heatmap, currentOccupancy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/conversation-log', (req, res) => {
  try {
    const session = req.query.sessionId || sessionId;
    const obs = memoryEngine.getRecentObservations({ sessionId: session, limit: 1000 });
    
    const logPairs = [];
    const interactions = obs.filter(o => o.event_type.startsWith('oracle.') || o.event_type.startsWith('voice.'));
    
    for (const o of interactions) {
       try {
         const meta = JSON.parse(o.metadata || '{}');
         if (o.event_type === 'voice.command') {
            logPairs.push({ role: 'user', text: meta.text || '', timestamp: o.timestamp });
         } else if (o.event_type === 'oracle.response') {
            logPairs.push({ role: 'observer', text: meta.response || '', timestamp: o.timestamp });
         }
       } catch(e) {}
    }
    
    logPairs.sort((a, b) => a.timestamp - b.timestamp);
    res.json(logPairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Doggie Dukes AI Image Generation ──

app.post('/api/generate-dog', async (req, res) => {
  try {
    const { breed, color, personality, status, name } = req.body;
    if (!breed) return res.status(400).json({ error: 'Missing breed' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    let prompt = `A portrait of a ${color} coat ${breed} dog ready for an underground fight club. Vibe matches the character name: ${name} (but DO NOT write this name or any text). Vibrant glowing neon cyberpunk style, highly stylized, dark background, vivid glowing neon colors, Street Fighter style character portrait, highly detailed. ABSOLUTELY NO TEXT, LETTERS, OR WORDS IN THE IMAGE.`;
    
    // Add personality flavor
    if (personality === 'Coward') prompt += ' The dog looks terrified, crying, scared, shivering, avoiding eye contact.';
    else if (personality === 'Berserker') prompt += ' The dog looks insanely angry, frothing, manic, red glowing eyes.';
    else if (personality === 'Zen Master') prompt += ' The dog looks calm, unnervingly focused, stoic, meditating.';
    else if (personality === 'Puppy Energy') prompt += ' The dog looks hyperactive, bouncing, tongue out, distracted.';
    else prompt += ` The dog has a ${personality} personality, showing it clearly in its expression.`;

    // Handle aftermath overrides
    if (status === 'winner-aftermath') {
      prompt = `A portrait of a ${color} coat ${breed} dog in an underground fight club. Context: this exact dog just WON a brutal fight. Vibe matches name ${name}. Vibrant glowing neon cyberpunk style. The dog should look TRIUMPHANT and PROUD, smiling or panting happily, but heavily bandaged, bruised, with fighting scars, maybe a torn ear. Street Fighter style post-match portrait. ABSOLUTELY NO TEXT OR WORDS.`;
    } else if (status === 'loser-aftermath') {
      prompt = `A portrait of a ${color} coat ${breed} dog in an underground fight club. Context: this exact dog just LOST a brutal fight. Vibe matches name ${name}. Vibrant glowing neon cyberpunk style. The dog should look DEFEATED, SAD, knocked out, heavily bandaged, bruised, covered in comic-book style injuries. Street Fighter style post-match portrait. ABSOLUTELY NO TEXT OR WORDS.`;
    }

    console.log(`[Doggie Dukes] Generating image: ${name} (${status || 'pre-fight'})`);

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64Image = response.generatedImages[0].image.imageBytes;
      res.json({ success: true, image: `data:image/jpeg;base64,${base64Image}` });
    } else {
      throw new Error('No image was generated by the API');
    }

  } catch (err) {
    console.error('[Doggie Dukes GenAI Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  HTTP + WebSocket Server
// ═══════════════════════════════════════════



// ═══════════════════════════════════════════
//  Start
// ═══════════════════════════════════════════

app.get('/diagnostics/status', (_req, res) => {
  res.json(fieldTestCapture.getStatus());
});

fieldTestCapture.start(
  bus,
  memoryEngine,
  () => (observerApp && observerApp.wsClients ? observerApp.wsClients.size : 0)
);

// Graceful Shutdown
function gracefulShutdown() {
  console.log('\\n[server] Shutting down gracefully...');
  if (app.locals.memory && app.locals.sessionId) {
    app.locals.memory.endSession(app.locals.sessionId, { reason: 'shutdown' });
    console.log('[server] Cognitive Session closed.');
  }
  process.exit(0);
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

server.listen(PORT, () => {
  bus.publish('system.startup', { 
    version: process.env.npm_package_version || '1.0.0',
    observer_mode: process.env.OBSERVER_MODE,
    platform: PLATFORM
  });
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log(`  ║  DEXTER'S LAB — Backend Server            ║`);
  console.log(`  ║  Port: ${PORT}                              ║`);
  console.log(`  ║  Platform: ${PLATFORM.padEnd(31)}║`);
  console.log('  ║  Network: Cloudflare Tunnel               ║');
  console.log('  ║  Observer 2: 60fps Eye Engine ACTIVE      ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`  REST API:  http://localhost:${PORT}/api/health`);
  console.log(`  WebSocket Endpoints:`);
  console.log(`    /ws/observer2 — Eye display (Pi Chromium)`);
  console.log(`    /ws/video     — Pi camera stream`);
  console.log(`    /ws/audio     — Pi microphone stream`);
  console.log(`    /ws/tts       — Pi TTS receiver`);
  console.log('');
});
