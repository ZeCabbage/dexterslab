/**
 * JULIAN WHACKER — Game Engine
 * Zits pop up on Julian's face. Click them to pop.
 * Miss too many and it's game over.
 */

import {
  ActiveZit,
  ZIT_ZONES,
  PopParticle,
  SplatMark,
  createPopParticles,
  createSplatMark,
  updateParticles,
  updateSplatMarks,
} from './julian-renderer';

export interface GameState {
  phase: 'idle' | 'playing' | 'gameover';
  score: number;
  combo: number;
  maxCombo: number;
  level: number;
  timeLeft: number;
  totalTime: number;
  misses: number;
  maxMisses: number;
  zitsPopped: number;
  zitsEscaped: number;
  zits: ActiveZit[];
  particles: PopParticle[];
  splatMarks: SplatMark[];
  highScore: number;
  nextZitId: number;
  difficulty: 'easy' | 'normal' | 'hard';
}

const LS_KEY = 'julian-whacker-highscore';
const BASE_TIME = 60;
const MAX_MISSES = 5;
const LEVEL_THRESHOLD = 400;

export function getHighScore(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(LS_KEY) || '0', 10);
}

function saveHighScore(score: number): void {
  if (typeof window === 'undefined') return;
  const current = getHighScore();
  if (score > current) localStorage.setItem(LS_KEY, String(score));
}

export function createInitialState(): GameState {
  return {
    phase: 'idle',
    score: 0,
    combo: 0,
    maxCombo: 0,
    level: 1,
    timeLeft: BASE_TIME,
    totalTime: BASE_TIME,
    misses: 0,
    maxMisses: MAX_MISSES,
    zitsPopped: 0,
    zitsEscaped: 0,
    zits: [],
    particles: [],
    splatMarks: [],
    highScore: getHighScore(),
    nextZitId: 1,
    difficulty: 'normal',
  };
}

export function startGame(prev: GameState): GameState {
  return {
    ...createInitialState(),
    phase: 'playing',
    highScore: prev.highScore,
    difficulty: prev.difficulty,
  };
}

// ── Difficulty modifiers ──
function diffMultiplier(d: GameState['difficulty']): { spawnRate: number; duration: number; maxZits: number } {
  switch (d) {
    case 'easy':   return { spawnRate: 1.4, duration: 1.5, maxZits: 3 };
    case 'normal': return { spawnRate: 1.0, duration: 1.0, maxZits: 5 };
    case 'hard':   return { spawnRate: 0.6, duration: 0.6, maxZits: 8 };
  }
}

// ── Spawning ──

function getSpawnInterval(level: number, diff: GameState['difficulty']): number {
  const base = 1800 * diffMultiplier(diff).spawnRate;
  return Math.max(350, base - level * 100);
}

function getZitDuration(level: number, severity: 1 | 2 | 3, diff: GameState['difficulty']): number {
  const base = 3500 * diffMultiplier(diff).duration;
  const levelMod = Math.max(0.4, 1 - level * 0.05);
  const severityMod = severity === 1 ? 1.2 : severity === 2 ? 1.0 : 0.75;
  return base * levelMod * severityMod;
}

function getMaxConcurrentZits(level: number, diff: GameState['difficulty']): number {
  const base = diffMultiplier(diff).maxZits;
  return Math.min(base + 3, base + Math.floor(level * 0.4));
}

function pickSeverity(level: number): 1 | 2 | 3 {
  const r = Math.random();
  if (level < 3) return r < 0.6 ? 1 : 2;
  if (level < 5) return r < 0.3 ? 1 : r < 0.75 ? 2 : 3;
  return r < 0.2 ? 1 : r < 0.55 ? 2 : 3;
}

function getPoints(severity: 1 | 2 | 3): number {
  return severity === 1 ? 50 : severity === 2 ? 100 : 200;
}

export function spawnZit(state: GameState, canvasW: number, canvasH: number): GameState {
  if (state.phase !== 'playing') return state;

  const activeZits = state.zits.filter(z => z.status !== 'popped' && z.status !== 'escaped');
  if (activeZits.length >= getMaxConcurrentZits(state.level, state.difficulty)) return state;

  // Pick a zone that doesn't already have a zit
  const usedZones = new Set(activeZits.map(z => z.zone.id));
  const availableZones = ZIT_ZONES.filter(z => !usedZones.has(z.id));
  if (availableZones.length === 0) return state;

  const zone = availableZones[Math.floor(Math.random() * availableZones.length)];
  const severity = pickSeverity(state.level);

  // Convert normalized zone coords to canvas coords
  const jitter = zone.radius * (Math.random() - 0.5) * 2;
  const x = (zone.cx + jitter * 0.5) * canvasW;
  const y = (zone.cy + jitter * 0.5) * canvasH;

  const baseRadius = canvasW * 0.022;
  const radius = baseRadius * (0.8 + severity * 0.3);
  const duration = getZitDuration(state.level, severity, state.difficulty);

  const newZit: ActiveZit = {
    id: state.nextZitId,
    zone,
    x,
    y,
    radius,
    hitRadius: radius * 2.2, // generous hit area
    growthPhase: 0,
    maxGrowth: 600 + severity * 200, // ms to fully grow
    lifetime: duration,
    spawnedAt: Date.now(),
    status: 'growing',
    popFrame: 0,
    severity,
    points: getPoints(severity),
  };

  return {
    ...state,
    zits: [...state.zits, newZit],
    nextZitId: state.nextZitId + 1,
  };
}

// ── Clicking / popping ──

export function popZitAt(
  state: GameState,
  clickX: number,
  clickY: number
): { state: GameState; hit: boolean; points?: number } {
  if (state.phase !== 'playing') return { state, hit: false };

  // Find the closest clickable zit
  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < state.zits.length; i++) {
    const z = state.zits[i];
    if (z.status !== 'growing' && z.status !== 'ready') continue;
    const dist = Math.hypot(clickX - z.x, clickY - z.y);
    if (dist <= z.hitRadius && dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) {
    // Missed
    return { state: { ...state, combo: 0 }, hit: false };
  }

  const zit = state.zits[bestIdx];
  const newCombo = state.combo + 1;
  const comboMultiplier = Math.min(5, 1 + Math.floor(newCombo / 3));
  const points = zit.points * comboMultiplier;
  const newScore = state.score + points;

  // Generate particles
  const newParticles = createPopParticles(zit);
  const newSplat = createSplatMark(zit);

  const updatedZits = [...state.zits];
  updatedZits[bestIdx] = { ...zit, status: 'popping', popFrame: 0 };

  return {
    state: {
      ...state,
      score: newScore,
      combo: newCombo,
      maxCombo: Math.max(state.maxCombo, newCombo),
      level: Math.floor(newScore / LEVEL_THRESHOLD) + 1,
      zitsPopped: state.zitsPopped + 1,
      zits: updatedZits,
      particles: [...state.particles, ...newParticles],
      splatMarks: [...state.splatMarks, newSplat],
    },
    hit: true,
    points,
  };
}

// ── Game tick (called every frame) ──

export function gameTick(state: GameState, deltaMs: number): GameState {
  if (state.phase !== 'playing') return state;

  const now = Date.now();
  let newMisses = state.misses;
  let newEscaped = state.zitsEscaped;
  let newCombo = state.combo;

  const updatedZits = state.zits
    .map(zit => {
      const elapsed = now - zit.spawnedAt;

      if (zit.status === 'growing') {
        const growth = Math.min(1, elapsed / zit.maxGrowth);
        if (growth >= 1) {
          return { ...zit, growthPhase: 1, status: 'ready' as const };
        }
        return { ...zit, growthPhase: growth };
      }

      if (zit.status === 'ready') {
        if (elapsed > zit.lifetime) {
          newMisses++;
          newEscaped++;
          newCombo = 0;
          return { ...zit, status: 'escaped' as const };
        }
        return zit;
      }

      if (zit.status === 'popping') {
        const newFrame = zit.popFrame + 1;
        if (newFrame >= 10) {
          return { ...zit, status: 'popped' as const, popFrame: newFrame };
        }
        return { ...zit, popFrame: newFrame };
      }

      return zit;
    })
    .filter(z => z.status !== 'popped' && z.status !== 'escaped');

  const isGameOver = newMisses >= state.maxMisses;
  if (isGameOver) saveHighScore(state.score);

  return {
    ...state,
    zits: updatedZits,
    particles: updateParticles(state.particles),
    splatMarks: updateSplatMarks(state.splatMarks),
    misses: newMisses,
    zitsEscaped: newEscaped,
    combo: newCombo,
    phase: isGameOver ? 'gameover' : state.phase,
  };
}

// ── Timer tick (called every second) ──

export function tickTimer(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const newTime = state.timeLeft - 1;
  if (newTime <= 0) {
    saveHighScore(state.score);
    return { ...state, timeLeft: 0, phase: 'gameover' };
  }
  return { ...state, timeLeft: newTime };
}

// ── Helpers ──

export function getSpawnIntervalMs(state: GameState): number {
  return getSpawnInterval(state.level, state.difficulty);
}
