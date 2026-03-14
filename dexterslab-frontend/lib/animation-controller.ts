/**
 * Animation Controller — Blink + Saccade systems.
 * Ported from SmoothBlinkController and SaccadeController in observer.py.
 */

// ── Configuration ──
const BLINK_MIN_INTERVAL = 3.0;
const BLINK_MAX_INTERVAL = 8.0;
const STANDARD_BLINK_DURATION = 0.28;
const STYLE_BLINK_DURATION = 0.40;
const DOUBLE_BLINK_CHANCE = 0.15;
const SACCADE_INTENSITY = 0.015;
const SACCADE_SPEED = 8.0;

function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

// ── Smooth Blink Controller ──

export class BlinkController {
    isBlinking = false;
    private blinkStart = 0;
    private blinkDuration = STANDARD_BLINK_DURATION;
    private isStyleBlink = false;
    private swapCallback: (() => void) | null = null;
    private swapFired = false;
    private doublePending = false;
    private nextBlink: number;

    constructor() {
        this.nextBlink = performance.now() / 1000 + randomRange(BLINK_MIN_INTERVAL, BLINK_MAX_INTERVAL);
    }

    triggerStandardBlink() {
        if (this.isBlinking) return;
        this.isBlinking = true;
        this.blinkStart = performance.now() / 1000;
        this.blinkDuration = STANDARD_BLINK_DURATION;
        this.isStyleBlink = false;
        this.swapFired = false;
        this.doublePending = Math.random() < DOUBLE_BLINK_CHANCE;
    }

    triggerStyleBlink(callback: () => void) {
        if (this.isBlinking) return;
        this.isBlinking = true;
        this.blinkStart = performance.now() / 1000;
        this.blinkDuration = STYLE_BLINK_DURATION;
        this.isStyleBlink = true;
        this.swapCallback = callback;
        this.swapFired = false;
        this.doublePending = false;
    }

    private easeBlink(t: number): number {
        if (this.isStyleBlink) {
            const closePhase = 0.35;
            const openPhase = 0.65;
            if (t < closePhase) {
                return Math.sin((t / closePhase) * Math.PI / 2);
            } else if (t < openPhase) {
                return 1.0;
            } else {
                return Math.cos(((t - openPhase) / (1 - openPhase)) * Math.PI / 2);
            }
        } else {
            const closePhase = 0.40;
            if (t < closePhase) {
                return Math.sin((t / closePhase) * Math.PI / 2);
            } else {
                const openT = (t - closePhase) / (1 - closePhase);
                return Math.cos(openT * Math.PI / 2);
            }
        }
    }

    update(): number {
        const now = performance.now() / 1000;

        if (!this.isBlinking) {
            if (now >= this.nextBlink) {
                this.triggerStandardBlink();
            }
            return 0.0;
        }

        const elapsed = now - this.blinkStart;
        const t = Math.min(1.0, elapsed / this.blinkDuration);
        const phase = this.easeBlink(t);

        // Fire style swap at peak
        if (this.isStyleBlink && !this.swapFired && phase >= 0.98) {
            this.swapFired = true;
            this.swapCallback?.();
        }

        if (t >= 1.0) {
            this.isBlinking = false;
            if (this.doublePending) {
                this.doublePending = false;
                setTimeout(() => this.triggerStandardBlink(), 80);
            }
            this.nextBlink = now + randomRange(BLINK_MIN_INTERVAL, BLINK_MAX_INTERVAL);
            return 0.0;
        }

        return phase;
    }
}

// ── Saccade Controller (Microsaccades) ──

export class SaccadeController {
    private maxTravel: number;
    private targetX = 0;
    private targetY = 0;
    private currentX = 0;
    private currentY = 0;
    private nextSaccade = 0;

    constructor(maxTravel: number) {
        this.maxTravel = maxTravel;
        this.scheduleNext();
    }

    private scheduleNext() {
        this.nextSaccade = performance.now() / 1000 + randomRange(0.3, 1.5);
        const intensity = this.maxTravel * SACCADE_INTENSITY;
        this.targetX = (Math.random() - 0.5) * 2 * intensity;
        this.targetY = (Math.random() - 0.5) * 2 * intensity;
    }

    update(): [number, number] {
        const now = performance.now() / 1000;

        if (now >= this.nextSaccade) {
            this.scheduleNext();
        }

        const speed = SACCADE_SPEED * 0.016; // ~60fps step
        this.currentX += (this.targetX - this.currentX) * speed;
        this.currentY += (this.targetY - this.currentY) * speed;

        return [this.currentX, this.currentY];
    }
}
