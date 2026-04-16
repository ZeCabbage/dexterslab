'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from '../page.module.css';
import { Dog } from '../lib/dogs';
import {
  CombatState,
  CombatEvent,
  initCombat,
  tickCombat,
  TICKS_PER_SECOND,
} from '../lib/combat-engine';
import {
  drawDog,
  drawArena,
  drawHealthBars,
  drawTimer,
  drawCommentary,
  spawnHitParticles,
  updateAndDrawParticles,
  Particle,
} from '../lib/sprite-renderer';

interface CombatArenaProps {
  dog1: Dog;
  dog2: Dog;
  onFinished: (combatState: CombatState) => void;
}

export default function CombatArena({ dog1, dog2, onFinished }: CombatArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const combatStateRef = useRef<CombatState>(initCombat(dog1, dog2));
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef(0);
  const lastTickTimeRef = useRef(0);
  const lastCommentaryRef = useRef('ROUND 1 — FIGHT!');
  const lastEventCountRef = useRef(0);
  const screenShakeRef = useRef(0);
  const hitFreezeRef = useRef(0);
  const koFlashRef = useRef(false);
  const [showKO, setShowKO] = useState(false);
  const finishedRef = useRef(false);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 400;

  // Main game loop
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = combatStateRef.current;

    // ── Hit freeze (pause on big hits for impact) ──
    if (hitFreezeRef.current > 0) {
      hitFreezeRef.current--;
      requestAnimationFrame(gameLoop);
      return;
    }

    // ── Combat ticking (10 tps) ──
    if (!state.isFinished) {
      const msPerTick = 1000 / TICKS_PER_SECOND;
      if (timestamp - lastTickTimeRef.current >= msPerTick) {
        lastTickTimeRef.current = timestamp;
        tickCombat(state);

        // Check for new events
        if (state.events.length > lastEventCountRef.current) {
          const newEvents = state.events.slice(lastEventCountRef.current);
          lastEventCountRef.current = state.events.length;

          for (const event of newEvents) {
            // Update commentary
            lastCommentaryRef.current = event.text;

            // Spawn particles on hits
            if (['hit', 'critical', 'combo', 'counter'].includes(event.type)) {
              const hitX = state.fighters[event.defender].x;
              particlesRef.current.push(...spawnHitParticles(hitX, 270));

              // Hit freeze (longer for crits)
              hitFreezeRef.current = event.type === 'critical' ? 6 : 3;

              // Screen shake
              screenShakeRef.current = event.type === 'critical' ? 8 : 4;
            }

            // KO flash
            if (event.type === 'ko') {
              koFlashRef.current = true;
              setShowKO(true);
              screenShakeRef.current = 12;
            }
          }
        }
      }
    }

    // ── Render ──
    animFrameRef.current++;
    const frame = animFrameRef.current;

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (screenShakeRef.current > 0) {
      shakeX = (Math.random() - 0.5) * screenShakeRef.current * 2;
      shakeY = (Math.random() - 0.5) * screenShakeRef.current * 2;
      screenShakeRef.current *= 0.85;
      if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

    // Arena background
    drawArena(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, frame);

    // Draw dogs
    drawDog(ctx, state.fighters[0], frame);
    drawDog(ctx, state.fighters[1], frame);

    // Particles
    particlesRef.current = updateAndDrawParticles(ctx, particlesRef.current);

    // HUD
    drawHealthBars(ctx, state.fighters, CANVAS_WIDTH);
    drawTimer(ctx, state.roundTimer, CANVAS_WIDTH);
    drawCommentary(ctx, lastCommentaryRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.restore();

    // ── KO white flash ──
    if (koFlashRef.current) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      koFlashRef.current = false;
    }

    // Continue loop or finish
    if (!state.isFinished) {
      requestAnimationFrame(gameLoop);
    } else if (!finishedRef.current) {
      // Let KO animation play for 2 seconds before transitioning
      finishedRef.current = true;
      setTimeout(() => {
        onFinished(state);
      }, 2500);
      // Keep rendering for the victory animation
      const victoryLoop = (ts: number) => {
        animFrameRef.current++;
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawArena(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, animFrameRef.current);
        drawDog(ctx, state.fighters[0], animFrameRef.current);
        drawDog(ctx, state.fighters[1], animFrameRef.current);
        particlesRef.current = updateAndDrawParticles(ctx, particlesRef.current);
        drawHealthBars(ctx, state.fighters, CANVAS_WIDTH);
        drawTimer(ctx, state.roundTimer, CANVAS_WIDTH);
        drawCommentary(ctx, lastCommentaryRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
        if (finishedRef.current) requestAnimationFrame(victoryLoop);
      };
      requestAnimationFrame(victoryLoop);
    }
  }, [dog1, dog2, onFinished]);

  useEffect(() => {
    // Initialize combat
    combatStateRef.current = initCombat(dog1, dog2);
    lastEventCountRef.current = 1; // Skip the fight_start event for commentary
    finishedRef.current = false;
    setShowKO(false);
    lastTickTimeRef.current = performance.now();

    requestAnimationFrame(gameLoop);

    return () => {
      finishedRef.current = true; // Stop victory loop on unmount
    };
  }, [dog1, dog2, gameLoop]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }
  }, []);

  return (
    <div className={styles.combatScreen}>
      <canvas
        ref={canvasRef}
        className={styles.arenaCanvas}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      {showKO && <div className={styles.koText}>K.O.!</div>}
    </div>
  );
}
