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
import { WSClientV2, EyeState } from '@/lib/observer2/ws-client-v2';
import { CameraStreamer } from '@/lib/observer2/camera-streamer';
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
    const debugRef = useRef(false);
    const fpsRef = useRef({ count: 0, lastTime: 0, value: 0 });

    // React state for UI overlays only
    const [connected, setConnected] = useState(false);
    const [overlayText, setOverlayText] = useState('');
    const [overlayType, setOverlayType] = useState('');

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

        // ── Initialize WebSocket client ──
        const ws = new WSClientV2();

        ws.onEyeState = (state) => {
            stateRef.current = state;

            // Update overlay text (throttled via React state)
            if (state.overlayText !== overlayText) {
                setOverlayText(state.overlayText);
                setOverlayType(state.overlayType);
            }
        };

        ws.onConnectionChange = (isConnected) => {
            connectedRef.current = isConnected;
            setConnected(isConnected);
        };

        ws.onOracleResponse = (data) => {
            setOverlayText(data.response);
            setOverlayType('oracle');
        };

        ws.connect();

        // ── Initialize camera streamer ──
        const camera = new CameraStreamer();
        camera.start(ws);

        // ── Debug HUD Canvas overlay ──
        const debugCanvas = document.createElement('canvas');
        debugCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20;';
        document.body.appendChild(debugCanvas);
        const debugCtx = debugCanvas.getContext('2d')!;

        // ── Keyboard handlers ──
        function onKeyDown(e: KeyboardEvent) {
            if (e.code === 'Backquote') {
                debugRef.current = !debugRef.current;
            }
            // Voice commands via keyboard (fallback)
            if (e.code === 'KeyS') ws.sendCommand('sleep');
            else if (e.code === 'KeyW') ws.sendCommand('wake');
            else if (e.code === 'KeyB') ws.sendCommand('blush');
            else if (e.code === 'KeyG') ws.sendCommand('goodboy');
            else if (e.code === 'KeyT') ws.sendCommand('thankyou');
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

            // Render eye from latest backend state
            renderer.render(stateRef.current);

            // Debug HUD
            debugCanvas.width = window.innerWidth;
            debugCanvas.height = window.innerHeight;
            if (debugRef.current) {
                renderDebugHUD(debugCtx, stateRef.current, fps.value, connectedRef.current, camera.isActive);
            }

            animRef.current = requestAnimationFrame(frame);
        }

        animRef.current = requestAnimationFrame(frame);

        // ── Resize handler ──
        function onResize() {
            renderer.resize();
        }
        window.addEventListener('resize', onResize);

        // ── Voice recognition (Web Speech API) ──
        let recognition: any = null;
        try {
            const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognitionCtor) {
                recognition = new SpeechRecognitionCtor();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const result = event.results[i];
                        if (result.isFinal) {
                            const text = result[0].transcript.trim().toLowerCase();
                            // Check for commands
                            if (text.includes('sleep') || text.includes('go to sleep')) {
                                ws.sendCommand('sleep');
                            } else if (text.includes('wake') || text.includes('wake up')) {
                                ws.sendCommand('wake');
                            } else if (text.includes('blush')) {
                                ws.sendCommand('blush');
                            } else if (text.includes('good boy')) {
                                ws.sendCommand('goodboy');
                            } else if (text.includes('thank you') || text.includes('thanks')) {
                                ws.sendCommand('thankyou');
                            } else {
                                // Send to Oracle
                                ws.sendOracle(text);
                            }
                        }
                    }
                };

                recognition.onerror = () => {
                    // Restart on error
                    setTimeout(() => {
                        try { recognition?.start(); } catch { /* ignore */ }
                    }, 1000);
                };

                recognition.onend = () => {
                    // Auto-restart
                    setTimeout(() => {
                        try { recognition?.start(); } catch { /* ignore */ }
                    }, 200);
                };

                recognition.start();
            }
        } catch {
            console.log('Speech recognition not available');
        }

        // ── Cleanup ──
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
            ws.disconnect();
            camera.stop();
            renderer.destroy();
            debugCanvas.remove();
            try { recognition?.stop(); } catch { /* ignore */ }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const cleanup = startApp();
        return cleanup;
    }, [startApp]);

    return (
        <div style={{
            width: '100vw', height: '100vh',
            backgroundColor: '#000',
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
            {!connected && (
                <div style={{
                    position: 'absolute', bottom: 20, left: 0, right: 0,
                    textAlign: 'center', zIndex: 25,
                    color: 'rgba(255,50,50,0.6)',
                    fontFamily: 'monospace', fontSize: '14px',
                }}>
                    ⚠ BACKEND OFFLINE — Connecting...
                </div>
            )}

            {/* Text overlay (Oracle responses, reactions) */}
            {overlayText && (
                <div style={{
                    position: 'absolute',
                    bottom: '15%', left: 0, right: 0,
                    textAlign: 'center', zIndex: 25,
                    fontFamily: "'Courier New', monospace",
                    fontSize: overlayType === 'oracle' ? '24px' : '32px',
                    fontWeight: 'bold',
                    color: overlayType === 'oracle' ? '#0ff' :
                           overlayType === 'goodboy' ? '#ff88aa' :
                           overlayType === 'thankyou' ? '#0df' : '#0fc',
                    textShadow: '0 0 20px currentColor',
                    letterSpacing: '3px',
                    opacity: 0.9,
                    animation: 'fadeInUp 0.3s ease-out',
                }}>
                    {overlayText}
                </div>
            )}

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 0.9; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

// ── Debug HUD ──
function renderDebugHUD(
    ctx: CanvasRenderingContext2D,
    state: EyeState,
    fps: number,
    connected: boolean,
    cameraActive: boolean,
) {
    const pad = 14;
    const lineH = 18;
    let y = 40;
    const x = 12;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - 8, y - 20, 380, 220);
    ctx.strokeStyle = 'rgba(0,255,200,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 8, y - 20, 380, 220);

    ctx.font = '13px monospace';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0fc';
    ctx.fillText('── OBSERVER 2 DEBUG HUD (` to close) ──', x, y);
    y += lineH + 4;

    ctx.fillStyle = connected ? '#0f0' : '#f44';
    ctx.fillText(`FPS: ${fps}  |  WS: ${connected ? 'CONNECTED' : 'OFFLINE'}  |  CAM: ${cameraActive ? 'ACTIVE' : 'OFF'}`, x, y);
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
