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

  // ── Browser Media ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);




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
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);



  // ── Browser Media Setup ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Camera Feed
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Camera error:", err));
    }

    // 2. Mic Tracking
    const sr = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (sr) {
      const recognition = new sr();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = Math.max(0, event.results.length - 3); i < event.results.length; ++i) {
          current += event.results[i][0].transcript + ' ';
        }
        setTranscript(current.trim().slice(-60)); // keep it short
      };

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        try { recognition.start(); } catch (e) {}
      };

      try { recognition.start(); } catch (e) {}

      return () => {
        recognition.onend = null;
        recognition.stop();
      };
    }
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

        {/* ── Diagnostics Grid (2x2) ── */}
        <div className={styles.diagnosticsGrid}>
          {/* Vision Panel */}
          <div className={`${styles.panel} ${status.diagnostics?.health?.video_stream_active ? styles.panelActive : styles.panelInactive}`}>
            <div className={styles.panelHeader}>╔══ VISION ══╗</div>
            <div className={styles.panelValue} style={{ color: status.diagnostics?.health?.video_stream_active ? 'var(--color-green)' : 'var(--color-red)' }}>
              CAMERA {status.diagnostics?.health?.video_stream_active ? 'ACTIVE' : 'OFFLINE'}
              {status.diagnostics?.health?.video_fps ? <span style={{fontSize: '0.8em', color: '#888'}}>{status.diagnostics.health.video_fps} FPS</span> : null}
            </div>
            <div className={styles.panelDetail} style={{ position: 'relative' }}>
              <video autoPlay muted playsInline ref={videoRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3, zIndex: 0 }} />
              <div style={{ position: 'relative', zIndex: 1, textShadow: '0 0 4px #000' }}>
                {status.diagnostics?.entities && status.diagnostics.entities.length > 0 ? (
                  status.diagnostics.entities.slice(0, 4).map((ent, i) => (
                    <div key={i} className={styles.logLine} style={{ color: 'var(--color-cyan)' }}>
                      TARGET: {ent.tags?.join(', ') || 'Unknown'} {(ent.confidence ? `(${(ent.confidence * 100).toFixed(0)}%)` : '')}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#aaa', fontWeight: 'bold' }}>SCANNING...</div>
                )}
              </div>
            </div>
          </div>

          {/* Audio Panel */}
          <div className={`${styles.panel} ${status.diagnostics?.health?.pi_audio_connected || isListening ? styles.panelActive : styles.panelInactive}`}>
            <div className={styles.panelHeader}>╔══ AUDIO IN ══╗</div>
            <div className={styles.panelValue} style={{ color: status.diagnostics?.health?.pi_audio_connected || isListening ? 'var(--color-green)' : 'var(--color-red)' }}>
              MIC {status.diagnostics?.health?.pi_audio_connected || isListening ? 'LISTENING' : 'OFFLINE'}
            </div>
            <div className={styles.panelDetail}>
              <div style={{ color: '#ccc', fontStyle: 'italic', marginBottom: '4px', textShadow: '0 0 4px #000' }}>
                {transcript ? `> ${transcript}` : 'Awaiting speech...'}
              </div>
              {status.diagnostics?.conversation && status.diagnostics.conversation.filter(c => c.role === 'user').length > 0 && (
                status.diagnostics.conversation.filter(c => c.role === 'user').slice(-2).reverse().map((conv, i) => (
                  <div key={i} className={styles.logLine} style={{ color: 'var(--color-amber)' }}>
                    &quot;{conv.text}&quot;
                  </div>
                ))
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
                  style={{ width: '80%', padding: '4px' }}
                  onClick={() => {
                     if (speakerEnabled) {
                       if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                         window.speechSynthesis.speak(new SpeechSynthesisUtterance('hello'));
                       }
                       fetch('/api/test/tts?text=hello');
                     }
                  }}
                  disabled={!speakerEnabled}
                >
                  ▶ TEST SOUND
                </button>
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

