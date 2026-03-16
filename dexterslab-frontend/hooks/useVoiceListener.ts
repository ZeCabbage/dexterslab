'use client';

/**
 * useVoiceListener — React hook for continuous speech recognition.
 *
 * Auto-detects and falls back between STT engines:
 *   1. BrowserSpeechRecognition (Web Speech API — Chrome only)
 *   2. ServerSpeechRecognition (MediaRecorder + Gemini STT — Chromium/all browsers)
 *
 * Chromium 145+ defines SpeechRecognition/webkitSpeechRecognition as stubs
 * that cycle listening→error every ~15s without Google cloud backend.
 * This hook detects that pattern (2+ errors, no transcript) and auto-falls back.
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
  commands?: CommandPattern[];
  onCommand?: (command: string, rawText: string) => void;
  onFinal?: (text: string) => void;
  onPartial?: (text: string) => void;
  lang?: string;
  autoStart?: boolean;
}

export interface UseVoiceListenerReturn {
  status: SpeechStatus;
  lastFinal: string;
  partial: string;
  isListening: boolean;
  isSupported: boolean;
  engine: 'browser' | 'server' | 'none';
  start: () => void;
  stop: () => void;
}

/** Send a diagnostic message to /api/diag (fire-and-forget). */
function diagLog(msg: string) {
  console.log(`🎙️ ${msg}`);
  if (typeof fetch !== 'undefined') {
    fetch('/api/diag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg }),
    }).catch(() => {});
  }
}

/** Max errors without a transcript before falling back from Browser to Server STT. */
const MAX_BROWSER_ERRORS = 2;

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
    if (typeof window === 'undefined') return;

    const hasBrowserSTT = BrowserSpeechRecognition.isSupported();
    const hasServerSTT = ServerSpeechRecognition.isSupported();
    diagLog(`detect: BrowserSTT=${hasBrowserSTT}, ServerSTT=${hasServerSTT}`);

    if (!hasBrowserSTT && !hasServerSTT) {
      setEngine('none');
      setStatus('error');
      diagLog('No STT engine available');
      return;
    }

    // ── Shared: build the onFinal handler ──
    const handleFinal = (text: string) => {
      setLastFinal(text);
      setPartial('');
      const { commands: cmds, onCommand: cmdCb, onFinal: finalCb } = callbacksRef.current;
      if (cmds && cmds.length > 0) {
        const matched = matchCommand(text, cmds);
        if (matched) {
          cmdCb?.(matched, text);
          return;
        }
      }
      finalCb?.(text);
    };

    const handlePartial = (text: string) => {
      setPartial(text);
      callbacksRef.current.onPartial?.(text);
    };

    // ── Start Server STT ──
    const startServerSTT = () => {
      diagLog('Starting ServerSpeechRecognition (MediaRecorder + Gemini)...');
      speechRef.current?.stop();

      const serverSpeech = new ServerSpeechRecognition({
        lang,
        onFinal: handleFinal,
        onPartial: handlePartial,
        onStatusChange: (s: SpeechStatus) => {
          setStatus(s);
          if (s === 'listening') diagLog('Server STT is LISTENING');
          else if (s === 'error') diagLog('Server STT failed');
        },
      });

      speechRef.current = serverSpeech;
      setEngine('server');

      if (autoStart) {
        serverSpeech.start();
      }
    };

    // ── Try Browser STT first (with fallback logic) ──
    if (hasBrowserSTT) {
      diagLog('Trying BrowserSpeechRecognition (Web Speech API)...');
      setEngine('browser');

      let browserFailed = false;
      let browserErrorCount = 0;
      let gotTranscript = false;

      const browserSpeech = new BrowserSpeechRecognition({
        lang,
        onFinal: (text: string) => {
          gotTranscript = true;
          browserErrorCount = 0; // Reset on success
          handleFinal(text);
        },
        onPartial: handlePartial,
        onStatusChange: (s: SpeechStatus) => {
          if (browserFailed) return;

          if (s === 'listening') {
            setStatus(s);
            diagLog('Browser STT is LISTENING');
          } else if (s === 'error') {
            browserErrorCount++;
            diagLog(`Browser STT error #${browserErrorCount} (gotTranscript=${gotTranscript})`);

            // Chromium stub detection: cycles listening→error
            // without producing transcripts
            if (!gotTranscript && browserErrorCount >= MAX_BROWSER_ERRORS && hasServerSTT) {
              diagLog('Chromium stub detected — switching to Server STT');
              browserFailed = true;
              startServerSTT();
            } else {
              setStatus(s);
            }
          } else {
            setStatus(s);
          }
        },
      });

      speechRef.current = browserSpeech;

      if (autoStart) {
        browserSpeech.start();
      }

      return () => {
        speechRef.current?.stop();
        speechRef.current = null;
      };
    }

    // ── No browser STT, go straight to server ──
    startServerSTT();

    return () => {
      speechRef.current?.stop();
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
