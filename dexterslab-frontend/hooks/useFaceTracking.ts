/**
 * useFaceTracking — Browser-based face detection for The Eye.
 *
 * Uses Chromium's built-in FaceDetector API (Shape Detection API).
 * Opens the camera via getUserMedia, runs face detection at ~15fps,
 * and maps face position → eye tracking coordinates.
 *
 * Falls back gracefully to { visible: false } if:
 *   - FaceDetector API isn't available (Firefox, Safari)
 *   - Camera permissions denied
 *   - No camera hardware
 */

import { useEffect, useRef, useCallback } from 'react';

// ── Types ──

/** FaceDetector API — built into Chromium, not in TypeScript stdlib */
interface DetectedFace {
    boundingBox: DOMRectReadOnly;
}

interface FaceDetectorOptions {
    fastMode?: boolean;
    maxDetectedFaces?: number;
}

declare class FaceDetector {
    constructor(options?: FaceDetectorOptions);
    detect(image: ImageBitmapSource): Promise<DetectedFace[]>;
}

export interface FaceTrackingData {
    /** Eye offset X in pixels (-150 to +150). Mirrored so face-left = eye-right. */
    x: number;
    /** Eye offset Y in pixels (-150 to +150). */
    y: number;
    /** Pupil dilation (0.5 = far, 1.5 = close). */
    dilation: number;
    /** Whether a face is currently detected. */
    visible: boolean;
    /** Smoothing factor. */
    smooth: number;
}

export interface FaceTrackingCallbacks {
    onTrackingData: (data: FaceTrackingData) => void;
    /** Eye render size in pixels (used for coordinate scaling) */
    eyeSize: number;
}

// ── Detection config ──
const DETECTION_INTERVAL_MS = 66;  // ~15fps
const MAX_OFFSET = 150;            // max eye offset in pixels
const VIDEO_WIDTH = 320;           // low-res for speed
const VIDEO_HEIGHT = 240;

export function useFaceTracking({ onTrackingData, eyeSize }: FaceTrackingCallbacks) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const detectorRef = useRef<FaceDetector | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const activeRef = useRef(false);
    const callbackRef = useRef(onTrackingData);
    callbackRef.current = onTrackingData;

    // Smoothed values for jitter reduction
    const smoothRef = useRef({ x: 0, y: 0, dilation: 1.0, lostFrames: 0 });

    const startTracking = useCallback(async () => {
        // Check for FaceDetector API
        if (typeof window === 'undefined' || !('FaceDetector' in window)) {
            console.log('👁 FaceDetector API not available — sentinel mode only');
            return;
        }

        try {
            // Create detector
            detectorRef.current = new FaceDetector({
                fastMode: true,
                maxDetectedFaces: 1,
            });

            // Open camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: VIDEO_WIDTH },
                    height: { ideal: VIDEO_HEIGHT },
                    facingMode: 'user',
                },
                audio: false,
            });

            // Create hidden video element
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.position = 'fixed';
            video.style.top = '-9999px';
            video.style.left = '-9999px';
            video.style.width = '1px';
            video.style.height = '1px';
            document.body.appendChild(video);
            videoRef.current = video;

            await video.play();
            activeRef.current = true;

            console.log(`👁 Face tracking started (${video.videoWidth}×${video.videoHeight})`);

            // Detection loop
            intervalRef.current = setInterval(async () => {
                if (!activeRef.current || !videoRef.current || !detectorRef.current) return;
                if (videoRef.current.readyState < 2) return; // not ready

                try {
                    const faces = await detectorRef.current.detect(videoRef.current);
                    const sm = smoothRef.current;
                    const vw = videoRef.current.videoWidth || VIDEO_WIDTH;
                    const vh = videoRef.current.videoHeight || VIDEO_HEIGHT;

                    if (faces.length > 0) {
                        const face = faces[0].boundingBox;

                        // Normalize face center to -1..+1 range
                        const faceCenterX = (face.x + face.width / 2) / vw;
                        const faceCenterY = (face.y + face.height / 2) / vh;

                        // Map to eye offset coordinates
                        // X is MIRRORED: camera-left → eye-right (creates "looking at you" effect)
                        const rawX = -(faceCenterX - 0.5) * 2 * MAX_OFFSET;
                        const rawY = (faceCenterY - 0.5) * 2 * MAX_OFFSET * 0.7; // less vertical range

                        // Face size → dilation (bigger face = closer = more dilated)
                        const faceRatio = face.width / vw;
                        const rawDilation = 0.6 + faceRatio * 3.0; // 0.6 (far) → 1.5+ (close)
                        const clampedDilation = Math.max(0.5, Math.min(1.8, rawDilation));

                        // Smooth to reduce jitter
                        const smoothFactor = 0.3;
                        sm.x = sm.x + (rawX - sm.x) * smoothFactor;
                        sm.y = sm.y + (rawY - sm.y) * smoothFactor;
                        sm.dilation = sm.dilation + (clampedDilation - sm.dilation) * 0.15;
                        sm.lostFrames = 0;

                        callbackRef.current({
                            x: sm.x,
                            y: sm.y,
                            dilation: sm.dilation,
                            visible: true,
                            smooth: 0.12,
                        });
                    } else {
                        // No face — increment lost frames counter
                        sm.lostFrames++;

                        // After a few missed frames, report as not visible
                        // (small grace period to avoid flickering)
                        if (sm.lostFrames > 5) {
                            callbackRef.current({
                                x: sm.x,
                                y: sm.y,
                                dilation: 1.0,
                                visible: false,
                                smooth: 0.06,
                            });
                        }
                    }
                } catch {
                    // Detection error — silently continue
                }
            }, DETECTION_INTERVAL_MS);
        } catch (err) {
            console.warn('👁 Camera access failed:', err);
        }
    }, []);

    const stopTracking = useCallback(() => {
        activeRef.current = false;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (videoRef.current) {
            const stream = videoRef.current.srcObject as MediaStream | null;
            stream?.getTracks().forEach(t => t.stop());
            videoRef.current.remove();
            videoRef.current = null;
        }

        detectorRef.current = null;
        console.log('👁 Face tracking stopped');
    }, []);

    useEffect(() => {
        startTracking();
        return stopTracking;
    }, [startTracking, stopTracking]);

    return { isActive: activeRef.current };
}
