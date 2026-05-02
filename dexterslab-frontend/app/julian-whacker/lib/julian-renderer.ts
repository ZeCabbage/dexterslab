/**
 * JULIAN FACE RENDERER
 * Draws a big 3D-looking Julian face on canvas.
 * Zits pop up on the face and the player clicks them to pop.
 * Popping triggers a satisfying whitehead splatter animation.
 */

// ── Zit zones where pimples can spawn (normalized 0-1 coords on face) ──
export interface ZitZone {
  id: string;
  label: string;
  cx: number; // center x (0-1)
  cy: number; // center y (0-1)
  radius: number; // spawn radius
}

export const ZIT_ZONES: ZitZone[] = [
  { id: 'forehead-l',   label: 'Forehead L',    cx: 0.38, cy: 0.22, radius: 0.06 },
  { id: 'forehead-c',   label: 'Forehead C',    cx: 0.50, cy: 0.18, radius: 0.05 },
  { id: 'forehead-r',   label: 'Forehead R',    cx: 0.62, cy: 0.22, radius: 0.06 },
  { id: 'temple-l',     label: 'Temple L',      cx: 0.30, cy: 0.30, radius: 0.04 },
  { id: 'temple-r',     label: 'Temple R',      cx: 0.70, cy: 0.30, radius: 0.04 },
  { id: 'cheek-l',      label: 'Left Cheek',    cx: 0.30, cy: 0.52, radius: 0.07 },
  { id: 'cheek-r',      label: 'Right Cheek',   cx: 0.70, cy: 0.52, radius: 0.07 },
  { id: 'nose-l',       label: 'Nose L',        cx: 0.46, cy: 0.48, radius: 0.03 },
  { id: 'nose-r',       label: 'Nose R',        cx: 0.54, cy: 0.48, radius: 0.03 },
  { id: 'nose-tip',     label: 'Nose Tip',      cx: 0.50, cy: 0.52, radius: 0.03 },
  { id: 'chin-l',       label: 'Chin L',        cx: 0.42, cy: 0.72, radius: 0.05 },
  { id: 'chin-c',       label: 'Chin C',        cx: 0.50, cy: 0.75, radius: 0.04 },
  { id: 'chin-r',       label: 'Chin R',        cx: 0.58, cy: 0.72, radius: 0.05 },
  { id: 'jaw-l',        label: 'Jaw L',         cx: 0.28, cy: 0.65, radius: 0.05 },
  { id: 'jaw-r',        label: 'Jaw R',         cx: 0.72, cy: 0.65, radius: 0.05 },
  { id: 'between-eyes', label: 'Between Eyes',  cx: 0.50, cy: 0.35, radius: 0.03 },
  { id: 'upper-lip',    label: 'Upper Lip',     cx: 0.50, cy: 0.62, radius: 0.04 },
];

export interface ActiveZit {
  id: number;
  zone: ZitZone;
  x: number;         // actual x position on canvas
  y: number;         // actual y position on canvas
  radius: number;    // zit visual radius
  hitRadius: number; // clickable radius
  growthPhase: number; // 0-1, how grown the zit is
  maxGrowth: number;   // time to fully grow (ms)
  lifetime: number;    // total time alive (ms)
  spawnedAt: number;
  status: 'growing' | 'ready' | 'popping' | 'popped' | 'escaped';
  popFrame: number;  // animation frame for pop
  severity: 1 | 2 | 3; // bigger = juicier
  points: number;
}

export interface PopParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface SplatMark {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
}

// ── Color palettes ──
const SKIN_BASE = '#e8b88a';
const SKIN_LIGHT = '#f5d4b3';
const SKIN_DARK = '#c4935e';
const SKIN_SHADOW = '#a07040';
const HAIR_COLOR = '#2a1a0a';
const HAIR_HIGHLIGHT = '#4a3020';
const EYE_WHITE = '#f5f0ea';
const EYE_IRIS = '#5a3a1a';
const LIP_COLOR = '#c87070';

/**
 * Draw the base Julian face (3D-looking, static backdrop)
 */
export function drawJulianFace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.48;
  const faceW = w * 0.38;
  const faceH = h * 0.42;

  // ─── Background gradient ───
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
  bgGrad.addColorStop(0, '#3d2060');
  bgGrad.addColorStop(0.5, '#2a1545');
  bgGrad.addColorStop(1, '#150a28');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle spotlight
  const spot = ctx.createRadialGradient(cx, cy - h * 0.1, 0, cx, cy, h * 0.55);
  spot.addColorStop(0, 'rgba(255,180,120,0.08)');
  spot.addColorStop(1, 'transparent');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  // ─── Neck ───
  const neckW = faceW * 0.45;
  const neckTop = cy + faceH * 0.75;
  ctx.fillStyle = SKIN_DARK;
  ctx.beginPath();
  ctx.moveTo(cx - neckW, neckTop);
  ctx.lineTo(cx - neckW * 1.3, h);
  ctx.lineTo(cx + neckW * 1.3, h);
  ctx.lineTo(cx + neckW, neckTop);
  ctx.closePath();
  ctx.fill();

  // Neck shadow
  const neckShad = ctx.createLinearGradient(cx, neckTop, cx, neckTop + faceH * 0.3);
  neckShad.addColorStop(0, 'rgba(0,0,0,0.25)');
  neckShad.addColorStop(1, 'transparent');
  ctx.fillStyle = neckShad;
  ctx.beginPath();
  ctx.moveTo(cx - neckW, neckTop);
  ctx.lineTo(cx - neckW * 1.1, neckTop + faceH * 0.3);
  ctx.lineTo(cx + neckW * 1.1, neckTop + faceH * 0.3);
  ctx.lineTo(cx + neckW, neckTop);
  ctx.closePath();
  ctx.fill();

  // ─── Shirt / collar ───
  ctx.fillStyle = '#d42a6b';
  ctx.beginPath();
  ctx.moveTo(cx - neckW * 2.2, h);
  ctx.lineTo(cx - neckW * 0.9, neckTop + faceH * 0.15);
  ctx.quadraticCurveTo(cx, neckTop + faceH * 0.5, cx + neckW * 0.9, neckTop + faceH * 0.15);
  ctx.lineTo(cx + neckW * 2.2, h);
  ctx.closePath();
  ctx.fill();

  // Collar shine
  const collarGrad = ctx.createLinearGradient(cx - neckW, neckTop, cx + neckW, neckTop + faceH * 0.3);
  collarGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  collarGrad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  collarGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = collarGrad;
  ctx.beginPath();
  ctx.moveTo(cx - neckW * 2.2, h);
  ctx.lineTo(cx - neckW * 0.9, neckTop + faceH * 0.15);
  ctx.quadraticCurveTo(cx, neckTop + faceH * 0.5, cx + neckW * 0.9, neckTop + faceH * 0.15);
  ctx.lineTo(cx + neckW * 2.2, h);
  ctx.closePath();
  ctx.fill();

  // ─── Ears ───
  for (const side of [-1, 1]) {
    const earX = cx + faceW * 0.95 * side;
    const earY = cy + faceH * 0.05;
    const earW = faceW * 0.18;
    const earH = faceH * 0.22;

    // Ear shadow
    ctx.fillStyle = SKIN_SHADOW;
    ctx.beginPath();
    ctx.ellipse(earX + side * 3, earY + 3, earW * 1.05, earH * 1.05, side * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Ear base
    ctx.fillStyle = SKIN_BASE;
    ctx.beginPath();
    ctx.ellipse(earX, earY, earW, earH, side * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Inner ear
    const innerGrad = ctx.createRadialGradient(earX, earY, 0, earX, earY, earH);
    innerGrad.addColorStop(0, '#d4937a');
    innerGrad.addColorStop(0.6, SKIN_DARK);
    innerGrad.addColorStop(1, SKIN_BASE);
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.ellipse(earX + side * 2, earY, earW * 0.6, earH * 0.7, side * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Face shape (egg/oval, slightly 3D) ───
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 6, faceW * 1.02, faceH * 1.02, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main face
  ctx.fillStyle = SKIN_BASE;
  ctx.beginPath();
  ctx.ellipse(cx, cy, faceW, faceH, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3D lighting gradient — light from upper-left
  const faceGrad = ctx.createRadialGradient(
    cx - faceW * 0.25, cy - faceH * 0.25, 0,
    cx + faceW * 0.1, cy + faceH * 0.1, faceW * 1.2
  );
  faceGrad.addColorStop(0, SKIN_LIGHT);
  faceGrad.addColorStop(0.4, 'rgba(240,200,160,0.3)');
  faceGrad.addColorStop(0.7, 'rgba(196,147,94,0.4)');
  faceGrad.addColorStop(1, 'rgba(160,112,64,0.5)');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, faceW, faceH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cheek blush
  for (const side of [-1, 1]) {
    const blushGrad = ctx.createRadialGradient(
      cx + faceW * 0.4 * side, cy + faceH * 0.2, 0,
      cx + faceW * 0.4 * side, cy + faceH * 0.2, faceW * 0.2
    );
    blushGrad.addColorStop(0, 'rgba(220,120,100,0.2)');
    blushGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.ellipse(cx + faceW * 0.4 * side, cy + faceH * 0.2, faceW * 0.22, faceH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Hair ───
  drawHair(ctx, cx, cy, faceW, faceH);

  // ─── Eyebrows ───
  for (const side of [-1, 1]) {
    const bx = cx + faceW * 0.28 * side;
    const by = cy - faceH * 0.22;
    ctx.strokeStyle = HAIR_COLOR;
    ctx.lineWidth = Math.max(3, faceW * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - faceW * 0.15 * side, by + faceH * 0.02);
    ctx.quadraticCurveTo(bx, by - faceH * 0.04, bx + faceW * 0.13 * side, by + faceH * 0.01);
    ctx.stroke();
  }

  // ─── Eyes ───
  for (const side of [-1, 1]) {
    const ex = cx + faceW * 0.28 * side;
    const ey = cy - faceH * 0.1;
    const eyeW = faceW * 0.17;
    const eyeH = faceH * 0.1;

    // Eye socket shadow
    const socketGrad = ctx.createRadialGradient(ex, ey, eyeW * 0.3, ex, ey, eyeW * 1.3);
    socketGrad.addColorStop(0, 'transparent');
    socketGrad.addColorStop(1, 'rgba(120,80,40,0.15)');
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeW * 1.3, eyeH * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // White
    ctx.fillStyle = EYE_WHITE;
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye border
    ctx.strokeStyle = 'rgba(60,30,10,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Iris
    const irisR = eyeH * 0.7;
    const irisGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, irisR);
    irisGrad.addColorStop(0, '#3a2510');
    irisGrad.addColorStop(0.6, EYE_IRIS);
    irisGrad.addColorStop(1, '#2a1a08');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0a0505';
    ctx.beginPath();
    ctx.arc(ex, ey, irisR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex + irisR * 0.3, ey - irisR * 0.3, irisR * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Eyelid crease
    ctx.strokeStyle = 'rgba(160,112,64,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey - eyeH * 0.15, eyeW * 1.1, Math.PI + 0.3, -0.3);
    ctx.stroke();
  }

  // ─── Nose ───
  const noseX = cx;
  const noseY = cy + faceH * 0.1;

  // Nose shadow
  ctx.fillStyle = 'rgba(160,112,64,0.25)';
  ctx.beginPath();
  ctx.moveTo(noseX - faceW * 0.02, cy - faceH * 0.05);
  ctx.quadraticCurveTo(noseX - faceW * 0.12, noseY + faceH * 0.08, noseX - faceW * 0.08, noseY + faceH * 0.12);
  ctx.quadraticCurveTo(noseX, noseY + faceH * 0.15, noseX + faceW * 0.08, noseY + faceH * 0.12);
  ctx.quadraticCurveTo(noseX + faceW * 0.12, noseY + faceH * 0.08, noseX + faceW * 0.02, cy - faceH * 0.05);
  ctx.fill();

  // Nose bridge highlight
  ctx.fillStyle = 'rgba(255,230,200,0.3)';
  ctx.beginPath();
  ctx.ellipse(noseX - faceW * 0.01, noseY - faceH * 0.05, faceW * 0.025, faceH * 0.08, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Nostrils
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(80,40,20,0.5)';
    ctx.beginPath();
    ctx.ellipse(noseX + faceW * 0.04 * side, noseY + faceH * 0.1, faceW * 0.025, faceH * 0.015, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose tip highlight
  ctx.fillStyle = 'rgba(255,230,200,0.2)';
  ctx.beginPath();
  ctx.ellipse(noseX, noseY + faceH * 0.06, faceW * 0.04, faceH * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();

  // ─── Mouth ───
  const mouthY = cy + faceH * 0.38;
  const mouthW = faceW * 0.3;

  // Lips
  ctx.fillStyle = LIP_COLOR;
  ctx.beginPath();
  // Upper lip
  ctx.moveTo(cx - mouthW, mouthY);
  ctx.quadraticCurveTo(cx - mouthW * 0.4, mouthY - faceH * 0.04, cx, mouthY - faceH * 0.02);
  ctx.quadraticCurveTo(cx + mouthW * 0.4, mouthY - faceH * 0.04, cx + mouthW, mouthY);
  // Lower lip
  ctx.quadraticCurveTo(cx + mouthW * 0.5, mouthY + faceH * 0.06, cx, mouthY + faceH * 0.05);
  ctx.quadraticCurveTo(cx - mouthW * 0.5, mouthY + faceH * 0.06, cx - mouthW, mouthY);
  ctx.fill();

  // Mouth line
  ctx.strokeStyle = 'rgba(100,40,40,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - mouthW * 0.9, mouthY + faceH * 0.005);
  ctx.quadraticCurveTo(cx, mouthY + faceH * 0.015, cx + mouthW * 0.9, mouthY + faceH * 0.005);
  ctx.stroke();

  // Lip highlight
  ctx.fillStyle = 'rgba(255,180,180,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, mouthY + faceH * 0.025, mouthW * 0.4, faceH * 0.015, 0, 0, Math.PI * 2);
  ctx.fill();

  // slight smirk
  ctx.strokeStyle = 'rgba(100,50,50,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + mouthW * 0.85, mouthY - faceH * 0.005);
  ctx.quadraticCurveTo(cx + mouthW * 1.05, mouthY - faceH * 0.015, cx + mouthW * 1.1, mouthY - faceH * 0.025);
  ctx.stroke();
}

function drawHair(ctx: CanvasRenderingContext2D, cx: number, cy: number, faceW: number, faceH: number) {
  // Hair mass - messy, greasy looking
  ctx.fillStyle = HAIR_COLOR;

  // Main hair volume
  ctx.beginPath();
  ctx.moveTo(cx - faceW * 1.1, cy - faceH * 0.15);
  ctx.quadraticCurveTo(cx - faceW * 1.15, cy - faceH * 0.7, cx - faceW * 0.4, cy - faceH * 0.95);
  ctx.quadraticCurveTo(cx, cy - faceH * 1.1, cx + faceW * 0.4, cy - faceH * 0.95);
  ctx.quadraticCurveTo(cx + faceW * 1.15, cy - faceH * 0.7, cx + faceW * 1.1, cy - faceH * 0.15);
  ctx.quadraticCurveTo(cx + faceW * 1.0, cy - faceH * 0.5, cx, cy - faceH * 0.62);
  ctx.quadraticCurveTo(cx - faceW * 1.0, cy - faceH * 0.5, cx - faceW * 1.1, cy - faceH * 0.15);
  ctx.fill();

  // Hair texture strands
  ctx.strokeStyle = HAIR_HIGHLIGHT;
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const sx = cx - faceW * 0.8 + faceW * 1.6 * t;
    const sy = cy - faceH * 0.85 + Math.sin(t * Math.PI) * faceH * 0.15;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      sx + (Math.random() - 0.5) * faceW * 0.2,
      sy + faceH * 0.15,
      sx + (Math.random() - 0.5) * faceW * 0.15,
      sy + faceH * 0.25
    );
    ctx.stroke();
  }

  // Hair shine
  const hairShine = ctx.createLinearGradient(cx - faceW * 0.3, cy - faceH * 0.9, cx + faceW * 0.1, cy - faceH * 0.6);
  hairShine.addColorStop(0, 'rgba(255,255,255,0.08)');
  hairShine.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  hairShine.addColorStop(1, 'transparent');
  ctx.fillStyle = hairShine;
  ctx.beginPath();
  ctx.ellipse(cx - faceW * 0.15, cy - faceH * 0.75, faceW * 0.35, faceH * 0.15, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Sideburns
  for (const side of [-1, 1]) {
    ctx.fillStyle = HAIR_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx + faceW * 0.92 * side, cy - faceH * 0.25);
    ctx.quadraticCurveTo(cx + faceW * 1.05 * side, cy, cx + faceW * 0.88 * side, cy + faceH * 0.15);
    ctx.lineTo(cx + faceW * 0.82 * side, cy + faceH * 0.1);
    ctx.quadraticCurveTo(cx + faceW * 0.9 * side, cy - faceH * 0.05, cx + faceW * 0.85 * side, cy - faceH * 0.2);
    ctx.fill();
  }
}

// ─── ZIT RENDERING ───

export function drawZit(
  ctx: CanvasRenderingContext2D,
  zit: ActiveZit,
  time: number
): void {
  if (zit.status === 'popped' || zit.status === 'escaped') return;

  const { x, y, radius, growthPhase, severity } = zit;
  const r = radius * Math.min(1, growthPhase);

  if (r < 1) return;

  ctx.save();

  if (zit.status === 'popping') {
    // Pop animation - shrink then burst
    const popProgress = zit.popFrame / 8;
    const scale = popProgress < 0.3
      ? 1 + popProgress * 2  // brief swell
      : Math.max(0, 1 - (popProgress - 0.3) * 2); // collapse

    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);
  }

  // Inflamed area (red ring)
  const inflameR = r * (1.8 + severity * 0.3);
  const inflame = ctx.createRadialGradient(x, y, r * 0.5, x, y, inflameR);
  inflame.addColorStop(0, `rgba(200, 60, 60, ${0.25 + severity * 0.1})`);
  inflame.addColorStop(0.5, `rgba(180, 50, 50, ${0.12 + severity * 0.05})`);
  inflame.addColorStop(1, 'transparent');
  ctx.fillStyle = inflame;
  ctx.beginPath();
  ctx.arc(x, y, inflameR, 0, Math.PI * 2);
  ctx.fill();

  // Pimple bump - 3D shading
  const bumpGrad = ctx.createRadialGradient(
    x - r * 0.25, y - r * 0.25, 0,
    x + r * 0.1, y + r * 0.1, r
  );
  bumpGrad.addColorStop(0, `hsl(15, ${50 + severity * 10}%, ${65 - severity * 5}%)`);
  bumpGrad.addColorStop(0.5, `hsl(8, ${55 + severity * 10}%, ${55 - severity * 5}%)`);
  bumpGrad.addColorStop(1, `hsl(0, ${50 + severity * 10}%, ${40 - severity * 3}%)`);
  ctx.fillStyle = bumpGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Ring border
  ctx.strokeStyle = `rgba(180, 50, 50, ${0.4 + severity * 0.15})`;
  ctx.lineWidth = Math.max(1, r * 0.15);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
  ctx.stroke();

  // Whitehead center
  if (growthPhase > 0.5) {
    const whiteR = r * (0.3 + severity * 0.08) * Math.min(1, (growthPhase - 0.5) * 2);
    const whiteGrad = ctx.createRadialGradient(
      x - whiteR * 0.2, y - whiteR * 0.2, 0,
      x, y, whiteR
    );
    whiteGrad.addColorStop(0, '#fffde8');
    whiteGrad.addColorStop(0.6, '#f5e8a0');
    whiteGrad.addColorStop(1, '#e0c860');
    ctx.fillStyle = whiteGrad;
    ctx.beginPath();
    ctx.arc(x, y, whiteR, 0, Math.PI * 2);
    ctx.fill();

    // Shine on whitehead
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - whiteR * 0.25, y - whiteR * 0.25, whiteR * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pulsing glow when ready
  if (zit.status === 'ready') {
    const pulse = 0.3 + Math.sin(time * 0.006) * 0.15;
    ctx.fillStyle = `rgba(255, 80, 80, ${pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw pop particles (pus splatter!)
 */
export function drawPopParticles(ctx: CanvasRenderingContext2D, particles: PopParticle[]): void {
  for (const p of particles) {
    if (p.life <= 0) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();

    // Shine on particle
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(p.x - p.radius * 0.2, p.y - p.radius * 0.2, p.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw splat marks left on the face
 */
export function drawSplatMarks(ctx: CanvasRenderingContext2D, marks: SplatMark[]): void {
  for (const m of marks) {
    if (m.opacity <= 0) continue;
    ctx.globalAlpha = m.opacity;

    // Splat blob shape
    const splatGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
    splatGrad.addColorStop(0, m.color);
    splatGrad.addColorStop(0.7, m.color);
    splatGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = splatGrad;

    // Irregular splat shape
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distortion = 0.7 + Math.sin(i * 2.5) * 0.3;
      const r = m.radius * distortion;
      const px = m.x + Math.cos(angle) * r;
      const py = m.y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Generate pop particles when a zit is popped
 */
export function createPopParticles(zit: ActiveZit): PopParticle[] {
  const count = 8 + zit.severity * 6;
  const particles: PopParticle[] = [];

  // Pus colors
  const colors = [
    '#fffde0', '#f5e8a0', '#e8d070', // yellowy pus
    '#fff8f0', '#ffe8d0',             // white pus
    '#ffcccc', '#ff9999',             // bloody
  ];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 1.5 + Math.random() * 4 * zit.severity;
    particles.push({
      x: zit.x + (Math.random() - 0.5) * zit.radius,
      y: zit.y + (Math.random() - 0.5) * zit.radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1, // slight upward bias
      radius: 1.5 + Math.random() * 3 * zit.severity,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  return particles;
}

/**
 * Create a splat mark where a zit was popped
 */
export function createSplatMark(zit: ActiveZit): SplatMark {
  const colors = ['rgba(255,248,200,0.4)', 'rgba(240,220,150,0.35)', 'rgba(255,200,200,0.3)'];
  return {
    x: zit.x,
    y: zit.y,
    radius: zit.radius * (1.5 + zit.severity * 0.5),
    opacity: 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

/**
 * Update particle physics
 */
export function updateParticles(particles: PopParticle[]): PopParticle[] {
  return particles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.15, // gravity
      vx: p.vx * 0.97,  // friction
      life: p.life - 1,
    }))
    .filter(p => p.life > 0);
}

/**
 * Fade splat marks over time
 */
export function updateSplatMarks(marks: SplatMark[]): SplatMark[] {
  return marks
    .map(m => ({ ...m, opacity: m.opacity - 0.003 }))
    .filter(m => m.opacity > 0);
}
