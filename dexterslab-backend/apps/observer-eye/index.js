import { EyeStateMachine } from '../../observer2/eye-state-machine.js';
import fs from 'fs';
import path from 'path';

export default class ObserverEyeApp {
  static manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps', 'observer-eye', 'manifest.json'), 'utf-8'));

  constructor(platform) {
    this.platform = platform; // { appManager, hardwareBroker, aiProvider, wsRouter, restRouter, memory, bus }
    
    // Create the core engine
    this.engine = new EyeStateMachine({
      genai: this.platform.aiProvider.getGenAI(),
      sessionId: this.platform.sessionId,
      memory: this.platform.memory
    });
    
    this.wsHandler = null;
    this.wsClients = new Set();
    this.subscriptions = [];
  }

  /**
   * Called by AppManager when this app claims the display/TTS
   */
  async onActivateDisplay() {
    console.log('[ObserverEye] Activating...');
    
    // Initialize ML
    await this.engine.motionProcessor.init();
    
    // Claim TTS
    this.platform.hardwareBroker.claimTTS(ObserverEyeApp.manifest.id);
    
    // Subscribe to video frames (Shared Sensor)
    this.subscriptions.push(
      this.platform.hardwareBroker.subscribeVideo((jpegBuffer) => {
        this.engine.processFrame(jpegBuffer).catch(() => {});
      })
    );
    
    // ── Gemini Live Voice Pipeline (Online) ──
    // Switch to Gemini Live for real-time audio-native conversation.
    // This replaces the Vosk STT → Oracle → Piper TTS chain entirely.
    await this.platform.hardwareBroker.setVoiceMode('gemini-live', {
      onInputTranscript: (text) => {
        // Broadcast user's speech to display clients
        const packet = JSON.stringify({ type: 'user_question', text });
        for (const client of this.wsClients) {
          if (client.readyState === 1) client.send(packet);
        }
      },
      onOutputTranscript: (text) => {
        // Broadcast Gemini's response text to display clients
        const packet = JSON.stringify({
          type: 'oracle_chunk',
          text,
          chunkIndex: 0,
          isLast: true
        });
        for (const client of this.wsClients) {
          if (client.readyState === 1) client.send(packet);
        }
      },
      onTurnComplete: () => {
        // Signal display clients that the response is complete
        const packet = JSON.stringify({ type: 'oracle_complete' });
        for (const client of this.wsClients) {
          if (client.readyState === 1) client.send(packet);
        }
      }
    });

    // ── Fallback: Local STT → Oracle pipeline ──
    // Only fires if Gemini Live is disconnected (voice mode falls back to 'local')
    let lastNavTimestamp = 0;
    this.subscriptions.push(
      this.platform.bus.subscribe('voice.navigation', (data) => {
        lastNavTimestamp = data.timestamp || Date.now();
      })
    );

    this.subscriptions.push(
      this.platform.hardwareBroker.subscribeSTT((text) => {
        // Skip if in Gemini Live mode (shouldn't fire, but safety check)
        if (this.platform.hardwareBroker.getVoiceMode() === 'gemini-live') return;

        // If VoiceNavigator just consumed this command, skip oracle
        const elapsed = Date.now() - lastNavTimestamp;
        if (elapsed < 500) {
          console.log(`[ObserverEye] Skipping oracle — voice command was navigation (${elapsed}ms ago)`);
          return;
        }

        // Immediately broadcast user's question to display clients
        const questionPacket = JSON.stringify({ type: 'user_question', text });
        for (const client of this.wsClients) {
          if (client.readyState === 1) client.send(questionPacket);
        }

        // ── Streaming Oracle Pipeline (local fallback) ──
        const MUTE_RESPONSES = ['[NOTED, COMRADE.]', '[NOTED. CONTINUE]', '[ACKNOWLEDGED]', '[STAND BY]', '[PROCESSING]', '[FILE UPDATED]'];

        this.engine.handleOracleQuestionStreaming(text, (chunkText, chunkIndex, isLast) => {
          if (!chunkText || !chunkText.trim()) return;

          if (MUTE_RESPONSES.includes(chunkText)) {
            console.log(`[ObserverEye] Suppressing TTS for generic response: ${chunkText}`);
            return;
          }

          this.platform.hardwareBroker.speakChunk(
            ObserverEyeApp.manifest.id,
            chunkText,
            chunkIndex,
            isLast
          );

          const chunkPacket = JSON.stringify({
            type: 'oracle_chunk',
            text: chunkText,
            chunkIndex,
            isLast
          });
          for (const client of this.wsClients) {
            if (client.readyState === 1) client.send(chunkPacket);
          }
        }).then((result) => {
          if (result && result.category === 'noise') {
            console.log(`[ObserverEye] Silent — noise filtered: "${text.substring(0, 40)}"`);
          }
        }).catch(() => {});
      })
    );
    
    // Set Pi Connection State manually based on broker status
    if (this.platform.hardwareBroker.audioIngress.isClientConnected()) {
      if (typeof this.engine.setPiConnectionState === 'function') {
        this.engine.setPiConnectionState('connected');
      }
    }
    
    // Provide a broadcast callback to EyeStateMachine
    this.engine.start((eyeState) => {
      if (this.wsClients.size === 0) return;
      const packet = JSON.stringify(eyeState);
      for (const client of this.wsClients) {
        if (client.readyState === 1) {
          client.send(packet);
        }
      }
    });
  }

  async onDeactivateDisplay() {
    console.log('[ObserverEye] Deactivating...');
    this.engine.stop();
    this.platform.hardwareBroker.releaseTTS(ObserverEyeApp.manifest.id);
    
    // Switch back to local voice mode for other apps
    await this.platform.hardwareBroker.setVoiceMode('local');
    
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];
  }

  getWsHandler() {
    // Only register WS once
    if (!this.wsHandler) {
      const wss = this.platform.wsRouter.registerPath(ObserverEyeApp.manifest.wsPath);
      
      wss.on('connection', (ws) => {
        this.wsClients.add(ws);
        console.log(`👁 [ObserverEye] Client connected (total: ${this.wsClients.size})`);
        
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'command') {
              this.engine.handleCommand(msg.command);
            } else if (msg.type === 'oracle') {
              this.engine.handleOracleQuestion(msg.text).then(result => {
                if (result && result.category === 'noise') {
                  // Noise — don't even send a response to the display client
                  return;
                }
                ws.send(JSON.stringify({ type: 'oracle_response', ...result }));
                // Also speak the response on Pi speaker (like STT flow does)
                if (result && result.response) {
                  const MUTE_RESPONSES = ['[NOTED, COMRADE.]', '[NOTED. CONTINUE]', '[ACKNOWLEDGED]', '[STAND BY]', '[PROCESSING]', '[FILE UPDATED]'];
                  if (!MUTE_RESPONSES.includes(result.response)) {
                    this.platform.hardwareBroker.speak(ObserverEyeApp.manifest.id, result.response);
                  }
                }
              }).catch(() => {});
            } else if (msg.type === 'voice_partial') {
              for (const client of this.wsClients) {
                if (client !== ws && client.readyState === 1) {
                  client.send(JSON.stringify(msg));
                }
              }
            }
          } catch { /* ignore */ }
        });
        
        ws.on('close', () => {
          this.wsClients.delete(ws);
          console.log(`👁 [ObserverEye] Client disconnected (remaining: ${this.wsClients.size})`);
        });
        
        ws.on('error', () => {
          this.wsClients.delete(ws);
        });
      });
      
      // Auto-activate/deactivate based on display client connections
      this.platform.appManager.wsAutoActivate(ObserverEyeApp.manifest.id, wss);
      
      this.wsHandler = wss;
    }
    
    return this.wsHandler;
  }
}
