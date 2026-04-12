'use client';

/**
 * THE OBSERVER 2 — Thin Client Eye Page
 *
 * Full-screen photorealistic eye rendered via WebGL2.
 * All intelligence runs on the PC backend — this page just:
 *   1. Captures camera → streams JPEG frames to backend
 *   2. Receives EyeState at 60fps
 *   3. Renders the eye via GPU shaders
 *   4. Handles voice input for Oracle Q&A
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealisticEyeRenderer } from '@/lib/observer2/realistic-eye-renderer';
import { DisplayConnector } from '@/lib/observer2/display-connector';
import { EyeState } from '@/lib/observer2/types';
import Link from 'next/link';

// Default state when no backend packets have arrived yet
const DEFAULT_STATE: EyeState = {
    ix: 0, iy: 0, dilation: 1.0, blink: 0,
    emotion: 'neutral', sentinel: true, visible: false,
    entityCount: 0, overlayText: '', overlayType: '',
    blush: 0, goodBoy: 0, thankYou: 0, t: 0,
};

export default function ObserverEyeV2() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    // Mutable state refs (60fps, no re-renders)
    const stateRef = useRef<EyeState>({ ...DEFAULT_STATE });
    const connectedRef = useRef(false);
    const connStateRef = useRef<'connecting'|'connected'|'disconnected'|'error'>('connecting');
    const debugRef = useRef(false);
    const fpsRef = useRef({ count: 0, lastTime: 0, value: 0 });

    // React state for UI overlays only
    const [connState, setConnState] = useState<'connecting'|'connected'|'disconnected'|'error'>('connecting');
    const [overlayText, setOverlayText] = useState('');
    const [overlayType, setOverlayType] = useState('');
    const [healthOverlay, setHealthOverlay] = useState('');
    const [trackingActive, setTrackingActive] = useState(false);
    const [detectionMode, setDetectionMode] = useState('none');

    const startApp = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // ── Initialize WebGL renderer ──
        const renderer = new RealisticEyeRenderer();
        const success = renderer.init(canvas);
        if (!success) {
            console.error('Failed to initialize WebGL2 renderer');
            return;
        }
        renderer.resize();

        // ── Initialize display connector ──
        const ws = new DisplayConnector();

        ws.onStateUpdate = (state) => {
            stateRef.current = state;

            // Update overlay text (throttled via React state)
            if (state.overlayText !== overlayText) {
                setOverlayText(state.overlayText);
                setOverlayType(state.overlayType);
            }

            // Tracking detection alert
            setTrackingActive(state.visible && state.entityCount > 0);
            if (state.detectionMode) setDetectionMode(state.detectionMode);
        };

        ws.onConnectionChange = (state) => {
            connectedRef.current = state === 'connected';
            connStateRef.current = state;
            setConnState(state);
        };

        ws.onOracleResponse = (data) => {
            setOverlayText(data.response);
            setOverlayType('oracle');
            // TTS removed: handled by Pi daemon natively
        };

        ws.connect();

        // ── Debug HUD Canvas overlay ──
        const debugCanvas = document.createElement('canvas');
        debugCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20;';
        document.body.appendChild(debugCanvas);
        const debugCtx = debugCanvas.getContext('2d')!;

        // ── Keyboard handlers ──
        let sentinelOverride = false;

        function onKeyDown(e: KeyboardEvent) {
            if (e.code === 'Backquote') {
                debugRef.current = !debugRef.current;
            }
            // Theme selection (1-4)
            if (e.code === 'Digit1') renderer.setTheme(0);
            else if (e.code === 'Digit2') renderer.setTheme(1);
            else if (e.code === 'Digit3') renderer.setTheme(2);
            else if (e.code === 'Digit4') renderer.setTheme(3);
            else if (e.code === 'Digit5') {
                sentinelOverride = !sentinelOverride;
                console.log(`👁 Sentinel Override toggled to: ${sentinelOverride}`);
            }
            // Voice commands via keyboard (fallback)
            else if (e.code === 'KeyS') ws.sendInteraction({ type: 'command', command: 'sleep' });
            else if (e.code === 'KeyW') ws.sendInteraction({ type: 'command', command: 'wake' });
            else if (e.code === 'KeyB') ws.sendInteraction({ type: 'command', command: 'blush' });
            else if (e.code === 'KeyG') ws.sendInteraction({ type: 'command', command: 'goodboy' });
            else if (e.code === 'KeyT') ws.sendInteraction({ type: 'command', command: 'thankyou' });
        }
        window.addEventListener('keydown', onKeyDown);

        // ── Main render loop ──
        function frame() {
            const now = performance.now() / 1000;
            const fps = fpsRef.current;

            // FPS counter
            fps.count++;
            if (now - fps.lastTime >= 1.0) {
                fps.value = fps.count;
                fps.count = 0;
                fps.lastTime = now;
            }

            // Render eye from latest backend state (or mock state based on connection)
            let displayState = { ...stateRef.current };
            if (sentinelOverride) {
                displayState.sentinel = true;
            }

            if (displayState.sentinel) {
                // Procedural Saccadic Scanning Path
                const sSpeed = 0.4; // 1 cycle every 2.5 seconds
                const t = now * sSpeed;
                const tFloor = Math.floor(t);
                const tFract = t - tFloor;
                
                // Smooth jump over 25% of cycle (~0.6 seconds), hold for the rest
                let jumpBlend = 1;
                if (tFract < 0.25) {
                    const x = tFract / 0.25;
                    jumpBlend = x * x * (3 - 2 * x); // smoothstep
                }

                // Tame the scanning radius so it stays well within the 5-inch screen and eyeball bounds
                const targetAmpX = 0.18;
                const targetAmpY = 0.12;
                
                const p1x = Math.sin(tFloor * 13.4) * targetAmpX;
                const p1y = Math.cos(tFloor * 17.7) * targetAmpY;
                const p2x = Math.sin((tFloor + 1) * 13.4) * targetAmpX;
                const p2y = Math.cos((tFloor + 1) * 17.7) * targetAmpY;

                const dartX = p1x + (p2x - p1x) * jumpBlend;
                const dartY = p1y + (p2y - p1y) * jumpBlend;

                const wanderX = Math.sin(now * 0.6) * 0.04;
                const wanderY = Math.cos(now * 0.8) * 0.04;

                const limitX = canvas ? canvas.width * 0.5 : 400;
                const limitY = canvas ? canvas.height * 0.5 : 300;
                
                // Override tracking point
                displayState.ix = (dartX + wanderX) * limitX;
                displayState.iy = (dartY + wanderY) * limitY;
            }

            const cs = connStateRef.current;
            
            if (canvas) {
                if (cs === 'disconnected') {
                    displayState.blink = 1.0;
                    canvas.style.opacity = '0.3';
                    canvas.style.filter = 'none';
                } else if (cs === 'connecting') {
                    displayState.blink = (Math.sin(now * Math.PI) + 1) / 2; // slow 0.5Hz blink
                    canvas.style.opacity = '1.0';
                    canvas.style.filter = 'none';
                } else if (cs === 'error') {
                    displayState.blink = 0.5;
                    canvas.style.opacity = '1.0';
                    canvas.style.filter = 'drop-shadow(0 0 40px red) sepia(1) hue-rotate(300deg) saturate(3)';
                } else {
                    canvas.style.opacity = '1.0';
                    canvas.style.filter = 'none';
                }
            }

            renderer.render(displayState);

            // Debug HUD
            debugCanvas.width = window.innerWidth;
            debugCanvas.height = window.innerHeight;
            if (debugRef.current) {
                renderDebugHUD(debugCtx, stateRef.current, fps.value, connectedRef.current, renderer.getThemeName(), renderer.getThemeIndex());
            }

            animRef.current = requestAnimationFrame(frame);
        }

        animRef.current = requestAnimationFrame(frame);

        // ── Resize handler ──
        function onResize() {
            renderer.resize();
        }
        window.addEventListener('resize', onResize);



        // ── Cleanup ──
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
            ws.disconnect();
            renderer.destroy();
            debugCanvas.remove();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Task 6.6: Wire /health to HUD (poll every 5s)
    useEffect(() => {
        let active = true;
        const fetchHealth = async () => {
            try {
                // Route to API origin based on WS logic natively
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const apiUrl = isLocal 
                    ? 'http://localhost:8888/health' 
                    : /^192\.168\.|^10\.|^100\.|^172\.(1[6-9]|2\d|3[01])\./.test(window.location.hostname)
                        ? `http://${window.location.hostname}:8888/health`
                        : 'https://dexterslab-api.cclottaaworld.com/health';
                
                const res = await fetch(apiUrl, { cache: 'no-store' });
                if (!res.ok) throw new Error('Not OK');
                const data = await res.json();
                
                if (active) {
                    const vFps = data.video_fps !== undefined ? `${data.video_fps}` : '0';
                    const aConn = data.pi_audio_connected ? 'connected' : 'offline';
                    const ttsConn = data.pi_tts_connected ? 'ready' : 'offline';
                    const wsConn = connStateRef.current;
                    setHealthOverlay(`VIDEO: ${vFps}fps | AUDIO: ${aConn.toUpperCase()} | TTS: ${ttsConn.toUpperCase()} | WS: ${wsConn.toUpperCase()}`);
                }
            } catch {
                if (active) setHealthOverlay('HUB UNREACHABLE');
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => { active = false; clearInterval(interval); };
    }, []);

    useEffect(() => {
        // App activation is automatic: when DisplayConnector connects to
        // /ws/observer2, the AppManager's wsAutoActivate triggers onActivateDisplay.
        // No REST call needed.
        const cleanup = startApp();
        return cleanup;
    }, [startApp]);

    return (
        <div className="theme-modern-dystopian">
        <div style={{
            width: '100vw', height: '100vh',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'none',
        }}>
            {/* Back to hub */}
            <Link href="/observer" style={{
                position: 'absolute', top: 8, left: 8, zIndex: 30,
                fontSize: '10px', color: '#333', textDecoration: 'none',
                letterSpacing: '1px',
            }}>
                ← HUB
            </Link>

            {/* WebGL canvas */}
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
            />

            {/* Connection indicator */}
            {connState !== 'connected' && (
                <div style={{
                    position: 'absolute', bottom: 60, left: 0, right: 0,
                    textAlign: 'center', zIndex: 25,
                    color: connState === 'error' ? 'red' : 'rgba(255,200,50,0.8)',
                    fontFamily: 'monospace', fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    ⚠ BACKEND {connState.toUpperCase()}
                </div>
            )}

            {/* Health HUD Overlay */}
            <div style={{
                position: 'fixed', bottom: 8, right: 8,
                zIndex: 40, fontFamily: 'monospace', fontSize: '10px',
                color: 'rgba(0, 255, 200, 0.4)', pointerEvents: 'none'
            }}>
                {healthOverlay || 'WAITING FOR TELEMETRY...'}
            </div>

            {/* Text overlay (Oracle responses, reactions, ambient) */}
            {overlayText && overlayType !== 'ambient' && (
                <div style={{
                    position: 'absolute',
                    bottom: '15%',
                    left: '5vw', right: '5vw', // Prevent horizontal overflow
                    textAlign: 'center', zIndex: 25,
                    fontFamily: 'var(--font-main)',
                    fontSize: overlayType === 'oracle' ? 'clamp(16px, 4vw, 24px)' : 'clamp(20px, 6vw, 32px)',
                    lineHeight: '1.4',
                    wordWrap: 'break-word',
                    fontWeight: 'bold',
                    color: overlayType === 'oracle' ? '#0ff' :
                           overlayType === 'goodboy' ? '#ff88aa' :
                           overlayType === 'thankyou' ? '#0df' : '#0fc',
                    textShadow: '0 0 20px currentColor',
                    letterSpacing: '2px',
                    opacity: 0.9,
                    animation: 'fadeInUp 0.3s ease-out',
                    pointerEvents: 'none',
                }}>
                    {overlayText}
                </div>
            )}

            {/* Tracking Detection Alert (Disabled per user request) */}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 0.9; transform: translateY(0); }
                }
                @keyframes trackingFadeIn {
                    from { opacity: 0; letter-spacing: 12px; }
                    to { opacity: 1; letter-spacing: 4px; }
                }
                @keyframes trackingFlicker {
                    0% { opacity: 0.8; }
                    50% { opacity: 1; }
                    100% { opacity: 0.9; }
                }
                @keyframes ambientGlitch {
                    0% { opacity: 0; transform: translateX(-4px); }
                    30% { opacity: 0.9; transform: translateX(2px); }
                    50% { opacity: 0.4; transform: translateX(-1px); }
                    100% { opacity: 0.75; transform: translateX(0); }
                }
                @keyframes ambientPulse {
                    0% { opacity: 0.65; }
                    50% { opacity: 0.85; }
                    100% { opacity: 0.65; }
                }
            `}</style>
        </div>
        </div>
    );
}

// ── Debug HUD ──
function renderDebugHUD(
    ctx: CanvasRenderingContext2D,
    state: EyeState,
    fps: number,
    connected: boolean,
    themeName: string,
    themeIndex: number,
) {
    const lineH = 18;
    let y = 40;
    const x = 12;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - 8, y - 20, 420, 260);
    ctx.strokeStyle = 'rgba(0,255,200,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 8, y - 20, 420, 260);

    ctx.font = '13px monospace';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0fc';
    ctx.fillText('── OBSERVER 2 DEBUG HUD (` to close) ──', x, y);
    y += lineH + 4;

    ctx.fillStyle = connected ? '#0f0' : '#f44';
    ctx.fillText(`FPS: ${fps}  |  WS: ${connected ? 'CONNECTED' : 'OFFLINE'}  |  CAM: NATIVE`, x, y);
    y += lineH;

    const themeColors = ['#68f', '#f44', '#fa0', '#0ed'];
    ctx.fillStyle = themeColors[themeIndex] || '#fff';
    ctx.fillText(`THEME: [${themeIndex + 1}] ${themeName}  |  Keys: 1-4 to switch`, x, y);
    y += lineH;

    ctx.fillStyle = '#ccc';
    ctx.fillText(`IX: ${state.ix.toFixed(1)}  IY: ${state.iy.toFixed(1)}  Dil: ${state.dilation.toFixed(2)}  Blink: ${state.blink.toFixed(2)}`, x, y);
    y += lineH;

    ctx.fillStyle = '#ff0';
    ctx.fillText(`Emotion: ${state.emotion}  |  Entities: ${state.entityCount}  |  Sentinel: ${state.sentinel}`, x, y);
    y += lineH;

    ctx.fillStyle = '#f0f';
    ctx.fillText(`Visible: ${state.visible}  |  Blush: ${state.blush.toFixed(2)}`, x, y);
    y += lineH;

    ctx.fillStyle = '#aaa';
    ctx.fillText('Keys: S=sleep W=wake B=blush G=goodboy T=thankyou', x, y);
    y += lineH;

    ctx.fillStyle = '#0fc';
    ctx.fillText('── ARCHITECTURE: PC engine → WS → WebGL thin client ──', x, y);
    y += lineH;

    if (state.overlayText) {
        ctx.fillStyle = '#f80';
        ctx.fillText(`Overlay: "${state.overlayText}"`, x, y);
    }
}
