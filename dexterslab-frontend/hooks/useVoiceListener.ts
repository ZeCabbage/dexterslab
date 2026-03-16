'use client';

/**
 * useVoiceListener — React hook for continuous browser speech recognition.
 *
 * Auto-detects the best available STT engine:
 *   1. BrowserSpeechRecognition (Web Speech API — Chrome only)
 *   2. ServerSpeechRecognition (MediaRecorder + Gemini STT — Chromium/all browsers)
 *
 * Falls back gracefully: if neither is supported, status = 'error'.
 *
 * Usage:
 *   const { status, lastFinal, partial } = useVoiceListener({
 *     commands: HUB_COMMANDS,
 *     onCommand: (cmd) => doAction(cmd),
 *     onFinal: (text) => console.log('Heard:', text),
 *   });
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BrowserSpeechRecognition,
  ServerSpeechRecognition,
  SpeechStatus,
  CommandPattern,
  matchCommand,
} from '@/lib/speech-recognition';

export interface UseVoiceListenerOptions {
  /** Command patterns to match against recognized text. */
  commands?: CommandPattern[];
  /** Called when a command pattern matches. */
  onCommand?: (command: string, rawText: string) => void;
  /** Called with final recognized text (after command matching). */
  onFinal?: (text: string) => void;
  /** Called with interim/partial text while speaking. */
  onPartial?: (text: string) => void;
  /** Language for recognition. Default: 'en-US'. */
  lang?: string;
  /** Whether to auto-start on mount. Default: true. */
  autoStart?: boolean;
}

export interface UseVoiceListenerReturn {
  /** Current mic status: 'off' | 'starting' | 'listening' | 'error'. */
  status: SpeechStatus;
  /** Last fully recognized utterance. */
  lastFinal: string;
  /** Current interim/partial text while speaking. */
  partial: string;
  /** Whether the mic is actively listening. */
  isListening: boolean;
  /** Whether any speech recognition engine is supported. */
  isSupported: boolean;
  /** Which engine is in use: 'browser', 'server', or 'none'. */
  engine: 'browser' | 'server' | 'none';
  /** Manually start listening. */
  start: () => void;
  /** Manually stop listening. */
  stop: () => void;
}

/** Detect which STT engine to use. */
function detectEngine(): 'browser' | 'server' | 'none' {
  if (typeof window === 'undefined') return 'none';

  const hasBrowserSTT = BrowserSpeechRecognition.isSupported();
  const hasServerSTT = ServerSpeechRecognition.isSupported();

  // Log detailed detection to /api/diag for remote debugging
  const msg = `detectEngine: BrowserSTT=${hasBrowserSTT}, ServerSTT=${hasServerSTT}, ` +
    `SpeechRecognition=${!!((window as unknown as Record<string, unknown>).SpeechRecognition)}, ` +
    `webkitSpeechRecognition=${!!((window as unknown as Record<string, unknown>).webkitSpeechRecognition)}, ` +
    `mediaDevices=${!!navigator.mediaDevices}, ` +
    `MediaRecorder=${!!window.MediaRecorder}`;
  console.log(msg);
  // POST to /api/diag for remote reading
  fetch('/api/diag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg }),
  }).catch(() => {});

  if (hasBrowserSTT) return 'browser';
  if (hasServerSTT) return 'server';
  return 'none';
}

export function useVoiceListener(
  options: UseVoiceListenerOptions = {}
): UseVoiceListenerReturn {
  const {
    commands,
    onCommand,
    onFinal,
    onPartial,
    lang,
    autoStart = true,
  } = options;

  const [status, setStatus] = useState<SpeechStatus>('off');
  const [lastFinal, setLastFinal] = useState('');
  const [partial, setPartial] = useState('');
  const [engine, setEngine] = useState<'browser' | 'server' | 'none'>('none');

  // Stable refs for callbacks so the speech instance doesn't need to be recreated
  const callbacksRef = useRef({ onCommand, onFinal, onPartial, commands });
  callbacksRef.current = { onCommand, onFinal, onPartial, commands };

  const speechRef = useRef<BrowserSpeechRecognition | ServerSpeechRecognition | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    (BrowserSpeechRecognition.isSupported() || ServerSpeechRecognition.isSupported());

  const start = useCallback(() => {
    if (speechRef.current?.isRunning) return;
    speechRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    speechRef.current?.stop();
  }, []);

  useEffect(() => {
    const detected = detectEngine();
    setEngine(detected);

    if (detected === 'none') {
      setStatus('error');
      console.warn('🎙️ No speech recognition available (need Chrome for Web Speech API, or mic for server STT)');
      return;
    }

    console.log(`🎙️ Using ${detected === 'browser' ? 'Web Speech API (Chrome)' : 'MediaRecorder + Gemini STT (server)'}`);

    const speechOptions = {
      lang,
      onFinal: (text: string) => {
        setLastFinal(text);
        setPartial('');

        const { commands: cmds, onCommand: cmdCb, onFinal: finalCb } = callbacksRef.current;

        // Try command matching first
        if (cmds && cmds.length > 0) {
          const matched = matchCommand(text, cmds);
          if (matched) {
            cmdCb?.(matched, text);
            return;
          }
        }

        // No command matched — pass through as regular speech
        finalCb?.(text);
      },
      onPartial: (text: string) => {
        setPartial(text);
        callbacksRef.current.onPartial?.(text);
      },
      onStatusChange: (s: SpeechStatus) => {
        setStatus(s);
      },
    };

    let speech: BrowserSpeechRecognition | ServerSpeechRecognition;

    if (detected === 'browser') {
      speech = new BrowserSpeechRecognition(speechOptions);
    } else {
      speech = new ServerSpeechRecognition(speechOptions);
    }

    speechRef.current = speech;

    if (autoStart) {
      speech.start();
    }

    return () => {
      speech.stop();
      speechRef.current = null;
    };
  }, [lang, autoStart]);

  return {
    status,
    lastFinal,
    partial,
    isListening: status === 'listening',
    isSupported,
    engine,
    start,
    stop,
  };
}
