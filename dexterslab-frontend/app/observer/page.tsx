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

import { useEffect, useState, useCallback } from 'react';
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

interface AppInfo {
  id: string;
  name: string;
  frontendRoute: string;
  icon: string;
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

// ═══ Voice command prefixes for app launching ═══
const VOICE_PREFIX_HINT = '"Launch [app name]"';

// ═══ Hub Apps (static fallback — backend augments dynamically) ═══
// Only apps specifically designed for the Observer Hub
const HUB_APP_IDS = new Set(['observer-eye', 'rules-lawyer', 'record-clerk', 'offline-observer', 'deadswitch']);
const HUB_APPS: AppInfo[] = [
  { id: 'observer-eye', name: 'Observer V2', frontendRoute: '/observer/eye-v2', icon: '◉' },
  { id: 'rules-lawyer', name: 'Rules Lawyer', frontendRoute: '/observer/rules-lawyer', icon: '§' },
  { id: 'record-clerk', name: 'Dandelion Records', frontendRoute: '/record-clerk', icon: '⊚' },
  { id: 'offline-observer', name: 'Offline Observer', frontendRoute: '/offline-observer.html', icon: '⏣' },
  { id: 'deadswitch', name: 'Deadswitch', frontendRoute: '/observer/deadswitch', icon: '☢' },
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
  const [appList, setAppList] = useState<AppInfo[]>(HUB_APPS);
  const [activeApp, setActiveApp] = useState<string | null>(null);

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

  // ── Poll available apps ──
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/hub/apps');
        if (res.ok) {
          const data = await res.json();
          const backendApps: AppInfo[] = (data.apps || []).filter((a: AppInfo) => HUB_APP_IDS.has(a.id));
          if (backendApps.length > 0) {
            // Merge: use static names (user-preferred) over backend names
            const hubMap = new Map(HUB_APPS.map(a => [a.id, a]));
            const merged = backendApps.map(a => ({
              ...a,
              name: hubMap.get(a.id)?.name || a.name,
              icon: hubMap.get(a.id)?.icon || a.icon,
            }));
            const ids = new Set(merged.map(a => a.id));
            const extras = HUB_APPS.filter(a => !ids.has(a.id));
            setAppList([...merged, ...extras]);
          } else {
            setAppList(HUB_APPS);
          }
          setActiveApp(data.activeApp || null);
        }
      } catch {
        // Offline — use static list
        if (appList.length === 0) setAppList(HUB_APPS);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
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

  // ── Poll STT transcripts ──
  useEffect(() => {
    // Reset dedup tracking on every mount (handles HMR/Fast Refresh)
    const seen = new Set<number>();

    const poll = async () => {
      try {
        const res = await fetch('/api/hub/transcripts');
        if (res.ok) {
          const data: TranscriptEntry[] = await res.json();
          if (!data || data.length === 0) return;
          const fresh = data.filter(d => !seen.has(d.timestamp));
          if (fresh.length === 0) return;
          for (const e of fresh) seen.add(e.timestamp);
          setTranscriptLog(prev => [...prev, ...fresh].slice(-30));
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

    // 1. Local beep for instant feedback (LOUD doorbell chime)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // First note — high ding
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);    // A5
      gain1.gain.setValueAtTime(1.0, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Second note — lower dong
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.35);  // E5
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.setValueAtTime(1.0, ctx.currentTime + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc2.start(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.8);
      osc2.onended = () => ctx.close();
    } catch { /* no audio context */ }

    // 2. Send "hello" to Pi espeak-ng via backend TTS
    try {
      const res = await fetch('/api/test/tts?text=hello');
      const data = await res.json();
      if (data.success) {
        setSoundStatus('sent');
      } else {
        console.error('[TTS] Failed:', data.error, data.hint || '');
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

          {/* Apps Panel */}
          <div className={`${styles.panel} ${styles.panelActive}`}>
             <div className={styles.panelHeader}>╔══ APPS ══╗</div>
             <div className={styles.panelValue} style={{ color: 'var(--color-cyan)' }}>
               {appList.length} AVAILABLE
               {activeApp ? <span style={{ fontSize: '0.75em', color: 'var(--color-green)', marginLeft: '6px' }}>● {activeApp}</span> : null}
             </div>
             <div className={styles.panelDetail} style={{ overflowY: 'auto' }}>
               {appList.length > 0 ? (
                 appList.map(app => (
                   <button
                     key={app.id}
                     onClick={async () => {
                        // Offline apps need REST to start the Pi daemon before navigating
                        const OFFLINE_APPS = new Set(['offline-observer', 'deadswitch']);

                        if (OFFLINE_APPS.has(app.id)) {
                          setActionPending(`Starting ${app.name}...`);
                          try {
                            const res = await fetch('/api/hub/action', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'start_offline', app: app.id }),
                            });
                            const data = await res.json();
                            if (data.navigate) {
                              router.push(data.navigate);
                            } else {
                              router.push(app.frontendRoute);
                            }
                          } catch {
                            router.push(app.frontendRoute);
                          }
                          setActionPending('');
                        } else {
                          // Online apps: just navigate — WS connection auto-activates the app
                          router.push(app.frontendRoute);
                        }
                      }}
                     className={styles.appListItem}
                     style={{
                       color: activeApp === app.id ? 'var(--color-green)' : 'var(--color-amber)',
                       fontWeight: activeApp === app.id ? 'bold' : 'normal',
                     }}
                   >
                     <span className={styles.appListIcon}>{app.icon}</span>
                     <span className={styles.appListName}>{app.name.toUpperCase()}</span>
                     <span className={styles.appListVoice}>🎤</span>
                   </button>
                 ))
               ) : (
                 <div style={{ color: '#555' }}>Loading apps...</div>
               )}
               <div style={{ fontSize: 'clamp(6px, 0.9vmin, 8px)', color: '#555', marginTop: '4px', textAlign: 'center' }}>
                 Say {VOICE_PREFIX_HINT} to open
               </div>
             </div>
           </div>
        </div>

        {/* ── Bottom Status Bar (WiFi + Utilities) ── */}
        <div className={styles.bottomBar}>
          <div className={styles.bottomBarLeft}>
            <span style={{ color: sigColor }}>
              {signalBars(status.wifi.signal)} {status.wifi.signal}%
            </span>
            <span style={{ color: '#666' }}>│</span>
            <span style={{ color: status.wifi.connected ? 'var(--color-green)' : 'var(--color-red)', fontSize: '0.85em' }}>
              {status.wifi.ssid}
            </span>
            <span style={{ color: '#444', fontSize: '0.8em' }}>
              {status.wifi.ip !== '---' ? ` · ${status.wifi.ip}` : ''}
            </span>
          </div>
          <div className={styles.bottomBarRight}>
            <button
              onClick={() => doAction('kill', 'KILL — stopping all')}
              disabled={!!actionPending}
              className={`${styles.utilBtn} ${styles.killBtn}`}
            >
              ■ KILL
            </button>
            <button
              onClick={() => doAction('git_pull', 'Pulling latest code')}
              disabled={!!actionPending || syncing}
              className={`${styles.utilBtn} ${styles.syncBtn} ${syncing ? styles.syncBtnActive : ''}`}
            >
              {syncing ? '⟳' : '⟳ SYNC'}
            </button>
          </div>
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
          VOICE: &quot;Launch [app]&quot; • &quot;Close Application&quot; • &quot;Go Home&quot;
        </div>
        </div>
      </div>
  );
}
