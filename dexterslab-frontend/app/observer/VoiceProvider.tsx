'use client';

/**
 * VoiceProvider — Shared voice context for all Observer routes.
 *
 * Wraps useVoiceListener so the microphone stays active across
 * route navigation (hub → eye → back). Provides a universal
 * "return to hub" command that works from any sub-project.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  useVoiceListener,
  UseVoiceListenerReturn,
} from '@/hooks/useVoiceListener';
import { CommandPattern } from '@/lib/speech-recognition';

// ── Global commands (active on every page) ──
const GLOBAL_COMMANDS: CommandPattern[] = [
  // Launch applications
  { pattern: /launch\s+(?:the\s+)?eye(?:\s+application)?/i, command: 'launch_eye' },
  { pattern: /launch\s+(?:the\s+)?observer\s+eye(?:\s+application)?/i, command: 'launch_eye' },
  { pattern: /launch\s+(?:the\s+)?rules?\s*lawyer/i, command: 'launch_rules_lawyer' },
  { pattern: /(?:open|start)\s+(?:the\s+)?rules?\s*lawyer/i, command: 'launch_rules_lawyer' },
  // Kill applications (return to hub)
  { pattern: /kill\s+(?:the\s+)?eye(?:\s+application)?/i, command: 'kill_eye' },
  { pattern: /kill\s+(?:the\s+)?observer\s+eye(?:\s+application)?/i, command: 'kill_eye' },
  { pattern: /kill\s+(?:the\s+)?rules?\s*lawyer/i, command: 'kill_application' },
  { pattern: /kill\s+(?:the\s+)?(?:current\s+)?application/i, command: 'kill_application' },
  // Hub return (fallback)
  { pattern: /(?:go\s+(?:to\s+)?)?(?:home|hub)/i, command: 'return_hub' },
  { pattern: /return\s+(?:to\s+)?hub/i, command: 'return_hub' },
  { pattern: /back\s+to\s+hub/i, command: 'return_hub' },
];

interface VoiceContextValue extends UseVoiceListenerReturn {
  /** Register page-specific commands (merged with global commands) */
  pageCommands: CommandPattern[];
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside <VoiceProvider>');
  return ctx;
}

interface VoiceProviderProps {
  children: React.ReactNode;
  /** Additional commands from the current page */
  pageCommands?: CommandPattern[];
  /** Called when a page-level command matches */
  onPageCommand?: (command: string, rawText: string) => void;
  /** Called with final text that didn't match any command */
  onFinal?: (text: string) => void;
}

export function VoiceProvider({
  children,
  pageCommands = [],
  onPageCommand,
  onFinal,
}: VoiceProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Merge global + page commands
  const allCommands = useMemo(
    () => [...GLOBAL_COMMANDS, ...pageCommands],
    [pageCommands]
  );

  const handleCommand = useCallback(
    (command: string, rawText: string) => {
      // Global navigation commands
      switch (command) {
        case 'launch_eye':
          if (pathname !== '/observer/eye') {
            console.log('🎙️ VOICE: Launching eye application');
            router.push('/observer/eye');
          }
          return;
        case 'launch_rules_lawyer':
          if (pathname !== '/observer/rules-lawyer') {
            console.log('🎙️ VOICE: Launching rules lawyer');
            router.push('/observer/rules-lawyer');
          }
          return;
        case 'kill_eye':
        case 'kill_application':
        case 'return_hub':
          if (pathname !== '/observer') {
            console.log(`🎙️ VOICE: ${command} — returning to hub`);
            router.push('/observer');
          }
          return;
      }

      // Page-specific commands
      onPageCommand?.(command, rawText);
    },
    [router, pathname, onPageCommand]
  );

  const voice = useVoiceListener({
    commands: allCommands,
    onCommand: handleCommand,
    onFinal,
    autoStart: true,
  });

  const contextValue = useMemo(
    () => ({ ...voice, pageCommands }),
    [voice, pageCommands]
  );

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
}
