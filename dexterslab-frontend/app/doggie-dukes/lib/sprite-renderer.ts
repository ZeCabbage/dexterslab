// ═══════════════════════════════════════════════════════════════
//  DOGGIE DUKES — 2D Sprite Renderer v3
//  SNES-era 32-bit style procedural dog sprites
//  Anchor-point based composition — every part connects properly
//  Each breed has distinctive silhouette, proportions, and features
// ═══════════════════════════════════════════════════════════════

import { FighterState } from './combat-engine';

// ── Color palette for breeds ──

const BREED_COLORS: Record<string, { body: string; belly: string; accent: string; nose: string }> = {
  'brown':            { body: '#8B5E3C', belly: '#C4956A', accent: '#5C3D2E', nose: '#1A1A1A' },
  'silver':           { body: '#A8A8B0', belly: '#D0D0D8', accent: '#707078', nose: '#2A2A2E' },
  'black':            { body: '#383840', belly: '#555560', accent: '#1A1A1E', nose: '#0A0A0E' },
  'tan':              { body: '#C4956A', belly: '#E0C8A0', accent: '#8B6E48', nose: '#1A1A1A' },
  'cream':            { body: '#F0DCC0', belly: '#FFF0E0', accent: '#C4A880', nose: '#2A2A2E' },
  'grey':             { body: '#808890', belly: '#B0B8C0', accent: '#585E68', nose: '#1A1A1E' },
  'white':            { body: '#E0E0E8', belly: '#F0F0F8', accent: '#B0B0B8', nose: '#2A2A2E' },
  'dark brown':       { body: '#5C3D2E', belly: '#8B6E48', accent: '#3C2518', nose: '#1A1A1A' },
  'brindle':          { body: '#7C6040', belly: '#A08860', accent: '#4C3828', nose: '#1A1A1A' },
  'black and white':  { body: '#383840', belly: '#E0E0E8', accent: '#1A1A1E', nose: '#0A0A0E' },
  'fawn':             { body: '#D4A060', belly: '#E8C890', accent: '#A07840', nose: '#1A1A1A' },
  'red':              { body: '#B04020', belly: '#D08060', accent: '#802810', nose: '#1A1A1A' },
};

// ── Breed Shape Profiles ──
// All dimensions are relative to a "unit" that gets scaled by the master scale
// This means proportions stay correct at any size

interface BreedShape {
  // Overall
  scale: number;

  // Body (the torso rectangle — everything anchors off this)
  bodyW: number;          // Width in units (default ~70)
  bodyH: number;          // Height in units (default ~40)
  bodyRound: number;      // Corner rounding

  // Chest — bulge at the front of the body
  chestBulge: number;     // 0 = none, 0.3 = bully breeds

  // Head
  headW: number;          // Head width
  headH: number;          // Head height
  headOffsetY: number;    // How high head sits above body top (0 = flush)
  snoutLen: number;       // Snout length extending from head front
  snoutH: number;         // Snout height
  jawDrop: number;        // How far jaw hangs below head (underbite breeds)

  // Eyes
  eyeSize: number;
  eyeY: number;           // Vertical position within head (0 = center, negative = higher)

  // Ears
  earType: 'pointed' | 'floppy' | 'small' | 'tall' | 'bat' | 'folded';
  earH: number;           // Ear height
  earW: number;           // Ear width

  // Legs — positioned at body front/back
  legH: number;           // Leg height
  legW: number;           // Leg width
  pawSize: number;        // Paw width

  // Tail
  tailType: 'curled' | 'straight' | 'stub' | 'bushy' | 'whip';
  tailLen: number;

  // Neck
  neckW: number;          // Neck width (connects body to head)

  // Special features
  hasMask: boolean;       // Dark face marking
  hasMane: boolean;       // Fluffy neck ruff
  hasSpots: boolean;      // Brindle/spotted pattern
}

const BREEDS: Record<string, BreedShape> = {
  'Pit Bull': {
    scale: 1.05,
    bodyW: 75, bodyH: 42, bodyRound: 6, chestBulge: 0.25,
    headW: 34, headH: 30, headOffsetY: 4, snoutLen: 16, snoutH: 14, jawDrop: 0,
    eyeSize: 4.5, eyeY: -3,
    earType: 'small', earH: 10, earW: 10,
    legH: 36, legW: 12, pawSize: 14,
    tailType: 'whip', tailLen: 30,
    neckW: 22,
    hasMask: false, hasMane: false, hasSpots: false,
  },
  'Greyhound': {
    scale: 1.1,
    bodyW: 80, bodyH: 30, bodyRound: 8, chestBulge: 0.08,
    headW: 24, headH: 24, headOffsetY: 8, snoutLen: 24, snoutH: 10, jawDrop: 0,
    eyeSize: 5, eyeY: -2,
    earType: 'folded', earH: 12, earW: 10,
    legH: 50, legW: 8, pawSize: 10,
    tailType: 'whip', tailLen: 35,
    neckW: 14,
    hasMask: false, hasMane: false, hasSpots: false,
  },
  'Rottweiler': {
    scale: 1.15,
    bodyW: 78, bodyH: 44, bodyRound: 5, chestBulge: 0.2,
    headW: 36, headH: 32, headOffsetY: 3, snoutLen: 18, snoutH: 14, jawDrop: 0,
    eyeSize: 4, eyeY: -2,
    earType: 'floppy', earH: 12, earW: 12,
    legH: 38, legW: 13, pawSize: 15,
    tailType: 'stub', tailLen: 10,
    neckW: 22,
    hasMask: true, hasMane: false, hasSpots: false,
  },
  'German Shepherd': {
    scale: 1.1,
    bodyW: 80, bodyH: 38, bodyRound: 6, chestBulge: 0.12,
    headW: 30, headH: 28, headOffsetY: 6, snoutLen: 22, snoutH: 12, jawDrop: 0,
    eyeSize: 4.5, eyeY: -3,
    earType: 'tall', earH: 18, earW: 12,
    legH: 42, legW: 11, pawSize: 13,
    tailType: 'bushy', tailLen: 35,
    neckW: 18,
    hasMask: true, hasMane: false, hasSpots: false,
  },
  'Chihuahua': {
    scale: 0.7,
    bodyW: 50, bodyH: 28, bodyRound: 8, chestBulge: 0,
    headW: 34, headH: 30, headOffsetY: 6, snoutLen: 10, snoutH: 8, jawDrop: 0,
    eyeSize: 8, eyeY: -1,
    earType: 'bat', earH: 22, earW: 18,
    legH: 24, legW: 7, pawSize: 9,
    tailType: 'curled', tailLen: 20,
    neckW: 12,
    hasMask: false, hasMane: false, hasSpots: false,
  },
  'Great Dane': {
    scale: 1.35,
    bodyW: 85, bodyH: 40, bodyRound: 6, chestBulge: 0.1,
    headW: 30, headH: 30, headOffsetY: 8, snoutLen: 20, snoutH: 12, jawDrop: 2,
    eyeSize: 4.5, eyeY: -2,
    earType: 'floppy', earH: 14, earW: 12,
    legH: 52, legW: 12, pawSize: 14,
    tailType: 'whip', tailLen: 38,
    neckW: 16,
    hasMask: false, hasMane: false, hasSpots: false,
  },
  'Husky': {
    scale: 1.08,
    bodyW: 72, bodyH: 38, bodyRound: 6, chestBulge: 0.12,
    headW: 30, headH: 28, headOffsetY: 5, snoutLen: 18, snoutH: 12, jawDrop: 0,
    eyeSize: 5.5, eyeY: -2,
    earType: 'pointed', earH: 14, earW: 11,
    legH: 38, legW: 11, pawSize: 13,
    tailType: 'bushy', tailLen: 30,
    neckW: 18,
    hasMask: true, hasMane: true, hasSpots: false,
  },
  'Doberman': {
    scale: 1.12,
    bodyW: 75, bodyH: 36, bodyRound: 5, chestBulge: 0.1,
    headW: 26, headH: 26, headOffsetY: 8, snoutLen: 22, snoutH: 10, jawDrop: 0,
    eyeSize: 4, eyeY: -3,
    earType: 'tall', earH: 16, earW: 10,
    legH: 46, legW: 10, pawSize: 12,
    tailType: 'stub', tailLen: 8,
    neckW: 15,
    hasMask: true, hasMane: false, hasSpots: false,
  },
  'Bulldog': {
    scale: 0.95,
    bodyW: 72, bodyH: 38, bodyRound: 8, chestBulge: 0.3,
    headW: 38, headH: 34, headOffsetY: 0, snoutLen: 10, snoutH: 14, jawDrop: 6,
    eyeSize: 5, eyeY: -2,
    earType: 'folded', earH: 8, earW: 10,
    legH: 26, legW: 14, pawSize: 16,
    tailType: 'stub', tailLen: 6,
    neckW: 26,
    hasMask: false, hasMane: false, hasSpots: false,
  },
  'Border Collie': {
    scale: 1.0,
    bodyW: 70, bodyH: 35, bodyRound: 7, chestBulge: 0.05,
    headW: 28, headH: 26, headOffsetY: 5, snoutLen: 18, snoutH: 11, jawDrop: 0,
    eyeSize: 5.5, eyeY: -2,
    earType: 'folded', earH: 12, earW: 11,
    legH: 38, legW: 10, pawSize: 12,
    tailType: 'bushy', tailLen: 32,
    neckW: 16,
    hasMask: true, hasMane: true, hasSpots: false,
  },
  'Boxer': {
    scale: 1.05,
    bodyW: 74, bodyH: 40, bodyRound: 6, chestBulge: 0.2,
    headW: 34, headH: 32, headOffsetY: 3, snoutLen: 12, snoutH: 14, jawDrop: 4,
    eyeSize: 4.5, eyeY: -2,
    earType: 'floppy', earH: 10, earW: 12,
    legH: 38, legW: 12, pawSize: 14,
    tailType: 'stub', tailLen: 8,
    neckW: 20,
    hasMask: true, hasMane: false, hasSpots: false,
  },
  'Akita': {
    scale: 1.15,
    bodyW: 76, bodyH: 42, bodyRound: 6, chestBulge: 0.15,
    headW: 34, headH: 32, headOffsetY: 4, snoutLen: 16, snoutH: 13, jawDrop: 0,
    eyeSize: 3.5, eyeY: -3,
    earType: 'pointed', earH: 13, earW: 12,
    legH: 38, legW: 13, pawSize: 15,
    tailType: 'curled', tailLen: 28,
    neckW: 22,
    hasMask: false, hasMane: true, hasSpots: false,
  },
};

const DEFAULT_BREED: BreedShape = {
  scale: 1.0,
  bodyW: 70, bodyH: 38, bodyRound: 6, chestBulge: 0.1,
  headW: 28, headH: 26, headOffsetY: 5, snoutLen: 16, snoutH: 11, jawDrop: 0,
  eyeSize: 4.5, eyeY: -2,
  earType: 'pointed', earH: 12, earW: 10,
  legH: 36, legW: 10, pawSize: 12,
  tailType: 'straight', tailLen: 28,
  neckW: 16,
  hasMask: false, hasMane: false, hasSpots: false,
};

// ── GROUND LINE — where paws touch ──
const GROUND_Y = 310;  // Lower on 400px canvas for bigger dogs

// ══════════════════════════════════════════
//  MAIN DRAW FUNCTION
//  Uses anchor-point composition:
//    Ground → Legs → Body bottom → Body → Neck top → Head
//  Every part connects to the previous one
// ══════════════════════════════════════════

export function drawDog(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  animFrame: number
): void {
  const colors = BREED_COLORS[fighter.dog.color] || BREED_COLORS['brown'];
  const breed = BREEDS[fighter.dog.breed] || DEFAULT_BREED;
  const s = breed.scale;
  const facing = fighter.facing;

  ctx.save();
  ctx.translate(fighter.x, GROUND_Y);

  // Flip for facing direction
  if (facing === -1) {
    ctx.scale(-1, 1);
  }

  // ── State transforms ──
  let bobY = 0;
  let shakeX = 0;
  let dodgeX = 0;
  let lungeX = 0;

  if (fighter.state === 'idle' || fighter.state === 'walking') {
    bobY = Math.sin(animFrame * 0.12) * 2.5;
  }
  if (fighter.state === 'hit') {
    shakeX = (Math.random() - 0.5) * 8;
    bobY = 2;
  }
  if (fighter.state === 'dodging') {
    dodgeX = -30;
    bobY = -5;
  }
  if (fighter.state === 'attacking') {
    lungeX = 18;
    bobY = -2;
  }
  if (fighter.state === 'ko') {
    ctx.translate(0, 15);
    ctx.rotate((Math.PI * 0.4) * facing);
  }
  if (fighter.state === 'victory') {
    bobY = -Math.abs(Math.sin(animFrame * 0.18)) * 18;
  }

  ctx.translate(lungeX + shakeX + dodgeX, bobY);

  // ═════════════════════════════════════
  //  COMPUTE ANCHOR POINTS
  // ═════════════════════════════════════

  // All y values go UP from ground (negative = up on screen)
  const bw = breed.bodyW * s;
  const bh = breed.bodyH * s;
  const lh = breed.legH * s;
  const lw = breed.legW * s;

  // Body sits on top of legs
  const bodyBot = -lh;                    // Bottom of body (top of legs)
  const bodyTop = bodyBot - bh;           // Top of body
  const bodyCenterY = bodyBot - bh / 2;   // Vertical center of body
  const bodyLeft = -bw * 0.45;            // Body extends mostly behind center
  const bodyRight = bw * 0.55;            // Front extends forward

  // Neck attaches at body front-top
  const neckBaseX = bodyRight - breed.neckW * s * 0.3;
  const neckTopX = bodyRight + breed.neckW * s * 0.1;
  const neckTopY = bodyTop - breed.headOffsetY * s;

  // Head attaches at neck top
  const hw = breed.headW * s;
  const hh = breed.headH * s;
  const headCenterX = neckTopX + hw * 0.15;
  const headCenterY = neckTopY - hh * 0.35;
  const headLeft = headCenterX - hw / 2;
  const headRight = headCenterX + hw / 2;
  const headTop = headCenterY - hh / 2;
  const headBot = headCenterY + hh / 2;

  // Leg positions
  const frontLegX = bodyRight - bw * 0.2;
  const backLegX = bodyLeft + bw * 0.15;

  // ═════════════════════════════════════
  //  DRAW (back to front layering)
  // ═════════════════════════════════════

  // ── 1. SHADOW ──
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 2, bw * 0.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 2. TAIL (behind body) ──
  drawTail(ctx, bodyLeft, bodyCenterY, bodyTop, s, breed, colors, animFrame);

  // ── 3. BACK LEGS (behind body) ──
  const legAnim = Math.sin(animFrame * 0.18) * 5;
  drawLeg(ctx, backLegX, bodyBot, lh, lw, breed.pawSize * s, colors.accent, -legAnim);
  drawLeg(ctx, frontLegX, bodyBot, lh, lw, breed.pawSize * s, colors.accent, legAnim);

  // ── 4. BODY ──
  // Main body shape
  ctx.fillStyle = colors.body;
  roundRect(ctx, bodyLeft, bodyTop, bw, bh, breed.bodyRound * s);
  ctx.fill();

  // Chest bulge (front of body extends down and forward)
  if (breed.chestBulge > 0) {
    const cx = bodyRight - bw * 0.25;
    const cw = bw * 0.35 + breed.chestBulge * bw * 0.2;
    const ch = bh * 0.7 + breed.chestBulge * bh * 0.3;
    ctx.fillStyle = colors.body;
    roundRect(ctx, cx, bodyTop + bh * 0.1, cw, ch, 6 * s);
    ctx.fill();
  }

  // Belly patch (lighter underside)
  ctx.fillStyle = colors.belly;
  const bellyW = bw * 0.6;
  const bellyH = bh * 0.3;
  roundRect(ctx, bodyLeft + bw * 0.15, bodyBot - bellyH - bh * 0.05, bellyW, bellyH, 4 * s);
  ctx.fill();

  // Spot/brindle pattern
  if (breed.hasSpots) {
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < 5; i++) {
      const sx = bodyLeft + bw * (0.2 + i * 0.15);
      const sy = bodyTop + bh * (0.2 + (i % 3) * 0.2);
      ctx.beginPath();
      ctx.arc(sx, sy, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 5. NECK (connects body to head) ──
  const nw = breed.neckW * s;
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(neckBaseX, bodyTop + 2);           // Back of neck at body
  ctx.lineTo(neckBaseX + nw, bodyTop + 2);      // Front of neck at body
  ctx.lineTo(headCenterX + hw * 0.2, headBot);  // Front of neck at head
  ctx.lineTo(headCenterX - hw * 0.3, headBot);  // Back of neck at head
  ctx.closePath();
  ctx.fill();

  // Mane/ruff (fluffy breeds)
  if (breed.hasMane) {
    ctx.fillStyle = colors.belly;
    const maneR = nw * 0.4;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const mx = neckBaseX + t * (headCenterX - neckBaseX);
      const my = bodyTop - t * (bodyTop - headBot) + 2;
      ctx.beginPath();
      ctx.arc(mx + nw * 0.5, my, maneR + Math.sin(i * 1.5) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 6. FRONT LEGS (in front of body) ──
  drawLeg(ctx, backLegX + 3, bodyBot, lh, lw, breed.pawSize * s, colors.body, legAnim);
  drawLeg(ctx, frontLegX + 3, bodyBot, lh, lw, breed.pawSize * s, colors.body, -legAnim);

  // ── 7. BOXING GLOVES ──
  const gloveSize = 9 * s;
  const gloveY = bodyBot + lh * 0.1;
  if (fighter.state === 'attacking') {
    // Extended punch
    const punchX = bodyRight + 22 * s;
    const punchY = bodyCenterY - 4 * s;
    // Arm
    ctx.strokeStyle = colors.body;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(bodyRight - 4, bodyCenterY);
    ctx.lineTo(punchX, punchY);
    ctx.stroke();
    // Glove
    ctx.fillStyle = '#CC2222';
    ctx.beginPath();
    ctx.arc(punchX, punchY, gloveSize, 0, Math.PI * 2);
    ctx.fill();
    // Glove highlight
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(punchX + 2 * s, punchY - 2 * s, gloveSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Glove laces
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(punchX - 3, punchY);
    ctx.lineTo(punchX + 3, punchY);
    ctx.stroke();
  } else {
    // Resting glove near front leg
    const restX = frontLegX + lw * 0.8;
    const restY = bodyBot + lh * 0.25;
    ctx.fillStyle = '#CC2222';
    ctx.beginPath();
    ctx.arc(restX, restY, gloveSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(restX + 1.5, restY - 1.5, gloveSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 8. HEAD ──
  // Base head shape
  ctx.fillStyle = colors.body;
  roundRect(ctx, headLeft, headTop, hw, hh, 5 * s);
  ctx.fill();

  // Face mask (dark muzzle area for masked breeds)
  if (breed.hasMask) {
    ctx.fillStyle = colors.accent;
    const maskY = headCenterY - hh * 0.05;
    roundRect(ctx, headCenterX - hw * 0.15, maskY, hw * 0.6, hh * 0.45, 3 * s);
    ctx.fill();
  }

  // Snout (extends from head front)
  const snoutW = breed.snoutLen * s;
  const snoutH = breed.snoutH * s;
  const snoutX = headRight - 4 * s;
  const snoutY = headCenterY + hh * 0.05 - snoutH / 2;
  ctx.fillStyle = breed.hasMask ? colors.accent : colors.belly;
  roundRect(ctx, snoutX, snoutY, snoutW, snoutH, 3 * s);
  ctx.fill();
  // Snout bridge (lighter top)
  ctx.fillStyle = colors.belly;
  roundRect(ctx, snoutX, snoutY, snoutW * 0.9, snoutH * 0.45, 2 * s);
  ctx.fill();

  // Nose (at end of snout)
  ctx.fillStyle = colors.nose;
  const noseR = Math.max(2.5, 3.5 * s);
  ctx.beginPath();
  ctx.arc(snoutX + snoutW - noseR, snoutY + snoutH * 0.35, noseR, 0, Math.PI * 2);
  ctx.fill();
  // Nose highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(snoutX + snoutW - noseR - 1, snoutY + snoutH * 0.25, noseR * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Underbite / dropped jaw
  if (breed.jawDrop > 0) {
    const jawY = headBot - 2 * s;
    const jawH = breed.jawDrop * s;
    ctx.fillStyle = colors.belly;
    roundRect(ctx, headCenterX, jawY, hw * 0.45, jawH + 4, 3 * s);
    ctx.fill();
    // Lower teeth
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(headCenterX + 4 + i * 4 * s, jawY - 1, 2 * s, 3 * s);
    }
  }

  // ── 9. EYES ──
  const eyeR = breed.eyeSize * s;
  const eyeX = headCenterX + hw * 0.08;
  const eyeY = headCenterY + breed.eyeY * s;

  // Sclera (white)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris
  let irisColor = '#442200';
  if (fighter.dog.breed === 'Husky') irisColor = '#3399FF';
  if (fighter.dog.personality === 'Berserker') irisColor = '#DD2200';
  if (fighter.dog.personality === 'Coward') irisColor = '#8899BB';
  if (fighter.dog.personality === 'Zen Master') irisColor = '#3388CC';
  if (fighter.state === 'hit') irisColor = '#FF0000';

  ctx.fillStyle = irisColor;
  ctx.beginPath();
  ctx.arc(eyeX + eyeR * 0.15, eyeY, eyeR * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(eyeX + eyeR * 0.2, eyeY, eyeR * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlight
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(eyeX + eyeR * 0.35, eyeY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eye outline
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 0.85, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Eyebrow expressions
  if (fighter.dog.personality === 'Berserker' || fighter.state === 'attacking') {
    // Angry
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeR * 1.3, eyeY - eyeR * 1.6);
    ctx.lineTo(eyeX + eyeR * 0.8, eyeY - eyeR * 1.0);
    ctx.stroke();
  } else if (fighter.dog.personality === 'Coward') {
    // Worried
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeR * 1.0, eyeY - eyeR * 1.0);
    ctx.lineTo(eyeX + eyeR * 0.8, eyeY - eyeR * 1.6);
    ctx.stroke();
  } else if (fighter.dog.personality === 'Zen Master') {
    // Half-closed eyes
    ctx.fillStyle = colors.body;
    ctx.fillRect(eyeX - eyeR, eyeY - eyeR, eyeR * 2, eyeR * 0.6);
  }

  // ── 10. EARS ──
  drawEars(ctx, headLeft, headTop, headRight, headCenterY, hw, hh, s, breed, colors);

  // Mouth (open when attacking)
  if (fighter.state === 'attacking') {
    const mouthX = snoutX + snoutW * 0.2;
    const mouthY = snoutY + snoutH * 0.7;
    const mouthW = snoutW * 0.6;
    ctx.fillStyle = '#770000';
    ctx.beginPath();
    ctx.ellipse(mouthX + mouthW / 2, mouthY, mouthW / 2, 4 * s, 0, 0, Math.PI);
    ctx.fill();
    // Top teeth
    ctx.fillStyle = '#FFFFFF';
    const teethCount = breed.jawDrop > 2 ? 4 : 3;
    for (let i = 0; i < teethCount; i++) {
      const tx = mouthX + 2 + i * (mouthW / teethCount);
      ctx.fillRect(tx, mouthY - 1, 2.5 * s, 3.5 * s);
    }
  }

  // ── 11. HIT FLASH ──
  if (fighter.state === 'hit' && Math.floor(animFrame) % 2 === 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(bodyLeft - 5, headTop - 15, bw + hw + 30, -bodyTop + lh + 20);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

// ══════════════════════════════════════
//  COMPONENT DRAWING FUNCTIONS
// ══════════════════════════════════════

// ── Draw a single leg ──

function drawLeg(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,       // Where leg connects to body bottom
  height: number,
  width: number,
  pawW: number,
  color: string,
  animOffset: number
): void {
  const kneeY = topY + height * 0.55;
  const ankleY = topY + height * 0.85;
  const pawY = topY + height;
  const anim = animOffset * 0.6;

  // Upper leg
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, topY);
  ctx.lineTo(x + width / 2, topY);
  ctx.lineTo(x + width / 2 + anim * 0.3, kneeY);
  ctx.lineTo(x - width / 2 + anim * 0.3, kneeY);
  ctx.closePath();
  ctx.fill();

  // Lower leg (slightly thinner)
  ctx.beginPath();
  ctx.moveTo(x - width * 0.4 + anim * 0.3, kneeY);
  ctx.lineTo(x + width * 0.4 + anim * 0.3, kneeY);
  ctx.lineTo(x + width * 0.35 + anim * 0.5, ankleY);
  ctx.lineTo(x - width * 0.35 + anim * 0.5, ankleY);
  ctx.closePath();
  ctx.fill();

  // Paw
  ctx.fillStyle = '#222228';
  roundRect(ctx, x - pawW / 2 + anim * 0.5, ankleY - 1, pawW, height * 0.18, 3);
  ctx.fill();
}

// ── Draw breed-specific ears ──

function drawEars(
  ctx: CanvasRenderingContext2D,
  headLeft: number, headTop: number,
  headRight: number, headCenterY: number,
  hw: number, hh: number,
  s: number,
  breed: BreedShape,
  colors: { body: string; belly: string; accent: string }
): void {
  const earH = breed.earH * s;
  const earW = breed.earW * s;
  const earBaseX = headLeft + hw * 0.15;
  const earBaseY = headTop + hh * 0.1;

  switch (breed.earType) {
    case 'pointed': {
      // Classic pointed (Husky, Akita)
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(earBaseX - earW * 0.3, earBaseY);
      ctx.lineTo(earBaseX + earW * 0.2, earBaseY - earH);
      ctx.lineTo(earBaseX + earW * 0.7, earBaseY);
      ctx.closePath();
      ctx.fill();
      // Inner
      ctx.fillStyle = '#CC9999';
      ctx.beginPath();
      ctx.moveTo(earBaseX, earBaseY);
      ctx.lineTo(earBaseX + earW * 0.2, earBaseY - earH * 0.65);
      ctx.lineTo(earBaseX + earW * 0.5, earBaseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tall': {
      // Tall pointed (GSD, Doberman) — taller and narrower
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(earBaseX - earW * 0.2, earBaseY);
      ctx.lineTo(earBaseX + earW * 0.2, earBaseY - earH * 1.4);
      ctx.lineTo(earBaseX + earW * 0.6, earBaseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#CC9999';
      ctx.beginPath();
      ctx.moveTo(earBaseX, earBaseY);
      ctx.lineTo(earBaseX + earW * 0.2, earBaseY - earH);
      ctx.lineTo(earBaseX + earW * 0.45, earBaseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'bat': {
      // Huge bat ears (Chihuahua) — massive and fanned out
      ctx.fillStyle = colors.accent;
      // Ear 1 — fanned back-left
      ctx.beginPath();
      ctx.moveTo(earBaseX - earW * 0.2, earBaseY + 2);
      ctx.lineTo(earBaseX - earW * 0.8, earBaseY - earH * 1.3);
      ctx.lineTo(earBaseX + earW * 0.4, earBaseY);
      ctx.closePath();
      ctx.fill();
      // Inner
      ctx.fillStyle = '#DDAAAA';
      ctx.beginPath();
      ctx.moveTo(earBaseX - earW * 0.1, earBaseY + 1);
      ctx.lineTo(earBaseX - earW * 0.6, earBaseY - earH * 0.9);
      ctx.lineTo(earBaseX + earW * 0.25, earBaseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'floppy': {
      // Hanging floppy ears (Rottweiler, Great Dane, Boxer)
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(earBaseX, earBaseY);
      ctx.quadraticCurveTo(
        earBaseX - earW * 0.6, earBaseY + earH * 0.3,
        earBaseX - earW * 0.3, earBaseY + earH
      );
      ctx.lineTo(earBaseX + earW * 0.3, earBaseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'folded': {
      // Semi-folded (Border Collie, Greyhound, Bulldog) — goes up then folds over
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(earBaseX - earW * 0.2, earBaseY);
      ctx.lineTo(earBaseX + earW * 0.1, earBaseY - earH * 0.7);
      ctx.quadraticCurveTo(
        earBaseX + earW * 0.5, earBaseY - earH * 0.4,
        earBaseX + earW * 0.3, earBaseY + earH * 0.2
      );
      ctx.lineTo(earBaseX + earW * 0.5, earBaseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'small': {
      // Small rose ears (Pit Bull)
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(earBaseX, earBaseY + 2);
      ctx.lineTo(earBaseX + earW * 0.15, earBaseY - earH * 0.4);
      ctx.lineTo(earBaseX + earW * 0.5, earBaseY - earH * 0.1);
      ctx.lineTo(earBaseX + earW * 0.45, earBaseY + 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ── Draw breed-specific tail ──

function drawTail(
  ctx: CanvasRenderingContext2D,
  bodyLeft: number,
  bodyCenterY: number,
  bodyTop: number,
  s: number,
  breed: BreedShape,
  colors: { body: string; belly: string; accent: string; nose: string },
  animFrame: number
): void {
  const wag = Math.sin(animFrame * 0.25) * 15;
  const tailX = bodyLeft;
  const tailY = bodyTop + (breed.bodyH * s) * 0.15;
  const len = breed.tailLen * s;

  ctx.lineCap = 'round';

  switch (breed.tailType) {
    case 'curled': {
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.bezierCurveTo(
        tailX - len * 0.5, tailY - len * 0.6,
        tailX - len * 0.1, tailY - len * 0.9 + wag * 0.3,
        tailX + len * 0.15, tailY - len * 0.5
      );
      ctx.stroke();
      break;
    }
    case 'bushy': {
      // Thick fluffy tail
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 7 * s;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(
        tailX - len * 0.6, tailY - len * 0.3 - wag * 0.5,
        tailX - len * 0.4, tailY - len * 0.7
      );
      ctx.stroke();
      // Fluffy tip
      ctx.fillStyle = colors.belly;
      ctx.beginPath();
      ctx.arc(tailX - len * 0.4, tailY - len * 0.7, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stub': {
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX - len * 0.4, tailY - len * 0.4 + wag * 0.15);
      ctx.stroke();
      break;
    }
    case 'whip': {
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(
        tailX - len * 0.5, tailY - len * 0.5 - wag,
        tailX - len * 0.3, tailY - len * 0.9
      );
      ctx.stroke();
      break;
    }
    default: {
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(
        tailX - len * 0.5, tailY - len * 0.4 - wag,
        tailX - len * 0.3, tailY - len * 0.8
      );
      ctx.stroke();
      break;
    }
  }
}

// ── Helper: Rounded Rectangle ──

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ══════════════════════════════════════
//  ARENA & HUD RENDERING
// ══════════════════════════════════════

export function drawArena(ctx: CanvasRenderingContext2D, w: number, h: number, animFrame: number): void {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
  skyGrad.addColorStop(0, '#060510');
  skyGrad.addColorStop(0.4, '#121030');
  skyGrad.addColorStop(1, '#201850');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h * 0.65);

  // Crowd
  const crowdY = h * 0.42;
  for (let i = 0; i < w; i += 11) {
    const ch = 12 + Math.sin(i * 0.35 + animFrame * 0.04) * 4;
    const hue = (i * 8 + animFrame * 1.5) % 360;
    ctx.fillStyle = `hsl(${hue}, 50%, 20%)`;
    ctx.fillRect(i, crowdY - ch, 9, ch);
    ctx.fillStyle = `hsl(${hue}, 35%, 32%)`;
    ctx.fillRect(i + 2, crowdY - ch - 5, 5, 5);
  }

  // Ring floor (raised to give dogs more vertical space)
  const floorY = GROUND_Y + 8;
  const matGrad = ctx.createLinearGradient(0, floorY, 0, h);
  matGrad.addColorStop(0, '#3A2010');
  matGrad.addColorStop(0.3, '#2A1808');
  matGrad.addColorStop(1, '#1A0E04');
  ctx.fillStyle = matGrad;
  ctx.fillRect(0, floorY, w, h - floorY);

  // Ring line
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(50, floorY + 4);
  ctx.lineTo(w - 50, floorY + 4);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ring posts
  ctx.fillStyle = '#B0B0B0';
  ctx.fillRect(35, floorY - 120, 8, 125);
  ctx.fillRect(w - 43, floorY - 120, 8, 125);

  // Ropes
  ctx.strokeStyle = '#EE3333';
  ctx.lineWidth = 3;
  for (let r = 0; r < 3; r++) {
    const ry = floorY - 30 - r * 35;
    ctx.beginPath();
    ctx.moveTo(39, ry);
    ctx.lineTo(w - 39, ry);
    ctx.stroke();
  }

  // Neon title
  const ga = 0.5 + Math.sin(animFrame * 0.08) * 0.25;
  ctx.fillStyle = `rgba(255, 45, 149, ${ga})`;
  ctx.font = 'bold 13px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DOGGIE DUKES', w / 2, 28);
  ctx.fillStyle = `rgba(0, 255, 224, ${ga * 0.6})`;
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillText('UNDERGROUND FIGHT CLUB', w / 2, 42);
}

// ── Particles ──

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export function spawnHitParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  const colors = ['#FFFF00', '#FF8800', '#FFFFFF', '#FF4444', '#FFAA00'];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
    const speed = 2.5 + Math.random() * 5;
    particles.push({
      x, y: y - 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 15 + Math.floor(Math.random() * 12),
      maxLife: 27,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 2 + Math.random() * 5,
    });
  }
  return particles;
}

export function updateAndDrawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): Particle[] {
  return particles
    .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - 1 }))
    .filter(p => p.life > 0)
    .map(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
      return p;
    });
}

// ── Health Bars ──

export function drawHealthBars(
  ctx: CanvasRenderingContext2D,
  fighters: [FighterState, FighterState],
  canvasWidth: number
): void {
  const barW = canvasWidth * 0.34;
  const barH = 16;
  const barY = 62;
  const margin = 22;

  for (let i = 0; i < 2; i++) {
    const f = fighters[i];
    const ratio = Math.max(0, f.hp / f.maxHP);
    const x = i === 0 ? margin : canvasWidth - margin - barW;

    // BG
    ctx.fillStyle = '#120808';
    ctx.fillRect(x - 2, barY - 2, barW + 4, barH + 4);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, barY - 2, barW + 4, barH + 4);

    // Fill
    const fw = barW * ratio;
    const fx = i === 0 ? x : x + barW - fw;
    const color = ratio > 0.6 ? '#00CC44' : ratio > 0.3 ? '#CCAA00' : '#CC2222';
    const grad = ctx.createLinearGradient(fx, barY, fx, barY + barH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shadeColor(color, -30));
    ctx.fillStyle = grad;
    ctx.fillRect(fx, barY, fw, barH);

    // Segments
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let seg = 0; seg < barW; seg += 4) ctx.fillRect(x + seg, barY, 1, barH);

    // Name
    ctx.fillStyle = i === 0 ? '#00FFE0' : '#FF2D95';
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = i === 0 ? 'left' : 'right';
    ctx.fillText(f.dog.name.toUpperCase(), i === 0 ? x : x + barW, barY - 6);

    // HP
    ctx.fillStyle = '#FFF';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, f.hp)}`, x + barW / 2, barY + barH + 12);
  }

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 11px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VS', canvasWidth / 2, barY + 10);
}

// ── Timer ──

export function drawTimer(ctx: CanvasRenderingContext2D, seconds: number, canvasWidth: number): void {
  ctx.fillStyle = seconds <= 10 ? '#FF4444' : '#FFD700';
  ctx.font = '18px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(seconds).padStart(2, '0'), canvasWidth / 2, 48);
}

// ── Commentary ──

export function drawCommentary(ctx: CanvasRenderingContext2D, text: string, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, h - 32, w, 32);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 32);
  ctx.lineTo(w, h - 32);
  ctx.stroke();
  ctx.fillStyle = '#FFF';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h - 10);
}

// ── Utility ──

function shadeColor(c: string, pct: number): string {
  const n = parseInt(c.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.max(0, Math.min(255, (n >> 16) + a));
  const G = Math.max(0, Math.min(255, ((n >> 8) & 0xFF) + a));
  const B = Math.max(0, Math.min(255, (n & 0xFF) + a));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
