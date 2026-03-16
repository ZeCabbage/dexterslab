/**
 * Web Speech API Wrapper — Shared by Hub, V1, and V2.
 *
 * Uses the browser's built-in SpeechRecognition (Chrome/Chromium).
 * Continuous listening with auto-restart, interim results, and
 * configurable command pattern matching.
 *
 * Usage:
 *   const speech = new BrowserSpeechRecognition({
 *     onFinal: (text) => { ... },
 *     onPartial: (text) => { ... },
 *     onStatusChange: (status) => { ... },
 *   });
 *   speech.start();   // Auto-restarts on silence/end
 *   speech.stop();    // Clean stop
 */

export type SpeechStatus = 'off' | 'starting' | 'listening' | 'error';

export interface SpeechRecognitionOptions {
  /** Called with the final recognized text (complete utterance). */
  onFinal?: (text: string) => void;
  /** Called with interim/partial text as the user speaks. */
  onPartial?: (text: string) => void;
  /** Called when the status changes. */
  onStatusChange?: (status: SpeechStatus) => void;
  /** Language for recognition. Default: 'en-US'. */
  lang?: string;
}

// Command pattern types
export interface CommandPattern {
  pattern: RegExp;
  command: string;
}

// ── Hub Commands (version switching) ──
export const HUB_COMMANDS: CommandPattern[] = [
  { pattern: /(?:open|launch|start|run)\s+observer\s+(?:version\s+)?(?:one|1|won|v1)/i, command: 'start_v1' },
  { pattern: /observer\s+version\s+(?:one|1|won)/i, command: 'start_v1' },
  { pattern: /switch\s+to\s+(?:version\s+)?(?:one|1|won|v1)/i, command: 'start_v1' },
  { pattern: /(?:open|launch|start|run)\s+observer\s+(?:version\s+)?(?:two|2|to|too|v2)/i, command: 'start_v2' },
  { pattern: /observer\s+version\s+(?:two|2|to|too)/i, command: 'start_v2' },
  { pattern: /switch\s+to\s+(?:version\s+)?(?:two|2|to|too|v2)/i, command: 'start_v2' },
  { pattern: /(?:kill|shut\s*(?:down|off)|close|stop|turn\s+off)\s+(?:the\s+)?observer/i, command: 'kill' },
  { pattern: /kill\s+it/i, command: 'kill' },
  { pattern: /shut\s+it\s+down/i, command: 'kill' },
  // Code sync
  { pattern: /(?:sync|pull|update)\s+(?:the\s+)?code/i, command: 'git_pull' },
  { pattern: /pull\s+latest/i, command: 'git_pull' },
  { pattern: /git\s+pull/i, command: 'git_pull' },
];

// ── Navigation Commands (launch/kill applications) ──
// "launch X application" opens a sub-project
// "kill X application" returns to observer hub
export const NAVIGATION_COMMANDS: CommandPattern[] = [
  // Launch applications
  { pattern: /launch\s+(?:the\s+)?eye(?:\s+application)?/i, command: 'launch_eye' },
  { pattern: /launch\s+(?:the\s+)?observer\s+eye(?:\s+application)?/i, command: 'launch_eye' },
  // Kill applications (return to hub)
  { pattern: /kill\s+(?:the\s+)?eye(?:\s+application)?/i, command: 'kill_eye' },
  { pattern: /kill\s+(?:the\s+)?observer\s+eye(?:\s+application)?/i, command: 'kill_eye' },
  // Generic kill (return to hub from any sub-project)
  { pattern: /kill\s+(?:the\s+)?(?:current\s+)?application/i, command: 'kill_application' },
  // Hub return (fallback)
  { pattern: /(?:go\s+(?:to\s+)?)?(?:home|hub)/i, command: 'return_hub' },
  { pattern: /return\s+(?:to\s+)?hub/i, command: 'return_hub' },
  { pattern: /back\s+to\s+hub/i, command: 'return_hub' },
];

// ── Observer App Commands (in-app reactions) ──
export const OBSERVER_COMMANDS: CommandPattern[] = [
  { pattern: /\bgo to sleep\b/i, command: 'sleep' },
  { pattern: /\bwake up\b/i, command: 'wake' },
  { pattern: /\bnaughty\b/i, command: 'blush' },
  { pattern: /\bgood boy\b/i, command: 'goodboy' },
  { pattern: /\bgood dog\b/i, command: 'goodboy' },
  { pattern: /\bthank you\b/i, command: 'thankyou' },
  { pattern: /\bthanks\b/i, command: 'thankyou' },
];

/**
 * Match text against a list of command patterns.
 * Returns the first matching command string or null.
 */
export function matchCommand(text: string, patterns: CommandPattern[]): string | null {
  const lower = text.toLowerCase().trim();
  for (const { pattern, command } of patterns) {
    if (pattern.test(lower)) {
      return command;
    }
  }
  return null;
}

/**
 * Browser-based speech recognition using the Web Speech API.
 * Auto-restarts on silence, handles browser quirks.
 */
export class BrowserSpeechRecognition {
  private recognition: any = null;
  private running = false;
  private options: SpeechRecognitionOptions;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SpeechRecognitionOptions) {
    this.options = options;
  }

  /** Returns true if the Web Speech API is available in this browser. */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  /** Start continuous listening. Auto-restarts on silence/end. */
  start(): boolean {
    if (this.running) return true;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('🎙️ Web Speech API not supported in this browser');
      this.options.onStatusChange?.('error');
      return false;
    }

    this.running = true;
    this.options.onStatusChange?.('starting');
    this._createAndStart(SpeechRecognition);
    return true;
  }

  /** Stop listening completely. */
  stop() {
    this.running = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort(); // abort() immediately releases mic resources
      } catch {}
      this.recognition = null;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.options.onStatusChange?.('off');
  }

  get isRunning(): boolean {
    return this.running;
  }

  private _createAndStart(SpeechRecognition: any) {
    if (!this.running) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.options.lang || 'en-US';
    // Reduce no-speech timeout for faster restart on Chrome
    rec.maxAlternatives = 1;

    this.recognition = rec;

    rec.onstart = () => {
      this.options.onStatusChange?.('listening');
    };

    rec.onresult = (event: any) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        this.options.onPartial?.(interim.trim());
      }

      if (finalText) {
        const cleaned = finalText.trim();
        if (cleaned) {
          this.options.onFinal?.(cleaned);
          // Clear partial after final result
          this.options.onPartial?.('');
        }
      }
    };

    rec.onerror = (event: any) => {
      // 'no-speech' is normal — just means silence, auto-restart handles it
      if (event.error === 'no-speech') return;
      // 'aborted' happens during restart — ignore
      if (event.error === 'aborted') return;

      console.warn(`🎙️ Speech error: ${event.error}`);

      if (event.error === 'not-allowed') {
        // User denied mic permission — stop completely
        this.options.onStatusChange?.('error');
        this.running = false;
        return;
      }

      // For other errors, try to restart after a delay
      this.options.onStatusChange?.('error');
    };

    rec.onend = () => {
      // Auto-restart if we're still supposed to be running
      if (this.running) {
        this.restartTimer = setTimeout(() => {
          this._createAndStart(SpeechRecognition);
        }, 300);
      } else {
        this.options.onStatusChange?.('off');
      }
    };

    try {
      rec.start();
    } catch (e) {
      console.warn('🎙️ Failed to start speech recognition:', e);
      // Retry after delay
      if (this.running) {
        this.restartTimer = setTimeout(() => {
          this._createAndStart(SpeechRecognition);
        }, 2000);
      }
    }
  }
}

/** Send diagnostic log to both console and /api/diag server endpoint. */
function diagLog(msg: string) {
  console.log(msg);
  if (typeof fetch !== 'undefined') {
    fetch('/api/diag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg }),
    }).catch(() => {});
  }
}

/**
 * Server-side speech recognition using MediaRecorder + Gemini STT.
 *
 * Works in Chromium (which lacks Web Speech API) by:
 * 1. Capturing mic audio via MediaRecorder (universal browser API)
 * 2. Using AudioContext analyser for voice activity detection (VAD)
 * 3. Sending audio chunks to /api/stt (Gemini) only when speech is detected
 *
 * Same callback interface as BrowserSpeechRecognition for drop-in use.
 */
export class ServerSpeechRecognition {
  private running = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private options: SpeechRecognitionOptions;
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private chunks: Blob[] = [];
  private isSpeaking = false;
  private silenceFrames = 0;

  // VAD thresholds
  private static readonly SPEECH_THRESHOLD = 15; // RMS level to consider "speech"
  private static readonly SILENCE_FRAMES_TO_STOP = 12; // ~600ms of silence to end utterance
  private static readonly CHUNK_INTERVAL_MS = 50; // VAD polling interval
  private static readonly MAX_RECORDING_MS = 8000; // Max single recording length
  private static readonly MIN_RECORDING_MS = 500; // Min recording to bother sending

  constructor(options: SpeechRecognitionOptions) {
    this.options = options;
  }

  /** Check if MediaRecorder is available (all modern browsers including Chromium). */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasMediaRecorder = !!window.MediaRecorder;
    diagLog(`ServerSTT check: mediaDevices=${hasMediaDevices}, MediaRecorder=${hasMediaRecorder}`);
    return hasMediaDevices && hasMediaRecorder;
  }

  /** Start continuous listening with VAD. */
  async start(): Promise<boolean> {
    if (this.running) return true;

    diagLog('ServerSTT: Starting...');
    this.options.onStatusChange?.('starting');

    // Retry logic: mic may be briefly locked by previous SpeechRecognition.
    // Try up to 3 times with increasing delays.
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        diagLog(`ServerSTT: Requesting getUserMedia (attempt ${attempt})...`);
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        diagLog(`ServerSTT: getUserMedia granted, tracks: ${this.stream.getAudioTracks().map(t => t.label).join(', ')}`);
        break; // Success!
      } catch (err) {
        const e = err as Error;
        diagLog(`ServerSTT: getUserMedia attempt ${attempt} failed - ${e?.name}: ${e?.message}`);
        if (attempt < MAX_RETRIES) {
          // Wait before retrying (mic may still be releasing)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else {
          diagLog(`ServerSTT: FAILED after ${MAX_RETRIES} attempts`);
          this.options.onStatusChange?.('error');
          return false;
        }
      }
    }

    try {
      // Set up AudioContext for VAD
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream!);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;
      source.connect(this.analyser);
      diagLog('ServerSTT: AudioContext and VAD analyser ready');

      this.running = true;
      this.options.onStatusChange?.('listening');

      // Start VAD loop
      this._vadLoop();
      diagLog('ServerSTT: VAD loop started, now listening');

      return true;
    } catch (err) {
      const e = err as Error;
      diagLog(`ServerSTT: FAILED - ${e?.name}: ${e?.message}`);
      this.options.onStatusChange?.('error');
      return false;
    }
  }

  /** Stop listening completely. */
  stop() {
    this.running = false;

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {}
    }
    this.recorder = null;

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    this.analyser = null;
    this.chunks = [];
    this.options.onStatusChange?.('off');
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Voice Activity Detection loop using AudioContext analyser. */
  private _vadLoop() {
    if (!this.running || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let recordingStartTime = 0;

    const checkVAD = () => {
      if (!this.running || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate RMS energy
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      if (rms > ServerSpeechRecognition.SPEECH_THRESHOLD) {
        this.silenceFrames = 0;

        if (!this.isSpeaking) {
          // Speech started — begin recording
          this.isSpeaking = true;
          recordingStartTime = Date.now();
          this.options.onPartial?.('...');
          this._startRecording();
        }

        // Check max duration
        if (Date.now() - recordingStartTime > ServerSpeechRecognition.MAX_RECORDING_MS) {
          this._stopRecordingAndTranscribe();
          this.isSpeaking = false;
        }
      } else if (this.isSpeaking) {
        this.silenceFrames++;
        if (this.silenceFrames >= ServerSpeechRecognition.SILENCE_FRAMES_TO_STOP) {
          // Silence long enough — end of utterance
          const duration = Date.now() - recordingStartTime;
          if (duration >= ServerSpeechRecognition.MIN_RECORDING_MS) {
            this._stopRecordingAndTranscribe();
          } else {
            // Too short, discard
            this._discardRecording();
          }
          this.isSpeaking = false;
          this.silenceFrames = 0;
        }
      }
    };

    this.recordingTimer = setInterval(checkVAD, ServerSpeechRecognition.CHUNK_INTERVAL_MS);
  }

  private _startRecording() {
    if (!this.stream) return;
    this.chunks = [];

    // Prefer webm/opus which Gemini supports well
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

    try {
      this.recorder = new MediaRecorder(this.stream, { mimeType });
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(100); // collect chunks every 100ms
    } catch (err) {
      console.warn('🎙️ MediaRecorder start failed:', err);
    }
  }

  private async _stopRecordingAndTranscribe() {
    if (!this.recorder || this.recorder.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      if (!this.recorder) { resolve(); return; }

      this.recorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
        this.chunks = [];
        this.options.onPartial?.('🔄');

        // Send to server for transcription
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await fetch('/api/stt', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const text = (data.text || '').trim();
            if (text) {
              this.options.onFinal?.(text);
              this.options.onPartial?.('');
            } else {
              this.options.onPartial?.('');
            }
          } else {
            console.warn('🎙️ STT request failed:', res.status);
            this.options.onPartial?.('');
          }
        } catch (err) {
          console.warn('🎙️ STT request error:', err);
          this.options.onPartial?.('');
        }

        resolve();
      };

      try {
        this.recorder.stop();
      } catch {
        resolve();
      }
    });
  }

  private _discardRecording() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {}
    }
    this.chunks = [];
    this.options.onPartial?.('');
  }
}
