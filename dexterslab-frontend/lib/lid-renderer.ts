/**
 * Lid Renderer — Eyelid with gunmetal panel look.
 * 
 * PERFORMANCE REWRITE: Old version drew individual horizontal line strokes
 * per scanline (up to 400 ctx.stroke() calls per frame when lids were closing).
 * Now uses fillRect bands for the ridges and a single gradient for the shadow.
 * 
 * CIRCULAR DISPLAY: When isCircular=true, the lids are clipped to a circle
 * so they close as curved arcs matching the Waveshare 5" round display.
 */

const GUNMETAL_BASE: [number, number, number] = [55, 60, 65];
const GUNMETAL_LIGHT: [number, number, number] = [80, 85, 90];
const GUNMETAL_DARK: [number, number, number] = [30, 35, 40];
const CYAN_LED: [number, number, number] = [0, 220, 220];
const LID_RIDGE_HEIGHT = 6;
const LED_THICKNESS = 2;

export class LidRenderer {
    private size: number;
    private isCircular: boolean;

    constructor(size: number, isCircular = false) {
        this.size = size;
        this.isCircular = isCircular;
    }

    render(ctx: CanvasRenderingContext2D, lidPhase: number) {
        if (lidPhase <= 0.001) return;

        const s = this.size;
        const phase = Math.max(0, Math.min(1, lidPhase));
        const center = s / 2;
        const radius = s / 2;

        const upperY = Math.round(phase * center);
        const lowerY = s - Math.round(phase * center);

        if (this.isCircular) {
            // ── Circular lid rendering ──
            // Clip each lid to the circular display boundary so the
            // gunmetal plates appear as curved arcs, not rectangles.

            // Upper lid
            ctx.save();
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.clip();
            this.drawRidgedPlate(ctx, 0, upperY, true);
            ctx.restore();

            // Lower lid
            ctx.save();
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.clip();
            this.drawRidgedPlate(ctx, lowerY, s, false);
            ctx.restore();

            // ── Curved LED edge strips ──
            // Instead of straight horizontal LED lines, draw arcs at the lid edge
            if (phase > 0.01) {
                this.drawCurvedLedEdge(ctx, center, center, radius, upperY, true);
                this.drawCurvedLedEdge(ctx, center, center, radius, lowerY, false);
            }
        } else {
            // ── Standard rectangular lids (desktop mode) ──
            // Upper lid
            this.drawRidgedPlate(ctx, 0, upperY, true);

            // Lower lid
            this.drawRidgedPlate(ctx, lowerY, s, false);
        }
    }

    /**
     * Draw a curved LED edge at the lid boundary that follows the circle.
     */
    private drawCurvedLedEdge(
        ctx: CanvasRenderingContext2D,
        cx: number, cy: number, radius: number,
        edgeY: number, isUpper: boolean
    ) {
        // Calculate the angle where the horizontal edge intersects the circle
        const dy = edgeY - cy;
        if (Math.abs(dy) >= radius) return; // Edge is outside the circle

        const dx = Math.sqrt(radius * radius - dy * dy);
        const startAngle = Math.atan2(dy, -dx);
        const endAngle = Math.atan2(dy, dx);

        // LED glow arc
        ctx.strokeStyle = `rgb(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]})`;
        ctx.lineWidth = LED_THICKNESS + 1;
        ctx.beginPath();
        if (isUpper) {
            ctx.arc(cx, cy, radius * 0.01 + Math.sqrt(dx * dx + dy * dy) * 0.99, startAngle, endAngle);
        } else {
            ctx.arc(cx, cy, radius * 0.01 + Math.sqrt(dx * dx + dy * dy) * 0.99, startAngle, endAngle);
        }
        // Actually just draw a straight LED line clipped to the circle — it reads better visually
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = `rgb(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]})`;
        for (let i = 0; i < LED_THICKNESS; i++) {
            const offset = isUpper ? i : -i;
            const yLed = edgeY + offset;
            if (yLed >= 0 && yLed < this.size) {
                ctx.fillRect(0, yLed, this.size, 1);
            }
        }

        // LED glow gradient (also clipped)
        const glowDir = isUpper ? 1 : -1;
        const glowY = edgeY + glowDir * LED_THICKNESS;
        const glowH = 8;
        if (glowY >= 0 && glowY + glowH * glowDir >= 0) {
            const grad = ctx.createLinearGradient(0, glowY, 0, glowY + glowH * glowDir);
            grad.addColorStop(0, `rgba(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]},0.2)`);
            grad.addColorStop(1, `rgba(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]},0)`);
            ctx.fillStyle = grad;
            const rectY = isUpper ? glowY : glowY - glowH;
            ctx.fillRect(0, rectY, this.size, glowH);
        }
        ctx.restore();
    }

    private drawRidgedPlate(ctx: CanvasRenderingContext2D, yStart: number, yEnd: number, isUpper: boolean) {
        const s = this.size;
        const height = yEnd - yStart;
        if (height <= 0) return;

        // Fill with base gunmetal color
        ctx.fillStyle = `rgb(${GUNMETAL_BASE[0]},${GUNMETAL_BASE[1]},${GUNMETAL_BASE[2]})`;
        ctx.fillRect(0, yStart, s, height);

        // Draw ridge lines every LID_RIDGE_HEIGHT pixels
        for (let y = yStart; y < yEnd; y += LID_RIDGE_HEIGHT) {
            // Light edge
            ctx.fillStyle = `rgb(${GUNMETAL_LIGHT[0]},${GUNMETAL_LIGHT[1]},${GUNMETAL_LIGHT[2]})`;
            ctx.fillRect(0, y, s, 1);
            // Dark edge
            const darkY = y + LID_RIDGE_HEIGHT - 1;
            if (darkY < yEnd) {
                ctx.fillStyle = `rgb(${GUNMETAL_DARK[0]},${GUNMETAL_DARK[1]},${GUNMETAL_DARK[2]})`;
                ctx.fillRect(0, darkY, s, 1);
            }
        }

        // LED edge strip (only in non-circular mode — circular mode draws curved LEDs separately)
        if (!this.isCircular) {
            const ledY = isUpper ? yEnd : yStart;
            ctx.fillStyle = `rgb(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]})`;
            for (let i = 0; i < LED_THICKNESS; i++) {
                const offset = isUpper ? i : -i;
                const yLed = ledY + offset;
                if (yLed >= 0 && yLed < s) {
                    ctx.fillRect(0, yLed, s, 1);
                }
            }

            // LED glow (use a gradient instead of per-line alpha)
            const glowDir = isUpper ? 1 : -1;
            const glowY = ledY + glowDir * LED_THICKNESS;
            const glowH = 8;
            if (glowY >= 0 && glowY + glowH * glowDir >= 0) {
                const grad = ctx.createLinearGradient(0, glowY, 0, glowY + glowH * glowDir);
                grad.addColorStop(0, `rgba(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]},0.2)`);
                grad.addColorStop(1, `rgba(${CYAN_LED[0]},${CYAN_LED[1]},${CYAN_LED[2]},0)`);
                ctx.fillStyle = grad;
                const rectY = isUpper ? glowY : glowY - glowH;
                ctx.fillRect(0, rectY, s, glowH);
            }
        }

        // Shadow (use a gradient instead of 20 individual line strokes)
        const shadowH = 15;
        const shadowDir = isUpper ? 1 : -1;
        const shadowY = isUpper ? yEnd : yStart - shadowH;
        if (shadowY >= 0 && shadowY < s) {
            const sGrad = ctx.createLinearGradient(0, isUpper ? yEnd : yStart, 0, isUpper ? yEnd + shadowH : yStart - shadowH);
            sGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
            sGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = sGrad;
            ctx.fillRect(0, shadowY, s, shadowH);
        }
    }
}
