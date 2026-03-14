'use client';

/**
 * useVoiceListener — React hook for continuous browser speech recognition.
 *
 * Wraps BrowserSpeechRecognition in a hook with React-managed state.
 * Auto-starts on mount, auto-stops on unmount.
 * The underlying class handles 24/7 continuous listening with auto-restart.
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
  /** Whether the Web Speech API is supported. */
  isSupported: boolean;
  /** Manually start listening. */
  start: () => void;
  /** Manually stop listening. */
  stop: () => void;
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

  // Stable refs for callbacks so the speech instance doesn't need to be recreated
  const callbacksRef = useRef({ onCommand, onFinal, onPartial, commands });
  callbacksRef.current = { onCommand, onFinal, onPartial, commands };

  const speechRef = useRef<BrowserSpeechRecognition | null>(null);

  const isSupported =
    typeof window !== 'undefined' && BrowserSpeechRecognition.isSupported();

  const start = useCallback(() => {
    if (speechRef.current?.isRunning) return;
    speechRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    speechRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!BrowserSpeechRecognition.isSupported()) {
      setStatus('error');
      return;
    }

    const speech = new BrowserSpeechRecognition({
      lang,
      onFinal: (text) => {
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
      onPartial: (text) => {
        setPartial(text);
        callbacksRef.current.onPartial?.(text);
      },
      onStatusChange: (s) => {
        setStatus(s);
      },
    });

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
    start,
    stop,
  };
}
