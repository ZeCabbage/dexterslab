/**
 * 2D High-Performance Eye Renderer
 *
 * Dispatches to one of three draw methods based on style.type:
 *   organic  — Smooth vector fills, anime-style highlights
 *   snes     — Chunky pixel grid, scanlines, retro palette
 *   robotic  — Precision rings, crosshair, cold HUD aesthetic
 *
 * All methods use only fillStyle/fill()/arc()/strokeStyle/stroke()
 * with zero shadowBlur to guarantee 60fps on Raspberry Pi.
 */

import { EyeStyle } from '@/data/eye-styles';

export function rgb(color: [number, number, number], alpha = 1.0): string {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export class EyeRenderer {
    private size: number;
    private center: number;

    constructor(size: number) {
        this.size = size;
        this.center = size / 2;
    }

    draw(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation = 1.0,
    ) {
        switch (style.type) {
            case 'snes':
                this.drawSNES(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'robotic':
                this.drawRobotic(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'pentagram':
                this.drawPentagram(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'arcade':
                this.drawArcade(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'crumb':
                this.drawCrumb(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'void':
                this.drawVoid(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'hologram':
                this.drawHologram(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'infrared':
                this.drawInfrared(ctx, style, offsetX, offsetY, dilation);
                break;
            case 'fractured':
                this.drawFractured(ctx, style, offsetX, offsetY, dilation);
                break;
            default:
                this.drawOrganic(ctx, style, offsetX, offsetY, dilation);
        }
    }

    // ═════════════════════════════════════════════════════════
    // ORGANIC — Smooth anime/cartoon style
    // ═════════════════════════════════════════════════════════
    private drawOrganic(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;

        // Sclera
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        // Sclera shadow
        ctx.fillStyle = rgb(style.scleraShadow, 0.6);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(cx, cy - scleraR * 0.3, scleraR * 1.5, scleraR * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris rim
        ctx.fillStyle = rgb(style.irisRim);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris base
        ctx.fillStyle = rgb(style.irisBase);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Iris highlight crescent
        ctx.fillStyle = rgb(style.irisHighlight);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.85, 0, Math.PI * 2);
        ctx.arc(ix, iy + irisR * 0.1, irisR * 0.85, 0, Math.PI * 2, true);
        ctx.fill();

        // Pupil
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Specular reflections
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.3, iy - irisR * 0.4, irisR * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ix - irisR * 0.4, iy + irisR * 0.2, irisR * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // SNES — Retro pixel-art via offscreen low-res canvas
    // Renders at ~133px then scales up with nearest-neighbor
    // for authentic chunky pixels WITHOUT 40K fillRect calls.
    // ═════════════════════════════════════════════════════════
    private snesCanvas: HTMLCanvasElement | null = null;
    private snesCtx: CanvasRenderingContext2D | null = null;

    private drawSNES(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const px = style.pixelSize || 6;
        // Low-res canvas size: full size / pixel size
        const lowRes = Math.ceil(s / px);

        // Create offscreen canvas once (lazily)
        if (!this.snesCanvas || this.snesCanvas.width !== lowRes) {
            this.snesCanvas = document.createElement('canvas');
            this.snesCanvas.width = lowRes;
            this.snesCanvas.height = lowRes;
            this.snesCtx = this.snesCanvas.getContext('2d')!;
        }
        const lctx = this.snesCtx!;
        const lc = lowRes / 2; // center in low-res space

        // Scale all coordinates to low-res space
        const scleraR = (s * 0.50) / px;
        const irisR = (s * style.irisRadiusFrac * 0.6) / px;
        const basePupilR = (s * style.pupilRadiusFrac * 0.6) / px;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = lc + offsetX / px;
        const iy = lc + offsetY / px;

        // Clear low-res canvas
        lctx.clearRect(0, 0, lowRes, lowRes);
        lctx.imageSmoothingEnabled = false;

        // 1. Sclera — smooth circle at low res (becomes chunky when scaled up)
        lctx.fillStyle = rgb(style.scleraColor);
        lctx.beginPath();
        lctx.arc(lc, lc, scleraR, 0, Math.PI * 2);
        lctx.fill();

        // 2. Sclera shadow — upper region
        lctx.save();
        lctx.beginPath();
        lctx.arc(lc, lc, scleraR, 0, Math.PI * 2);
        lctx.clip();
        lctx.fillStyle = rgb(style.scleraShadow, 0.5);
        lctx.beginPath();
        lctx.ellipse(lc, lc - scleraR * 0.35, scleraR * 1.3, scleraR * 0.55, 0, 0, Math.PI * 2);
        lctx.fill();
        lctx.restore();

        // 3. Iris rim
        lctx.fillStyle = rgb(style.irisRim);
        lctx.beginPath();
        lctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        lctx.fill();

        // 4. Iris base
        lctx.fillStyle = rgb(style.irisBase);
        lctx.beginPath();
        lctx.arc(ix, iy, irisR * 0.82, 0, Math.PI * 2);
        lctx.fill();

        // 5. Iris highlight — upper crescent
        lctx.fillStyle = rgb(style.irisHighlight, 0.7);
        lctx.beginPath();
        lctx.arc(ix, iy, irisR * 0.75, 0, Math.PI * 2);
        lctx.arc(ix, iy + irisR * 0.15, irisR * 0.75, 0, Math.PI * 2, true);
        lctx.fill();

        // 6. Pupil
        lctx.fillStyle = rgb(style.pupilColor);
        lctx.beginPath();
        lctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        lctx.fill();

        // 7. Specular highlights — chunky squares at low res
        const accent = style.accentColor || [248, 248, 200];
        lctx.fillStyle = rgb(accent, 0.95);
        // Big highlight: 3px at low-res = 3 * pixelSize at high-res
        lctx.fillRect(Math.round(ix + irisR * 0.25), Math.round(iy - irisR * 0.4), 3, 3);
        // Small highlight: 1px
        lctx.fillRect(Math.round(ix - irisR * 0.35), Math.round(iy + irisR * 0.25), 1, 1);

        // ── Scale up to main canvas with nearest-neighbor ──
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Draw scaled-up low-res canvas onto the main canvas
        ctx.drawImage(this.snesCanvas, 0, 0, lowRes, lowRes, 0, 0, s, s);

        // 8. CRT Scanline overlay (drawn at full resolution for crispness)
        const scanAlpha = style.scanlineAlpha || 0.15;
        ctx.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        for (let y = 0; y < s; y += px * 2) {
            ctx.fillRect(0, y, s, Math.max(1, px * 0.4));
        }

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // ROBOTIC — Cold precision, concentric rings, crosshair
    // ═════════════════════════════════════════════════════════
    private drawRobotic(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const accent = style.accentColor || [0, 255, 200];

        ctx.save();
        ctx.shadowBlur = 0;

        // 1. Dark chassis background (sclera)
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        // Clip to sclera for all inner elements
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        // 2. Subtle inner vignette ring
        ctx.fillStyle = rgb(style.scleraShadow, 0.4);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.arc(cx, cy, scleraR * 0.7, 0, Math.PI * 2, true);
        ctx.fill();

        // 3. Outer ring — thin precision stroke
        ctx.strokeStyle = rgb(style.irisRim, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 1.15, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Segmented iris ring (12 segments with gaps)
        const segments = 12;
        const gapAngle = Math.PI / 90; // Small gap between segments
        const segmentAngle = (Math.PI * 2) / segments - gapAngle;

        ctx.lineWidth = 4;
        for (let i = 0; i < segments; i++) {
            const startAngle = (i / segments) * Math.PI * 2;
            const endAngle = startAngle + segmentAngle;

            // Alternate between bright and dim segments
            const bright = i % 3 === 0;
            ctx.strokeStyle = bright
                ? rgb(style.irisHighlight, 0.9)
                : rgb(style.irisBase, 0.6);

            ctx.beginPath();
            ctx.arc(ix, iy, irisR, startAngle, endAngle);
            ctx.stroke();
        }

        // 5. Inner iris ring — thinner, brighter
        ctx.strokeStyle = rgb(style.irisHighlight, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // 6. Iris fill — subtle dark tinted disc
        ctx.fillStyle = rgb(style.irisBase, 0.15);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.68, 0, Math.PI * 2);
        ctx.fill();

        // 7. Tick marks around outer iris (every 30°)
        ctx.strokeStyle = rgb(style.irisRim, 0.4);
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const innerTick = irisR * 1.05;
            const outerTick = irisR * 1.15;
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * innerTick, iy + Math.sin(angle) * innerTick);
            ctx.lineTo(ix + Math.cos(angle) * outerTick, iy + Math.sin(angle) * outerTick);
            ctx.stroke();
        }

        // 8. Pupil — pure black void
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // 9. Pupil rim glow
        ctx.strokeStyle = rgb(style.irisHighlight, 0.3);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR * 1.1, 0, Math.PI * 2);
        ctx.stroke();

        // 10. Targeting crosshair through pupil
        ctx.strokeStyle = rgb(accent, 0.35);
        ctx.lineWidth = 1;
        const crossLen = irisR * 0.5;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(ix - crossLen, iy);
        ctx.lineTo(ix - pupilR * 1.3, iy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ix + pupilR * 1.3, iy);
        ctx.lineTo(ix + crossLen, iy);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(ix, iy - crossLen);
        ctx.lineTo(ix, iy - pupilR * 1.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ix, iy + pupilR * 1.3);
        ctx.lineTo(ix, iy + crossLen);
        ctx.stroke();

        // 11. Corner brackets (targeting reticle feel)
        ctx.strokeStyle = rgb(accent, 0.25);
        ctx.lineWidth = 1.5;
        const bSize = irisR * 0.2;
        const bOff = irisR * 0.85;
        const corners = [
            [ix - bOff, iy - bOff, 1, 1],
            [ix + bOff, iy - bOff, -1, 1],
            [ix - bOff, iy + bOff, 1, -1],
            [ix + bOff, iy + bOff, -1, -1],
        ];
        for (const [bx, by, dx, dy] of corners) {
            ctx.beginPath();
            ctx.moveTo(bx, by + dy * bSize);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + dx * bSize, by);
            ctx.stroke();
        }

        // 12. Subtle scanline overlay
        const scanAlpha = style.scanlineAlpha || 0.08;
        ctx.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        for (let y = 0; y < s; y += 4) {
            ctx.fillRect(0, y, s, 1);
        }

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // GOAT — Horizontal slit pupil, amber iris, stroma fibers
    // ═════════════════════════════════════════════════════════
    private drawGoat(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const fiberColor = style.accentColor || [140, 100, 30];

        // Dilation controls slit width: dilated = wider slit, constricted = thin slit
        const clampedDilation = Math.max(0.4, Math.min(2.0, dilation));
        // Slit height is always tall within the iris, width changes with dilation
        const slitH = irisR * 0.85;
        const slitW = irisR * 0.08 + irisR * 0.35 * (clampedDilation - 0.4) / 1.6;

        ctx.save();
        ctx.shadowBlur = 0;

        // ── 1. Sclera ──
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        // ── 2. Sclera shadow (warm, natural) ──
        ctx.fillStyle = rgb(style.scleraShadow, 0.5);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(cx, cy - scleraR * 0.3, scleraR * 1.4, scleraR * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── 3. Iris outer rim ──
        ctx.fillStyle = rgb(style.irisRim);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.fill();

        // ── 4. Iris base (amber) ──
        ctx.fillStyle = rgb(style.irisBase);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.92, 0, Math.PI * 2);
        ctx.fill();

        // ── 5. Iris highlight band (upper golden crescent) ──
        ctx.fillStyle = rgb(style.irisHighlight, 0.5);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.85, 0, Math.PI * 2);
        ctx.arc(ix, iy + irisR * 0.12, irisR * 0.85, 0, Math.PI * 2, true);
        ctx.fill();

        // ── 6. Stroma fibers (radial lines from pupil edge to iris edge) ──
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.9, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = rgb(fiberColor, 0.3);
        ctx.lineWidth = 1;
        const fiberCount = 36;
        for (let i = 0; i < fiberCount; i++) {
            const angle = (i / fiberCount) * Math.PI * 2;
            const innerR = irisR * 0.3;
            const outerR = irisR * 0.88;
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * innerR, iy + Math.sin(angle) * innerR);
            ctx.lineTo(ix + Math.cos(angle) * outerR, iy + Math.sin(angle) * outerR);
            ctx.stroke();
        }

        // Concentric rings in iris (stroma texture)
        ctx.strokeStyle = rgb(fiberColor, 0.15);
        ctx.lineWidth = 0.8;
        for (let r = 0.4; r <= 0.85; r += 0.15) {
            ctx.beginPath();
            ctx.arc(ix, iy, irisR * r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // ── 7. Horizontal slit pupil (THE signature goat feature) ──
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        // Draw as a rounded rectangle oriented horizontally
        const cornerR = slitW * 0.35;  // Rounded ends
        const left = ix - slitH;
        const right = ix + slitH;
        const top = iy - slitW;
        const bottom = iy + slitW;

        // Rounded horizontal rectangle
        ctx.moveTo(left + cornerR, top);
        ctx.lineTo(right - cornerR, top);
        ctx.quadraticCurveTo(right, top, right, top + cornerR);
        ctx.lineTo(right, bottom - cornerR);
        ctx.quadraticCurveTo(right, bottom, right - cornerR, bottom);
        ctx.lineTo(left + cornerR, bottom);
        ctx.quadraticCurveTo(left, bottom, left, bottom - cornerR);
        ctx.lineTo(left, top + cornerR);
        ctx.quadraticCurveTo(left, top, left + cornerR, top);
        ctx.closePath();
        ctx.fill();

        // Slight border glow on the pupil edges
        ctx.strokeStyle = rgb(style.irisRim, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();

        // ── 8. Specular reflections (natural, off-center) ──
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.25, iy - irisR * 0.35, irisR * 0.14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(ix - irisR * 0.3, iy + irisR * 0.15, irisR * 0.06, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // PENTAGRAM — Satanic / Archaic / Ominous
    // Pentagram-shaped pupil on a blood-crimson iris
    // ═════════════════════════════════════════════════════════
    private drawPentagram(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const fiberColor = style.accentColor || [90, 5, 0];

        const clampedDilation = Math.max(0.5, Math.min(1.8, dilation));
        // Pentagram outer radius scales with dilation
        const pentaR = irisR * 0.55 * clampedDilation;

        ctx.save();
        ctx.shadowBlur = 0;

        // ── 1. Sclera (near-black void) ──
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        // ── 2. Sclera shadow ──
        ctx.fillStyle = rgb(style.scleraShadow, 0.6);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(cx, cy - scleraR * 0.3, scleraR * 1.4, scleraR * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── 3. Iris outer rim ──
        ctx.fillStyle = rgb(style.irisRim);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.fill();

        // ── 4. Iris base (blood crimson) ──
        ctx.fillStyle = rgb(style.irisBase);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.92, 0, Math.PI * 2);
        ctx.fill();

        // ── 5. Iris highlight band (ember crescent) ──
        ctx.fillStyle = rgb(style.irisHighlight, 0.35);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.85, 0, Math.PI * 2);
        ctx.arc(ix, iy + irisR * 0.15, irisR * 0.85, 0, Math.PI * 2, true);
        ctx.fill();

        // ── 6. Vein-like stroma fibers (radial, dark) ──
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.9, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = rgb(fiberColor, 0.4);
        ctx.lineWidth = 1.2;
        const fiberCount = 30;
        for (let i = 0; i < fiberCount; i++) {
            const angle = (i / fiberCount) * Math.PI * 2;
            const innerR = irisR * 0.35;
            const outerR = irisR * 0.88;
            // Slight waviness
            const midR = (innerR + outerR) / 2;
            const wobble = (Math.sin(angle * 5) * irisR * 0.03);
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * innerR, iy + Math.sin(angle) * innerR);
            ctx.quadraticCurveTo(
                ix + Math.cos(angle) * midR + wobble,
                iy + Math.sin(angle) * midR + wobble,
                ix + Math.cos(angle) * outerR,
                iy + Math.sin(angle) * outerR
            );
            ctx.stroke();
        }
        ctx.restore();

        // ── 7. Pentagram pupil ──
        // Calculate the 5 outer points of the star, rotated so one point is at top
        const starPoints: [number, number][] = [];
        const rotation = -Math.PI / 2; // Point upward
        for (let i = 0; i < 5; i++) {
            const angle = rotation + (i * 2 * Math.PI) / 5;
            starPoints.push([
                ix + Math.cos(angle) * pentaR,
                iy + Math.sin(angle) * pentaR,
            ]);
        }

        // Draw the filled pentagram by connecting every other point (star shape)
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        // Star vertex order: 0 -> 2 -> 4 -> 1 -> 3 -> 0
        ctx.moveTo(starPoints[0][0], starPoints[0][1]);
        ctx.lineTo(starPoints[2][0], starPoints[2][1]);
        ctx.lineTo(starPoints[4][0], starPoints[4][1]);
        ctx.lineTo(starPoints[1][0], starPoints[1][1]);
        ctx.lineTo(starPoints[3][0], starPoints[3][1]);
        ctx.closePath();
        ctx.fill();

        // Stroke the pentagram outline with a faint ember glow
        ctx.strokeStyle = rgb(style.irisHighlight, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // ── 8. Inner occult circle (inscribed in the pentagram) ──
        const innerCircleR = pentaR * 0.38;
        ctx.strokeStyle = rgb(style.irisHighlight, 0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ix, iy, innerCircleR, 0, Math.PI * 2);
        ctx.stroke();

        // ── 9. Outer binding circle (circumscribing the pentagram) ──
        ctx.strokeStyle = rgb(style.irisRim, 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, pentaR * 1.05, 0, Math.PI * 2);
        ctx.stroke();

        // ── 10. Specular reflections (dim red, not white — keeps it dark) ──
        ctx.fillStyle = rgb(style.irisHighlight, 0.4);
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.25, iy - irisR * 0.35, irisR * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgb(style.irisHighlight, 0.2);
        ctx.beginPath();
        ctx.arc(ix - irisR * 0.3, iy + irisR * 0.15, irisR * 0.04, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // ARCADE — 80s Retro Video Game (neon pixel nostalgia)
    //   Think: Galaga, Pac-Man, Tron — glowing neon on CRT void.
    //   Uses pixel grid like SNES but with neon palette, glow rings,
    //   and a grid overlay for that arcade cabinet feel.
    // ═════════════════════════════════════════════════════════
    private drawArcade(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const px = style.pixelSize || 4;
        const lowRes = Math.ceil(s / px);

        // Lazily create offscreen canvas
        if (!this.snesCanvas || this.snesCanvas.width !== lowRes) {
            this.snesCanvas = document.createElement('canvas');
            this.snesCanvas.width = lowRes;
            this.snesCanvas.height = lowRes;
            this.snesCtx = this.snesCanvas.getContext('2d')!;
        }
        const lctx = this.snesCtx!;
        const lc = lowRes / 2;

        const scleraR = (s * 0.50) / px;
        const irisR = (s * style.irisRadiusFrac * 0.6) / px;
        const basePupilR = (s * style.pupilRadiusFrac * 0.6) / px;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = lc + offsetX / px;
        const iy = lc + offsetY / px;

        lctx.clearRect(0, 0, lowRes, lowRes);
        lctx.imageSmoothingEnabled = false;

        // 1. Sclera — deep CRT void
        lctx.fillStyle = rgb(style.scleraColor);
        lctx.beginPath();
        lctx.arc(lc, lc, scleraR, 0, Math.PI * 2);
        lctx.fill();

        // 2. Neon glow rings (concentric circles, arcade cabinet style)
        const neonColor = style.irisBase;
        for (let r = 3; r >= 1; r--) {
            lctx.strokeStyle = rgb(neonColor, 0.08 * r);
            lctx.lineWidth = 1;
            lctx.beginPath();
            lctx.arc(ix, iy, irisR + r * 2, 0, Math.PI * 2);
            lctx.stroke();
        }

        // 3. Iris rim — thick neon ring
        lctx.strokeStyle = rgb(style.irisRim);
        lctx.lineWidth = 2;
        lctx.beginPath();
        lctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        lctx.stroke();

        // 4. Iris fill — flat arcade color
        lctx.fillStyle = rgb(style.irisBase);
        lctx.beginPath();
        lctx.arc(ix, iy, irisR * 0.92, 0, Math.PI * 2);
        lctx.fill();

        // 5. Highlight ring (inner)
        lctx.strokeStyle = rgb(style.irisHighlight, 0.6);
        lctx.lineWidth = 1;
        lctx.beginPath();
        lctx.arc(ix, iy, irisR * 0.7, 0, Math.PI * 2);
        lctx.stroke();

        // 6. Pupil
        lctx.fillStyle = rgb(style.pupilColor);
        lctx.beginPath();
        lctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        lctx.fill();

        // 7. Hot magenta accent specular (high-score glint)
        const accent = style.accentColor || [255, 0, 200];
        lctx.fillStyle = rgb(accent, 0.9);
        lctx.fillRect(Math.round(ix + irisR * 0.3), Math.round(iy - irisR * 0.45), 2, 2);
        lctx.fillRect(Math.round(ix - irisR * 0.4), Math.round(iy + irisR * 0.25), 1, 1);

        // 8. Cross-hair targeting lines (arcade reticle)
        lctx.strokeStyle = rgb(style.irisHighlight, 0.3);
        lctx.lineWidth = 1;
        lctx.beginPath();
        lctx.moveTo(ix - irisR * 0.6, iy);
        lctx.lineTo(ix - irisR * 0.2, iy);
        lctx.moveTo(ix + irisR * 0.2, iy);
        lctx.lineTo(ix + irisR * 0.6, iy);
        lctx.moveTo(ix, iy - irisR * 0.6);
        lctx.lineTo(ix, iy - irisR * 0.2);
        lctx.moveTo(ix, iy + irisR * 0.2);
        lctx.lineTo(ix, iy + irisR * 0.6);
        lctx.stroke();

        // ── Scale up with nearest-neighbor ──
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.snesCanvas, 0, 0, lowRes, lowRes, 0, 0, s, s);

        // 9. CRT scanlines at full res
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let y = 0; y < s; y += px * 2) {
            ctx.fillRect(0, y, s, Math.max(1, px * 0.3));
        }

        // 10. Subtle pixel grid overlay (arcade CRT phosphor feel)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < s; x += px) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, s);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // CRUMB — R. Crumb Underground Comix Style
    //   Think: crosshatching, wobbly ink lines, aged newsprint.
    //   Hand-drawn feel with visible pen strokes, stipple noise,
    //   and rough, organic shapes — nothing is perfectly round.
    // ═════════════════════════════════════════════════════════
    private drawCrumb(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const veinColor = style.accentColor || [140, 20, 30];

        ctx.save();
        ctx.shadowBlur = 0;

        // 1. Sclera — yellowish, unhealthy eyeball white
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        // 2. Fleshy upper shadow (eyelid shadow / wetness)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = rgb(style.scleraShadow, 0.4);
        ctx.beginPath();
        ctx.ellipse(cx, cy - scleraR * 0.25, scleraR * 1.4, scleraR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pink/fleshy wash near edges (irritation)
        ctx.fillStyle = 'rgba(200, 120, 110, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.arc(cx, cy, scleraR * 0.7, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.restore();

        // 3. BLOODSHOT VEINS — the gross-up signature
        //    Branching red/purple capillaries radiating from edges toward iris.
        //    Uses deterministic angles so veins don't flicker per frame.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        const numVeins = 18;
        for (let i = 0; i < numVeins; i++) {
            const angle = (Math.PI * 2 * i) / numVeins + (i * 0.37); // offset per vein
            const startR = scleraR * 0.92;
            const endR = irisR * 1.15;
            const vx1 = cx + Math.cos(angle) * startR;
            const vy1 = cy + Math.sin(angle) * startR;
            const vx2 = ix + Math.cos(angle) * endR;
            const vy2 = iy + Math.sin(angle) * endR;

            // Main vein — thicker, darker red
            const isThick = i % 3 === 0;
            ctx.strokeStyle = rgb(veinColor, isThick ? 0.5 : 0.3);
            ctx.lineWidth = isThick ? 2.5 : 1.5;
            ctx.beginPath();
            ctx.moveTo(vx1, vy1);
            // Wobbly bezier curve (not straight — organic feel)
            const midR = (startR + endR) / 2;
            const wobble = (i % 2 === 0 ? 1 : -1) * scleraR * 0.06;
            const cpAngle = angle + wobble / midR;
            const cpx = cx + Math.cos(cpAngle) * midR;
            const cpy = cy + Math.sin(cpAngle) * midR;
            ctx.quadraticCurveTo(cpx, cpy, vx2, vy2);
            ctx.stroke();

            // Branch veins (smaller forks off the main vein)
            if (isThick) {
                const branchAngle = angle + 0.15;
                const branchR = midR * 0.85;
                const bx = cx + Math.cos(branchAngle) * branchR;
                const by = cy + Math.sin(branchAngle) * branchR;
                ctx.strokeStyle = rgb(veinColor, 0.2);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cpx, cpy);
                ctx.lineTo(bx, by);
                ctx.stroke();

                // Second branch
                const branchAngle2 = angle - 0.12;
                const bx2 = cx + Math.cos(branchAngle2) * (branchR * 0.9);
                const by2 = cy + Math.sin(branchAngle2) * (branchR * 0.9);
                ctx.beginPath();
                ctx.moveTo(cpx, cpy);
                ctx.lineTo(bx2, by2);
                ctx.stroke();
            }
        }
        ctx.restore();

        // 4. Red irritated rim around the sclera edge (lid irritation / crustiness)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = 'rgba(180, 40, 30, 0.35)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR - 2, 0, Math.PI * 2);
        ctx.stroke();

        // Crusty irregular dots around the rim
        ctx.fillStyle = 'rgba(160, 50, 35, 0.2)';
        const numCrust = 30;
        for (let i = 0; i < numCrust; i++) {
            const a = (Math.PI * 2 * i) / numCrust;
            const r = scleraR - 3 + ((i * 7) % 5) - 2;
            const crustX = cx + Math.cos(a) * r;
            const crustY = cy + Math.sin(a) * r;
            const crustR = 1.5 + (i % 3);
            ctx.beginPath();
            ctx.arc(crustX, crustY, crustR, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // 5. Sclera outline — thick meaty border
        ctx.strokeStyle = rgb(veinColor, 0.6);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR - 1, 0, Math.PI * 2);
        ctx.stroke();

        // 6. Iris — pinkish-red with radial streaks
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        // Iris rim (dark outer ring)
        ctx.fillStyle = rgb(style.irisRim);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris base
        ctx.fillStyle = rgb(style.irisBase);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Iris highlight crescent (upper)
        ctx.fillStyle = rgb(style.irisHighlight, 0.6);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.82, 0, Math.PI * 2);
        ctx.arc(ix, iy + irisR * 0.15, irisR * 0.82, 0, Math.PI * 2, true);
        ctx.fill();

        // Radial iris streaks (stroma detail — like real iris texture)
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.clip();
        const numStreaks = 32;
        for (let i = 0; i < numStreaks; i++) {
            const angle = (Math.PI * 2 * i) / numStreaks;
            const innerR = pupilR * 1.05;
            const outerR = irisR * 0.95;
            // Alternate colors for depth
            ctx.strokeStyle = i % 2 === 0
                ? rgb(style.irisRim, 0.3)
                : rgb(style.irisHighlight, 0.2);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * innerR, iy + Math.sin(angle) * innerR);
            ctx.lineTo(ix + Math.cos(angle) * outerR, iy + Math.sin(angle) * outerR);
            ctx.stroke();
        }
        ctx.restore();

        // Iris thick outline
        ctx.strokeStyle = rgb(style.irisRim, 0.9);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.stroke();

        // 7. Pupil — deep dark with soft edge bleed
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();
        // Soft bleed ring
        ctx.strokeStyle = rgb(style.pupilColor, 0.35);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR + 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // 8. BIG CARTOON SPECULAR — the signature gross-up highlight
        //    Large glossy white highlight (like the reference image)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.ellipse(
            ix + irisR * 0.25,
            iy - irisR * 0.3,
            irisR * 0.22,
            irisR * 0.28,
            -0.3, 0, Math.PI * 2
        );
        ctx.fill();

        // Secondary smaller specular (lower-left)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(ix - irisR * 0.2, iy + irisR * 0.25, irisR * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Tiny glint dots
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.4, iy - irisR * 0.1, irisR * 0.03, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // VOID — Black Hole / Singularity vortex
    // Concentric warping rings, event horizon glow, deep abyss
    // ═════════════════════════════════════════════════════════
    private drawVoid(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const accent = style.accentColor || [180, 80, 255];
        const t = performance.now() / 1000; // Time for animation

        ctx.save();
        ctx.shadowBlur = 0;

        // Sclera — deep space void
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        // Distant stars (tiny dots)
        ctx.fillStyle = 'rgba(200, 180, 255, 0.3)';
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 + t * 0.02;
            const dist = scleraR * (0.5 + (i % 5) * 0.1);
            const sx = cx + Math.cos(angle) * dist;
            const sy = cy + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(sx, sy, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Accretion disk — concentric warping rings
        const ringCount = 8;
        for (let i = ringCount; i >= 1; i--) {
            const ringR = irisR * (0.3 + (i / ringCount) * 0.85);
            const alpha = 0.15 + (i / ringCount) * 0.25;
            const rotOffset = t * (0.3 + i * 0.1);

            // Each ring slightly rotated and elliptical for warp effect
            ctx.save();
            ctx.translate(ix, iy);
            ctx.rotate(rotOffset);
            ctx.scale(1.0, 0.85 + Math.sin(t * 0.5 + i) * 0.08);

            ctx.strokeStyle = i % 2 === 0
                ? rgb(style.irisBase, alpha)
                : rgb(style.irisHighlight, alpha * 0.7);
            ctx.lineWidth = 2 + (i / ringCount) * 2;
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }

        // Event horizon glow ring
        ctx.strokeStyle = rgb(accent, 0.5 + Math.sin(t * 2) * 0.2);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR * 1.8, 0, Math.PI * 2);
        ctx.stroke();

        // Pupil — the singularity
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow at singularity edge
        ctx.strokeStyle = rgb(style.irisHighlight, 0.4);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Gravitational lensing arc
        ctx.strokeStyle = rgb(accent, 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 1.1, t % (Math.PI * 2), t % (Math.PI * 2) + Math.PI * 0.6);
        ctx.stroke();

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // HOLOGRAM — Sci-Fi wireframe projection
    // Translucent layers, scan lines, rotating data ring, glitch
    // ═════════════════════════════════════════════════════════
    private drawHologram(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const accent = style.accentColor || [0, 255, 180];
        const t = performance.now() / 1000;

        ctx.save();
        ctx.shadowBlur = 0;

        // Dark base
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        // Holographic scan line sweep
        const scanY = iy + Math.sin(t * 1.5) * irisR * 1.2;
        ctx.fillStyle = rgb(style.irisHighlight, 0.08);
        ctx.fillRect(0, scanY - 15, s, 30);
        ctx.fillStyle = rgb(style.irisHighlight, 0.25);
        ctx.fillRect(0, scanY - 1, s, 2);

        // Wireframe iris — concentric circles (thin strokes)
        for (let i = 1; i <= 5; i++) {
            const r = irisR * (i / 5);
            ctx.strokeStyle = rgb(style.irisBase, 0.3 + (i / 5) * 0.3);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ix, iy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Radial wireframe spokes
        ctx.strokeStyle = rgb(style.irisBase, 0.25);
        ctx.lineWidth = 1;
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * pupilR * 1.2, iy + Math.sin(angle) * pupilR * 1.2);
            ctx.lineTo(ix + Math.cos(angle) * irisR, iy + Math.sin(angle) * irisR);
            ctx.stroke();
        }

        // Rotating data ring with text-like segments
        ctx.save();
        ctx.translate(ix, iy);
        ctx.rotate(t * 0.3);
        const dataR = irisR * 0.78;
        const dataSegments = 24;
        for (let i = 0; i < dataSegments; i++) {
            const segAngle = (i / dataSegments) * Math.PI * 2;
            const segLen = (Math.PI * 2) / dataSegments * 0.6;
            const bright = (i + Math.floor(t * 3)) % 4 === 0;
            ctx.strokeStyle = bright
                ? rgb(accent, 0.8)
                : rgb(style.irisBase, 0.2);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, dataR, segAngle, segAngle + segLen);
            ctx.stroke();
        }
        ctx.restore();

        // Outer iris ring — brighter
        ctx.strokeStyle = rgb(style.irisHighlight, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.stroke();

        // Pupil — glowing center
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Pupil glow ring
        ctx.strokeStyle = rgb(style.irisHighlight, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR * 1.15, 0, Math.PI * 2);
        ctx.stroke();

        // Glitch offset layer (occasional horizontal slice shift)
        const glitchActive = Math.sin(t * 7) > 0.92;
        if (glitchActive) {
            ctx.fillStyle = rgb(style.irisHighlight, 0.15);
            const glitchY = iy + (Math.random() - 0.5) * irisR;
            ctx.fillRect(ix - irisR, glitchY, irisR * 2, 3);
        }

        // Holographic flicker
        const flicker = Math.sin(t * 15) > 0.7 ? 0.06 : 0;
        if (flicker > 0) {
            ctx.fillStyle = rgb(style.irisHighlight, flicker);
            ctx.beginPath();
            ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Scanlines over entire eye
        const scanAlpha = style.scanlineAlpha || 0.10;
        ctx.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        for (let y = 0; y < s; y += 3) {
            ctx.fillRect(0, y, s, 1);
        }

        ctx.restore();
    }

    // ═════════════════════════════════════════════════════════
    // INFRARED — Thermal night vision sensor HUD
    // Heat-map gradient, hex sensor grid, range-finder arcs
    // ═════════════════════════════════════════════════════════
    private drawInfrared(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const accent = style.accentColor || [0, 200, 60];

        ctx.save();
        ctx.shadowBlur = 0;

        // Dark olive-green base (night vision background)
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();

        // Night vision green overlay on sclera
        ctx.fillStyle = rgb(accent, 0.05);
        ctx.fillRect(0, 0, s, s);

        // Thermal iris rings — heat gradient (cool to hot)
        const heatSteps = 6;
        const heatColors: [number, number, number][] = [
            [0, 40, 120],       // Cold blue (outer)
            [0, 100, 180],      // Cool cyan
            [80, 160, 40],      // Warm green
            [200, 160, 0],      // Yellow
            [220, 80, 0],       // Orange
            [255, 200, 50],     // Hot white-yellow (center)
        ];
        for (let i = 0; i < heatSteps; i++) {
            const ringR = irisR * (1.0 - (i / heatSteps) * 0.7);
            ctx.fillStyle = rgb(heatColors[i], 0.5 + i * 0.08);
            ctx.beginPath();
            ctx.arc(ix, iy, ringR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Hex sensor grid over iris
        ctx.strokeStyle = rgb(accent, 0.2);
        ctx.lineWidth = 1;
        const hexSize = 12;
        for (let row = -6; row <= 6; row++) {
            for (let col = -6; col <= 6; col++) {
                const hx = ix + col * hexSize * 1.5;
                const hy = iy + row * hexSize * 1.73 + (col % 2 ? hexSize * 0.866 : 0);
                const dist = Math.sqrt((hx - ix) ** 2 + (hy - iy) ** 2);
                if (dist < irisR * 0.9) {
                    this.drawHexagon(ctx, hx, hy, hexSize * 0.5);
                }
            }
        }

        // Pupil — hot white core (inverted from normal)
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Pupil inner glow
        ctx.fillStyle = 'rgba(255, 220, 150, 0.3)';
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Outer iris ring
        ctx.strokeStyle = rgb(style.irisRim, 0.7);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.stroke();

        // Range-finder arcs (top and bottom)
        ctx.strokeStyle = rgb(accent, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 1.12, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 1.12, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();

        // Distance tick marks on range-finder
        ctx.strokeStyle = rgb(accent, 0.3);
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = -Math.PI * 0.3 + (i / 7) * Math.PI * 0.6;
            const r1 = irisR * 1.08;
            const r2 = irisR * 1.15;
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * r1, iy + Math.sin(angle) * r1);
            ctx.lineTo(ix + Math.cos(angle) * r2, iy + Math.sin(angle) * r2);
            ctx.stroke();
        }

        // Night vision scanline overlay
        const scanAlpha = style.scanlineAlpha || 0.10;
        ctx.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        for (let y = 0; y < s; y += 3) {
            ctx.fillRect(0, y, s, 1);
        }

        ctx.restore();
    }

    // Helper: draw hexagon for infrared sensor grid
    private drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // ═════════════════════════════════════════════════════════
    // FRACTURED — Shattered crystal / prism eye
    // Geometric triangular facets, prismatic refraction, cracked
    // ═════════════════════════════════════════════════════════
    private drawFractured(
        ctx: CanvasRenderingContext2D,
        style: EyeStyle,
        offsetX: number,
        offsetY: number,
        dilation: number,
    ) {
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50;
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));
        const ix = cx + offsetX;
        const iy = cy + offsetY;
        const accent = style.accentColor || [220, 100, 255];

        ctx.save();
        ctx.shadowBlur = 0;

        // Crystal-white sclera
        ctx.fillStyle = rgb(style.scleraColor);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.fill();

        // Sclera shadow
        ctx.fillStyle = rgb(style.scleraShadow, 0.5);
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(cx, cy - scleraR * 0.25, scleraR * 1.3, scleraR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris rim
        ctx.fillStyle = rgb(style.irisRim);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris base
        ctx.fillStyle = rgb(style.irisBase);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.95, 0, Math.PI * 2);
        ctx.fill();

        // Clip to iris for facet drawing
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.93, 0, Math.PI * 2);
        ctx.clip();

        // Geometric triangular facets filling the iris
        // Use a deterministic seed based on style name for consistent pattern
        const facetRings = 3;
        const prismaticColors: [number, number, number][] = [
            [180, 220, 255],    // Ice blue
            [140, 200, 240],    // Sky blue
            [200, 240, 255],    // Bright white-blue
            [160, 180, 220],    // Steel blue
            [120, 180, 255],    // Clear blue
            accent,             // Prismatic violet accent
        ];

        for (let ring = 0; ring < facetRings; ring++) {
            const innerR = pupilR * 1.3 + (irisR - pupilR * 1.3) * (ring / facetRings);
            const outerR = pupilR * 1.3 + (irisR - pupilR * 1.3) * ((ring + 1) / facetRings);
            const segments = 8 + ring * 4;

            for (let i = 0; i < segments; i++) {
                const a1 = (i / segments) * Math.PI * 2;
                const a2 = ((i + 1) / segments) * Math.PI * 2;
                const aMid = (a1 + a2) / 2;

                // Triangle from inner edge to outer points
                const colorIdx = (i + ring * 3) % prismaticColors.length;
                const alpha = 0.25 + (ring / facetRings) * 0.3;
                ctx.fillStyle = rgb(prismaticColors[colorIdx], alpha);

                ctx.beginPath();
                ctx.moveTo(ix + Math.cos(a1) * innerR, iy + Math.sin(a1) * innerR);
                ctx.lineTo(ix + Math.cos(aMid) * outerR, iy + Math.sin(aMid) * outerR);
                ctx.lineTo(ix + Math.cos(a2) * innerR, iy + Math.sin(a2) * innerR);
                ctx.closePath();
                ctx.fill();

                // Facet edge line
                ctx.strokeStyle = rgb(style.irisHighlight, 0.3);
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Crack lines radiating from pupil
        ctx.strokeStyle = rgb(style.irisHighlight, 0.5);
        ctx.lineWidth = 1;
        const crackCount = 12;
        for (let i = 0; i < crackCount; i++) {
            const angle = (i / crackCount) * Math.PI * 2 + 0.15;
            const len = irisR * (0.5 + ((i * 7) % 5) / 10);
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(angle) * pupilR * 1.1, iy + Math.sin(angle) * pupilR * 1.1);
            // Jagged crack — one midpoint offset
            const midR = len * 0.5;
            const jitter = ((i * 3) % 7 - 3) * 3;
            const perpAngle = angle + Math.PI / 2;
            const mx = ix + Math.cos(angle) * midR + Math.cos(perpAngle) * jitter;
            const my = iy + Math.sin(angle) * midR + Math.sin(perpAngle) * jitter;
            ctx.lineTo(mx, my);
            ctx.lineTo(ix + Math.cos(angle) * len, iy + Math.sin(angle) * len);
            ctx.stroke();
        }

        ctx.restore(); // un-clip iris

        // Pupil
        ctx.fillStyle = rgb(style.pupilColor);
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Crystal specular highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.28, iy - irisR * 0.35, irisR * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Secondary glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(ix - irisR * 0.3, iy + irisR * 0.2, irisR * 0.06, 0, Math.PI * 2);
        ctx.fill();

        // Prismatic edge shimmer (thin colored arc)
        ctx.strokeStyle = rgb(accent, 0.3);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.15, iy - irisR * 0.1, irisR * 0.75, -0.5, 0.8);
        ctx.stroke();

        ctx.restore();
    }
}
