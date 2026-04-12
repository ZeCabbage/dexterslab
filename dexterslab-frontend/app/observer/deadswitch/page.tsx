'use client';

import { useEffect, useState, useRef } from 'react';
import styles from './page.module.css';

const WS_URL =
  typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:8888/ws/deadswitch`
    : '';

type DeadswitchState = {
  status: 'idle' | 'listening' | 'retrieving' | 'generating' | 'speaking' | 'error';
  query: string;
  answer: string;
  sources: string[];
  ollamaOnline: boolean;
  knowledgeFiles: number;
  lastQuery: string | null;
};

const DEFAULT_STATE: DeadswitchState = {
  status: 'idle',
  query: '',
  answer: '',
  sources: [],
  ollamaOnline: false,
  knowledgeFiles: 0,
  lastQuery: null,
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'STANDING BY',
  listening: 'RECEIVING TRANSMISSION',
  retrieving: 'RETRIEVING ARCHIVES',
  generating: 'GENERATING RESPONSE',
  speaking: 'TRANSMITTING',
  error: 'SYSTEM ERROR',
};

export default function DeadswitchPage() {
  const [state, setState] = useState<DeadswitchState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const twRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[Deadswitch] WS connected');
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'state') {
            setState(msg.data);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // Typewriter effect for answer
  useEffect(() => {
    if (twRef.current) clearInterval(twRef.current);

    if (state.status === 'generating' && state.answer) {
      let idx = 0;
      setTypewriterText('');
      twRef.current = setInterval(() => {
        idx++;
        if (idx >= state.answer.length) {
          setTypewriterText(state.answer);
          if (twRef.current) clearInterval(twRef.current);
        } else {
          setTypewriterText(state.answer.slice(0, idx));
        }
      }, 18);
    } else if (state.answer) {
      setTypewriterText(state.answer);
    } else {
      setTypewriterText('');
    }

    return () => {
      if (twRef.current) clearInterval(twRef.current);
    };
  }, [state.answer, state.status]);

  const statusClass = styles[`status_${state.status}`] || '';

  return (
    <div className={styles.container}>
      {/* CRT overlay */}
      <div className={styles.crt} />
      <div className={styles.scanlines} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.radiation}>☢</span>
          <span className={styles.title}>DEADSWITCH</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.indicator} ${connected ? styles.indicatorOn : styles.indicatorOff}`} />
          <span className={styles.headerLabel}>
            {connected ? 'ONLINE' : 'NO SIGNAL'}
          </span>
        </div>
      </header>

      {/* Status bar */}
      <div className={`${styles.statusBar} ${statusClass}`}>
        <div className={styles.statusPulse} />
        <span className={styles.statusText}>{STATUS_LABELS[state.status] || 'UNKNOWN'}</span>
      </div>

      {/* Main content area */}
      <main className={styles.main}>
        {/* Idle state */}
        {state.status === 'idle' && !state.answer && (
          <div className={styles.idleContent}>
            <div className={styles.radiationLarge}>☢</div>
            <p className={styles.idleLabel}>SURVIVAL ORACLE READY</p>
            <p className={styles.idleSubLabel}>Voice query or wait for transmission</p>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{state.knowledgeFiles}</span>
                <span className={styles.statLabel}>ARCHIVES</span>
              </div>
              <div className={styles.stat}>
                <span className={`${styles.statValue} ${state.ollamaOnline ? styles.ollamaUp : styles.ollamaDown}`}>
                  {state.ollamaOnline ? 'ACTIVE' : 'OFFLINE'}
                </span>
                <span className={styles.statLabel}>AI ENGINE</span>
              </div>
            </div>
          </div>
        )}

        {/* Listening state */}
        {state.status === 'listening' && (
          <div className={styles.listeningContent}>
            <div className={styles.waveformContainer}>
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className={styles.waveformBar}
                  style={{ animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
            <p className={styles.listeningLabel}>RECEIVING...</p>
          </div>
        )}

        {/* Query display */}
        {state.query && state.status !== 'idle' && (
          <div className={styles.queryBlock}>
            <span className={styles.queryPrefix}>QUERY &gt;</span>
            <span className={styles.queryText}>{state.query}</span>
          </div>
        )}

        {/* Retrieving state */}
        {state.status === 'retrieving' && (
          <div className={styles.retrievingContent}>
            <div className={styles.spinner} />
            <p className={styles.retrievingLabel}>SEARCHING ARCHIVES...</p>
          </div>
        )}

        {/* Answer display */}
        {typewriterText && (
          <div className={styles.answerBlock}>
            <div className={styles.answerHeader}>
              <span className={styles.answerPrefix}>RESPONSE</span>
              {state.sources.length > 0 && (
                <span className={styles.sourcesBadge}>
                  {state.sources.length} SOURCE{state.sources.length > 1 ? 'S' : ''}
                </span>
              )}
            </div>
            <div className={styles.answerText}>
              {typewriterText}
              {state.status === 'generating' && (
                <span className={styles.cursor}>▊</span>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {state.status === 'error' && (
          <div className={styles.errorContent}>
            <span className={styles.errorIcon}>⚠</span>
            <p className={styles.errorLabel}>SYSTEM MALFUNCTION</p>
            <p className={styles.errorDetail}>Falling back to raw archive retrieval</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>
          DEADSWITCH v1.0 — OFFLINE SURVIVAL ORACLE
        </span>
      </footer>
    </div>
  );
}
