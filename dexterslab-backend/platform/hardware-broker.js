import { EventEmitter } from 'events';
import { bus } from '../core/context-bus.js';
import { VideoIngressServer } from '../observer2/video-ingress.js';
import { AudioIngressServer } from '../observer2/audio-ingress.js';
import { TTSCommander } from '../observer2/tts-commander.js';
import { STTEngine } from '../observer2/stt-engine.js';
import { GeminiVoice } from '../observer2/gemini-voice.js';

export class HardwareBroker {
  constructor(options = {}) {
    // All WS endpoints now share the main HTTP server via WSRouter
    this.wsRouter = options.wsRouter;

    this.videoSubscribers = new Set();
    this.audioSubscribers = new Set();
    this.sttSubscribers = new Set();

    this.ttsClaims = null; // appId that currently owns TTS

    // Voice pipeline mode: 'local' (Vosk STT → Oracle → Piper TTS)
    //                   or 'gemini-live' (Gemini Live API audio-native)
    this._voiceMode = 'local';
    this._geminiVoice = null;
    this._geminiVoiceCallbacks = {};  // app-level transcript/turn callbacks

    this.videoEvents = new EventEmitter();
    this.audioEvents = new EventEmitter();

    // Core Hardware services — all use WSRouter instead of separate ports
    this.videoIngress = new VideoIngressServer(this.wsRouter, this.videoEvents);
    this.audioIngress = new AudioIngressServer(this.wsRouter, this.audioEvents);
    this.ttsCommander = new TTSCommander();
    this.sttEngine = new STTEngine();
  }

  async init() {
    console.log('[Platform] Initializing Hardware Broker...');

    // 1. Start Video (registers /ws/video)
    this.videoIngress.start();
    this.videoEvents.on('frame', (jpegBuffer) => {
      for (const sub of this.videoSubscribers) {
        try {
          sub(jpegBuffer);
        } catch (e) {
          console.error('[HardwareBroker] Video subscriber error:', e);
        }
      }
    });

    // 2. Start Audio (registers /ws/audio)
    try {
      await this.audioIngress.start();
      console.log('[Platform] Audio Ingress registered on /ws/audio');
    } catch (err) {
      console.error('[Platform] Failed to start Audio Ingress:', err);
    }

    this.audioEvents.on('client_connected', () => {
      bus.publish('system.pi_connected', { timestamp: Date.now() });
    });

    this.audioEvents.on('client_disconnected', () => {
      bus.publish('system.pi_disconnected', { timestamp: Date.now() });
    });

    this.audioEvents.on('audio_frame', (pcmBuffer) => {
      // Route audio based on voice mode
      if (this._voiceMode === 'gemini-live' && this._geminiVoice?.isConnected()) {
        // Online mode: feed audio directly to Gemini Live API
        this._geminiVoice.feedAudio(pcmBuffer);
      } else {
        // Local mode (or Gemini not connected): feed STT engine
        this.sttEngine.feed(pcmBuffer);
      }

      // Feed raw audio subscribers (always, regardless of mode)
      for (const sub of this.audioSubscribers) {
        try {
          sub(pcmBuffer);
        } catch (e) {
          console.error('[HardwareBroker] Audio subscriber error:', e);
        }
      }
    });

    // 3. Start STT
    this.sttEngine.start();
    this.sttEngine.on('transcript', (text) => {
      // ── Speaker→Mic Feedback Gate ──
      // When TTS is playing on the Pi speaker, the mic picks up the robot's
      // own voice. Vosk transcribes it, and without this gate, the transcript
      // would trigger another Oracle query → infinite feedback loop.
      // The TTSCommander tracks isSpeaking = true from speak() until
      // tts_ack + 1.5s cooldown (echo decay).
      if (this.ttsCommander.isSpeaking) {
        console.log(`[STT] 🔇 Suppressed during TTS: "${text.substring(0, 40)}"`);
        return;
      }

      console.log('[STT] Transcript:', text);
      bus.publish('voice.command', { text, timestamp: Date.now() });

      for (const sub of this.sttSubscribers) {
        try {
          sub(text);
        } catch (e) {
          console.error('[HardwareBroker] STT subscriber error:', e);
        }
      }
    });

    // 4. Start TTS (registers /ws/tts — Pi connects to us)
    this.ttsCommander.connect(this.wsRouter);

    console.log('[Platform] Hardware Broker initialized.');
    console.log('[Platform]   /ws/video — Pi camera stream');
    console.log('[Platform]   /ws/audio — Pi microphone stream');
    console.log('[Platform]   /ws/tts   — Pi TTS receiver (Pi-initiated)');
  }

  // --- Sensors (Shared Broadcast) ---

  subscribeVideo(callback) {
    this.videoSubscribers.add(callback);
    return () => this.videoSubscribers.delete(callback);
  }

  subscribeAudio(callback) {
    this.audioSubscribers.add(callback);
    return () => this.audioSubscribers.delete(callback);
  }

  subscribeSTT(callback) {
    this.sttSubscribers.add(callback);
    return () => this.sttSubscribers.delete(callback);
  }

  // --- Actuators (Exclusive Claims) ---

  claimTTS(appId) {
    if (this.ttsClaims && this.ttsClaims !== appId) {
      console.warn(`[HardwareBroker] App ${appId} attempted to claim TTS, but it is held by ${this.ttsClaims}`);
      return false; // Denied
    }
    this.ttsClaims = appId;
    bus.publish('hardware.tts.claimed', { appId });
    return true; // Granted
  }

  releaseTTS(appId) {
    if (this.ttsClaims === appId) {
      this.ttsClaims = null;
      bus.publish('hardware.tts.released', { appId });
    }
  }

  speak(appId, text) {
    if (this.ttsClaims !== appId) {
      console.warn(`[HardwareBroker] App ${appId} attempted to speak, but does not own TTS`);
      return false;
    }
    if (this.ttsCommander) {
      this.ttsCommander.speak(text);
      return true;
    }
    return false;
  }

  /**
   * Send a TTS chunk as part of a streaming response.
   * @param {string} appId - App that holds the TTS claim
   * @param {string} text - Sentence fragment to speak
   * @param {number} chunkIndex - Sequential index
   * @param {boolean} isLast - Whether this is the final chunk
   */
  speakChunk(appId, text, chunkIndex, isLast) {
    if (this.ttsClaims !== appId) {
      console.warn(`[HardwareBroker] App ${appId} attempted to speakChunk, but does not own TTS`);
      return false;
    }
    if (this.ttsCommander) {
      return this.ttsCommander.speakChunk(text, chunkIndex, isLast);
    }
    return false;
  }

  getPlatformStatus() {
    return {
      pi_audio_connected: this.audioIngress.isClientConnected(),
      pi_tts_connected: this.ttsCommander.isConnected(),
      tts_speaking: this.ttsCommander.isSpeaking,
      video_stream_active: this.videoIngress.isActive(),
      video_fps: this.videoIngress.getFramesPerSecond(),
      voice_mode: this._voiceMode,
      gemini_live_connected: this._geminiVoice?.isConnected() || false,
    };
  }

  // ── Voice Mode Switching ──

  /**
   * Switch the voice pipeline mode.
   * @param {'local'|'gemini-live'} mode - The voice pipeline to activate
   * @param {object} [callbacks] - App-level callbacks for Gemini Live events
   * @param {function} [callbacks.onInputTranscript] - Called with (text) for user speech
   * @param {function} [callbacks.onOutputTranscript] - Called with (text) for AI response
   * @param {function} [callbacks.onTurnComplete] - Called when AI finishes speaking
   */
  async setVoiceMode(mode, callbacks = {}) {
    if (mode === this._voiceMode) return;

    console.log(`[HardwareBroker] Voice mode: ${this._voiceMode} → ${mode}`);

    // Clear any existing auto-fallback timer
    if (this._geminiHealthTimer) {
      clearInterval(this._geminiHealthTimer);
      this._geminiHealthTimer = null;
    }

    if (mode === 'gemini-live') {
      // Start Gemini Live session
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('[HardwareBroker] Cannot start Gemini Live — GEMINI_API_KEY not set');
        return;
      }

      this._geminiVoiceCallbacks = callbacks;
      this._geminiStreamingChunks = 0;  // Track chunks per turn for logging

      this._geminiVoice = new GeminiVoice({
        apiKey,
        onAudioResponse: (base64Audio, mimeType) => {
          // ── STREAM IMMEDIATELY ──
          // Forward each audio chunk to the Pi speaker as it arrives.
          // This is the key latency optimization — the Pi starts playing
          // while Gemini is still generating the rest of the response.
          this._sendRawAudioToPi(base64Audio);
          this._geminiStreamingChunks++;
        },
        onInputTranscript: (text) => {
          console.log(`[GeminiLive] 🎤 User: "${text}"`);
          bus.publish('voice.command', { text, timestamp: Date.now(), source: 'gemini-live' });
          if (this._geminiVoiceCallbacks.onInputTranscript) {
            this._geminiVoiceCallbacks.onInputTranscript(text);
          }
        },
        onOutputTranscript: (text) => {
          console.log(`[GeminiLive] 🤖 Observer: "${text}"`);
          if (this._geminiVoiceCallbacks.onOutputTranscript) {
            this._geminiVoiceCallbacks.onOutputTranscript(text);
          }
        },
        onTurnComplete: () => {
          // Log streaming stats — audio was already sent chunk-by-chunk
          if (this._geminiStreamingChunks > 0) {
            console.log(`[GeminiLive] ✅ Turn complete — streamed ${this._geminiStreamingChunks} audio chunks to Pi`);
            this._geminiStreamingChunks = 0;
          }
          if (this._geminiVoiceCallbacks.onTurnComplete) {
            this._geminiVoiceCallbacks.onTurnComplete();
          }
        },
        onError: (err) => {
          console.error('[GeminiLive] Session error:', err.message || err);
        },
        onConnectionLost: () => {
          console.warn('[GeminiLive] ⚠ Connection lost — audio will route to local STT until reconnected');
          // Don't auto-switch mode yet — GeminiVoice auto-reconnects in 3s.
          // The audio_frame handler already checks isConnected() before feeding.
        },
        onReconnected: () => {
          console.log('[GeminiLive] ✅ Reconnected — resuming Gemini audio pipeline');
        }
      });

      await this._geminiVoice.connect();
      this._voiceMode = 'gemini-live';

      // Health monitor — if Gemini stays disconnected for 30s, fall back to local
      this._geminiHealthTimer = setInterval(() => {
        if (this._voiceMode === 'gemini-live' && this._geminiVoice && !this._geminiVoice.isConnected()) {
          console.warn('[HardwareBroker] ⚠ Gemini Live disconnected >30s — falling back to local STT');
          this.setVoiceMode('local');
        }
      }, 30000);

    } else {
      // Switch back to local mode
      if (this._geminiVoice) {
        this._geminiVoice.disconnect();
        this._geminiVoice = null;
      }
      this._geminiVoiceCallbacks = {};
      this._geminiStreamingChunks = 0;
      this._voiceMode = 'local';
    }
  }

  /**
   * Flush buffered Gemini audio chunks as one payload to the Pi speaker.
   * Concatenating chunks reduces aplay startup overhead on the Pi.
   */
  _flushGeminiAudioBuffer() {
    if (!this._geminiTurnAudioBuffer || this._geminiTurnAudioBuffer.length === 0) return;
    if (!this.ttsCommander.isConnected()) {
      console.warn('[HardwareBroker] Cannot flush audio — Pi TTS not connected');
      this._geminiTurnAudioBuffer = [];
      return;
    }

    try {
      // Concatenate all base64 chunks into one PCM buffer
      const buffers = this._geminiTurnAudioBuffer.map(b64 => Buffer.from(b64, 'base64'));
      const combined = Buffer.concat(buffers);
      const combinedB64 = combined.toString('base64');
      
      console.log(`[HardwareBroker] Flushing ${this._geminiTurnAudioBuffer.length} audio chunks (${combined.length} bytes) to Pi`);

      this.ttsCommander.client.send(JSON.stringify({
        type: 'tts_raw_audio',
        audio: combinedB64,
        sampleRate: 24000,  // Gemini Live outputs 24kHz PCM
        format: 'pcm_s16le'
      }));
    } catch (err) {
      console.error('[HardwareBroker] Failed to send buffered audio to Pi:', err.message);
    }

    this._geminiTurnAudioBuffer = [];
  }

  /**
   * Send raw PCM audio from Gemini Live to the Pi speaker.
   * Uses a special 'tts_raw_audio' message type that the Pi plays directly
   * without Piper TTS synthesis (audio is already synthesized by Gemini).
   */
  _sendRawAudioToPi(base64Audio) {
    if (!this.ttsCommander.isConnected()) return;

    try {
      this.ttsCommander.client.send(JSON.stringify({
        type: 'tts_raw_audio',
        audio: base64Audio,
        sampleRate: 24000,  // Gemini Live outputs 24kHz PCM
        format: 'pcm_s16le'
      }));
    } catch (err) {
      // Connection may have dropped
      console.error('[HardwareBroker] Failed to send raw audio to Pi:', err.message);
    }
  }

  getVoiceMode() {
    return this._voiceMode;
  }
}
