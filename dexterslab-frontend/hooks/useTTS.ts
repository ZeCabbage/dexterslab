'use client';

/**
 * useTTS — Text-to-Speech hook for Rules Lawyer voice output.
 *
 * Uses the browser's SpeechSynthesis API.
 * Provides speak(), stop(), and isSpeaking state.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface TTSOptions {
  /** Voice rate (0.5 - 2.0). Default: 0.95 */
  rate?: number;
  /** Voice pitch (0 - 2.0). Default: 1.1 */
  pitch?: number;
  /** Preferred voice name substring (e.g. "Daniel", "Google UK English Male") */
  preferredVoice?: string;
}

interface TTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useTTS(options: TTSOptions = {}): TTSReturn {
  const { rate = 0.95, pitch = 1.1, preferredVoice = '' } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Find preferred voice
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // Try to match preferred voice
      if (preferredVoice) {
        const match = voices.find(v =>
          v.name.toLowerCase().includes(preferredVoice.toLowerCase())
        );
        if (match) {
          voiceRef.current = match;
          return;
        }
      }

      // Fallback: pick a decent English voice
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      const preferred = englishVoices.find(v =>
        v.name.includes('Male') || v.name.includes('Daniel') || v.name.includes('Google')
      );
      voiceRef.current = preferred || englishVoices[0] || voices[0];
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [preferredVoice]);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text) return;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported, rate, pitch]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { speak, stop, isSpeaking, isSupported };
}
