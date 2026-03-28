/**
 * THE OBSERVER 2 — ML Face Processor
 *
 * Replaces the grayscale background-subtraction MotionProcessor with
 * semantic ML face detection via TensorFlow BlazeFace.
 *
 * Uses pure-JS @tensorflow/tfjs (no native bindings) for Node v24 compat.
 *
 * Advantages over motion-processor.js:
 *   - Immune to camera AGC brightness shifts (no background model)
 *   - Detects actual faces, not arbitrary motion blobs
 *   - Stable centroid tracking (bounding box center, not noise clusters)
 *
 * Output format matches MotionProcessor exactly:
 *   { entities: [{x, y, size, activity, id}], totalMotion: number }
 */

import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

// ── Config ──
const MAX_ENTITIES = 8;
const CONFIDENCE_THRESHOLD = 0.45;  // lowered for long-range detection (farther faces = lower confidence)

export class MlProcessor {
    constructor() {
        this.model = null;
        this.ready = false;
        this.frameCount = 0;
        this.nextEntityId = 0;
        this.prevEntities = [];

        // FPS tracking
        this._fpsFrames = 0;
        this._fpsLastLog = Date.now();

        // Throttle: only run ML inference every N frames (save CPU)
        this._inferenceInterval = 2;  // run every 2nd frame for responsive tracking
        this._lastResult = { entities: [], totalMotion: 0 };

        // ── Temporal smoothing ──
        // Hold last valid detection to prevent flicker when BlazeFace drops frames
        this._lastValidEntities = [];    // last frame where we saw a face
        this._lastDetectionTime = 0;     // timestamp of last valid detection
        this._holdDuration = 500;        // ms to hold a lost face before declaring gone
        this._smoothX = 0;               // exponentially smoothed face X
        this._smoothY = 0;               // exponentially smoothed face Y
        this._smoothSize = 0;            // exponentially smoothed face size
        this._hasPrior = false;          // whether we have a prior position to smooth from
        this._positionSmooth = 0.4;      // position smoothing factor (0=no smooth, 1=frozen)

        // ── Motion detection fallback (long range) ──
        // When BlazeFace can't find a face, fall back to frame-differencing
        // to detect movement at any distance
        this._prevGray = null;           // previous frame grayscale buffer
        this._motionThreshold = 25;      // pixel brightness change threshold
        this._motionMinPixels = 80;      // minimum changed pixels to count as motion
        this._motionGridSize = 16;       // grid cell size for motion centroid
        this._detectionMode = 'none';    // 'face', 'motion', or 'none'
    }

    /**
     * Load the BlazeFace model. Must be called before processFrame.
     */
    async init() {
        console.log('[MlProcessor] Loading BlazeFace model (pure JS backend)...');
        const startTime = Date.now();
        this.model = await blazeface.load();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('[MlProcessor] BlazeFace model loaded in ' + elapsed + 's');
        this.ready = true;
    }

    /**
     * Process a pre-decoded frame (RGBA pixel data) and detect faces.
     * This signature matches how EyeStateMachine calls it — it decodes
     * the JPEG first, then passes pixel data.
     *
     * @param {Uint8Array|Buffer} pixelData - RGBA pixel data
     * @param {number} width - Frame width (e.g. 320)
     * @param {number} height - Frame height (e.g. 240)
     * @param {number} channels - 3 (RGB) or 4 (RGBA)
     * @returns {{entities: Array, totalMotion: number}}
     */
    processFrame(pixelData, width, height, channels = 4) {
        this.frameCount++;
        this._fpsFrames++;
        const now = Date.now();

        // FPS logging every 3 seconds
        if (now - this._fpsLastLog >= 3000) {
            const fps = (this._fpsFrames / ((now - this._fpsLastLog) / 1000)).toFixed(1);
            const mode = this._detectionMode.toUpperCase();
            console.log('[MlProcessor] ' + fps + ' fps | frame#' + this.frameCount + ' | faces: ' + this._lastResult.entities.length + ' | mode: ' + mode);
            this._fpsFrames = 0;
            this._fpsLastLog = now;
        }

        // Throttle: skip frames to save CPU
        if (this.frameCount % this._inferenceInterval !== 0) {
            return this._lastResult;
        }

        // Fire and forget the async inference — we'll use the result on next tick
        this._inferenceErrors = this._inferenceErrors || 0;
        this._runInference(pixelData, width, height, channels).catch(err => {
            this._inferenceErrors++;
            if (this._inferenceErrors <= 10 || this.frameCount % 100 === 0) {
                console.error('[MlProcessor] Inference error #' + this._inferenceErrors + ' (frame ' + this.frameCount + '):', err.message);
                if (this._inferenceErrors === 1) console.error(err.stack);
            }
        });

        return this._lastResult;
    }

    /**
     * Run BlazeFace inference asynchronously.
     */
    async _runInference(pixelData, width, height, channels) {
        if (!this.ready || !this.model) return;

        let tensor = null;
        try {
            // Convert RGBA to RGB tensor [height, width, 3]
            if (channels === 4) {
                // Extract RGB from RGBA as float32
                const totalPixels = width * height;
                const rgb = new Float32Array(totalPixels * 3);
                for (let i = 0; i < totalPixels; i++) {
                    rgb[i * 3] = pixelData[i * 4];
                    rgb[i * 3 + 1] = pixelData[i * 4 + 1];
                    rgb[i * 3 + 2] = pixelData[i * 4 + 2];
                }
                tensor = tf.tensor3d(rgb, [height, width, 3]);
            } else {
                const floatData = new Float32Array(pixelData);
                tensor = tf.tensor3d(floatData, [height, width, 3]);
            }

            // Run face detection
            const predictions = await this.model.estimateFaces(tensor, false);

            // Debug: log first 20 inference results
            if (this.frameCount <= 60 || this.frameCount % 450 === 0) {
                console.log('[MlProcessor] inference frame#' + this.frameCount + ' | tensor shape: ' + tensor.shape + ' | dtype: ' + tensor.dtype + ' | predictions: ' + predictions.length);
                if (predictions.length > 0) {
                    const f = predictions[0];
                    console.log('[MlProcessor] face[0]: topLeft=' + JSON.stringify(f.topLeft) + ' bottomRight=' + JSON.stringify(f.bottomRight) + ' prob=' + f.probability);
                }
            }

            // Convert predictions to entities format
            let entities = [];

            for (const face of predictions) {
                // face.probability can be a Tensor, array, or number
                let confidence;
                if (face.probability instanceof tf.Tensor) {
                    confidence = (await face.probability.data())[0];
                } else if (Array.isArray(face.probability)) {
                    confidence = face.probability[0];
                } else {
                    confidence = face.probability || 0.5;
                }

                if (confidence < CONFIDENCE_THRESHOLD) continue;

                // topLeft and bottomRight: [x, y] in pixel coords
                const tl = Array.isArray(face.topLeft)
                    ? face.topLeft
                    : await face.topLeft.data();
                const br = Array.isArray(face.bottomRight)
                    ? face.bottomRight
                    : await face.bottomRight.data();

                // Center of the face in normalized coords (0-1)
                const centerX = ((tl[0] + br[0]) / 2) / width;
                const centerY = ((tl[1] + br[1]) / 2) / height;

                // Size: bounding box area relative to total frame area
                const bboxWidth = Math.abs(br[0] - tl[0]);
                const bboxHeight = Math.abs(br[1] - tl[1]);
                const size = (bboxWidth * bboxHeight) / (width * height);

                entities.push({
                    x: Math.max(0, Math.min(1, centerX)),
                    y: Math.max(0, Math.min(1, centerY)),
                    size: Math.max(0.001, Math.min(1, size)),
                    activity: 1.0,
                    id: 0,
                });
            }

            // Cap entity count
            if (entities.length > MAX_ENTITIES) {
                entities.sort((a, b) => b.size - a.size);
                entities = entities.slice(0, MAX_ENTITIES);
            }

            // Assign persistent IDs
            entities = this._assignIds(entities);
            this.prevEntities = entities;

            // ── Apply temporal smoothing ──
            if (entities.length > 0) {
                this._detectionMode = 'face';
                const e = entities[0];  // primary face

                if (this._hasPrior) {
                    // Smooth position toward new detection (low-pass filter)
                    this._smoothX += (e.x - this._smoothX) * (1 - this._positionSmooth);
                    this._smoothY += (e.y - this._smoothY) * (1 - this._positionSmooth);
                    this._smoothSize += (e.size - this._smoothSize) * (1 - this._positionSmooth);
                } else {
                    // First detection — jump to position
                    this._smoothX = e.x;
                    this._smoothY = e.y;
                    this._smoothSize = e.size;
                    this._hasPrior = true;
                }

                // Replace raw position with smoothed position
                entities[0] = {
                    ...e,
                    x: this._smoothX,
                    y: this._smoothY,
                    size: this._smoothSize,
                };

                this._lastValidEntities = entities;
                this._lastDetectionTime = Date.now();
            } else {
                // No face found — try motion detection fallback
                const motionEntities = this._detectMotion(pixelData, width, height, channels);

                if (motionEntities.length > 0) {
                    this._detectionMode = 'motion';
                    entities = this._assignIds(motionEntities);
                    this.prevEntities = entities;

                    // Smooth motion entities too
                    const e = entities[0];
                    if (this._hasPrior) {
                        this._smoothX += (e.x - this._smoothX) * 0.3;
                        this._smoothY += (e.y - this._smoothY) * 0.3;
                        this._smoothSize += (e.size - this._smoothSize) * 0.3;
                    } else {
                        this._smoothX = e.x;
                        this._smoothY = e.y;
                        this._smoothSize = e.size;
                        this._hasPrior = true;
                    }
                    entities[0] = { ...e, x: this._smoothX, y: this._smoothY, size: this._smoothSize };

                    this._lastValidEntities = entities;
                    this._lastDetectionTime = Date.now();
                } else {
                    // No face AND no motion — check hold timer
                    const elapsed = Date.now() - this._lastDetectionTime;
                    if (elapsed < this._holdDuration && this._lastValidEntities.length > 0) {
                        entities = this._lastValidEntities;
                    } else {
                        this._detectionMode = 'none';
                        this._hasPrior = false;
                    }
                }
            }

            // Store grayscale for next frame's motion detection
            this._storeGrayscale(pixelData, width, height, channels);

            const totalMotion = Math.min(1.0, entities.length * 0.3);
            this._lastResult = { entities, totalMotion };

            // Log detections
            if (entities.length > 0 && (this.frameCount <= 50 || this.frameCount % 150 === 0)) {
                const e = entities[0];
                const mode = this._detectionMode.toUpperCase();
                console.log('[MlProcessor] ' + mode + ' DETECTED! x=' + e.x.toFixed(3) + ' y=' + e.y.toFixed(3) + ' size=' + e.size.toFixed(4) + ' activity=' + e.activity.toFixed(1));
            }

        } finally {
            if (tensor) tensor.dispose();
        }
    }

    /**
     * Lightweight frame-differencing motion detection.
     * Compares current frame against previous to find movement centroids.
     * Returns entities with activity=0.5 (vs 1.0 for face detections).
     */
    _detectMotion(pixelData, width, height, channels) {
        if (!this._prevGray) return [];

        const totalPixels = width * height;
        const grid = this._motionGridSize;
        const gridW = Math.floor(width / grid);
        const gridH = Math.floor(height / grid);

        // Convert current frame to grayscale and compare
        let motionSumX = 0, motionSumY = 0, motionCount = 0;

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                // Sample center pixel of each grid cell
                const px = gx * grid + Math.floor(grid / 2);
                const py = gy * grid + Math.floor(grid / 2);
                const idx = py * width + px;

                // Current pixel grayscale
                let gray;
                if (channels === 4) {
                    gray = pixelData[idx * 4] * 0.299 + pixelData[idx * 4 + 1] * 0.587 + pixelData[idx * 4 + 2] * 0.114;
                } else {
                    gray = pixelData[idx * 3] * 0.299 + pixelData[idx * 3 + 1] * 0.587 + pixelData[idx * 3 + 2] * 0.114;
                }

                const diff = Math.abs(gray - this._prevGray[idx]);
                if (diff > this._motionThreshold) {
                    motionSumX += px;
                    motionSumY += py;
                    motionCount++;
                }
            }
        }

        if (motionCount < 3) return [];  // not enough cells changed

        // Centroid of motion
        const cx = (motionSumX / motionCount) / width;
        const cy = (motionSumY / motionCount) / height;
        // Size based on how many cells moved (larger motion = bigger entity)
        const motionSize = Math.min(0.3, (motionCount / (gridW * gridH)) * 2.0);

        return [{
            x: Math.max(0, Math.min(1, cx)),
            y: Math.max(0, Math.min(1, cy)),
            size: Math.max(0.005, motionSize),
            activity: 0.5,   // lower than face (1.0) so behavior model can differentiate
            id: 0,
        }];
    }

    /**
     * Store grayscale version of current frame for next frame's motion comparison.
     */
    _storeGrayscale(pixelData, width, height, channels) {
        const totalPixels = width * height;
        if (!this._prevGray || this._prevGray.length !== totalPixels) {
            this._prevGray = new Float32Array(totalPixels);
        }
        for (let i = 0; i < totalPixels; i++) {
            if (channels === 4) {
                this._prevGray[i] = pixelData[i * 4] * 0.299 + pixelData[i * 4 + 1] * 0.587 + pixelData[i * 4 + 2] * 0.114;
            } else {
                this._prevGray[i] = pixelData[i * 3] * 0.299 + pixelData[i * 3 + 1] * 0.587 + pixelData[i * 3 + 2] * 0.114;
            }
        }
    }

    /**
     * Assign stable IDs by matching current entities to previous frame entities.
     */
    _assignIds(current) {
        if (this.prevEntities.length === 0) {
            return current.map(e => ({ ...e, id: this.nextEntityId++ }));
        }

        const assignments = [];
        const usedPrevIds = new Set();
        const sorted = [...current].sort((a, b) => b.size - a.size);

        for (const entity of sorted) {
            let bestMatch = -1;
            let bestDist = 0.3;

            for (const prev of this.prevEntities) {
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
                assignments.push({ ...entity, id: this.nextEntityId++ });
            }
        }

        return assignments;
    }
}
