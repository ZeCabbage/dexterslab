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
        this.recognition.stop();
      } catch {}
      this.recognition = null;
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
