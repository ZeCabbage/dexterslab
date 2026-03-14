/**
 * Wireframe Renderer — Ultra-lightweight stroke-based renderer for Raspberry Pi.
 * Bypasses all gradients, shadows, and composite operations to guarantee 60fps.
 */

import { EyeStyle } from '@/data/eye-styles';

export class WireframeRenderer {
    private size: number;
    private center: number;
    private color = '#00ff41'; // Matrix Green

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
        const s = this.size;
        const cx = this.center;
        const cy = this.center;
        const scleraR = s * 0.50; // Match regular renderer
        const irisR = s * style.irisRadiusFrac * 0.6;
        const basePupilR = s * style.pupilRadiusFrac * 0.6;
        const pupilR = basePupilR * Math.max(0.4, Math.min(2.0, dilation));

        const ix = cx + offsetX;
        const iy = cy + offsetY;

        // Force zero effects
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = this.color;

        ctx.save();

        // ── 1. Sclera Outline ──
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.stroke();

        // Wireframe Sphere Latitude/Longitude Lines
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        // Latitudes
        ctx.ellipse(cx, cy, scleraR, scleraR * 0.5, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, scleraR, scleraR * 0.2, 0, 0, Math.PI * 2);
        // Longitudes
        ctx.ellipse(cx, cy, scleraR * 0.5, scleraR, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, scleraR * 0.2, scleraR, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // ── 2. Iris Ring ──
        ctx.beginPath();
        ctx.arc(cx, cy, scleraR, 0, Math.PI * 2);
        ctx.clip(); // Keep iris inside eyeball

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.stroke();

        // Inner tracking ring
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(ix, iy, irisR * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Wireframe stroma (Targeting reticle)
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ix - irisR * 1.2, iy); ctx.lineTo(ix + irisR * 1.2, iy);
        ctx.moveTo(ix, iy - irisR * 1.2); ctx.lineTo(ix, iy + irisR * 1.2);

        // 45 degree angle lines
        const d = irisR * 0.85;
        ctx.moveTo(ix - d, iy - d); ctx.lineTo(ix + d, iy + d);
        ctx.moveTo(ix - d, iy + d); ctx.lineTo(ix + d, iy - d);
        ctx.stroke();

        // ── 3. Pupil ──
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.stroke();
        // Inner solid tracking dot
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // ── 4. Tech UI Elements ──
        ctx.fillStyle = this.color;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`TRK: [${Math.round(offsetX)}, ${Math.round(offsetY)}]`, cx - scleraR + 10, cy - scleraR + 30);
        ctx.fillText(`DIL: ${dilation.toFixed(2)}`, cx - scleraR + 10, cy - scleraR + 50);

        ctx.restore();
    }
}
