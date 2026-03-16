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
  const voice = useVoice();

  const statusConfig = {
    listening: { label: '● MIC', color: 'var(--color-green)' },
    starting: { label: '◌ MIC', color: 'var(--color-amber)' },
    error: { label: '✕ MIC', color: 'var(--color-red)' },
    off: { label: '○ MIC', color: '#555' },
  };

  const config = statusConfig[voice.status] || statusConfig.off;

  return (
    <div className={styles.voiceBadge} style={{ color: config.color }}>
      <span className={styles.voiceBadgeIcon}>{config.label}</span>
      {voice.partial && (
        <span className={styles.voiceBadgePartial}>
          {voice.partial.slice(0, 30)}
        </span>
      )}
    </div>
  );
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
