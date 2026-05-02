'use client';

/**
 * JULIAN WHACKER — Zit Popper Arcade
 * Pop the zits on Julian's face before they disappear!
 * Leisure Suit Larry inspired visual style.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import {
  drawJulianFace,
  drawZit,
  drawPopParticles,
  drawSplatMarks,
} from './lib/julian-renderer';
import {
  GameState,
  createInitialState,
  startGame,
  spawnZit,
  popZitAt,
  gameTick,
  tickTimer,
  getSpawnIntervalMs,
} from './lib/game-engine';

// Canvas size — hi-res but scales to fit
const CW = 600;
const CH = 700;

export default function JulianWhackerPage() {
  const [time, setTime] = useState('');
  const [game, setGame] = useState<GameState>(createInitialState);
  const [scorePopups, setScorePopups] = useState<Array<{id: number; x: number; y: number; text: string; frame: number}>>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceImageRef = useRef<ImageData | null>(null);
  const gameRef = useRef(game);
  const animFrameRef = useRef<number>(0);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupIdRef = useRef(0);

  // Keep ref in sync
  gameRef.current = game;

  // ── Clock ──
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Pre-render the static face ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw face once, save as ImageData for fast re-blitting
    drawJulianFace(ctx, CW, CH);
    faceImageRef.current = ctx.getImageData(0, 0, CW, CH);
  }, []);

  // ── Game timer (1s) ──
  useEffect(() => {
    if (game.phase !== 'playing') return;
    const id = setInterval(() => {
      setGame(prev => tickTimer(prev));
    }, 1000);
    return () => clearInterval(id);
  }, [game.phase]);

  // ── Zit spawning ──
  useEffect(() => {
    if (game.phase !== 'playing') return;

    const scheduleSpawn = () => {
      const interval = getSpawnIntervalMs(gameRef.current);
      spawnTimerRef.current = setTimeout(() => {
        setGame(prev => spawnZit(prev, CW, CH));
        scheduleSpawn();
      }, interval);
    };

    // Initial spawn after short delay
    spawnTimerRef.current = setTimeout(() => {
      setGame(prev => spawnZit(prev, CW, CH));
      scheduleSpawn();
    }, 500);

    return () => {
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    };
  }, [game.phase, game.level]);

  // ── Main render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Tick game state
      if (gameRef.current.phase === 'playing') {
        setGame(prev => gameTick(prev, delta));
      }

      const g = gameRef.current;

      // Redraw face background
      if (faceImageRef.current) {
        ctx.putImageData(faceImageRef.current, 0, 0);
      }

      // Draw splat marks (under zits)
      drawSplatMarks(ctx, g.splatMarks);

      // Draw active zits
      for (const zit of g.zits) {
        drawZit(ctx, zit, now);
      }

      // Draw particles
      drawPopParticles(ctx, g.particles);

      // Draw score popups
      setScorePopups(prev => {
        const updated = prev
          .map(p => ({ ...p, frame: p.frame + 1 }))
          .filter(p => p.frame < 40);
        return updated;
      });

      // Render score popups on canvas
      const popups = scorePopups;
      for (const p of popups) {
        const alpha = Math.max(0, 1 - p.frame / 40);
        const yOffset = p.frame * 1.2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${16 + p.text.length}px 'Luckiest Guy', cursive`;
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.strokeText(p.text, p.x, p.y - yOffset);
        ctx.fillText(p.text, p.x, p.y - yOffset);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [scorePopups]);

  // ── Handle canvas clicks ──
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameRef.current.phase !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    setGame(prev => {
      const result = popZitAt(prev, clickX, clickY);
      if (result.hit && result.points) {
        popupIdRef.current++;
        setScorePopups(pp => [...pp, {
          id: popupIdRef.current,
          x: clickX,
          y: clickY,
          text: `+${result.points}`,
          frame: 0,
        }]);
      }
      return result.state;
    });
  }, []);

  // ── Start game ──
  const handleStart = useCallback(() => {
    // Re-render face (clears splats)
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawJulianFace(ctx, CW, CH);
        faceImageRef.current = ctx.getImageData(0, 0, CW, CH);
      }
    }
    setScorePopups([]);
    setGame(prev => startGame(prev));
  }, []);

  const setDifficulty = useCallback((diff: GameState['difficulty']) => {
    setGame(prev => ({ ...prev, difficulty: diff }));
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← BACK</Link>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>JULIAN WHACKER</h1>
          <p className={styles.subtitle}>POP THE ZITS!</p>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,77,166,0.4)' }}>{time}</span>
      </header>

      {/* HUD */}
      {game.phase === 'playing' && (
        <div className={styles.hud}>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>SCORE</span>
            <span className={`${styles.hudValue} ${styles.scoreValue}`}>{game.score}</span>
          </div>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>TIME</span>
            <span className={`${styles.hudValue} ${styles.timerValue} ${game.timeLeft <= 10 ? styles.timerDanger : ''}`}>
              {game.timeLeft}
            </span>
          </div>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>COMBO</span>
            <span className={`${styles.hudValue} ${styles.comboValue}`}>
              {game.combo > 0 ? `x${game.combo}` : '-'}
            </span>
          </div>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>LEVEL</span>
            <span className={`${styles.hudValue} ${styles.levelValue}`}>{game.level}</span>
          </div>
          <div className={styles.hudItem}>
            <span className={styles.hudLabel}>LIVES</span>
            <div className={styles.livesRow}>
              {Array.from({ length: game.maxMisses }).map((_, i) => (
                <span
                  key={i}
                  className={`${styles.lifeIcon} ${
                    i < game.maxMisses - game.misses ? styles.lifeActive : styles.lifeUsed
                  }`}
                >
                  💊
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Canvas */}
      <div className={styles.gameArea}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className={styles.gameCanvas}
          onClick={handleCanvasClick}
          id="game-canvas"
        />
      </div>

      {/* Start Overlay */}
      {game.phase === 'idle' && (
        <div className={styles.overlay}>
          <div className={`${styles.overlayTitle} ${styles.overlayTitlePink}`}>
            JULIAN<br/>WHACKER
          </div>
          <div className={styles.overlaySubtitle}>
            Pop the zits on Julian&apos;s face!<br/>
            Don&apos;t let 5 escape or it&apos;s game over!
          </div>
          <div className={styles.overlayFlavorText}>
            &quot;Dude, your face looks like a pizza...&quot;
          </div>

          {/* Difficulty */}
          <div className={styles.difficultyRow}>
            {(['easy', 'normal', 'hard'] as const).map(d => (
              <button
                key={d}
                className={`${styles.diffBtn} ${game.difficulty === d ? styles.diffBtnActive : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          {game.highScore > 0 && (
            <div className={styles.overlayFlavorText}>
              HIGH SCORE: {game.highScore}
            </div>
          )}

          <button className={styles.startBtn} onClick={handleStart} id="start-btn">
            START POPPING!
          </button>
        </div>
      )}

      {/* Game Over Overlay */}
      {game.phase === 'gameover' && (
        <div className={styles.overlay}>
          <div className={`${styles.overlayTitle} ${
            game.score >= game.highScore && game.score > 0
              ? styles.overlayTitleGold
              : styles.overlayTitleRed
          }`}>
            {game.score >= game.highScore && game.score > 0
              ? 'NEW HIGH\nSCORE!'
              : 'GAME\nOVER'}
          </div>

          <div className={styles.overlayStats}>
            <div className={styles.overlayStat}>
              <span className={styles.overlayStatLabel}>SCORE</span>
              <span className={styles.overlayStatValue}>{game.score}</span>
            </div>
            <div className={styles.overlayStat}>
              <span className={styles.overlayStatLabel}>POPPED</span>
              <span className={styles.overlayStatValue}>{game.zitsPopped}</span>
            </div>
            <div className={styles.overlayStat}>
              <span className={styles.overlayStatLabel}>COMBO</span>
              <span className={styles.overlayStatValue}>{game.maxCombo}</span>
            </div>
            <div className={styles.overlayStat}>
              <span className={styles.overlayStatLabel}>LEVEL</span>
              <span className={styles.overlayStatValue}>{game.level}</span>
            </div>
          </div>

          <div className={styles.overlayFlavorText}>
            {game.zitsPopped === 0
              ? '"Julian walks away unscathed. Pathetic."'
              : game.zitsPopped < 5
              ? '"Barely scratched the surface... literally."'
              : game.zitsPopped < 15
              ? '"Not bad, but Julian\'s still a pepperoni pizza."'
              : game.zitsPopped < 30
              ? '"Dermatologist in training! Nice work!"'
              : '"CERTIFIED PIMPLE DESTROYER! Julian is smooth!"'}
          </div>

          <button className={styles.startBtn} onClick={handleStart} id="retry-btn">
            POP AGAIN!
          </button>
        </div>
      )}
    </div>
  );
}
