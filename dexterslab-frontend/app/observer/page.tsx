'use client';

/**
 * OBSERVER HUB — 80s Retro-Futuristic System Control Interface
 * Circular layout for 1080×1080 round display (Waveshare 5").
 *
 * Features:
 *  - WiFi signal diagnostics (SSID, signal %, IP, status)
 *  - Voice feedback display (last heard text, partial, command log)
 *  - System launch log (rolling timestamped events)
 *  - Sub-project launcher (touch-friendly tiles)
 *  - Shutdown with confirmation
 *  - Chrome Web Speech API for voice commands (via VoiceProvider)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

// ═══ Types ═══

interface HubStatus {
  version: number;
  wifi: { ssid: string; signal: number; ip: string; connected: boolean };
}

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error' | 'command' | 'kill' | 'heard';
}

// ═══ Sub-Projects ═══
interface SubProject {
  name: string;
  route: string;
  icon: string;
  voiceCmd: string;
}

const SUB_PROJECTS: SubProject[] = [
  { name: 'EYE V2', route: '/observer/eye-v2', icon: '👁️', voiceCmd: '"open eye v2"' },
  { name: 'RULES LAWYER', route: '/observer/rules-lawyer', icon: '🎲', voiceCmd: '"launch rules lawyer"' },
];

export default function ObserverHub() {
  const router = useRouter();

  // ── State ──
  const [status, setStatus] = useState<HubStatus>({
    version: 0,
    wifi: { ssid: '---', signal: 0, ip: '---', connected: false },
  });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [actionPending, setActionPending] = useState('');
  const [showShutdown, setShowShutdown] = useState(false);
  const [shutdownCount, setShutdownCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [time, setTime] = useState('');
  const [scanY, setScanY] = useState(0);
  const [cursorBlink, setCursorBlink] = useState(true);



  // ── Helpers ──
  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [...prev.slice(-11), { time: t, msg, type }]);
  }, []);

  const signalBars = (sig: number) => {
    if (sig >= 75) return '▂▄▆█';
    if (sig >= 50) return '▂▄▆░';
    if (sig >= 25) return '▂▄░░';
    if (sig > 0) return '▂░░░';
    return '░░░░';
  };

  // ── Clock ──
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Cursor blink ──
  useEffect(() => {
    const id = setInterval(() => setCursorBlink(b => !b), 500);
    return () => clearInterval(id);
  }, []);

  // ── Scan line animation ──
  useEffect(() => {
    const id = setInterval(() => setScanY(y => (y + 1.5) % 100), 50);
    return () => clearInterval(id);
  }, []);

  // ── Poll status ──
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/hub/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch { /* offline */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);



  // ── Actions ──
  const doAction = async (action: string, label: string) => {
    setActionPending(action);
    if (action === 'git_pull') setSyncing(true);
    addLog(`${label}...`, 'command');
    try {
      const res = await fetch('/api/hub/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(data.message, 'success');
        // Log sync details
        if (data.details) {
          for (const d of data.details) addLog(`  ↳ ${d}`, 'info');
        }
        // Navigate if backend says so
        if (data.navigate) {
          router.push(data.navigate);
        }
      } else {
        addLog(data.message || 'Failed', 'error');
      }
    } catch {
      addLog('Action failed — check connection', 'error');
    }
    setActionPending('');
    if (action === 'git_pull') setSyncing(false);
  };

  const handleShutdown = () => {
    if (!showShutdown) { setShowShutdown(true); return; }
    setShutdownCount(5);
    addLog('SHUTDOWN INITIATED', 'kill');
    const id = setInterval(() => {
      setShutdownCount(p => {
        if (p <= 1) {
          clearInterval(id);
          fetch('/api/shutdown', { method: 'POST' }).catch(() => {});
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  };

  // ── Computed styles ──
  const sigColor = status.wifi.signal >= 50 ? 'var(--color-green)'
    : status.wifi.signal >= 25 ? 'var(--color-amber)' : 'var(--color-red)';

  const verText = status.version === 2 ? '● OBSERVER V2 ACTIVE' : '○ NO OBSERVER RUNNING';
  const verColor = status.version === 2 ? 'var(--color-blue)' : '#555';

  const logColors: Record<string, string> = {
    info: '#5a7a6a', success: 'var(--color-green)', error: 'var(--color-red)',
    command: 'var(--color-amber)', kill: 'var(--color-red)', heard: 'var(--color-blue)',
  };

  return (
    <div className={styles.container}>
      {/* Back to dashboard */}
      <Link href="/" className={styles.backLink}>← LAB</Link>

      {/* ── Circular Hub ── */}
      <div className={styles.hub}>
        {/* Decorative rings */}
        <div className={styles.ringInner} />
        <div className={styles.ringMid} />
        {/* Grid overlay */}
        <div className={styles.gridOverlay} />
        {/* CRT scanlines */}
        <div className={styles.crtOverlay} />
        {/* Animated scan line */}
        <div className={styles.scanline} style={{ top: `${scanY}%` }} />
        {/* Vignette */}
        <div className={styles.vignette} />

        {/* ═══ CONTENT ═══ */}

        {/* ── Header ── */}
        <div className={styles.header} style={{ zIndex: 10, width: '100%', marginBottom: '1.5%' }}>
          <div className={styles.headerTitle}>◈ OBSERVER HUB ◈</div>
          <div className={styles.headerSub}>SYSTEM CONTROL INTERFACE</div>
          <div className={styles.versionRow}>
            <span
              className={`${styles.versionDot} ${status.version > 0 ? styles.versionDotActive : ''}`}
              style={{ backgroundColor: verColor, boxShadow: `0 0 8px ${verColor}` }}
            />
            <span style={{ color: verColor }}>{verText}</span>
            <span style={{ color: '#333' }}>│</span>
            <span style={{ color: 'var(--color-amber)', textShadow: '0 0 6px rgba(255,170,0,0.3)' }}>{time}</span>
          </div>
        </div>

        {/* ── Diagnostics Row ── */}
        <div className={styles.diagnosticsRow}>
          {/* WiFi Panel */}
          <div className={`${styles.panel} ${status.wifi.connected ? styles.panelActive : styles.panelInactive}`}>
            <div className={styles.panelHeader}>╔══ NETWORK ══╗</div>
            <div className={styles.panelValue} style={{ color: sigColor }}>
              SIG {signalBars(status.wifi.signal)} {status.wifi.signal}%
            </div>
            <div className={styles.panelDetail}>
              <div style={{ color: 'var(--color-text)' }}>SSID: {status.wifi.ssid}</div>
              <div style={{ color: 'var(--color-text)' }}>IP: {status.wifi.ip}</div>
              <div style={{ color: status.wifi.connected ? 'var(--color-green)' : 'var(--color-red)' }}>
                {status.wifi.connected ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
            </div>
          </div>

          {/* Voice Panel */}
          <div className={`${styles.panel} ${styles.panelActive}`}>
            <div className={styles.panelHeader}>╔══ VOICE ════╗</div>
            <div className={styles.panelValue} style={{ color: 'var(--color-green)' }}>
              EDGE DAEMON
            </div>
            <div className={styles.panelDetail}>
              <div style={{ color: '#555' }}>
                Capture routed remotely
              </div>
            </div>
          </div>
        </div>

        {/* ── System Log ── */}
        <div className={styles.logContainer}>
          <div className={styles.logHeader}>─────── SYSTEM LOG ───────</div>
          <div className={styles.logEntries}>
            {log.length === 0 ? (
              <div className={styles.logEmpty}>Awaiting events...</div>
            ) : (
              log.slice(-8).map((entry, i) => (
                <div key={i} style={{ color: logColors[entry.type] || '#5a7a6a' }}>
                  [{entry.time}] {entry.msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Sub-Project Tiles ── */}
        <div className={styles.buttonsRow}>
          {SUB_PROJECTS.map(proj => (
            <button
              key={proj.route}
              onClick={() => router.push(proj.route)}
              className={`${styles.actionBtn} ${styles.projectBtn}`}
            >
              {proj.icon} {proj.name}
            </button>
          ))}
          <button
            onClick={() => doAction('kill', 'KILL — stopping all')}
            disabled={!!actionPending}
            className={`${styles.actionBtn} ${styles.killBtn}`}
          >
            ■ KILL
          </button>
          <button
            onClick={() => doAction('wifi_scan', 'WiFi scan')}
            disabled={!!actionPending}
            className={`${styles.actionBtn} ${styles.wifiBtn}`}
          >
            ◉ WIFI
          </button>
          <button
            onClick={() => doAction('git_pull', 'Pulling latest code')}
            disabled={!!actionPending || syncing}
            className={`${styles.actionBtn} ${styles.syncBtn} ${syncing ? styles.syncBtnActive : ''}`}
          >
            {syncing ? '⟳ SYNCING...' : '⟳ SYNC'}
          </button>
        </div>

        {/* ── Shutdown ── */}
        <div className={styles.shutdownArea}>
          {shutdownCount > 0 ? (
            <div className={styles.shutdownCountdown}>
              ⚠ SHUTDOWN: {shutdownCount}s
            </div>
          ) : showShutdown ? (
            <div className={styles.shutdownConfirmRow}>
              <button onClick={handleShutdown} className={`${styles.confirmBtn} ${styles.confirmYes}`}>
                CONFIRM SHUTDOWN
              </button>
              <button onClick={() => setShowShutdown(false)} className={`${styles.confirmBtn} ${styles.confirmNo}`}>
                CANCEL
              </button>
            </div>
          ) : (
            <button onClick={handleShutdown} className={styles.shutdownBtn}>
              ⏻ SAFE SHUTDOWN
            </button>
          )}
        </div>

        {/* ── Voice Hint ── */}
        <div className={styles.voiceHint}>
          VOICE: &quot;Launch Rules Lawyer&quot; • &quot;Kill Application&quot; • &quot;Sync Code&quot; • &quot;Go Home&quot;
        </div>
      </div>
    </div>
  );
}

