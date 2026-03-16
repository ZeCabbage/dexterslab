'use client';

/**
 * DEXTER'S LAB — Landing Page
 * Dashboard listing available experiments.
 * 80s retro-futuristic tech aesthetic.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

interface Experiment {
  name: string;
  route: string;
  description: string;
  status: 'active' | 'wip' | 'planned';
  icon: string;
}

const EXPERIMENTS: Experiment[] = [
  {
    name: 'OBSERVER HUB',
    route: '/observer',
    description: 'Voice-controlled command center for the circular display — system control, version switching, diagnostics',
    status: 'active',
    icon: '◈',
  },
  {
    name: 'OBSERVER EYE',
    route: '/observer/eye',
    description: 'Unified eye renderer — procedural iris, sentinel mode, voice reactions, Oracle Q&A',
    status: 'active',
    icon: '👁',
  },
  {
    name: 'RULES LAWYER',
    route: '/observer/rules-lawyer',
    description: 'LLM-powered board game rules assistant — 32-bit character, voice I/O, game-themed persona',
    status: 'active',
    icon: '🎲',
  },
];

export default function Home() {
  const [time, setTime] = useState('');
  const [scanY, setScanY] = useState(0);

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setScanY(y => (y + 1.2) % 100), 50);
    return () => clearInterval(id);
  }, []);

  const statusColors: Record<string, string> = {
    active: 'var(--color-green)',
    wip: 'var(--color-amber)',
    planned: 'var(--color-muted)',
  };

  const statusLabels: Record<string, string> = {
    active: 'ONLINE',
    wip: 'IN DEV',
    planned: 'PLANNED',
  };

  return (
    <div className={styles.container}>
      {/* CRT scanlines */}
      <div className="crt-scanlines" />

      {/* Animated scan line */}
      <div className={styles.scanline} style={{ top: `${scanY}%` }} />

      {/* Grid background */}
      <div className={styles.gridOverlay} />

      {/* Content */}
      <div className={styles.content}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}>⚗</span>
            <h1 className={styles.title}>DEXTER&apos;S LAB</h1>
            <span className={styles.titleIcon}>⚗</span>
          </div>
          <p className={styles.subtitle}>EXPERIMENTAL PLAYGROUND</p>
          <div className={styles.headerInfo}>
            <span className={styles.clock}>{time}</span>
            <span className={styles.divider}>│</span>
            <span className={styles.expCount}>{EXPERIMENTS.length} EXPERIMENTS</span>
          </div>
        </header>

        {/* Experiments Grid */}
        <div className={styles.experiments}>
          {EXPERIMENTS.map((exp, i) => (
            <Link key={exp.route} href={exp.route} className={styles.card} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>{exp.icon}</span>
                <span className={styles.cardName}>{exp.name}</span>
                <span className={styles.cardStatus} style={{ color: statusColors[exp.status] }}>
                  {statusLabels[exp.status]}
                </span>
              </div>
              <p className={styles.cardDesc}>{exp.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.cardRoute}>{exp.route}</span>
                <span className={styles.cardArrow}>→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <span>PORT 7777</span>
          <span className={styles.divider}>│</span>
          <span>RASPBERRY PI 5</span>
          <span className={styles.divider}>│</span>
          <span>VOICE CONTROLLED</span>
        </footer>
      </div>
    </div>
  );
}
