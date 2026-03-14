/**
 * Phone Alert Overlay — Soviet Propaganda Style
 *
 * Full-screen alert triggered when a cell phone is detected by the camera.
 * Flashes between two states at 3Hz:
 *   State A: Warning text with propaganda rays
 *   State B: Crossed-out phone icon (prohibition sign)
 */

// ── Configuration ──
const FLASH_HZ = 3.0;
const COOLDOWN_MS = 2000; // Stay active 2s after phone disappears

// ── Soviet colour palette ──
const SOVIET_RED: [number, number, number] = [200, 30, 20];
const SOVIET_DARK: [number, number, number] = [120, 15, 10];
const SOVIET_GOLD: [number, number, number] = [255, 200, 0];

export class PhoneAlertOverlay {
    private size: number;
    private center: number;
    private active = false;
    private lastPhoneTime = 0;
    private activateTime = 0;

    // Pre-rendered phone icon
    private phoneIconCanvas: OffscreenCanvas | null = null;

    // ── Siren audio ──
    private audioCtx: AudioContext | null = null;
    private sirenOsc1: OscillatorNode | null = null;
    private sirenOsc2: OscillatorNode | null = null;
    private sirenGain: GainNode | null = null;
    private sirenPlaying = false;
    private sirenAnimFrame = 0;

    constructor(size: number) {
        this.size = size;
        this.center = size / 2;
        this._buildPhoneIcon();
    }

    get isActive(): boolean {
        return this.active;
    }

    /** Update state based on detected objects list from WebSocket */
    update(objects: { label: string; score: number }[], now: number): void {
        const phoneDetected = objects.some(obj => obj.label === 'cell phone');

        if (phoneDetected) {
            this.lastPhoneTime = now;
            if (!this.active) {
                this.active = true;
                this.activateTime = now;
                this._startSiren();
            }
        } else if (this.active) {
            if (now - this.lastPhoneTime > COOLDOWN_MS) {
                this.active = false;
                this._stopSiren();
            }
        }
    }

    // ── Siren Sound (Web Audio API) ──
    private _startSiren(): void {
        if (this.sirenPlaying) return;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new AudioContext();
            }
            const ctx = this.audioCtx;
            if (ctx.state === 'suspended') ctx.resume();

            // Gain node — overall siren volume
            this.sirenGain = ctx.createGain();
            this.sirenGain.gain.value = 0.35;

            // Distortion for extra grit
            const distortion = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i / 128) - 1;
                curve[i] = (Math.PI + 50) * x / (Math.PI + 50 * Math.abs(x));
            }
            distortion.curve = curve;
            distortion.oversample = '4x';

            // Oscillator 1: Main wailing siren (sweeps 600Hz–1400Hz)
            this.sirenOsc1 = ctx.createOscillator();
            this.sirenOsc1.type = 'sawtooth';
            this.sirenOsc1.frequency.value = 600;

            // Oscillator 2: Higher harsh pulse (sweeps 900Hz–1800Hz)
            this.sirenOsc2 = ctx.createOscillator();
            this.sirenOsc2.type = 'square';
            this.sirenOsc2.frequency.value = 900;

            const osc2Gain = ctx.createGain();
            osc2Gain.gain.value = 0.15; // Quieter secondary tone

            this.sirenOsc1.connect(distortion);
            this.sirenOsc2.connect(osc2Gain);
            osc2Gain.connect(distortion);
            distortion.connect(this.sirenGain);
            this.sirenGain.connect(ctx.destination);

            this.sirenOsc1.start();
            this.sirenOsc2.start();
            this.sirenPlaying = true;

            // Animate the siren sweep
            const animateSiren = () => {
                if (!this.sirenPlaying || !this.sirenOsc1 || !this.sirenOsc2) return;
                const t = performance.now() * 0.001;

                // Main wail: sweep up and down at ~1.5Hz (European two-tone siren)
                const sweep = Math.sin(t * Math.PI * 1.5);
                this.sirenOsc1.frequency.value = 1000 + sweep * 400;

                // Secondary: faster wobble
                const sweep2 = Math.sin(t * Math.PI * 3.0);
                this.sirenOsc2.frequency.value = 1350 + sweep2 * 450;

                // Pulsing volume for extra urgency
                if (this.sirenGain) {
                    this.sirenGain.gain.value = 0.25 + 0.1 * Math.abs(Math.sin(t * 8));
                }

                this.sirenAnimFrame = requestAnimationFrame(animateSiren);
            };
            animateSiren();

        } catch (e) {
            console.warn('Siren audio failed:', e);
        }
    }

    private _stopSiren(): void {
        if (!this.sirenPlaying) return;
        this.sirenPlaying = false;

        cancelAnimationFrame(this.sirenAnimFrame);

        try {
            this.sirenOsc1?.stop();
            this.sirenOsc2?.stop();
        } catch { /* already stopped */ }

        this.sirenOsc1?.disconnect();
        this.sirenOsc2?.disconnect();
        this.sirenGain?.disconnect();
        this.sirenOsc1 = null;
        this.sirenOsc2 = null;
        this.sirenGain = null;
    }

    /** Render the full-screen Soviet propaganda alert */
    render(ctx: CanvasRenderingContext2D, now: number): void {
        if (!this.active) return;

        const s = this.size;
        const cx = this.center;
        const cy = this.center;

        // Flash state: A (text) or B (icon)
        const phase = Math.sin(now * 0.001 * 2 * Math.PI * FLASH_HZ);
        const showText = phase >= 0;

        // Strobe intensity for pulsing brightness
        const strobe = 0.6 + 0.4 * Math.abs(Math.sin(now * 0.012));

        ctx.save();

        // ── Background: deep Soviet red with strobe ──
        const bgR = Math.floor(SOVIET_DARK[0] * strobe);
        const bgG = Math.floor(SOVIET_DARK[1] * strobe);
        const bgB = Math.floor(SOVIET_DARK[2] * strobe);
        ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
        ctx.fillRect(0, 0, s, s);

        // ── Propaganda rays (rotating golden burst) ──
        const rayAlpha = 0.15 * strobe;
        ctx.globalAlpha = rayAlpha;
        ctx.strokeStyle = `rgb(${SOVIET_GOLD.join(',')})`;
        ctx.lineWidth = 4;
        const numRays = 24;
        const t = now * 0.0003; // slow rotation
        for (let i = 0; i < numRays; i++) {
            const angle = (2 * Math.PI * i / numRays) + t;
            const x1 = cx + Math.cos(angle) * 20;
            const y1 = cy + Math.sin(angle) * 20;
            const x2 = cx + Math.cos(angle) * s;
            const y2 = cy + Math.sin(angle) * s;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        // ── Scanlines ──
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < s; y += 3) {
            ctx.fillRect(0, y, s, 1);
        }

        if (showText) {
            this._renderTextState(ctx, cx, cy, s, strobe);
        } else {
            this._renderIconState(ctx, cx, cy, s, strobe, now);
        }

        // ── Red border flash ──
        const borderAlpha = 0.7 * strobe;
        ctx.globalAlpha = borderAlpha;
        ctx.strokeStyle = `rgb(${SOVIET_RED.join(',')})`;
        for (let b = 0; b < 12; b++) {
            ctx.lineWidth = 3;
            ctx.globalAlpha = Math.max(0.02, borderAlpha - b * 0.06);
            ctx.strokeRect(b, b, s - b * 2, s - b * 2);
        }
        ctx.globalAlpha = 1.0;

        ctx.restore();
    }

    // ── STATE A: Warning text with alert ──
    private _renderTextState(
        ctx: CanvasRenderingContext2D,
        cx: number, cy: number, s: number, strobe: number
    ): void {
        const alertFontSize = Math.max(20, Math.floor(s * 0.14));
        const subFontSize = Math.max(16, Math.floor(s * 0.06));

        // "⚠ ALERT ⚠" — large, upper area
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow
        ctx.font = `bold ${alertFontSize + 4}px 'Courier New', monospace`;
        ctx.globalAlpha = 0.4 * strobe;
        ctx.fillStyle = `rgb(${SOVIET_RED.join(',')})`;
        ctx.fillText('⚠ ALERT ⚠', cx - 2, cy * 0.45 - 1);
        ctx.fillText('⚠ ALERT ⚠', cx + 2, cy * 0.45 + 1);

        // Main
        ctx.font = `bold ${alertFontSize}px 'Courier New', monospace`;
        ctx.globalAlpha = strobe;
        ctx.fillStyle = `rgb(${SOVIET_GOLD.join(',')})`;
        ctx.fillText('⚠ ALERT ⚠', cx, cy * 0.45);

        // Subtitle lines
        ctx.font = `bold ${subFontSize}px 'Courier New', monospace`;
        ctx.globalAlpha = 0.9 * strobe;
        ctx.fillStyle = `rgb(${SOVIET_GOLD.join(',')})`;
        ctx.fillText('FOREIGN OBSERVATION', cx, cy * 1.15);
        ctx.fillText('TECHNOLOGY DETECTED!', cx, cy * 1.15 + subFontSize + 8);

        ctx.globalAlpha = 1.0;
    }

    // ── STATE B: Crossed-out phone icon ──
    private _renderIconState(
        ctx: CanvasRenderingContext2D,
        cx: number, cy: number, s: number, strobe: number, now: number
    ): void {
        // Draw pre-rendered phone icon with pulse
        if (this.phoneIconCanvas) {
            const iconSize = Math.floor(s * 0.5);
            const iconAlpha = 0.7 + 0.3 * Math.sin(now * 0.008);
            ctx.globalAlpha = iconAlpha;
            ctx.drawImage(
                this.phoneIconCanvas,
                cx - iconSize / 2, cy - iconSize / 2,
                iconSize, iconSize
            );
        }

        // Label below icon
        const labelFontSize = Math.max(14, Math.floor(s * 0.04));
        ctx.font = `bold ${labelFontSize}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.8 * strobe;
        ctx.fillStyle = `rgb(${SOVIET_GOLD.join(',')})`;
        ctx.fillText('RECORDING PROHIBITED', cx, cy + s * 0.3);

        ctx.globalAlpha = 1.0;
    }

    /** Pre-build the crossed-out phone icon on an OffscreenCanvas */
    private _buildPhoneIcon(): void {
        const iconSize = Math.floor(this.size * 0.5);

        // Use regular canvas if OffscreenCanvas not available
        let canvas: OffscreenCanvas | HTMLCanvasElement;
        let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        try {
            canvas = new OffscreenCanvas(iconSize, iconSize);
            ctx = canvas.getContext('2d');
        } catch {
            // Fallback for environments without OffscreenCanvas
            canvas = document.createElement('canvas');
            canvas.width = iconSize;
            canvas.height = iconSize;
            ctx = canvas.getContext('2d');
        }
        if (!ctx) return;

        const cx = iconSize / 2;
        const cy = iconSize / 2;

        // Phone body (rounded rectangle)
        const pw = Math.floor(iconSize * 0.28);
        const ph = Math.floor(iconSize * 0.50);
        const px = cx - pw / 2;
        const py = cy - ph / 2;

        ctx.fillStyle = 'rgb(60, 60, 70)';
        this._roundRect(ctx, px, py, pw, ph, 8, true, false);
        ctx.strokeStyle = 'rgb(180, 180, 190)';
        ctx.lineWidth = 3;
        this._roundRect(ctx, px, py, pw, ph, 8, false, true);

        // Screen area
        const screenMargin = Math.floor(pw * 0.12);
        ctx.fillStyle = 'rgb(100, 160, 220)';
        ctx.fillRect(
            px + screenMargin,
            py + Math.floor(ph * 0.12),
            pw - screenMargin * 2,
            Math.floor(ph * 0.62)
        );

        // Home button
        const btnR = Math.max(3, Math.floor(pw * 0.08));
        const btnY = py + ph - Math.floor(ph * 0.08);
        ctx.fillStyle = 'rgb(150, 150, 160)';
        ctx.beginPath();
        ctx.arc(cx, btnY, btnR, 0, Math.PI * 2);
        ctx.fill();

        // Camera dot
        const camR = Math.max(2, Math.floor(pw * 0.05));
        const camY = py + Math.floor(ph * 0.05);
        ctx.fillStyle = 'rgb(40, 40, 50)';
        ctx.beginPath();
        ctx.arc(cx, camY, camR, 0, Math.PI * 2);
        ctx.fill();

        // Red prohibition circle
        const circleR = Math.floor(iconSize * 0.40);
        ctx.strokeStyle = `rgb(${SOVIET_RED.join(',')})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
        ctx.stroke();

        // Diagonal slash
        const slashD = Math.floor(Math.cos(Math.PI / 4) * circleR);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx - slashD, cy - slashD);
        ctx.lineTo(cx + slashD, cy + slashD);
        ctx.stroke();

        this.phoneIconCanvas = canvas as OffscreenCanvas;
    }

    /** Helper: draw a rounded rectangle */
    private _roundRect(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        r: number, fill: boolean, stroke: boolean
    ): void {
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
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }
}
