'use client';

/**
 * useVoiceListener — React hook for continuous speech recognition.
 *
 * Auto-detects and falls back between STT engines:
 *   1. BrowserSpeechRecognition (Web Speech API — Chrome)
 *   2. ServerSpeechRecognition (MediaRecorder + Gemini STT — Chromium/all browsers)
 *
 * Chromium 145+ defines SpeechRecognition/webkitSpeechRecognition as stubs
 * that fail at runtime (no Google cloud speech service). This hook detects
 * that failure and automatically falls back to server-side STT.
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
  const fallbackAttempted = useRef(false);

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

    // Build speech options with callbacks
    const makeSpeechOptions = (onStatusCb: (s: SpeechStatus) => void) => ({
      lang,
      onFinal: (text: string) => {
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
      },
      onPartial: (text: string) => {
        setPartial(text);
        callbacksRef.current.onPartial?.(text);
      },
      onStatusChange: onStatusCb,
    });

    // ── Fallback function: switch from Browser to Server STT ──
    const fallbackToServer = () => {
      if (fallbackAttempted.current || !hasServerSTT) {
        diagLog('Fallback: no server STT available, giving up');
        setStatus('error');
        return;
      }
      fallbackAttempted.current = true;
      diagLog('Falling back to ServerSpeechRecognition (MediaRecorder + Gemini)...');

      // Stop the failed browser STT
      speechRef.current?.stop();

      const serverSpeech = new ServerSpeechRecognition(
        makeSpeechOptions((s: SpeechStatus) => {
          setStatus(s);
          if (s === 'listening') {
            diagLog('Server STT is LISTENING');
          } else if (s === 'error') {
            diagLog('Server STT also failed');
          }
        })
      );

      speechRef.current = serverSpeech;
      setEngine('server');

      if (autoStart) {
        serverSpeech.start();
      }
    };

    // ── Try Browser STT first ──
    if (hasBrowserSTT) {
      diagLog('Trying BrowserSpeechRecognition (Web Speech API)...');
      setEngine('browser');

      let browserFailed = false;
      let browserListening = false;

      const browserSpeech = new BrowserSpeechRecognition(
        makeSpeechOptions((s: SpeechStatus) => {
          if (browserFailed) return; // Already fell back

          if (s === 'listening') {
            browserListening = true;
            setStatus(s);
            diagLog('Browser STT is LISTENING');
          } else if (s === 'error') {
            diagLog('Browser STT reported error');
            if (!browserListening) {
              // Never reached 'listening' — this is a Chromium stub failure
              browserFailed = true;
              fallbackToServer();
            } else {
              // Was listening but errored (might be temporary)
              setStatus(s);
            }
          } else {
            setStatus(s);
          }
        })
      );

      speechRef.current = browserSpeech;

      if (autoStart) {
        browserSpeech.start();
      }

      // Safety timeout: if browser STT hasn't reached 'listening' in 5s, fallback
      const timeoutId = setTimeout(() => {
        if (!browserListening && !browserFailed) {
          diagLog('Browser STT timeout — never reached listening state, falling back');
          browserFailed = true;
          fallbackToServer();
        }
      }, 5000);

      return () => {
        clearTimeout(timeoutId);
        speechRef.current?.stop();
        speechRef.current = null;
      };
    }

    // ── Browser STT not available, go straight to Server ──
    diagLog('Starting ServerSpeechRecognition directly');
    setEngine('server');

    const serverSpeech = new ServerSpeechRecognition(
      makeSpeechOptions((s: SpeechStatus) => {
        setStatus(s);
        if (s === 'listening') {
          diagLog('Server STT is LISTENING');
        } else if (s === 'error') {
          diagLog('Server STT failed');
        }
      })
    );

    speechRef.current = serverSpeech;

    if (autoStart) {
      serverSpeech.start();
    }

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
