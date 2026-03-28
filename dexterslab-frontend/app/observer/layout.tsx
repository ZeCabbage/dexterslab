'use client';

/**
 * Observer Layout — Wraps all /observer/* routes.
 *
 * Provides:
 *  - Persistent VoiceProvider (mic stays active across sub-pages)
 *  - Floating voice status indicator (always visible)
 */

import { VoiceProvider, useVoice } from './VoiceProvider';
import styles from './layout.module.css';

function VoiceStatusBadge() {
  return null;
}

function ObserverLayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VoiceStatusBadge />
      {children}
    </>
  );
}

export default function ObserverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VoiceProvider>
      <ObserverLayoutInner>{children}</ObserverLayoutInner>
    </VoiceProvider>
  );
}
