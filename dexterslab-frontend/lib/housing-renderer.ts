/**
 * Housing Renderer — Post-apocalyptic, 1984 Brutalist style.
 * Renders a gritty, concrete-like/rusty metal aperture over the eye borders.
 */

export class HousingRenderer {
    private size: number;
    private offscreenCanvas: HTMLCanvasElement | null = null;
    private apertureR: number;

    constructor(size: number, apertureFrac: number = 0.44) {
        this.size = size;
        this.apertureR = size * apertureFrac;
    }

    render(ctx: CanvasRenderingContext2D) {
        if (!this.offscreenCanvas) {
            this.buildHousing();
        }
        if (this.offscreenCanvas) {
            ctx.drawImage(this.offscreenCanvas, 0, 0);
        }
    }

    private buildHousing() {
        // We only have access to document in browser
        if (typeof document === 'undefined') return;

        const canvas = document.createElement('canvas');
        canvas.width = this.size;
        canvas.height = this.size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cx = this.size / 2;
        const cy = this.size / 2;

        // 1. Base metal/concrete background
        ctx.fillStyle = '#1a1a1c'; // Very dark, gritty grey
        ctx.fillRect(0, 0, this.size, this.size);

        // Add noise texture
        const imgData = ctx.getImageData(0, 0, this.size, this.size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 15;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);

        // 2. Brutalist panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Diagonal cuts
        ctx.moveTo(0, 0); ctx.lineTo(cx - this.apertureR - 20, cy - this.apertureR - 20);
        ctx.moveTo(this.size, 0); ctx.lineTo(cx + this.apertureR + 20, cy - this.apertureR - 20);
        ctx.moveTo(0, this.size); ctx.lineTo(cx - this.apertureR - 20, cy + this.apertureR + 20);
        ctx.moveTo(this.size, this.size); ctx.lineTo(cx + this.apertureR + 20, cy + this.apertureR + 20);

        // Horizontal/vertical bolts
        ctx.moveTo(0, cy); ctx.lineTo(cx - this.apertureR, cy);
        ctx.moveTo(this.size, cy); ctx.lineTo(cx + this.apertureR, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - this.apertureR);
        ctx.moveTo(cx, this.size); ctx.lineTo(cx, cy + this.apertureR);
        ctx.stroke();

        // Highlights on panel lines for depth
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Cut out the center aperture
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, this.apertureR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // 4. Aperture Bevel/Rim (Gritty steel rim)
        ctx.beginPath();
        ctx.arc(cx, cy, this.apertureR, 0, Math.PI * 2);
        ctx.lineWidth = 12;
        const rimGrad = ctx.createLinearGradient(0, 0, this.size, this.size);
        rimGrad.addColorStop(0, '#4a4a4d');
        rimGrad.addColorStop(0.5, '#111112');
        rimGrad.addColorStop(1, '#3a3a3d');
        ctx.strokeStyle = rimGrad;
        ctx.stroke();

        // Inner shadow of the rim to make it feel deeply recessed
        ctx.beginPath();
        ctx.arc(cx, cy, this.apertureR - 6, 0, Math.PI * 2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.stroke();

        // 5. Caution stripes/warning markings
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#ff3300';
        // Draw some faded warning text on the housing
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WARNING: SURVEILLANCE ACTIVE', cx, 30);
        ctx.fillText('SECTOR 4 - COMPLIANCE', cx, this.size - 20);

        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText('PROPERTY OF THE STATE', 0, -this.apertureR - 40);
        ctx.restore();

        // Save to offscreen canvas
        this.offscreenCanvas = canvas;
    }
}
