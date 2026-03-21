/**
 * useMotionTracking — Browser-based multi-entity motion detection.
 *
 * Uses getUserMedia + canvas frame differencing to detect motion regions.
 * Groups motion pixels into blobs (entities) using connected-component analysis.
 * Feeds entities through GazeController for lifelike attention management.
 *
 * Zero dependencies — pure canvas ImageData operations.
 */

import { useEffect, useRef, useCallback } from 'react';
import { GazeController, GazeTarget, MotionEntity } from '@/lib/gaze-controller';

export interface MotionTrackingCallbacks {
    onGazeUpdate: (gaze: GazeTarget) => void;
}

// ── Detection config ──
const CAPTURE_WIDTH = 160;      // very low res for speed
const CAPTURE_HEIGHT = 120;
const DETECTION_INTERVAL = 66;  // ~15fps
const MOTION_THRESHOLD = 30;    // pixel diff threshold (0-255)
const MIN_BLOB_SIZE = 15;       // minimum pixels to be an entity
const MERGE_DISTANCE = 0.12;    // max normalized distance to merge blobs
const BG_LEARN_RATE = 0.03;     // how fast background adapts (0=never, 1=instant)

// Downscaled grid for blob detection (faster than per-pixel flood fill)
const GRID_CELL = 4;            // process in 4×4 cells
const GRID_W = Math.ceil(CAPTURE_WIDTH / GRID_CELL);
const GRID_H = Math.ceil(CAPTURE_HEIGHT / GRID_CELL);

export function useMotionTracking({ onGazeUpdate }: MotionTrackingCallbacks) {
    const callbackRef = useRef(onGazeUpdate);
    callbackRef.current = onGazeUpdate;

    const activeRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startTracking = useCallback(async () => {
        // Check for camera
        if (!navigator.mediaDevices?.getUserMedia) {
            console.log('👁 getUserMedia not available — sentinel mode only');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: CAPTURE_WIDTH },
                    height: { ideal: CAPTURE_HEIGHT },
                    facingMode: 'user',
                    frameRate: { ideal: 15, max: 20 },
                },
                audio: false,
            });

            // Hidden video element
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px';
            document.body.appendChild(video);
            await video.play();

            const vw = video.videoWidth || CAPTURE_WIDTH;
            const vh = video.videoHeight || CAPTURE_HEIGHT;

            console.log(`👁 Motion tracking started (${vw}×${vh})`);

            // Canvas for frame capture
            const canvas = document.createElement('canvas');
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

            // State
            let prevFrame: Uint8ClampedArray | null = null;
            let bgFrame: Float32Array | null = null;
            const gazeController = new GazeController();
            let nextEntityId = 0;

            // Previous entities for ID persistence
            let prevEntities: MotionEntity[] = [];

            activeRef.current = true;

            intervalRef.current = setInterval(() => {
                if (!activeRef.current || video.readyState < 2) return;

                // ── 1. Capture frame ──
                ctx.drawImage(video, 0, 0, vw, vh);
                const imageData = ctx.getImageData(0, 0, vw, vh);
                const pixels = imageData.data;

                // Convert to grayscale
                const gray = new Uint8Array(vw * vh);
                for (let i = 0; i < gray.length; i++) {
                    const p = i * 4;
                    gray[i] = (pixels[p] * 77 + pixels[p + 1] * 150 + pixels[p + 2] * 29) >> 8;
                }

                // ── 2. Initialize or update background model ──
                if (!bgFrame) {
                    bgFrame = new Float32Array(gray.length);
                    for (let i = 0; i < gray.length; i++) bgFrame[i] = gray[i];
                    prevFrame = new Uint8ClampedArray(gray);
                    return;
                }

                // ── 3. Frame differencing against adaptive background ──
                const motionGrid = new Uint8Array(GRID_W * GRID_H);

                for (let gy = 0; gy < GRID_H; gy++) {
                    for (let gx = 0; gx < GRID_W; gx++) {
                        let motionSum = 0;
                        let cellPixels = 0;

                        // Sum motion in this grid cell
                        for (let dy = 0; dy < GRID_CELL; dy++) {
                            for (let dx = 0; dx < GRID_CELL; dx++) {
                                const px = gx * GRID_CELL + dx;
                                const py = gy * GRID_CELL + dy;
                                if (px >= vw || py >= vh) continue;

                                const idx = py * vw + px;
                                const diff = Math.abs(gray[idx] - bgFrame[idx]);
                                if (diff > MOTION_THRESHOLD) motionSum++;
                                cellPixels++;

                                // Update background (adaptive)
                                bgFrame[idx] += (gray[idx] - bgFrame[idx]) * BG_LEARN_RATE;
                            }
                        }

                        // Cell has motion if >30% of pixels moved
                        if (cellPixels > 0 && motionSum / cellPixels > 0.3) {
                            motionGrid[gy * GRID_W + gx] = 1;
                        }
                    }
                }

                prevFrame = new Uint8ClampedArray(gray);

                // ── 4. Connected-component blob detection ──
                const visited = new Uint8Array(GRID_W * GRID_H);
                const rawBlobs: { sumX: number; sumY: number; count: number; maxX: number; minX: number; maxY: number; minY: number }[] = [];

                for (let gy = 0; gy < GRID_H; gy++) {
                    for (let gx = 0; gx < GRID_W; gx++) {
                        const idx = gy * GRID_W + gx;
                        if (!motionGrid[idx] || visited[idx]) continue;

                        // Flood fill
                        const blob = { sumX: 0, sumY: 0, count: 0, minX: gx, maxX: gx, minY: gy, maxY: gy };
                        const stack = [idx];
                        visited[idx] = 1;

                        while (stack.length > 0) {
                            const ci = stack.pop()!;
                            const cx = ci % GRID_W;
                            const cy = Math.floor(ci / GRID_W);

                            blob.sumX += cx;
                            blob.sumY += cy;
                            blob.count++;
                            blob.minX = Math.min(blob.minX, cx);
                            blob.maxX = Math.max(blob.maxX, cx);
                            blob.minY = Math.min(blob.minY, cy);
                            blob.maxY = Math.max(blob.maxY, cy);

                            // Check 4 neighbors
                            const neighbors = [
                                [cx - 1, cy], [cx + 1, cy],
                                [cx, cy - 1], [cx, cy + 1],
                            ];
                            for (const [nx, ny] of neighbors) {
                                if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
                                const ni = ny * GRID_W + nx;
                                if (!motionGrid[ni] || visited[ni]) continue;
                                visited[ni] = 1;
                                stack.push(ni);
                            }
                        }

                        if (blob.count >= MIN_BLOB_SIZE / (GRID_CELL * GRID_CELL)) {
                            rawBlobs.push(blob);
                        }
                    }
                }

                // ── 5. Convert blobs to entities ──
                let entities: MotionEntity[] = rawBlobs.map(b => ({
                    x: (b.sumX / b.count) / GRID_W,
                    y: (b.sumY / b.count) / GRID_H,
                    size: (b.count * GRID_CELL * GRID_CELL) / (vw * vh),
                    activity: Math.min(1, b.count / (GRID_W * GRID_H * 0.15)),
                    id: 0,
                }));

                // ── 6. Merge nearby entities ──
                entities = mergeNearbyEntities(entities);

                // ── 7. Assign persistent IDs ──
                entities = assignEntityIds(entities, prevEntities, () => nextEntityId++);
                prevEntities = entities;

                // ── 8. Feed to gaze controller ──
                const gaze = gazeController.update(entities);
                callbackRef.current(gaze);

            }, DETECTION_INTERVAL);

            // Return cleanup
            return () => {
                activeRef.current = false;
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                stream.getTracks().forEach(t => t.stop());
                video.remove();
                console.log('👁 Motion tracking stopped');
            };
        } catch (err) {
            console.warn('👁 Camera access failed:', err);
        }
    }, []);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        startTracking().then(c => { cleanup = c; });
        return () => { cleanup?.(); };
    }, [startTracking]);
}

/** Merge entities that are close together (likely same person) */
function mergeNearbyEntities(entities: MotionEntity[]): MotionEntity[] {
    if (entities.length <= 1) return entities;

    const merged: MotionEntity[] = [];
    const used = new Set<number>();

    for (let i = 0; i < entities.length; i++) {
        if (used.has(i)) continue;

        let group = [entities[i]];
        used.add(i);

        for (let j = i + 1; j < entities.length; j++) {
            if (used.has(j)) continue;
            const dx = entities[i].x - entities[j].x;
            const dy = entities[i].y - entities[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < MERGE_DISTANCE) {
                group.push(entities[j]);
                used.add(j);
            }
        }

        // Weighted average by size
        let totalSize = 0;
        let wx = 0, wy = 0, totalActivity = 0;
        for (const e of group) {
            totalSize += e.size;
            wx += e.x * e.size;
            wy += e.y * e.size;
            totalActivity = Math.max(totalActivity, e.activity);
        }

        merged.push({
            x: wx / totalSize,
            y: wy / totalSize,
            size: totalSize,
            activity: totalActivity,
            id: 0,
        });
    }

    return merged;
}

/** Assign stable IDs to entities based on proximity to previous frame's entities */
function assignEntityIds(
    current: MotionEntity[],
    previous: MotionEntity[],
    nextId: () => number,
): MotionEntity[] {
    if (previous.length === 0) {
        return current.map(e => ({ ...e, id: nextId() }));
    }

    const assignments: MotionEntity[] = [];
    const usedPrevIds = new Set<number>();

    // Sort current by size (process largest first for stable matching)
    const sorted = [...current].sort((a, b) => b.size - a.size);

    for (const entity of sorted) {
        let bestMatch = -1;
        let bestDist = 0.25; // max matching distance

        for (const prev of previous) {
            if (usedPrevIds.has(prev.id)) continue;
            const dx = entity.x - prev.x;
            const dy = entity.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestMatch = prev.id;
            }
        }

        if (bestMatch >= 0) {
            usedPrevIds.add(bestMatch);
            assignments.push({ ...entity, id: bestMatch });
        } else {
            assignments.push({ ...entity, id: nextId() });
        }
    }

    return assignments;
}
