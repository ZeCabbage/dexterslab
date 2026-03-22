/**
 * THE OBSERVER 2 — Camera Streamer
 *
 * Captures camera frames and streams them as JPEG blobs
 * over WebSocket to the backend for motion processing.
 *
 * Runs at ~15fps, 320×240, JPEG quality 0.5 for low bandwidth.
 */

import { WSClientV2 } from './ws-client-v2';

const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;
const CAPTURE_INTERVAL = 66; // ~15fps
const JPEG_QUALITY = 0.5;

export class CameraStreamer {
    private video: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private stream: MediaStream | null = null;
    private active = false;

    /**
     * Start capturing and streaming frames.
     * @param wsClient - WebSocket client to send frames through
     * @returns true if camera started successfully
     */
    async start(wsClient: WSClientV2): Promise<boolean> {
        if (this.active) return true;

        // Check for camera support
        if (!navigator.mediaDevices?.getUserMedia) {
            console.log('👁 Camera not available — sentinel mode only');
            return false;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: CAPTURE_WIDTH },
                    height: { ideal: CAPTURE_HEIGHT },
                    facingMode: 'user',
                    frameRate: { ideal: 15, max: 20 },
                },
                audio: false,
            });

            // Hidden video element
            this.video = document.createElement('video');
            this.video.srcObject = this.stream;
            this.video.autoplay = true;
            this.video.playsInline = true;
            this.video.muted = true;
            this.video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px';
            document.body.appendChild(this.video);
            await this.video.play();

            const vw = this.video.videoWidth || CAPTURE_WIDTH;
            const vh = this.video.videoHeight || CAPTURE_HEIGHT;

            console.log(`👁 Camera streaming started (${vw}×${vh})`);

            // Offscreen canvas for frame capture
            this.canvas = document.createElement('canvas');
            this.canvas.width = vw;
            this.canvas.height = vh;
            this.ctx = this.canvas.getContext('2d')!;

            this.active = true;

            // Capture loop
            this.intervalId = setInterval(() => {
                if (!this.active || !this.video || this.video.readyState < 2) return;
                if (!wsClient.isConnected) return;

                // Draw frame to canvas
                this.ctx!.drawImage(this.video, 0, 0, vw, vh);

                // Export as JPEG blob and send over WS
                this.canvas!.toBlob(
                    (blob) => {
                        if (blob) {
                            wsClient.sendFrame(blob);
                        }
                    },
                    'image/jpeg',
                    JPEG_QUALITY,
                );
            }, CAPTURE_INTERVAL);

            return true;
        } catch (err) {
            console.warn('👁 Camera access failed:', err);
            return false;
        }
    }

    /**
     * Stop capturing and release camera.
     */
    stop() {
        this.active = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.remove();
            this.video = null;
        }
        this.canvas = null;
        this.ctx = null;
        console.log('👁 Camera streaming stopped');
    }

    get isActive() {
        return this.active;
    }
}
