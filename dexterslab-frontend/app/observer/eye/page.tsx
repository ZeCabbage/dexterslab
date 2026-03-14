'use client';

/**
 * THE OBSERVER — Unified Eye Renderer
 * Merges V1 (2D canvas) and V2 (3D Three.js) into a single page.
 * Full-screen black canvas with the procedural eye.
 * Optimized for Raspberry Pi 5 + Waveshare 5" 1080×1080 circular display.
 *
 * Features:
 *  - 2D canvas eye renderer (default mode)
 *  - Sentinel mode (idle surveillance scanning)
 *  - Voice commands: sleep, wake, blush, goodboy, thankyou
 *  - Oracle Q&A via voice and text
 *  - Phone alert overlay
 *  - Debug HUD (backtick toggle)
 *  - Auto style-swap every 20-60s
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { EYE_STYLES } from '@/data/eye-styles';
import { EyeRenderer } from '@/lib/eye-renderer';
import { WireframeRenderer } from '@/lib/wireframe-renderer';
import { DecayEffect } from '@/lib/decay-effect';
import { LidRenderer } from '@/lib/lid-renderer';
import { HousingRenderer } from '@/lib/housing-renderer';
import { TextOverlay } from '@/lib/text-overlay';
import { BlinkController, SaccadeController } from '@/lib/animation-controller';
import { WebSocketClient, TrackingData, OracleEvent, VoiceCommandEvent, VoicePartialEvent } from '@/lib/websocket-client';
import { isCircularDisplay, getDisplayConfig } from '@/lib/pi-display-config';
import { PhoneAlertOverlay } from '@/lib/phone-alert-overlay';
import { OBSERVER_COMMANDS } from '@/lib/speech-recognition';
import { useVoiceListener } from '@/hooks/useVoiceListener';
import Link from 'next/link';

// ── Configuration ──
const SMOOTHING = 0.15;
function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

// ── Ask Oracle via text ──
async function askOracle(text: string): Promise<{ response: string; category: string } | null> {
  try {
    const res = await fetch('/api/oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function ObserverEye() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Detect circular display once on mount
  const [isCircular] = useState(() => isCircularDisplay());
  const [displayConfig] = useState(() => getDisplayConfig());
  const EYE_SIZE = displayConfig.eyeSize;

  // Mutable state refs (no React re-renders needed for 60fps)
  const stateRef = useRef({
    // Tracking
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    smoothFactor: SMOOTHING,
    targetDilation: 1.0,
    currentDilation: 1.0,
    somethingVisible: false,

    // Sentinel Protocol
    sentinelActive: false,
    sentinelPhase: 0,
    sentinelSweepStage: 0,
    sentinelSweepSpeed: 1.0,
    sentinelTargetX: 0,
    sentinelTargetY: 0,
    sentinelNextSweep: 0,
    sentinelZoomPhase: 0,
    sentinelDwellTime: 0,
    sentinelLastSweepType: -1,
    lastFaceTime: 0,

    // Style swap
    currentStyleIndex: 0,
    nextSwapTime: 0,

    // Sleep state
    isSleeping: false,
    sleepTarget: 0,
    sleepPhase: 0,

    // Blush state
    blushPhase: 0,
    blushTarget: 0,
    blushEndTime: 0,

    // Good Boy state
    goodBoyPhase: 0,
    goodBoyTarget: 0,
    goodBoyEndTime: 0,

    // Thank You state
    thankYouPhase: 0,
    thankYouTarget: 0,
    thankYouEndTime: 0,

    // Connection
    connected: false,

    // Debug HUD
    debugVisible: false,
    lastVoiceText: '',
    lastOracleResponse: '',
    objects: [] as { label: string; score: number }[],
    fps: 0,
    frameCount: 0,
    lastFpsTime: 0,
  });

  const startApp = useCallback(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    // Initialize renderers
    const eyeRenderer = new EyeRenderer(EYE_SIZE);
    const wireframeRenderer = new WireframeRenderer(EYE_SIZE);
    const decayEffect = new DecayEffect(EYE_SIZE, isCircular);
    const lidRenderer = new LidRenderer(EYE_SIZE, isCircular);
    const housingRenderer = new HousingRenderer(EYE_SIZE, 0.488);
    const textOverlay = new TextOverlay(EYE_SIZE);
    const blinkController = new BlinkController();
    const saccadeController = new SaccadeController(200);
    const phoneAlert = new PhoneAlertOverlay(EYE_SIZE);

    // WebSocket
    const ws = new WebSocketClient();

    ws.onTracking = (data: TrackingData) => {
      const s = stateRef.current;
      s.targetX = data.x;
      s.targetY = data.y;
      s.smoothFactor = data.smooth;
      s.targetDilation = data.dilation;
      s.somethingVisible = data.visible;
      s.objects = data.objects || [];
    };

    ws.onOracle = (data: OracleEvent) => {
      stateRef.current.lastOracleResponse = data.response;
      textOverlay.forceShow(data.response, 3.0);
    };

    ws.onCommand = (data: VoiceCommandEvent) => {
      const s = stateRef.current;
      if (data.command === 'sleep') {
        s.isSleeping = true; s.sleepTarget = 1;
      } else if (data.command === 'wake') {
        s.isSleeping = false; s.sleepTarget = 0;
      } else if (data.command === 'blush') {
        s.blushTarget = 1;
        s.blushEndTime = performance.now() / 1000 + 4.0;
      } else if (data.command === 'goodboy') {
        s.goodBoyTarget = 1;
        s.goodBoyEndTime = performance.now() / 1000 + 5.0;
      } else if (data.command === 'thankyou') {
        s.thankYouTarget = 1;
        s.thankYouEndTime = performance.now() / 1000 + 5.0;
      }
    };

    ws.onConnectionChange = (connected: boolean) => {
      stateRef.current.connected = connected;
    };

    ws.onPartial = (data: VoicePartialEvent) => {
      stateRef.current.lastVoiceText = data.text;
    };

    ws.connect();

    // Store for text input handlers
    const inputOpenRef = { current: false };
    (window as any).__observerTextOverlay = textOverlay;
    (window as any).__observerStateRef = stateRef;
    (window as any).__observerInputOpen = inputOpenRef;

    function onKeyDown(e: KeyboardEvent) {
      if (inputOpenRef.current) return;

      if (e.code === 'Backquote') {
        stateRef.current.debugVisible = !stateRef.current.debugVisible;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        const s = stateRef.current;
        let newIdx = Math.floor(Math.random() * EYE_STYLES.length);
        while (newIdx === s.currentStyleIndex && EYE_STYLES.length > 1) {
          newIdx = Math.floor(Math.random() * EYE_STYLES.length);
        }
        s.currentStyleIndex = newIdx;
        s.nextSwapTime = performance.now() / 1000 + 20 + Math.random() * 40;
      }

      const s = stateRef.current;
      if (e.code === 'KeyS') { s.isSleeping = true; s.sleepTarget = 1; }
      else if (e.code === 'KeyW') { s.isSleeping = false; s.sleepTarget = 0; }
      else if (e.code === 'KeyB') { s.blushTarget = 1; s.blushEndTime = performance.now() / 1000 + 4.0; }
      else if (e.code === 'KeyG') { s.goodBoyTarget = 1; s.goodBoyEndTime = performance.now() / 1000 + 5.0; }
      else if (e.code === 'KeyT') { s.thankYouTarget = 1; s.thankYouEndTime = performance.now() / 1000 + 5.0; }
    }
    window.addEventListener('keydown', onKeyDown);

    // ── Main Animation Loop ──
    function frame() {
      const now = performance.now() / 1000;
      const s = stateRef.current;

      // FPS counter
      s.frameCount++;
      if (now - s.lastFpsTime >= 1.0) {
        s.fps = s.frameCount;
        s.frameCount = 0;
        s.lastFpsTime = now;
      }

      // Auto style swap (20-60s)
      if (s.nextSwapTime === 0) s.nextSwapTime = now + 20 + Math.random() * 40;
      if (now >= s.nextSwapTime) {
        let newIdx = Math.floor(Math.random() * EYE_STYLES.length);
        while (newIdx === s.currentStyleIndex && EYE_STYLES.length > 1) {
          newIdx = Math.floor(Math.random() * EYE_STYLES.length);
        }
        s.currentStyleIndex = newIdx;
        s.nextSwapTime = now + 20 + Math.random() * 40;
      }

      // ── Sentinel Protocol ──
      const timeSinceFace = now - s.lastFaceTime;

      if (s.somethingVisible) {
        s.lastFaceTime = now;
        s.sentinelActive = false;
        textOverlay.sentinelMode = false;
        const trackSmooth = 0.12;
        s.currentX = lerp(s.currentX, s.targetX, trackSmooth);
        s.currentY = lerp(s.currentY, s.targetY, trackSmooth);
        s.currentDilation = lerp(s.currentDilation, s.targetDilation, 0.08);
      } else if (timeSinceFace > 2.0) {
        if (!s.sentinelActive) {
          s.sentinelActive = true;
          s.sentinelNextSweep = now + 0.5;
          s.sentinelZoomPhase = now;
          textOverlay.sentinelMode = true;
        }

        s.sentinelPhase = now;

        if (now >= s.sentinelNextSweep) {
          let sweepType = Math.floor(Math.random() * 4);
          if (sweepType === s.sentinelLastSweepType) sweepType = (sweepType + 1) % 4;
          s.sentinelLastSweepType = sweepType;
          s.sentinelSweepStage = sweepType;
          const range = 150;

          switch (sweepType) {
            case 0:
              s.sentinelTargetX = (Math.random() > 0.5 ? 1 : -1) * range * (0.6 + Math.random() * 0.4);
              s.sentinelTargetY = (Math.random() - 0.5) * 30;
              s.sentinelSweepSpeed = 0.5 + Math.random() * 0.3;
              s.sentinelDwellTime = 2.5 + Math.random() * 2.0;
              break;
            case 1:
              s.sentinelTargetX = (Math.random() - 0.5) * 40;
              s.sentinelTargetY = (Math.random() > 0.5 ? 1 : -1) * range * (0.4 + Math.random() * 0.4);
              s.sentinelSweepSpeed = 0.4 + Math.random() * 0.2;
              s.sentinelDwellTime = 1.5 + Math.random() * 2.0;
              break;
            case 2:
              s.sentinelTargetX = (Math.random() > 0.5 ? 1 : -1) * range * (0.5 + Math.random() * 0.5);
              s.sentinelTargetY = (Math.random() > 0.5 ? 1 : -1) * range * (0.3 + Math.random() * 0.4);
              s.sentinelSweepSpeed = 0.6 + Math.random() * 0.4;
              s.sentinelDwellTime = 2.0 + Math.random() * 2.5;
              break;
            case 3:
              s.sentinelTargetX = (Math.random() - 0.5) * range * 1.5;
              s.sentinelTargetY = (Math.random() - 0.5) * range * 0.8;
              s.sentinelSweepSpeed = 1.2 + Math.random() * 0.5;
              s.sentinelDwellTime = 3.0 + Math.random() * 3.0;
              break;
          }
          s.sentinelNextSweep = now + s.sentinelDwellTime;
        }

        const driftX = Math.sin(now * 0.35) * 15 + Math.sin(now * 0.13) * 8 + Math.sin(now * 0.7) * 3;
        const driftY = Math.cos(now * 0.28) * 10 + Math.cos(now * 0.11) * 6 + Math.cos(now * 0.55) * 2;
        const sweepLerp = 0.03 * s.sentinelSweepSpeed;
        s.currentX = lerp(s.currentX, s.sentinelTargetX + driftX, sweepLerp);
        s.currentY = lerp(s.currentY, s.sentinelTargetY + driftY, sweepLerp);

        const zoomBase = 1.0;
        const zoomSlow = Math.sin(now * 0.4) * 0.25;
        const zoomMed = Math.sin(now * 1.1) * 0.12;
        const zoomFast = Math.sin(now * 3.0) * 0.04;
        const zoomSpike = Math.pow(Math.sin(now * 0.15), 8) * 0.35;
        const sentinelDilation = Math.max(0.5, Math.min(1.6, zoomBase + zoomSlow + zoomMed + zoomFast + zoomSpike));
        s.currentDilation = lerp(s.currentDilation, sentinelDilation, 0.06);
      } else {
        s.currentX = lerp(s.currentX, s.targetX, 0.06);
        s.currentY = lerp(s.currentY, s.targetY, 0.06);
        s.currentDilation = lerp(s.currentDilation, 1.0, 0.03);
      }

      s.sleepPhase = lerp(s.sleepPhase, s.sleepTarget, 0.05);

      // Blush
      if (s.blushTarget > 0 && now >= s.blushEndTime) s.blushTarget = 0;
      s.blushPhase = lerp(s.blushPhase, s.blushTarget, 0.08);

      // Blink
      const blinkPhase = blinkController.update();
      const totalLidPhase = Math.min(1.0, Math.max(blinkPhase, s.sleepPhase));

      // Current style
      const currentStyle = EYE_STYLES[s.currentStyleIndex];
      const [saccX, saccY] = saccadeController.update();
      const drawX = s.currentX + saccX;
      const drawY = s.currentY + saccY;

      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.save();
      ctx.translate(cx - EYE_SIZE / 2, cy - EYE_SIZE / 2);

      // Circular display clip
      if (isCircular) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(EYE_SIZE / 2, EYE_SIZE / 2, EYE_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      // Render eye
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, EYE_SIZE, EYE_SIZE);
      eyeRenderer.draw(ctx, currentStyle, drawX, drawY, s.currentDilation);
      lidRenderer.render(ctx, totalLidPhase);
      if (!isCircular) housingRenderer.render(ctx);
      decayEffect.apply(ctx, now);

      // Blush marks
      if (s.blushPhase > 0.01) {
        const blushAlpha = s.blushPhase * 0.6;
        const blushY = EYE_SIZE * 0.62;
        const blushSpread = EYE_SIZE * 0.28;
        const markSize = EYE_SIZE * 0.04;

        ctx.strokeStyle = `rgba(255, 80, 100, ${blushAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const bx = EYE_SIZE * 0.5 - blushSpread + i * markSize * 1.8;
          const by = blushY + (i % 2 === 0 ? -2 : 2);
          ctx.beginPath();
          ctx.moveTo(bx - markSize * 0.6, by - markSize * 0.3);
          ctx.lineTo(bx + markSize * 0.6, by + markSize * 0.3);
          ctx.stroke();
        }
        for (let i = 0; i < 3; i++) {
          const bx = EYE_SIZE * 0.5 + blushSpread - (2 - i) * markSize * 1.8;
          const by = blushY + (i % 2 === 0 ? -2 : 2);
          ctx.beginPath();
          ctx.moveTo(bx - markSize * 0.6, by - markSize * 0.3);
          ctx.lineTo(bx + markSize * 0.6, by + markSize * 0.3);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255, 120, 140, ${blushAlpha * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(EYE_SIZE * 0.5 - blushSpread + markSize, blushY, markSize * 3, markSize * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(EYE_SIZE * 0.5 + blushSpread - markSize, blushY, markSize * 3, markSize * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Text overlay
      textOverlay.update();
      if (textOverlay.isShowing) textOverlay.render(ctx);

      // Phone alert
      phoneAlert.update(s.objects, performance.now());
      if (phoneAlert.isActive) phoneAlert.render(ctx, performance.now());

      // Good Boy overlay
      if (s.goodBoyTarget > 0 && now >= s.goodBoyEndTime) s.goodBoyTarget = 0;
      s.goodBoyPhase = lerp(s.goodBoyPhase, s.goodBoyTarget, 0.1);
      if (s.goodBoyPhase > 0.01) {
        const alpha = Math.min(1.0, s.goodBoyPhase);
        ctx.fillStyle = `rgba(10, 5, 20, ${alpha * 0.6})`;
        ctx.fillRect(0, 0, EYE_SIZE, EYE_SIZE);
        ctx.font = `${Math.floor(EYE_SIZE * 0.04)}px monospace`;
        const heartColors = ['rgba(255,100,150,', 'rgba(255,180,200,', 'rgba(200,80,120,'];
        for (let h = 0; h < 6; h++) {
          const hx = EYE_SIZE * 0.2 + (h * EYE_SIZE * 0.12);
          const baseY = EYE_SIZE * 0.15;
          const hy = baseY + Math.sin(now * 3 + h * 1.2) * EYE_SIZE * 0.04;
          const ha = alpha * (0.5 + 0.3 * Math.sin(now * 4 + h));
          ctx.fillStyle = `${heartColors[h % 3]}${ha})`;
          ctx.fillText('♥', hx, hy);
        }
        const textSize = Math.floor(EYE_SIZE * 0.06);
        ctx.font = `bold ${textSize}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(0, 220, 255, ${alpha * (0.85 + 0.15 * Math.sin(now * 4))})`;
        ctx.fillText('GOOD BOY', EYE_SIZE / 2, EYE_SIZE * 0.85);
      }

      // Thank You overlay
      if (s.thankYouTarget > 0 && now >= s.thankYouEndTime) s.thankYouTarget = 0;
      s.thankYouPhase = lerp(s.thankYouPhase, s.thankYouTarget, 0.1);
      if (s.thankYouPhase > 0.01) {
        const alpha = Math.min(1.0, s.thankYouPhase);
        ctx.fillStyle = `rgba(5, 15, 20, ${alpha * 0.65})`;
        ctx.fillRect(0, 0, EYE_SIZE, EYE_SIZE);
        const textSize = Math.floor(EYE_SIZE * 0.055);
        ctx.font = `bold ${textSize}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(0, 220, 255, ${alpha * (0.85 + 0.15 * Math.sin(now * 4))})`;
        ctx.fillText('YOU ARE WELCOME HUMAN', EYE_SIZE / 2, EYE_SIZE * 0.83);
      }

      // Close circular clip
      if (isCircular) ctx.restore();
      ctx.restore();

      // Connection indicator
      if (!s.connected) {
        ctx.fillStyle = 'rgba(255,50,50,0.6)';
        ctx.font = isCircular ? '12px monospace' : '14px monospace';
        ctx.textAlign = 'center';
        const connY = isCircular ? canvas.height / 2 + EYE_SIZE * 0.4 : canvas.height - 20;
        ctx.fillText('⚠ BACKEND OFFLINE — Connecting...', canvas.width / 2, connY);
      }

      // Debug HUD
      if (s.debugVisible) {
        const pad = 14;
        const lineH = 18;
        const hudX = isCircular ? canvas.width / 2 - EYE_SIZE * 0.35 : 12;
        let hudY = isCircular ? canvas.height / 2 - EYE_SIZE * 0.3 : 36;

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(hudX - 8, hudY - 20, 340, 260);
        ctx.strokeStyle = 'rgba(0,255,200,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(hudX - 8, hudY - 20, 340, 260);

        ctx.font = '13px monospace';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#0fc';
        ctx.fillText(`── DEBUG HUD (\` to close) ──  ${isCircular ? '[PI MODE]' : '[DESKTOP]'}`, hudX, hudY);
        hudY += lineH + 4;

        ctx.fillStyle = s.connected ? '#0f0' : '#f44';
        ctx.fillText(`FPS: ${s.fps}  |  WS: ${s.connected ? 'CONNECTED' : 'OFFLINE'}`, hudX, hudY);
        hudY += lineH;

        ctx.fillStyle = '#aaa';
        ctx.fillText(`Eye: ${EYE_SIZE}×${EYE_SIZE}  Canvas: ${canvas.width}×${canvas.height}`, hudX, hudY);
        hudY += lineH;

        ctx.fillStyle = '#ccc';
        ctx.fillText(`X: ${s.currentX.toFixed(1)}  Y: ${s.currentY.toFixed(1)}  Dil: ${s.currentDilation.toFixed(2)}`, hudX, hudY);
        hudY += lineH;

        ctx.fillStyle = '#f0f';
        ctx.fillText(`Style: ${EYE_STYLES[s.currentStyleIndex].name} (${s.currentStyleIndex + 1}/${EYE_STYLES.length})  [SPACE]`, hudX, hudY);
        hudY += lineH;

        ctx.fillStyle = '#0fc';
        ctx.fillText('── OBJECTS ──', hudX, hudY);
        hudY += lineH;
        if (s.objects.length === 0) {
          ctx.fillStyle = '#666';
          ctx.fillText('  (none)', hudX, hudY);
          hudY += lineH;
        } else {
          ctx.fillStyle = '#aff';
          for (const obj of s.objects) {
            ctx.fillText(`  • ${obj.label}`, hudX, hudY);
            hudY += lineH;
          }
        }

        ctx.fillStyle = '#ff0';
        ctx.fillText(`  MIC: "${s.lastVoiceText || '(silence)'}"`, hudX, hudY);
        hudY += lineH;
        if (s.lastOracleResponse) {
          ctx.fillStyle = '#f80';
          ctx.fillText(`  ORACLE: "${s.lastOracleResponse}"`, hudX, hudY);
        }
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      ws.disconnect();
    };
  }, [EYE_SIZE, isCircular]);

  // ── Initialize canvas and renderers ──
  useEffect(() => {
    const cleanup = startApp();
    return cleanup;
  }, [startApp]);

  // ── Canvas sizing ──
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Web Speech API ──
  useVoiceListener({
    commands: OBSERVER_COMMANDS,
    onCommand: (cmd) => {
      const s = stateRef.current;
      if (cmd === 'sleep') { s.isSleeping = true; s.sleepTarget = 1; }
      else if (cmd === 'wake') { s.isSleeping = false; s.sleepTarget = 0; }
      else if (cmd === 'blush') { s.blushTarget = 1; s.blushEndTime = performance.now() / 1000 + 4.0; }
      else if (cmd === 'goodboy') { s.goodBoyTarget = 1; s.goodBoyEndTime = performance.now() / 1000 + 5.0; }
      else if (cmd === 'thankyou') { s.thankYouTarget = 1; s.thankYouEndTime = performance.now() / 1000 + 5.0; }
    },
    onFinal: (text) => {
      stateRef.current.lastVoiceText = text;
      askOracle(text).then((result) => {
        if (result?.response) {
          const overlay = (window as any).__observerTextOverlay as TextOverlay | undefined;
          if (overlay) overlay.forceShow(result.response, 4.0);
          stateRef.current.lastOracleResponse = result.response;
        }
      });
    },
    onPartial: (text) => {
      if (text) stateRef.current.lastVoiceText = text;
    },
  });

  return (
    <div style={{
      width: '100vw', height: '100vh',
      backgroundColor: '#000',
      overflow: 'hidden',
      position: 'relative',
      cursor: 'none',
    }}>
      {/* Back to hub — only visible on desktop/debug */}
      <Link href="/observer" style={{
        position: 'absolute', top: 8, left: 8, zIndex: 30,
        fontSize: '10px', color: '#333', textDecoration: 'none',
        letterSpacing: '1px',
      }}>
        ← HUB
      </Link>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
