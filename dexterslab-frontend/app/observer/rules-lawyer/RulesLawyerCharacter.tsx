'use client';

/**
 * RulesLawyerCharacter — Enhanced 16-bit pixel art character renderer.
 * Higher detail with 2px pixel size, richer outfits, expressive features.
 */

import { useRef, useEffect, useCallback } from 'react';

export interface ThemePalette { primary: string; secondary: string; bg: string; }
export interface CharacterTheme { hat: string; accessory: string; palette: ThemePalette; genre: string; }
export type CharacterMood =
  | 'idle' | 'confident' | 'thinking' | 'excited'
  | 'confused' | 'smug' | 'disappointed' | 'surprised' | 'speaking';

interface Props {
  theme: CharacterTheme;
  mood: CharacterMood;
  isSpeaking: boolean;
  width?: number;
  height?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
function darken(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.floor(r * f)},${Math.floor(g * f)},${Math.floor(b * f)})`;
}
function lighten(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.floor(r * f))},${Math.min(255, Math.floor(g * f))},${Math.min(255, Math.floor(b * f))})`;
}

// Draw a filled rectangle in pixel grid
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// Draw a pixel-art rounded rect (chamfered corners)
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + p, y, w - p * 2, h);
  ctx.fillRect(x, y + p, w, h - p * 2);
}

export default function RulesLawyerCharacter({ theme, mood, isSpeaking, width = 320, height = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const animRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    const w = width, h = height;
    const p = 2; // pixel size — doubled detail from 4px
    const cx = w / 2;
    ctx.clearRect(0, 0, w, h);

    const { primary, secondary } = theme.palette;
    const skin = '#e8b87a';
    const skinHi = '#f0c88e';
    const skinSh = '#c49560';
    const skinDk = '#a87a48';
    const hair = '#4a3628';
    const eyeW = '#fff';
    const pupil = '#1a1a2e';

    // Animation
    const breathe = Math.sin(frame * 0.08) * 1.5;
    const sway = Math.sin(frame * 0.04) * 1;
    let eyebrowOff = 0, eyeScale = 1, mouthW = 6, mouthOpen = false;
    let headTilt = 0, bodyBounce = 0, blush = false;

    switch (mood) {
      case 'confident': case 'smug': eyebrowOff = -2; headTilt = 2; mouthW = 8; break;
      case 'thinking': eyebrowOff = -3; headTilt = -3; eyeScale = 0.85; break;
      case 'excited': bodyBounce = Math.sin(frame * 0.2) * 3; eyeScale = 1.15; mouthW = 10; mouthOpen = true; break;
      case 'confused': eyebrowOff = 3; headTilt = -4; eyeScale = 1.05; break;
      case 'disappointed': eyebrowOff = 2; mouthW = 4; break;
      case 'surprised': eyeScale = 1.3; eyebrowOff = -4; mouthOpen = true; break;
      case 'speaking': mouthOpen = Math.sin(frame * 0.35) > 0; break;
    }
    if (isSpeaking) mouthOpen = Math.sin(frame * 0.35) > 0;
    const tilt = sway + headTilt;

    // ═══ TABLE ═══
    const tableY = h * 0.72;
    // Table surface with wood grain
    rect(ctx, 0, tableY, w, p * 6, '#6b4226');
    rect(ctx, 0, tableY, w, p * 2, '#8b5a34');
    rect(ctx, 0, tableY + p, w, p, '#7a4e2a');
    // Wood grain details
    for (let i = 0; i < 8; i++) {
      rect(ctx, 20 + i * 40, tableY + p * 3, 20, p, '#5c3a1e');
    }
    // Table edge shadow
    rect(ctx, 0, tableY + p * 6, w, p, '#3a2010');
    // Legs with detail
    rect(ctx, w * 0.12, tableY + p * 6, p * 4, h - tableY, '#5c3a1e');
    rect(ctx, w * 0.12 + p, tableY + p * 6, p * 2, h - tableY, '#4a2e14');
    rect(ctx, w * 0.82, tableY + p * 6, p * 4, h - tableY, '#5c3a1e');
    rect(ctx, w * 0.82 + p, tableY + p * 6, p * 2, h - tableY, '#4a2e14');

    // ═══ BODY ═══
    const bodyTop = tableY - p * 28 + breathe + bodyBounce;
    const bodyW = p * 20;
    const bodyH = p * 28;
    const bx = cx - bodyW / 2 + tilt;

    // Torso base
    roundRect(ctx, bx, bodyTop + p * 4, bodyW, bodyH - p * 4, p * 2, darken(primary, 0.65));
    // Main shirt
    roundRect(ctx, bx + p, bodyTop + p * 5, bodyW - p * 2, bodyH - p * 6, p * 2, darken(primary, 0.8));
    // Shirt front panel
    rect(ctx, cx - p * 3 + tilt, bodyTop + p * 8, p * 6, bodyH - p * 14, primary);
    // Buttons
    for (let i = 0; i < 4; i++) {
      rect(ctx, cx - p + tilt, bodyTop + p * 10 + i * p * 4, p * 2, p * 2, secondary);
    }
    // Collar
    rect(ctx, cx - p * 6 + tilt, bodyTop + p * 4, p * 12, p * 3, lighten(primary, 1.2));
    rect(ctx, cx - p * 5 + tilt, bodyTop + p * 4, p * 4, p * 4, lighten(primary, 1.1));
    rect(ctx, cx + p + tilt, bodyTop + p * 4, p * 4, p * 4, lighten(primary, 1.1));
    // Lapels
    rect(ctx, bx + p * 2, bodyTop + p * 7, p * 3, p * 10, darken(primary, 0.7));
    rect(ctx, bx + bodyW - p * 5, bodyTop + p * 7, p * 3, p * 10, darken(primary, 0.7));
    // Shoulders (wider)
    roundRect(ctx, bx - p * 3, bodyTop + p * 4, p * 6, p * 8, p, darken(primary, 0.75));
    roundRect(ctx, bx + bodyW - p * 3, bodyTop + p * 4, p * 6, p * 8, p, darken(primary, 0.75));

    // ═══ ARMS ═══
    const armY = tableY - p * 6;
    // Left arm
    rect(ctx, bx - p * 4, bodyTop + p * 12, p * 5, armY - bodyTop - p * 10, darken(primary, 0.75));
    rect(ctx, bx - p * 3, bodyTop + p * 13, p * 3, armY - bodyTop - p * 12, primary);
    // Right arm
    rect(ctx, bx + bodyW - p, bodyTop + p * 12, p * 5, armY - bodyTop - p * 10, darken(primary, 0.75));
    rect(ctx, bx + bodyW, bodyTop + p * 13, p * 3, armY - bodyTop - p * 12, primary);
    // Forearms on table
    rect(ctx, bx - p * 6, armY, p * 10, p * 4, primary);
    rect(ctx, bx + bodyW - p * 4, armY, p * 10, p * 4, primary);
    // Cuffs
    rect(ctx, bx - p * 6, armY, p * 10, p * 2, lighten(primary, 1.2));
    rect(ctx, bx + bodyW - p * 4, armY, p * 10, p * 2, lighten(primary, 1.2));
    // Hands (detailed)
    rect(ctx, bx - p * 8, armY + p * 2, p * 6, p * 4, skin);
    rect(ctx, bx - p * 7, armY + p * 3, p * 4, p * 2, skinHi);
    rect(ctx, bx + bodyW + p * 2, armY + p * 2, p * 6, p * 4, skin);
    rect(ctx, bx + bodyW + p * 3, armY + p * 3, p * 4, p * 2, skinHi);
    // Fingers
    rect(ctx, bx - p * 9, armY + p * 3, p * 2, p * 2, skinSh);
    rect(ctx, bx + bodyW + p * 7, armY + p * 3, p * 2, p * 2, skinSh);

    // ═══ HEAD ═══
    const headW = p * 18;
    const headH = p * 18;
    const hx = cx - headW / 2 + tilt;
    const hy = bodyTop - headH + p * 6 + breathe;

    // Neck
    rect(ctx, cx - p * 3 + tilt, hy + headH - p * 2, p * 6, p * 6, skin);
    rect(ctx, cx - p * 2 + tilt, hy + headH - p, p * 4, p * 4, skinSh);

    // Head shape (rounded)
    roundRect(ctx, hx, hy, headW, headH, p * 2, skin);
    // Highlight
    rect(ctx, hx + p * 2, hy + p * 2, p * 4, p * 3, skinHi);
    // Shadow edge
    rect(ctx, hx + headW - p * 3, hy + p * 4, p * 2, headH - p * 8, skinSh);
    // Chin
    rect(ctx, hx + p * 4, hy + headH - p * 3, headW - p * 8, p * 2, skinSh);
    // Cheeks
    if (blush || mood === 'excited') {
      ctx.globalAlpha = 0.2;
      rect(ctx, hx + p * 2, hy + p * 10, p * 4, p * 3, '#ff6688');
      rect(ctx, hx + headW - p * 6, hy + p * 10, p * 4, p * 3, '#ff6688');
      ctx.globalAlpha = 1;
    }

    // ═══ EARS ═══
    rect(ctx, hx - p * 2, hy + p * 6, p * 3, p * 4, skin);
    rect(ctx, hx - p, hy + p * 7, p, p * 2, skinSh);
    rect(ctx, hx + headW - p, hy + p * 6, p * 3, p * 4, skin);
    rect(ctx, hx + headW, hy + p * 7, p, p * 2, skinSh);

    // ═══ EYES ═══
    const eyeY = hy + headH * 0.35 + eyebrowOff * 0.2;
    const eW = Math.round(p * 4 * eyeScale);
    const eH = Math.round(p * 3 * eyeScale);
    const eyeSpacing = p * 5;

    // Eye whites
    roundRect(ctx, cx - eyeSpacing - eW / 2 + tilt, eyeY, eW, eH, p, eyeW);
    roundRect(ctx, cx + eyeSpacing - eW / 2 + tilt, eyeY, eW, eH, p, eyeW);
    // Pupils (look direction based on mood)
    const lookX = mood === 'thinking' ? -p : mood === 'confused' ? p : 0;
    rect(ctx, cx - eyeSpacing - p + lookX + tilt, eyeY + p, p * 2, p * 2, pupil);
    rect(ctx, cx + eyeSpacing - p + lookX + tilt, eyeY + p, p * 2, p * 2, pupil);
    // Pupil highlights
    rect(ctx, cx - eyeSpacing + lookX + tilt, eyeY + p, p, p, '#ffffff');
    rect(ctx, cx + eyeSpacing + lookX + tilt, eyeY + p, p, p, '#ffffff');
    // Eyelids (subtle)
    rect(ctx, cx - eyeSpacing - eW / 2 + tilt, eyeY - p, eW, p, skinSh);
    rect(ctx, cx + eyeSpacing - eW / 2 + tilt, eyeY - p, eW, p, skinSh);

    // ═══ EYEBROWS (detailed) ═══
    const brow = eyeY - p * 3 + eyebrowOff;
    ctx.fillStyle = hair;
    // Left brow
    rect(ctx, cx - eyeSpacing - eW / 2 + tilt, brow, eW + p * 2, p, hair);
    rect(ctx, cx - eyeSpacing - eW / 2 - p + tilt, brow + p, p * 2, p, hair);
    // Right brow (mirrors confusion)
    const rBrowOff = mood === 'confused' ? -eyebrowOff * 0.5 : 0;
    rect(ctx, cx + eyeSpacing - eW / 2 + tilt, brow + rBrowOff, eW + p * 2, p, hair);
    rect(ctx, cx + eyeSpacing + eW / 2 + p + tilt, brow + rBrowOff + p, p * 2, p, hair);

    // ═══ NOSE ═══
    rect(ctx, cx - p + tilt, hy + headH * 0.5, p * 2, p * 3, skinSh);
    rect(ctx, cx - p * 2 + tilt, hy + headH * 0.5 + p * 2, p * 4, p, skinSh);
    rect(ctx, cx + tilt, hy + headH * 0.5, p, p * 2, skinDk);

    // ═══ MOUSTACHE (detailed, bushy) ═══
    const mY = hy + headH * 0.6;
    ctx.fillStyle = hair;
    // Left curl
    rect(ctx, cx - p * 6 + tilt, mY, p * 5, p, hair);
    rect(ctx, cx - p * 7 + tilt, mY + p, p * 4, p, hair);
    rect(ctx, cx - p * 8 + tilt, mY + p * 2, p * 3, p, darken(hair, 0.8));
    rect(ctx, cx - p * 8 + tilt, mY + p * 3, p * 2, p, darken(hair, 0.7));
    // Center
    rect(ctx, cx - p + tilt, mY, p * 2, p * 2, hair);
    // Right curl (mirrored)
    rect(ctx, cx + p + tilt, mY, p * 5, p, hair);
    rect(ctx, cx + p * 3 + tilt, mY + p, p * 4, p, hair);
    rect(ctx, cx + p * 5 + tilt, mY + p * 2, p * 3, p, darken(hair, 0.8));
    rect(ctx, cx + p * 6 + tilt, mY + p * 3, p * 2, p, darken(hair, 0.7));

    // ═══ MOUTH ═══
    const mouthY = hy + headH * 0.72;
    if (mouthOpen) {
      rect(ctx, cx - p * 2 + tilt, mouthY, p * 4, p * 3, '#5a2522');
      rect(ctx, cx - p + tilt, mouthY + p, p * 2, p, '#8b3535');
      // Teeth
      rect(ctx, cx - p + tilt, mouthY, p * 2, p, '#eee');
    } else if (mood === 'smug' || mood === 'confident') {
      // Smirk
      rect(ctx, cx - p * 3 + tilt, mouthY, p * 6, p, '#8b4040');
      rect(ctx, cx + p * 2 + tilt, mouthY - p, p * 2, p, '#8b4040');
    } else if (mood === 'disappointed') {
      rect(ctx, cx - p * 2 + tilt, mouthY + p, p * 4, p, '#8b4040');
      rect(ctx, cx - p * 3 + tilt, mouthY, p, p, '#8b4040');
      rect(ctx, cx + p * 2 + tilt, mouthY, p, p, '#8b4040');
    } else {
      rect(ctx, cx - p * 2 + tilt, mouthY, p * 4, p, '#8b4040');
    }

    // ═══ HAT ═══
    drawHat(ctx, theme.hat, cx + tilt, hx, hy, headW, headH, p, primary, secondary, hair, frame);

    // ═══ ACCESSORY ═══
    drawAccessory(ctx, theme.accessory, cx + tilt, hx, hy, headW, headH, p, primary, secondary, eyeY, eW, eyeSpacing, frame, bodyTop);

    // ═══ TABLE ITEMS ═══
    drawTableItems(ctx, theme.genre, tableY, w, p, primary, secondary, frame);

  }, [theme, mood, isSpeaking, width, height]);

  function drawHat(ctx: CanvasRenderingContext2D, hat: string, cx: number, hx: number, hy: number, headW: number, headH: number, p: number, pri: string, sec: string, hair: string, frame: number) {
    switch (hat) {
      case 'tophat': {
        const brimW = headW + p * 8;
        const brimY = hy - p;
        // Hair peeking
        rect(ctx, hx + p * 2, hy, headW - p * 4, p * 3, hair);
        // Brim
        rect(ctx, cx - brimW / 2, brimY, brimW, p * 3, '#1a1a1a');
        rect(ctx, cx - brimW / 2 + p, brimY, brimW - p * 2, p, '#333');
        // Cylinder
        const cylW = headW - p * 2;
        rect(ctx, cx - cylW / 2, brimY - p * 16, cylW, p * 16, '#1a1a1a');
        rect(ctx, cx - cylW / 2 + p, brimY - p * 15, p * 2, p * 14, '#2a2a2a');
        // Gold band
        rect(ctx, cx - cylW / 2, brimY - p * 5, cylW, p * 3, '#d4af37');
        rect(ctx, cx - cylW / 2, brimY - p * 4, cylW, p, '#f0d060');
        // Top
        rect(ctx, cx - cylW / 2 + p, brimY - p * 17, cylW - p * 2, p * 2, '#222');
        break;
      }
      case 'wizard': {
        // Hair
        rect(ctx, hx + p * 2, hy, headW - p * 4, p * 2, hair);
        // Cone
        const layers = 14;
        for (let i = 0; i < layers; i++) {
          const lw = headW * (1 - i * 0.06);
          const col = i % 3 === 0 ? sec : darken(pri, 0.7);
          rect(ctx, cx - lw / 2, hy - p * (i + 1) * 1.3, lw, p * 1.5, col);
        }
        // Brim
        rect(ctx, hx - p * 4, hy - p, headW + p * 8, p * 2, darken(pri, 0.6));
        // Star emblem
        rect(ctx, cx - p * 2, hy - p * 10, p * 4, p, sec);
        rect(ctx, cx - p, hy - p * 11, p * 2, p, sec);
        rect(ctx, cx - p, hy - p * 9, p * 2, p, sec);
        rect(ctx, cx - p * 3, hy - p * 10, p, p, sec);
        rect(ctx, cx + p * 2, hy - p * 10, p, p, sec);
        break;
      }
      case 'helmet': {
        // Space helmet dome
        const hw = headW + p * 6;
        roundRect(ctx, cx - hw / 2, hy - p * 6, hw, headH + p * 4, p * 3, '#8899bb');
        roundRect(ctx, cx - hw / 2 + p, hy - p * 5, hw - p * 2, headH + p * 2, p * 2, '#99aabb');
        // Visor reflection
        ctx.globalAlpha = 0.25;
        rect(ctx, cx - hw / 2 + p * 4, hy + p * 2, hw - p * 8, headH * 0.45, lighten(pri, 1.3));
        ctx.globalAlpha = 1;
        // Stripe
        rect(ctx, cx - p, hy - p * 6, p * 2, headH + p * 4, pri);
        // Ear pieces
        rect(ctx, cx - hw / 2 - p, hy + p * 6, p * 3, p * 4, '#667788');
        rect(ctx, cx + hw / 2 - p * 2, hy + p * 6, p * 3, p * 4, '#667788');
        break;
      }
      case 'hood': {
        // Hair (dark)
        rect(ctx, hx + p * 2, hy, headW - p * 4, p * 2, '#1a0a0a');
        const hoodW = headW + p * 8;
        // Hood body
        roundRect(ctx, cx - hoodW / 2, hy - p * 6, hoodW, p * 10, p * 2, '#1a0808');
        rect(ctx, cx - hoodW / 2, hy, p * 3, headH * 0.6, '#1a0808');
        rect(ctx, cx + hoodW / 2 - p * 3, hy, p * 3, headH * 0.6, '#1a0808');
        // Inner shadow
        rect(ctx, cx - hoodW / 2 + p, hy - p * 5, hoodW - p * 2, p * 3, '#220e0e');
        // Red runes
        const runeGlow = 0.5 + Math.sin(frame * 0.1) * 0.3;
        ctx.globalAlpha = runeGlow;
        rect(ctx, cx - hoodW / 2 + p * 3, hy - p * 3, p * 2, p, '#ff2222');
        rect(ctx, cx + hoodW / 2 - p * 5, hy - p * 3, p * 2, p, '#ff2222');
        ctx.globalAlpha = 1;
        break;
      }
      case 'military': {
        // Hair
        rect(ctx, hx + p * 2, hy, headW - p * 4, p * 2, hair);
        const capW = headW + p * 6;
        // Cap body
        rect(ctx, cx - headW * 0.55, hy - p * 7, headW * 1.1, p * 7, '#3a4a2a');
        rect(ctx, cx - headW * 0.55 + p, hy - p * 6, headW * 1.1 - p * 2, p * 2, '#4a5a3a');
        // Visor
        rect(ctx, cx - capW / 2, hy - p, capW, p * 3, '#2a3a1a');
        rect(ctx, cx - capW / 2 + p, hy - p, capW - p * 2, p, '#3a4a2a');
        // Badge
        rect(ctx, cx - p * 2, hy - p * 5, p * 4, p * 3, sec);
        rect(ctx, cx - p, hy - p * 6, p * 2, p, sec);
        // Eagle wings
        rect(ctx, cx - p * 4, hy - p * 4, p * 2, p, sec);
        rect(ctx, cx + p * 2, hy - p * 4, p * 2, p, sec);
        break;
      }
      case 'party': {
        // Hair
        rect(ctx, hx + p * 2, hy, headW - p * 4, p * 2, hair);
        // Party cone (striped)
        const layers2 = 10;
        for (let i = 0; i < layers2; i++) {
          const lw = headW * 0.7 * (1 - i * 0.08);
          const col = i % 2 === 0 ? pri : sec;
          rect(ctx, cx - lw / 2, hy - p * (i + 1) * 1.5, lw, p * 1.5, col);
        }
        // Pom-pom
        roundRect(ctx, cx - p * 2, hy - p * 17, p * 4, p * 4, p, '#ffffff');
        rect(ctx, cx - p, hy - p * 18, p * 2, p, '#ffcccc');
        // Elastic strap
        rect(ctx, hx + p, hy + p * 3, p, p * 6, '#eecc55');
        rect(ctx, hx + headW - p * 2, hy + p * 3, p, p * 6, '#eecc55');
        break;
      }
      default: {
        // Baseball cap with detail
        rect(ctx, hx + p * 2, hy, headW - p * 4, p * 2, hair);
        rect(ctx, cx - headW * 0.5, hy - p * 4, headW, p * 5, pri);
        rect(ctx, cx - headW * 0.5 + p, hy - p * 3, headW - p * 2, p * 2, lighten(pri, 1.15));
        // Bill
        rect(ctx, cx, hy, headW * 0.6, p * 3, darken(pri, 0.7));
        rect(ctx, cx, hy, headW * 0.6, p, pri);
        // Logo
        rect(ctx, cx - p * 2, hy - p * 3, p * 4, p * 3, sec);
        break;
      }
    }
  }

  function drawAccessory(ctx: CanvasRenderingContext2D, acc: string, cx: number, hx: number, hy: number, headW: number, headH: number, p: number, pri: string, sec: string, eyeY: number, eW: number, eyeSpacing: number, frame: number, bodyTop: number) {
    switch (acc) {
      case 'monocle': {
        const mx = cx + eyeSpacing, my = eyeY + p;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx, my + p, eW * 0.8, 0, Math.PI * 2); ctx.stroke();
        // Chain with links
        for (let i = 0; i < 6; i++) {
          rect(ctx, mx + eW - p + i * p * 2, my + p * 3 + i * p * 3, p * 2, p, '#d4af37');
        }
        // Pocket watch at end
        ctx.beginPath(); ctx.arc(mx + eW + p * 10, my + p * 22, p * 3, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37'; ctx.fill(); ctx.stroke();
        break;
      }
      case 'beard': {
        const bY = hy + headH * 0.65;
        const bCol = '#6a5a4a', bDk = '#5a4a3a', bLt = '#7a6a5a';
        rect(ctx, cx - p * 6, bY, p * 12, p * 2, bCol);
        rect(ctx, cx - p * 7, bY + p * 2, p * 14, p * 3, bCol);
        rect(ctx, cx - p * 6, bY + p * 5, p * 12, p * 3, bDk);
        rect(ctx, cx - p * 5, bY + p * 8, p * 10, p * 2, bDk);
        rect(ctx, cx - p * 3, bY + p * 10, p * 6, p * 3, bDk);
        rect(ctx, cx - p * 2, bY + p * 13, p * 4, p * 2, '#4a3a2a');
        // Highlights
        rect(ctx, cx - p * 4, bY + p * 3, p * 2, p * 2, bLt);
        rect(ctx, cx + p * 2, bY + p * 4, p * 2, p, bLt);
        break;
      }
      case 'antenna': {
        const ax = cx + headW * 0.3;
        rect(ctx, ax, hy - p * 12, p, p * 8, '#8899bb');
        rect(ctx, ax - p, hy - p * 13, p * 3, p * 2, '#667788');
        // Blinking orb
        const glow = Math.sin(frame * 0.15) > 0;
        roundRect(ctx, ax - p * 2, hy - p * 16, p * 5, p * 4, p, glow ? pri : '#333');
        if (glow) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = pri;
          ctx.beginPath(); ctx.arc(ax + p, hy - p * 14, p * 5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'glowing_eyes': {
        const glow2 = 0.3 + Math.sin(frame * 0.1) * 0.2;
        ctx.globalAlpha = glow2;
        ctx.fillStyle = '#ff0000';
        ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY + p, p * 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY + p, p * 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'medals': {
        const medalY = bodyTop + p * 10;
        const colors = [['#d4af37', '#b8962f'], ['#c0c0c0', '#a0a0a0'], ['#cd7f32', '#a66528']];
        colors.forEach(([col, dk], i) => {
          const mx2 = cx - p * 7 + i * p * 5;
          // Ribbon
          rect(ctx, mx2, medalY - p * 3, p * 3, p * 3, sec);
          // Medal
          roundRect(ctx, mx2 - p, medalY, p * 5, p * 4, p, col);
          rect(ctx, mx2, medalY + p, p * 3, p * 2, dk);
        });
        break;
      }
      case 'bow_tie': {
        const btY = hy + headH + p;
        // Left wing
        rect(ctx, cx - p * 6, btY, p * 5, p * 2, pri);
        rect(ctx, cx - p * 7, btY + p, p * 3, p * 2, pri);
        rect(ctx, cx - p * 5, btY - p, p * 3, p, darken(pri, 0.8));
        // Center knot
        rect(ctx, cx - p, btY, p * 2, p * 3, darken(pri, 0.6));
        // Right wing
        rect(ctx, cx + p, btY, p * 5, p * 2, pri);
        rect(ctx, cx + p * 4, btY + p, p * 3, p * 2, pri);
        rect(ctx, cx + p * 2, btY - p, p * 3, p, darken(pri, 0.8));
        break;
      }
      case 'glasses': {
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - eyeSpacing - eW * 0.7, eyeY - p, eW * 1.6, p * 4);
        ctx.strokeRect(cx + eyeSpacing - eW * 0.7, eyeY - p, eW * 1.6, p * 4);
        ctx.beginPath();
        ctx.moveTo(cx - eyeSpacing + eW * 0.9, eyeY + p);
        ctx.lineTo(cx + eyeSpacing - eW * 0.7, eyeY + p);
        ctx.stroke();
        // Temple arms
        ctx.beginPath();
        ctx.moveTo(cx - eyeSpacing - eW * 0.7, eyeY);
        ctx.lineTo(cx - eyeSpacing - eW * 0.7 - p * 4, eyeY + p * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + eyeSpacing + eW * 0.9, eyeY);
        ctx.lineTo(cx + eyeSpacing + eW * 0.9 + p * 4, eyeY + p * 3);
        ctx.stroke();
        break;
      }
    }
  }

  function drawTableItems(ctx: CanvasRenderingContext2D, genre: string, tableY: number, w: number, p: number, pri: string, sec: string, frame: number) {
    const ty = tableY - p * 3;
    switch (genre) {
      case 'economic':
        // Stack of coins
        for (let i = 0; i < 3; i++) {
          roundRect(ctx, w * 0.18 + i * p, ty - i * p * 2, p * 5, p * 3, p, i === 2 ? '#f0d060' : '#d4af37');
        }
        // Banknote
        rect(ctx, w * 0.72, ty - p, p * 8, p * 5, '#2d5a2d');
        rect(ctx, w * 0.72 + p, ty, p * 6, p * 3, '#3d6a3d');
        rect(ctx, w * 0.72 + p * 3, ty + p, p * 2, p, '#aacc99');
        break;
      case 'fantasy':
        // D20 die
        roundRect(ctx, w * 0.18, ty - p * 2, p * 6, p * 6, p, '#ccccdd');
        rect(ctx, w * 0.18 + p * 2, ty, p * 2, p * 2, '#333');
        // Cards
        rect(ctx, w * 0.72, ty - p * 3, p * 6, p * 8, sec);
        rect(ctx, w * 0.72 + p, ty - p * 2, p * 4, p * 6, darken(sec, 0.7));
        rect(ctx, w * 0.73, ty - p * 3 - p, p * 5, p * 7, darken(pri, 0.5));
        break;
      case 'space':
        // Miniature ship
        rect(ctx, w * 0.18, ty, p, p * 2, pri);
        rect(ctx, w * 0.18 - p * 2, ty + p, p * 5, p, pri);
        rect(ctx, w * 0.18 - p * 3, ty + p * 2, p * 7, p, darken(pri, 0.7));
        rect(ctx, w * 0.18 - p, ty - p, p * 3, p, lighten(pri, 1.3));
        // Planet token
        ctx.fillStyle = sec;
        ctx.beginPath(); ctx.arc(w * 0.78, ty + p, p * 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = darken(sec, 0.6);
        ctx.beginPath(); ctx.arc(w * 0.78 + p, ty + p, p * 2, 0, Math.PI * 2); ctx.fill();
        break;
      case 'horror':
        // Candle
        rect(ctx, w * 0.2, ty - p * 4, p * 2, p * 6, '#ccbb88');
        rect(ctx, w * 0.2, ty - p * 5, p * 2, p, '#ffaa33');
        const flicker = Math.sin(frame * 0.2) > 0;
        if (flicker) rect(ctx, w * 0.2, ty - p * 6, p * 2, p, '#ffdd66');
        // Skull token
        rect(ctx, w * 0.74, ty - p, p * 4, p * 3, '#ddddcc');
        rect(ctx, w * 0.74 + p, ty - p * 2, p * 2, p, '#ddddcc');
        rect(ctx, w * 0.74 + p, ty + p, p, p, '#333');
        rect(ctx, w * 0.74 + p * 2, ty + p, p, p, '#333');
        break;
      case 'war':
        // Flag
        rect(ctx, w * 0.78, ty - p * 8, p, p * 8, '#555');
        rect(ctx, w * 0.78 + p, ty - p * 8, p * 5, p * 4, pri);
        rect(ctx, w * 0.78 + p, ty - p * 6, p * 3, p * 2, sec);
        // Tank token
        rect(ctx, w * 0.18, ty, p * 6, p * 2, '#556644');
        rect(ctx, w * 0.18 + p, ty - p * 2, p * 4, p * 2, '#667755');
        rect(ctx, w * 0.18 + p * 4, ty - p * 3, p * 3, p, '#556644');
        break;
      case 'party':
        // Cards fanned
        for (let i = 0; i < 3; i++) {
          rect(ctx, w * 0.17 + i * p * 3, ty - p * 2 - i * p, p * 5, p * 7, i % 2 === 0 ? '#fff' : '#eee');
          rect(ctx, w * 0.17 + i * p * 3 + p, ty - p - i * p, p * 3, p * 2, i % 2 === 0 ? pri : sec);
        }
        break;
      default:
        rect(ctx, w * 0.2, ty, p * 4, p * 3, pri);
        rect(ctx, w * 0.75, ty, p * 4, p * 3, sec);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let running = true;
    const animate = () => {
      if (!running) return;
      frameRef.current++;
      draw(ctx, frameRef.current);
      animRef.current = setTimeout(() => requestAnimationFrame(animate), 120); // ~8fps
    };
    animate();
    return () => { running = false; if (animRef.current) clearTimeout(animRef.current); };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'pixelated', width: '100%', maxWidth: width, height: 'auto' }}
    />
  );
}
