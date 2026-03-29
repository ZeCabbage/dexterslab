import { EventEmitter } from 'events';
import { bus } from '../core/context-bus.js';
import { VideoIngressServer } from '../observer2/video-ingress.js';
import { AudioIngressServer } from '../observer2/audio-ingress.js';
import { TTSCommander } from '../observer2/tts-commander.js';
import { STTEngine } from '../observer2/stt-engine.js';

export class HardwareBroker {
  constructor(options = {}) {
    this.videoPort = options.videoPort || 5600;
    this.audioPort = options.audioPort || 8889;
    
    this.videoSubscribers = new Set();
    this.audioSubscribers = new Set();
    this.sttSubscribers = new Set();
    
    this.ttsClaims = null; // appId that currently owns TTS

    this.videoEvents = new EventEmitter();
    this.audioEvents = new EventEmitter();

    // Core Hardware services
    this.videoIngress = new VideoIngressServer(this.videoPort, this.videoEvents);
    this.audioIngress = new AudioIngressServer(this.audioPort, this.audioEvents);
    this.ttsCommander = new TTSCommander();
    this.sttEngine = new STTEngine();
  }

  async init() {
    console.log('[Platform] Initializing Hardware Broker...');

    // 1. Start Video
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

    // 2. Start Audio
    try {
      await this.audioIngress.start();
      console.log(`[Platform] Audio Ingress listening on port ${this.audioPort}`);
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
      // Feed STT
      this.sttEngine.feed(pcmBuffer);
      
      // Feed raw audio subscribers
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

    // 4. Start TTS (Connect client)
    this.ttsCommander.connect();
    
    console.log('[Platform] Hardware Broker initialized.');
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
  
  getPlatformStatus() {
    return {
      pi_audio_connected: this.audioIngress.isClientConnected(),
      pi_tts_connected: this.ttsCommander.isConnected(),
      video_stream_active: this.videoIngress.isActive(),
      video_fps: this.videoIngress.getFramesPerSecond(),
    };
  }
}
