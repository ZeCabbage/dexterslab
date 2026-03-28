'use client';

/**
 * VoiceProvider — Shared context (now an empty shell).
 *
 * Stripped of speech APIs in Phase 3. Left simply to prevent
 * context provider errors in existing layouts.
 */

import React, { createContext, useContext, useMemo } from 'react';

interface VoiceContextValue {}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside <VoiceProvider>');
  return ctx;
}

interface VoiceProviderProps {
  children: React.ReactNode;
}

export function VoiceProvider({ children }: VoiceProviderProps) {
  const contextValue = useMemo(() => ({}), []);

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
}
