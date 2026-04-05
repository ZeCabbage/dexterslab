'use client';

/**
 * OBSERVER HUB — 80s Retro-Futuristic System Control Interface
 * Circular layout for 1080×1080 round display (Waveshare 5").
 *
 * Features:
 *  - WiFi signal diagnostics (SSID, signal %, IP, status)
 *  - Live Pi camera feed (polled JPEG snapshots from backend)
 *  - Live STT transcripts (from Pi mic → Vosk on PC)
 *  - TTS test button (sends to Pi espeak-ng via backend)
 *  - Sub-project launcher (touch-friendly tiles)
 *  - Shutdown with confirmation
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

// ═══ Types ═══

interface HubStatus {
  version: number;
  wifi: { ssid: string; signal: number; ip: string; connected: boolean };
  diagnostics?: {
    health?: {
      pi_audio_connected: boolean;
      pi_tts_connected: boolean;
      video_stream_active: boolean;
      video_fps: number;
    };
    entities?: Array<{ id: string, tags: string[], confidence?: number }>;
    conversation?: Array<{ role: string, text: string, timestamp: number }>;
  };
}

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error' | 'command' | 'kill' | 'heard';
}

interface TranscriptEntry {
  text: string;
  timestamp: number;
}

// ═══ Sub-Projects ═══
interface SubProject {
  name: string;
  route: string;
  icon: string;
  voiceCmd: string;
}

const SUB_PROJECTS: SubProject[] = [
  { name: 'EYE V2', route: '/observer/eye-v2', icon: '◉', voiceCmd: '"open eye v2"' },
  { name: 'RULES LAWYER', route: '/observer/rules-lawyer', icon: '§', voiceCmd: '"launch rules lawyer"' },
  { name: 'OFFLINE EYE', route: '/offline-observer.html', icon: '⏣', voiceCmd: '"launch offline eye"' },
];

export default function ObserverHub() {
  const router = useRouter();

  // ── State ──
  const [status, setStatus] = useState<HubStatus>({
    version: 0,
    wifi: { ssid: '---', signal: 0, ip: '---', connected: false },
  });
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [actionPending, setActionPending] = useState('');
  const [showShutdown, setShowShutdown] = useState(false);
  const [shutdownCount, setShutdownCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [time, setTime] = useState('');
  const [scanY, setScanY] = useState(0);
  const [cursorBlink, setCursorBlink] = useState(true);

  // ── Pi Data State ──
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const [soundStatus, setSoundStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const seenTimestamps = useRef(new Set<number>());

  // ── Helpers ──
  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    console.log(`[${type}] ${msg}`);
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

  // ── Poll hub status ──
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
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // ── Poll camera snapshot (low-res JPEG from Pi → backend → here) ──
  useEffect(() => {
    let active = true;

    const pollFrame = async () => {
      while (active) {
        try {
          const res = await fetch(`/api/hub/video-snapshot?t=${Date.now()}`);
          if (res.ok && res.status !== 204) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setCameraUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          }
        } catch { /* backend unreachable */ }
        // Poll at ~2fps for low-res diagnostic feed
        await new Promise(r => setTimeout(r, 500));
      }
    };

    pollFrame();
    return () => { active = false; };
  }, []);

  // ── Poll STT transcripts (accumulate, don't replace) ──
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/hub/transcripts');
        if (res.ok) {
          const data: TranscriptEntry[] = await res.json();
          setTranscriptLog(prev => {
            const newEntries = data.filter(d => !seenTimestamps.current.has(d.timestamp));
            if (newEntries.length === 0) return prev;
            for (const e of newEntries) seenTimestamps.current.add(e.timestamp);
            // Keep last 30 entries max
            const merged = [...prev, ...newEntries];
            return merged.slice(-30);
          });
        }
      } catch { /* offline */ }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, []);

  // ── Play hello sound (send to Pi TTS + local beep) ──
  const playHelloSound = useCallback(async () => {
    if (soundStatus === 'sending') return;
    setSoundStatus('sending');

    // 1. Local beep for instant feedback (louder, more distinct)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Bright two-tone chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);         // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2);   // E5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.4);   // G5
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      osc.onended = () => ctx.close();
    } catch { /* no audio context */ }

    // 2. Send "hello" to Pi espeak-ng via backend TTS
    try {
      const res = await fetch('/api/test/tts?text=hello');
      const data = await res.json();
      if (data.success) {
        setSoundStatus('sent');
      } else {
        setSoundStatus('failed');
      }
    } catch {
      setSoundStatus('failed');
    }

    // Reset after 2 seconds
    setTimeout(() => setSoundStatus('idle'), 2000);
  }, [soundStatus]);

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
        if (data.details) {
          for (const d of data.details) addLog(`  ↳ ${d}`, 'info');
        }
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

  const hasCameraFeed = !!cameraUrl;
  const hasMicData = status.diagnostics?.health?.pi_audio_connected || transcriptLog.length > 0;
  const hasTranscripts = transcriptLog.length > 0;

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

        {/* ── Diagnostics Grid (2x2) ── */}
        <div className={styles.diagnosticsGrid}>
          {/* Vision Panel */}
          <div className={`${styles.panel} ${status.diagnostics?.health?.video_stream_active ? styles.panelActive : styles.panelInactive}`}>
            <div className={styles.panelHeader}>╔══ VISION ══╗</div>
            <div className={styles.panelValue} style={{ color: status.diagnostics?.health?.video_stream_active ? 'var(--color-green)' : 'var(--color-red)' }}>
              CAMERA {status.diagnostics?.health?.video_stream_active ? 'ACTIVE' : 'OFFLINE'}
              {status.diagnostics?.health?.video_fps ? <span style={{fontSize: '0.8em', color: '#888'}}> {status.diagnostics.health.video_fps} FPS</span> : null}
            </div>
            <div className={styles.panelDetail} style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Pi camera feed via polled JPEG snapshots */}
              {hasCameraFeed ? (
                <img
                  src={cameraUrl}
                  alt="Pi Camera"
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover', opacity: 0.4,
                    zIndex: 0, imageRendering: 'auto',
                  }}
                />
              ) : null}
              <div style={{ position: 'relative', zIndex: 1, textShadow: '0 0 4px #000' }}>
                {status.diagnostics?.entities && status.diagnostics.entities.length > 0 ? (
                  status.diagnostics.entities.slice(0, 4).map((ent, i) => (
                    <div key={i} className={styles.logLine} style={{ color: 'var(--color-cyan)' }}>
                      TARGET: {ent.tags?.join(', ') || 'Unknown'} {(ent.confidence ? `(${(ent.confidence * 100).toFixed(0)}%)` : '')}
                    </div>
                  ))
                ) : (
                  <div style={{ color: hasCameraFeed ? '#aaa' : '#555', fontWeight: 'bold' }}>
                    {hasCameraFeed ? 'SCANNING...' : 'NO FEED'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Audio Panel */}
          <div className={`${styles.panel} ${hasMicData ? styles.panelActive : styles.panelInactive}`}>
            <div className={styles.panelHeader}>╔══ AUDIO IN ══╗</div>
            <div className={styles.panelValue} style={{ color: hasMicData ? 'var(--color-green)' : 'var(--color-red)' }}>
              MIC {hasMicData ? 'LISTENING' : 'OFFLINE'}
              {hasTranscripts ? <span style={{ fontSize: '0.75em', color: '#888' }}> ({transcriptLog.length})</span> : null}
            </div>
            <div className={styles.panelDetail} style={{ overflowY: 'auto' }}>
              {hasTranscripts ? (
                transcriptLog.map((t, i) => (
                  <div key={t.timestamp} className={styles.logLine} style={{
                    color: i === transcriptLog.length - 1 ? 'var(--color-cyan)' : 'var(--color-amber)',
                    fontWeight: i === transcriptLog.length - 1 ? 'bold' : 'normal',
                  }}>
                    &gt; &quot;{t.text}&quot;
                  </div>
                ))
              ) : (
                <div style={{ color: '#555' }}>Awaiting speech...</div>
              )}
            </div>
          </div>

          {/* Speaker Panel */}
          <div className={`${styles.panel} ${status.diagnostics?.health?.pi_tts_connected && speakerEnabled ? styles.panelActive : styles.panelInactive}`}>
            <div className={styles.panelHeader}>╔══ SPEAKER ══╗</div>
            <div className={styles.panelValue} style={{ color: status.diagnostics?.health?.pi_tts_connected && speakerEnabled ? 'var(--color-green)' : 'var(--color-red)' }}>
              <span>OUT {status.diagnostics?.health?.pi_tts_connected && speakerEnabled ? 'READY' : 'MUTED'}</span>
              <button
                className={styles.miniBtn}
                onClick={() => setSpeakerEnabled(!speakerEnabled)}
              >
                TOGGLE
              </button>
            </div>
            <div className={styles.panelDetail}>
              <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                <button
                  className={styles.miniBtn}
                  style={{
                    width: '80%', padding: '6px',
                    background: soundStatus === 'sent' ? '#0a2a0a' : soundStatus === 'failed' ? '#2a0a0a' : undefined,
                    borderColor: soundStatus === 'sent' ? 'var(--color-green)' : soundStatus === 'failed' ? 'var(--color-red)' : undefined,
                    color: soundStatus === 'sent' ? 'var(--color-green)' : soundStatus === 'failed' ? 'var(--color-red)' : undefined,
                    transition: 'all 0.3s ease',
                  }}
                  onClick={playHelloSound}
                  disabled={!speakerEnabled || soundStatus === 'sending'}
                >
                  {soundStatus === 'sending' ? '♪ SENDING...' :
                   soundStatus === 'sent' ? '✓ SENT TO PI' :
                   soundStatus === 'failed' ? '✗ FAILED' :
                   '▶ HELLO'}
                </button>
                <div style={{ fontSize: 'clamp(6px, 0.9vmin, 8px)', color: '#555', marginTop: '3px' }}>
                  Plays on Pi speaker via espeak-ng
                </div>
              </div>
            </div>
          </div>

          {/* WiFi Panel */}
          <div className={`${styles.panel} ${status.wifi.connected ? styles.panelActive : styles.panelInactive}`}>
             <div className={styles.panelHeader}>╔══ NETWORK ══╗</div>
             <div className={styles.panelValue} style={{ color: sigColor }}>
               SIG {signalBars(status.wifi.signal)} {status.wifi.signal}%
             </div>
             <div className={styles.panelDetail}>
               <div className={styles.logLine} style={{ color: 'var(--color-text)' }}>SSID: {status.wifi.ssid}</div>
               <div className={styles.logLine} style={{ color: 'var(--color-text)' }}>IP: {status.wifi.ip}</div>
               <div style={{ color: status.wifi.connected ? 'var(--color-green)' : 'var(--color-red)' }}>
                 {status.wifi.connected ? 'CONNECTED' : 'DISCONNECTED'}
               </div>
             </div>
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
