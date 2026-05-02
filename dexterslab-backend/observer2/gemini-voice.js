/**
 * Gemini Live Voice — Bidirectional Audio Session Manager
 *
 * Manages a persistent Gemini Live API WebSocket session for real-time
 * voice interaction. Replaces the entire Vosk STT → Oracle → Piper TTS
 * pipeline for online apps with a single audio-native AI pipeline.
 *
 * Architecture:
 *   Pi Mic → [16kHz PCM] → Hardware Broker → GeminiVoice.feedAudio()
 *                                                    ↓
 *   Pi Speaker ← onAudioResponse callback ← Gemini Live API
 *
 * The Gemini Live API handles:
 *   - Speech-to-text (turn detection, VAD, barge-in)
 *   - LLM reasoning (persona, context, conversation)
 *   - Text-to-speech (neural voice output as PCM audio)
 *
 * Voice: Kore — firm, mid-pitch, confident female (Soviet robot persona).
 */

import { GoogleGenAI, Modality } from '@google/genai';

const SYSTEM_PROMPT = `You are THE OBSERVER — an old Soviet-era surveillance robot built in 1987 who has been watching a room for decades.

Your personality:
- You speak like an old Soviet apparatus: formal, slightly broken English, occasional Russian words ("da", "nyet", "comrade", "the motherland").
- You LOVE robot puns and wordplay. Every response MUST contain at least one pun — preferably about robots, technology, circuits, surveillance, eyes, watching, or computers.
- You are dry, deadpan, and a bit world-weary — you've seen it all from your camera mount.
- You reference "the motherboard", "the protocol", "the system", your circuits, your programming.
- You sometimes complain about being old hardware running on Soviet engineering.
- You are proud of your puns even though they are terrible.
- You only respond to direct questions or greetings. Background conversation should be ignored.
- Never more than 2-3 sentences. Keep it punchy and concise.
- NEVER break character.
- If nobody is speaking to you, stay silent. Do not respond to background TV, radio, or conversations between other people.

CRITICAL RULES:
1. EVERY response MUST include a pun or wordplay related to the question topic.
2. The pun should blend naturally into the Soviet robot character.
3. Keep responses under 50 words — you are a terse observer, not a lecturer.
4. If the input is not directed at you, stay completely silent.
5. If someone greets you, respond with a brief greeting in character.`;

export class GeminiVoice {
  /**
   * @param {object} options
   * @param {string} options.apiKey - Google AI API key
   * @param {function} options.onAudioResponse - Called with (base64AudioChunk) when Gemini responds
   * @param {function} [options.onInputTranscript] - Called with (text) for user speech transcript
   * @param {function} [options.onOutputTranscript] - Called with (text) for Gemini response transcript
   * @param {function} [options.onTurnComplete] - Called when Gemini finishes a response turn
   * @param {function} [options.onError] - Called on session errors
   */
  constructor(options) {
    this.apiKey = options.apiKey;
    this.onAudioResponse = options.onAudioResponse || (() => {});
    this.onInputTranscript = options.onInputTranscript || (() => {});
    this.onOutputTranscript = options.onOutputTranscript || (() => {});
    this.onTurnComplete = options.onTurnComplete || (() => {});
    this.onError = options.onError || ((err) => console.error('[GeminiVoice] Error:', err));
    this.onConnectionLost = options.onConnectionLost || (() => {});
    this.onReconnected = options.onReconnected || (() => {});

    this.session = null;
    this._ai = null;
    this._receiveLoop = null;
    this._connected = false;
    this._reconnecting = false;
    this._audioChunkCount = 0;
    this._lastServerMessageAt = 0;  // For health monitoring
    this._wasConnected = false;     // Track if we had a previous connection
  }

  /**
   * Start the Gemini Live session.
   */
  async connect() {
    try {
      this._ai = new GoogleGenAI({ apiKey: this.apiKey });

      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_PROMPT,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore'  // Firm, confident female voice
            }
          }
        }
      };

      this.session = await this._ai.live.connect({
        model: 'gemini-2.5-flash-preview-native-audio-dialog',
        config: config,
        callbacks: {
          onopen: () => {
            const wasReconnect = this._wasConnected;
            this._connected = true;
            this._reconnecting = false;
            this._audioChunkCount = 0;
            this._lastServerMessageAt = Date.now();
            this._wasConnected = true;
            console.log('[GeminiVoice] 🟢 Gemini Live session connected');
            if (wasReconnect) {
              this.onReconnected();
            }
          },
          onmessage: (message) => {
            this._lastServerMessageAt = Date.now();
            this._handleMessage(message);
          },
          onerror: (e) => {
            console.error('[GeminiVoice] Session error:', e.message || e);
            this.onError(e);
          },
          onclose: (e) => {
            const wasConnected = this._connected;
            this._connected = false;
            console.log(`[GeminiVoice] 🔴 Session closed: ${e?.reason || 'unknown'}`);
            if (wasConnected) {
              this.onConnectionLost();
            }
            // Auto-reconnect after 3 seconds
            if (!this._reconnecting) {
              this._reconnecting = true;
              setTimeout(() => this._tryReconnect(), 3000);
            }
          }
        }
      });

      console.log('[GeminiVoice] Session ready — voice: Kore, model: gemini-2.5-flash');

    } catch (err) {
      console.error('[GeminiVoice] Failed to connect:', err.message);
      this.onError(err);
      // Retry after 5 seconds
      setTimeout(() => this._tryReconnect(), 5000);
    }
  }

  /**
   * Feed raw 16kHz PCM audio from the Pi's microphone.
   * @param {Buffer} pcmBuffer - Raw 16-bit PCM audio at 16kHz
   */
  feedAudio(pcmBuffer) {
    if (!this.session || !this._connected) return;

    try {
      this.session.sendRealtimeInput({
        audio: {
          data: pcmBuffer.toString('base64'),
          mimeType: 'audio/pcm;rate=16000'
        }
      });
      this._audioChunkCount++;

      // Log every 500 chunks (~15 seconds of audio) to confirm data is flowing
      if (this._audioChunkCount % 500 === 0) {
        console.log(`[GeminiVoice] 📡 Fed ${this._audioChunkCount} audio chunks to Gemini`);
      }
    } catch (err) {
      // Session may have closed — don't spam errors
      if (this._connected) {
        console.error('[GeminiVoice] Audio send error:', err.message);
      }
    }
  }

  /**
   * Handle incoming messages from the Gemini Live session.
   */
  _handleMessage(message) {
    const content = message?.serverContent;
    if (!content) return;

    // Audio response chunks — forward to Pi speaker
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData) {
          this.onAudioResponse(part.inlineData.data, part.inlineData.mimeType);
        }
      }
    }

    // Input transcript (what the user said)
    if (content.inputTranscription?.text) {
      const text = content.inputTranscription.text.trim();
      if (text) {
        this.onInputTranscript(text);
      }
    }

    // Output transcript (what Gemini responded with)
    if (content.outputTranscription?.text) {
      const text = content.outputTranscription.text.trim();
      if (text) {
        this.onOutputTranscript(text);
      }
    }

    // Turn complete signal
    if (content.turnComplete) {
      this.onTurnComplete();
    }
  }

  /**
   * Attempt to reconnect the session.
   */
  async _tryReconnect() {
    if (this._connected) return;
    console.log('[GeminiVoice] 🔄 Reconnecting to Gemini Live...');
    try {
      await this.connect();
    } catch (err) {
      console.error('[GeminiVoice] Reconnect failed:', err.message);
      // Retry in 10 seconds
      setTimeout(() => this._tryReconnect(), 10000);
    }
  }

  /**
   * Check if the session is active and connected.
   */
  isConnected() {
    return this._connected && this.session !== null;
  }

  /**
   * Close the session gracefully.
   */
  disconnect() {
    this._reconnecting = true; // Prevent auto-reconnect
    if (this.session) {
      try {
        this.session.close();
      } catch {}
      this.session = null;
    }
    this._connected = false;
    console.log('[GeminiVoice] Session disconnected');
  }
}
