/**
 * Digital Decay Effect — 80s Dystopian CRT Post-Processing
 *
 * Layered effects that make the eye look like it's being rendered on a
 * worn CRT monitor in a dystopian surveillance facility.
 *
 * PERFORMANCE PRIORITY: Eye tracking speed and realism come first.
 * All effects use only fillRect/stroke — NO drawImage self-copies
 * except in rare glitch blocks (~15% chance every 150ms).
 *
 * Effects (in render order):
 *   1. CRT Phosphor Tint — subtle green-cyan color shift
 *   2. Interlace Scanlines — alternating bright/dark pairs
 *   3. Analog Noise Band — drifting VHS tracking bar (visual only)
 *   4. Glitch Blocks — rare horizontal displacement with color bleed
 *   5. CRT Flicker — subtle brightness fluctuation
 *   6. Color Fringe — warm/cool tint at edges (cheap aberration)
 *   7. Vignette — darkened corners (desktop only)
 */

export class DecayEffect {
    private size: number;
    private isCircular: boolean;

    // ── Glitch state ──
    private glitchLines: { y: number; h: number; offset: number; colorShift: number }[] = [];
    private glitchTimer = 0;
    private glitchProbability: number;

    // ── Noise band state ──
    private noiseBandY = 0;
    private noiseBandSpeed = 0.4;
    private noiseBandDir = 1;

    // ── Interlace state ──
    private interlaceFrame = 0;

    // ── Scanline spacing ──
    private scanlineSpacing: number;

    constructor(size: number, isCircular = false) {
        this.size = size;
        this.isCircular = isCircular;
        this.scanlineSpacing = isCircular ? 5 : 3;
        this.glitchProbability = isCircular ? 0.10 : 0.15;
        this.noiseBandY = Math.random();
    }

    apply(ctx: CanvasRenderingContext2D, now: number) {
        const s = this.size;

        // ══════════════════════════════════════════════════
        // 1. CRT PHOSPHOR TINT
        //    Subtle green-cyan wash — like old CRT phosphors
        //    Cost: 1 fillRect
        // ══════════════════════════════════════════════════
        ctx.fillStyle = 'rgba(0, 35, 25, 0.05)';
        ctx.fillRect(0, 0, s, s);

        // ══════════════════════════════════════════════════
        // 2. INTERLACE SCANLINES
        //    Alternating dark lines that shift each frame
        //    Cost: ~s/spacing fillRects (cheap)
        // ══════════════════════════════════════════════════
        this.interlaceFrame++;
        const offset = this.interlaceFrame % 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let y = offset; y < s; y += this.scanlineSpacing) {
            ctx.fillRect(0, y, s, 1);
        }

        // ══════════════════════════════════════════════════
        // 3. ANALOG NOISE BAND
        //    Drifting horizontal interference bar (VHS feel)
        //    Visual only — no drawImage displacement
        //    Cost: 3 fillRects
        // ══════════════════════════════════════════════════
        this.noiseBandY += this.noiseBandSpeed * 0.016 * this.noiseBandDir;
        if (this.noiseBandY > 1.0 || this.noiseBandY < 0.0) {
            this.noiseBandDir *= -1;
            this.noiseBandSpeed = 0.2 + Math.random() * 0.5;
        }

        const bandY = this.noiseBandY * s;
        const bandH = s * 0.025 + Math.sin(now * 3) * s * 0.008;
        const bandAlpha = 0.035 + 0.025 * Math.sin(now * 7);

        // White streak
        ctx.fillStyle = `rgba(180, 210, 200, ${bandAlpha})`;
        ctx.fillRect(0, bandY, s, bandH);

        // Shadow edge above
        ctx.fillStyle = `rgba(0, 0, 0, ${bandAlpha * 0.7})`;
        ctx.fillRect(0, bandY - 2, s, 2);

        // Slight brightening below
        ctx.fillStyle = `rgba(150, 200, 180, ${bandAlpha * 0.3})`;
        ctx.fillRect(0, bandY + bandH, s, 1);

        // ══════════════════════════════════════════════════
        // 4. GLITCH BLOCKS (rare)
        //    Horizontal displacement + color bleed strips
        //    Only uses drawImage when glitch is active (~15%
        //    chance every 150ms = ~1 per second average)
        //    Cost: 0 most frames, ~3 drawImage when active
        // ══════════════════════════════════════════════════
        if (now - this.glitchTimer > 0.15) {
            this.glitchTimer = now;
            this.glitchLines = [];
            if (Math.random() < this.glitchProbability) {
                const count = 1 + (Math.random() * 2 | 0);
                for (let i = 0; i < count; i++) {
                    this.glitchLines.push({
                        y: Math.random() * (s - 10) | 0,
                        h: 2 + (Math.random() * 6 | 0),
                        offset: -12 + (Math.random() * 24 | 0),
                        colorShift: Math.random(),
                    });
                }
            }
        }

        for (const g of this.glitchLines) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, g.y, s, g.h);
            ctx.clip();

            ctx.fillStyle = 'black';
            ctx.fillRect(0, g.y, s, g.h);
            ctx.drawImage(ctx.canvas, 0, g.y, s, g.h, g.offset, g.y, s, g.h);

            // Color bleed tint
            if (g.colorShift < 0.33) {
                ctx.fillStyle = 'rgba(255, 0, 60, 0.12)';
            } else if (g.colorShift < 0.66) {
                ctx.fillStyle = 'rgba(0, 255, 180, 0.10)';
            } else {
                ctx.fillStyle = 'rgba(80, 120, 255, 0.12)';
            }
            ctx.fillRect(0, g.y, s, g.h);

            ctx.restore();
        }

        // ══════════════════════════════════════════════════
        // 5. CRT FLICKER
        //    Subtle full-frame brightness wobble — like an
        //    old monitor with unstable power supply
        //    Cost: 1 fillRect
        // ══════════════════════════════════════════════════
        const flicker =
            Math.sin(now * 8.3) * 0.01 +
            Math.sin(now * 13.7) * 0.006 +
            Math.sin(now * 31.1) * 0.003;

        if (flicker > 0) {
            ctx.fillStyle = `rgba(180, 210, 200, ${flicker})`;
        } else {
            ctx.fillStyle = `rgba(0, 0, 0, ${-flicker * 1.5})`;
        }
        ctx.fillRect(0, 0, s, s);

        // ══════════════════════════════════════════════════
        // 6. COLOR FRINGE (cheap chromatic aberration)
        //    Warm left edge, cool right edge — suggests
        //    color misalignment without expensive drawImage
        //    Cost: 2 fillRects
        // ══════════════════════════════════════════════════
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.02;
        ctx.fillStyle = 'rgb(255, 100, 80)';
        ctx.fillRect(0, 0, s * 0.08, s);
        ctx.fillStyle = 'rgb(80, 100, 255)';
        ctx.fillRect(s * 0.92, 0, s * 0.08, s);
        ctx.restore();

        // ══════════════════════════════════════════════════
        // 7. VIGNETTE
        //    Skip on circular — physical bezel provides it
        //    Cost: 1 radial gradient fill
        // ══════════════════════════════════════════════════
        if (!this.isCircular) {
            const vigGrad = ctx.createRadialGradient(
                s / 2, s / 2, s * 0.28,
                s / 2, s / 2, s * 0.52
            );
            vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vigGrad.addColorStop(0.7, 'rgba(0,0,0,0.12)');
            vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, s, s);
        }
    }
}
