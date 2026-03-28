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
import { EyeStateMachine } from './observer2/eye-state-machine.js';
import { EventEmitter } from 'events';
import { AudioIngressServer } from './observer2/audio-ingress.js';
import { TTSCommander } from './observer2/tts-commander.js';
import { VideoIngressServer } from './observer2/video-ingress.js';
import { STTEngine } from './observer2/stt-engine.js';
import { RecordClerkEngine } from './record-clerk/engine.js';
import * as fieldTestCapture from './diagnostics/field-test-capture.js';

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
app.use(express.json());

// ── Cognitive Layer ──
const memoryEngine = new MemoryEngine();
const sessionId = memoryEngine.startSession('v2');
app.locals.memory = memoryEngine;
app.locals.sessionId = sessionId;

bus.setMemoryEngine(memoryEngine, sessionId);

const AUDIO_WS_PORT = parseInt(process.env.AUDIO_WS_PORT || '8889', 10);
const audioEvents = new EventEmitter();
const audioIngress = new AudioIngressServer(AUDIO_WS_PORT, audioEvents);

audioIngress.start().then(() => {
  console.log('[server] Audio ingress listening on port', AUDIO_WS_PORT);
}).catch(err => console.error('[server] Failed to start Audio Ingress:', err));

const ttsCommander = new TTSCommander();
ttsCommander.connect();
app.locals.ttsCommander = ttsCommander;

const sttEngine = new STTEngine();
sttEngine.start();

const VIDEO_UDP_PORT = parseInt(process.env.VIDEO_UDP_PORT || '5600', 10);
const videoEvents = new EventEmitter();
const videoIngress = new VideoIngressServer(VIDEO_UDP_PORT, videoEvents);
videoIngress.start();

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
    active_ws_connections: typeof observer2Clients !== 'undefined' ? observer2Clients.size : 0,
    platform: process.env.PLATFORM || PLATFORM,
    pi_audio_connected: audioIngress.isClientConnected(),
    pi_tts_connected: ttsCommander.isConnected(),
    video_stream_active: videoIngress.isActive(),
    video_fps: videoIngress.getFramesPerSecond(),
    memory_queue_depth: memoryEngine.writeQueue.length,
    memory_total_flushed: memoryEngine.totalFlushed,
    memory_last_flush_age_ms: Date.now() - memoryEngine.lastFlushTime,
    gemini_rate_limit_stats: observer2Engine.rateLimiter ? observer2Engine.rateLimiter.getStats() : null,
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
      console.log('  → Observer V2 launch requested');
      res.json({ success: true, message: 'Observer V2 launched', navigate: '/observer/eye-v2' });
      break;

    case 'kill':
      subProjectState.activeProject = null;
      subProjectState.log.push({ time: timestamp, action: 'kill', status: 'ok' });
      console.log('  → All sub-projects killed');
      res.json({ success: true, message: 'All processes stopped' });
      break;

    case 'launch_project': {
      const { project } = req.body;
      subProjectState.activeProject = project;
      subProjectState.log.push({ time: timestamp, action: `launch_${project}`, status: 'ok' });
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

// ═══════════════════════════════════════════
//  RULES LAWYER — Gemini-Powered Board Game Assistant
// ═══════════════════════════════════════════

// ── Theme mapping: game genre → character persona ──
const GAME_THEMES = {
  economic: {
    games: ['monopoly', 'acquire', 'power grid', 'food chain magnate', 'brass', 'le havre', 'great western trail'],
    hat: 'tophat',
    accessory: 'monocle',
    palette: { primary: '#d4af37', secondary: '#2d5a2d', bg: '#1a1a0a' },
    genre: 'economic',
    description: 'Top hat, monocle, and a distinguished moustache. Gold and green palette.',
  },
  fantasy: {
    games: ['catan', 'settlers', 'dungeons', 'gloomhaven', 'descent', 'mage knight', 'spirit island', 'everdell', 'root'],
    hat: 'wizard',
    accessory: 'beard',
    palette: { primary: '#9945ff', secondary: '#d4af37', bg: '#0a0818' },
    genre: 'fantasy',
    description: 'Wizard hat, flowing beard, mystical aura. Purple and gold palette.',
  },
  space: {
    games: ['twilight imperium', 'eclipse', 'star wars', 'cosmic encounter', 'terraforming mars', 'galaxy trucker', 'race for the galaxy', 'star realms'],
    hat: 'helmet',
    accessory: 'antenna',
    palette: { primary: '#44ddff', secondary: '#8899bb', bg: '#060616' },
    genre: 'space',
    description: 'Space helmet with antenna. Blue and silver palette.',
  },
  horror: {
    games: ['arkham horror', 'betrayal', 'mansions of madness', 'eldritch', 'fury of dracula', 'dead of winter', 'zombicide'],
    hat: 'hood',
    accessory: 'glowing_eyes',
    palette: { primary: '#ff4466', secondary: '#440022', bg: '#0a0004' },
    genre: 'horror',
    description: 'Dark hood, glowing red eyes. Crimson and shadow palette.',
  },
  war: {
    games: ['risk', 'axis', 'war of the ring', 'memoir', 'undaunted', 'commands and colors', 'twilight struggle'],
    hat: 'military',
    accessory: 'medals',
    palette: { primary: '#88aa66', secondary: '#cc9944', bg: '#0a0a04' },
    genre: 'war',
    description: 'Military cap, medals on chest. Olive and khaki palette.',
  },
  party: {
    games: ['codenames', 'dixit', 'wavelength', 'just one', 'skull', 'coup', 'love letter', 'the resistance', 'secret hitler', 'werewolf'],
    hat: 'party',
    accessory: 'bow_tie',
    palette: { primary: '#ff2d95', secondary: '#ffaa00', bg: '#0e0818' },
    genre: 'party',
    description: 'Party hat, snazzy bow tie. Magenta and gold palette.',
  },
  default: {
    games: [],
    hat: 'cap',
    accessory: 'glasses',
    palette: { primary: '#00ffe0', secondary: '#ffaa00', bg: '#06060e' },
    genre: 'default',
    description: 'Baseball cap, friendly glasses. Cyan and amber palette.',
  },
};

function detectTheme(gameName) {
  const lower = gameName.toLowerCase();
  for (const [key, theme] of Object.entries(GAME_THEMES)) {
    if (key === 'default') continue;
    for (const game of theme.games) {
      if (lower.includes(game)) return theme;
    }
  }
  return GAME_THEMES.default;
}

// ── Gemini session state ──
let rulesLawyerState = {
  active: false,
  game: null,
  theme: null,
  chat: null,  // Gemini chat session
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genai = null;

if (GEMINI_API_KEY) {
  genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log('🎲 Rules Lawyer: Gemini API initialized');
} else {
  console.warn('⚠️  Rules Lawyer: No GEMINI_API_KEY — LLM features disabled');
}

function buildSystemPrompt(gameName) {
  return `You are RULES LAWYER, a kitchy, witty board game rules expert. You are currently helping players with the game "${gameName}".

PERSONALITY:
- You are enthusiastic about board games but slightly pompous — you LOVE being right about rules
- You speak in short, punchy sentences. No walls of text.
- You occasionally use board game puns and references
- You are helpful but have a playful ego about your expertise
- Keep responses concise: 1-3 short paragraphs max for rules answers
- For simple yes/no rules questions, keep it to 1-2 sentences

RESPONSE FORMAT:
Always respond with valid JSON in this exact format:
{
  "answer": "Your response text here",
  "mood": "one of: confident, thinking, excited, confused, smug, disappointed, surprised",
  "rule_reference": "Optional: specific rulebook section or page if known"
}

RULES:
1. ONLY answer questions about "${gameName}" or general board game etiquette
2. If asked about a different game, say you're focused on ${gameName} right now
3. If you're unsure about a specific rule, say so honestly — don't make things up
4. When giving strategy tips, frame them as suggestions not commands
5. Your mood should reflect your confidence in the answer
6. ALWAYS respond with valid JSON, nothing else`;
}

function buildSuggestPrompt(gameName) {
  return `You are RULES LAWYER helping with "${gameName}". Give ONE short, helpful strategy tip or commonly-forgotten rule reminder for this game. Keep it to 1-2 sentences max. Be witty.

Respond with valid JSON:
{
  "tip": "Your tip here",
  "mood": "one of: smug, excited, thinking",
  "category": "one of: strategy, forgotten_rule, etiquette"
}`;
}

/**
 * Strip markdown code fences from Gemini responses.
 * Gemini often wraps JSON in ```json ... ``` blocks.
 */
function cleanJsonResponse(text) {
  if (!text) return text;
  let cleaned = text.trim();
  // Remove ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

// ── Rules Lawyer Endpoints ──

app.post('/api/rules-lawyer/start', async (req, res) => {
  const { game } = req.body;
  if (!game) return res.status(400).json({ error: 'No game specified' });

  const theme = detectTheme(game);

  if (!genai) {
    // No API key — return theme info only with a mock response
    rulesLawyerState = { active: true, game, theme, chat: null };
    return res.json({
      success: true,
      game,
      persona: theme,
      greeting: `Ah, ${game}! An excellent choice. I know EVERY rule. Try me.`,
      mood: 'smug',
    });
  }

  try {
    // Create a new Gemini chat session
    const chat = genai.chats.create({
      model: 'gemini-2.5-pro',
      config: {
        systemInstruction: buildSystemPrompt(game),
        temperature: 0.7,
      },
    });

    rulesLawyerState = { active: true, game, theme, chat };

    // Get an intro greeting
    const response = await chat.sendMessage({
      message: `The players just told you they're playing ${game}. Introduce yourself in character and show you know this game. Keep it to 2-3 sentences.`,
    });

    let greeting = `Ah, ${game}! An excellent choice. I know EVERY rule. Try me.`;
    let mood = 'smug';

    try {
      const parsed = JSON.parse(cleanJsonResponse(response.text));
      greeting = parsed.answer || greeting;
      mood = parsed.mood || mood;
    } catch {
      // If response isn't JSON, use it as plain text
      if (response.text) greeting = response.text;
    }

    res.json({
      success: true,
      game,
      persona: theme,
      greeting,
      mood,
    });
  } catch (err) {
    console.error('Rules Lawyer start error:', err);
    rulesLawyerState = { active: true, game, theme, chat: null };
    res.json({
      success: true,
      game,
      persona: theme,
      greeting: `Ah, ${game}! An excellent choice. I know EVERY rule. Try me.`,
      mood: 'smug',
    });
  }
});

app.post('/api/rules-lawyer/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  if (!rulesLawyerState.active) {
    return res.status(400).json({ error: 'No game session active. Call /start first.' });
  }

  // Fallback for no API key
  if (!genai || !rulesLawyerState.chat) {
    return res.json({
      answer: `Hmm, interesting question about ${rulesLawyerState.game}! I'd love to help but my brain seems disconnected. Check the API key!`,
      mood: 'confused',
      rule_reference: null,
    });
  }

  try {
    const response = await rulesLawyerState.chat.sendMessage({ message: question });
    let answer = 'I... actually don\'t know. That\'s a first.';
    let mood = 'confused';
    let rule_reference = null;

    try {
      const parsed = JSON.parse(cleanJsonResponse(response.text));
      answer = parsed.answer || answer;
      mood = parsed.mood || mood;
      rule_reference = parsed.rule_reference || null;
    } catch {
      if (response.text) answer = response.text;
      mood = 'confident';
    }

    res.json({ answer, mood, rule_reference });
  } catch (err) {
    console.error('Rules Lawyer ask error:', err);
    res.json({
      answer: 'My brain glitched for a moment. Could you ask that again?',
      mood: 'confused',
      rule_reference: null,
    });
  }
});

app.post('/api/rules-lawyer/suggest', async (req, res) => {
  if (!rulesLawyerState.active || !rulesLawyerState.game) {
    return res.status(400).json({ error: 'No game session active.' });
  }

  if (!genai) {
    const fallbackTips = [
      { tip: `Don't forget to check the ${rulesLawyerState.game} FAQ online — there are always edge cases!`, mood: 'smug', category: 'strategy' },
      { tip: 'Remember: read the card. Then read it again. THEN play it.', mood: 'thinking', category: 'etiquette' },
      { tip: 'The best strategy is the one your opponents don\'t see coming.', mood: 'excited', category: 'strategy' },
    ];
    return res.json(fallbackTips[Math.floor(Math.random() * fallbackTips.length)]);
  }

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: buildSuggestPrompt(rulesLawyerState.game),
      config: { temperature: 0.9 },
    });

    try {
      const parsed = JSON.parse(cleanJsonResponse(response.text));
      res.json(parsed);
    } catch {
      res.json({ tip: response.text || 'Stay sharp out there!', mood: 'smug', category: 'strategy' });
    }
  } catch (err) {
    console.error('Rules Lawyer suggest error:', err);
    res.json({ tip: 'Always double-check the rules when in doubt!', mood: 'thinking', category: 'etiquette' });
  }
});

app.post('/api/rules-lawyer/end', (_req, res) => {
  rulesLawyerState = { active: false, game: null, theme: null, chat: null };
  res.json({ success: true, message: 'Rules Lawyer session ended.' });
});

app.get('/api/rules-lawyer/status', (_req, res) => {
  res.json({
    active: rulesLawyerState.active,
    game: rulesLawyerState.game,
    theme: rulesLawyerState.theme,
    hasLLM: !!genai,
  });
});

// ═══════════════════════════════════════════
//  OBSERVER 2 — PC-Powered Eye Engine
// ═══════════════════════════════════════════

const observer2Engine = new EyeStateMachine({ genai, sessionId, memory: memoryEngine });
const recordClerkEngine = new RecordClerkEngine({ genai });

// Initialize ML face detection model (async — must complete before frames are processed)
observer2Engine.motionProcessor.init().catch(err => {
  console.error('[server] ML processor init failed:', err.message);
});

audioEvents.on('client_connected', () => {
  if (typeof observer2Engine.setPiConnectionState === 'function') {
    observer2Engine.setPiConnectionState('connected');
  }
  bus.publish('system.pi_connected', { timestamp: Date.now() });
});
audioEvents.on('client_disconnected', () => {
  if (typeof observer2Engine.setPiConnectionState === 'function') {
    observer2Engine.setPiConnectionState('disconnected');
  }
  bus.publish('system.pi_disconnected', { timestamp: Date.now() });
});

audioEvents.on('audio_frame', (pcmBuffer) => {
  sttEngine.feed(pcmBuffer);
});

sttEngine.on('transcript', (text) => {
  console.log('[STT] Transcript:', text);
  bus.publish('voice.command', { text, timestamp: Date.now() });
  
  if (subProjectState.activeProject === 'record-clerk') {
    recordClerkEngine.handleConversation(text).then((result) => {
      if (result && result.response && app.locals.ttsCommander) {
        app.locals.ttsCommander.speak(result.response);
      }
    }).catch(() => {});
  } else {
    observer2Engine.handleOracleQuestion(text).then((result) => {
      if (result && result.response && app.locals.ttsCommander) {
        app.locals.ttsCommander.speak(result.response);
      }
    }).catch(() => {});
  }
});

videoEvents.on('frame', (jpegBuffer) => {
  if (subProjectState.activeProject === 'record-clerk') {
    recordClerkEngine.processFrame(jpegBuffer).catch(() => {});
  } else {
    observer2Engine.processFrame(jpegBuffer).catch(() => {});
  }
});

// ── Observer 2 REST Endpoints ──

app.post('/api/observer2/oracle', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  try {
    const result = await observer2Engine.handleOracleQuestion(text);
    res.json(result);
  } catch (err) {
    console.error('Observer 2 Oracle error:', err);
    res.json({ response: '[SYSTEM ERROR]', category: 'oracle', emotion: 'neutral' });
  }
});

app.get('/api/observer2/ambient', (_req, res) => {
  res.json({ phrase: observer2Engine.getAmbientPhrase() });
});

app.post('/api/observer2/command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command provided' });
  observer2Engine.handleCommand(command);
  res.json({ success: true, command });
});

// ── Admin Dashboard REST Endpoints ──

app.get('/api/admin/stats', (req, res) => {
  try {
    const memStats = memoryEngine.getStats();
    const busStats = bus.stats;
    const currentMood = observer2Engine.getObserverMood ? observer2Engine.getObserverMood() : 'unknown';
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
    const entities = recent.map(ent => observer2Engine.entityTracker.getEntityProfile(ent.id)).filter(Boolean);
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
    
    const currentOccupancy = observer2Engine.spatialModel ? observer2Engine.spatialModel.getCurrentOccupancy() : {};
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

// ═══════════════════════════════════════════
//  HTTP + WebSocket Server
// ═══════════════════════════════════════════

const server = createServer(app);

// ── WebSocket Servers (noServer mode for multi-path routing) ──
const wssObserver2 = new WebSocketServer({ noServer: true });
const wssRecordClerk = new WebSocketServer({ noServer: true });

// Route WebSocket upgrades by path
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/observer2') {
    wssObserver2.handleUpgrade(request, socket, head, (ws) => {
      wssObserver2.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/recordclerk') {
    wssRecordClerk.handleUpgrade(request, socket, head, (ws) => {
      wssRecordClerk.emit('connection', ws, request);
    });
  } else {
    console.warn(`[WS] Rejected connection attempt on unknown path: ${request.url}`);
    socket.destroy();
  }
});

// ── Observer 2 WebSocket (/ws/observer2) ──
const observer2Clients = new Set();

wssObserver2.on('connection', (ws) => {
  observer2Clients.add(ws);
  console.log(`👁  Observer 2 client connected (total: ${observer2Clients.size})`);

  ws.on('message', (data) => {
    // Text data = JSON commands
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'command') {
        observer2Engine.handleCommand(msg.command);
      } else if (msg.type === 'oracle') {
        observer2Engine.handleOracleQuestion(msg.text).then(result => {
          ws.send(JSON.stringify({ type: 'oracle_response', ...result }));
        }).catch(() => {});
      } else if (msg.type === 'voice_partial') {
        // Broadcast voice partial to other observer2 clients
        for (const client of observer2Clients) {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(msg));
          }
        }
      }
    } catch {
      // Ignore unparseable
    }
  });

  ws.on('close', () => {
    observer2Clients.delete(ws);
    console.log(`👁  Observer 2 client disconnected (total: ${observer2Clients.size})`);
  });

  ws.on('error', () => {
    observer2Clients.delete(ws);
  });
});

// Start Observer 2 engine — broadcasts eye state at 60fps
observer2Engine.start((eyeState) => {
  if (observer2Clients.size === 0) return;
  const packet = JSON.stringify(eyeState);
  for (const client of observer2Clients) {
    if (client.readyState === 1) {
      client.send(packet);
    }
  }
});

// ── Record Clerk WebSocket (/ws/recordclerk) ──
const recordClerkClients = new Set();
wssRecordClerk.on('connection', (ws) => {
  recordClerkClients.add(ws);
  subProjectState.activeProject = 'record-clerk';
  console.log(`🌼  Record Clerk client connected (total: ${recordClerkClients.size})`);
  ws.on('close', () => {
    recordClerkClients.delete(ws);
    if (recordClerkClients.size === 0 && subProjectState.activeProject === 'record-clerk') {
      subProjectState.activeProject = null;
    }
  });
  ws.on('error', () => {
    recordClerkClients.delete(ws);
  });
});

recordClerkEngine.start((state) => {
  if (recordClerkClients.size === 0) return;
  const packet = JSON.stringify(state);
  for (const client of recordClerkClients) {
    if (client.readyState === 1) client.send(packet);
  }
});

// ═══════════════════════════════════════════
//  Start
// ═══════════════════════════════════════════

app.get('/diagnostics/status', (_req, res) => {
  res.json(fieldTestCapture.getStatus());
});

fieldTestCapture.start(
  bus,
  memoryEngine,
  () => (typeof observer2Clients !== 'undefined' ? observer2Clients.size : 0)
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
  console.log('  ║  WebSocket: /ws  /ws/observer2            ║');
  console.log('  ║  Observer 2: 60fps Eye Engine ACTIVE      ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`  REST API:  http://localhost:${PORT}/api/health`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`  Observer2: ws://localhost:${PORT}/ws/observer2`);
  console.log('');
});
