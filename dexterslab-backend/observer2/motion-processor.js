/**
 * THE OBSERVER 2 — Motion Processor
 *
 * Server-side motion/entity detection from raw JPEG frames
 * streamed over WebSocket from the thin client browser.
 *
 * Pipeline:
 *   1. Decode JPEG → raw pixel buffer
 *   2. Convert to grayscale
 *   3. Adaptive background subtraction
 *   4. Grid-based motion detection
 *   5. Connected-component blob detection
 *   6. Entity merging (nearby blobs → single entity)
 *   7. Persistent entity ID tracking across frames
 *
 * Outputs: MotionEntity[] with normalized positions, sizes, activity
 */

// ── Detection Config ──
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;
const MOTION_THRESHOLD = 28;        // pixel diff threshold (0-255)
const MIN_BLOB_PIXELS = 20;         // minimum pixels to qualify as entity
const MERGE_DISTANCE = 0.15;        // normalized distance to merge blobs
const BG_LEARN_RATE = 0.025;        // background adaptation speed
const GRID_CELL = 4;                // process in 4×4 cell blocks
const GRID_W = Math.ceil(CAPTURE_WIDTH / GRID_CELL);
const GRID_H = Math.ceil(CAPTURE_HEIGHT / GRID_CELL);
const ENTITY_LOST_FRAMES = 12;      // frames before declaring entity gone
const MAX_ENTITIES = 8;             // cap for performance

export class MotionProcessor {
    constructor() {
        /** @type {Float32Array|null} */
        this.bgFrame = null;

        /** @type {number} */
        this.frameCount = 0;

        /** @type {number} */
        this.nextEntityId = 0;

        /** @type {Map<number, {lastSeen: number, x: number, y: number, size: number}>} */
        this.knownEntities = new Map();

        /** @type {Array<{x: number, y: number, size: number, activity: number, id: number}>} */
        this.prevEntities = [];

        /** @type {Uint8Array|null} */
        this.prevGray = null;

        // Preallocate buffers
        this._motionGrid = new Uint8Array(GRID_W * GRID_H);
        this._visited = new Uint8Array(GRID_W * GRID_H);
        this._floodStack = new Int32Array(GRID_W * GRID_H);
    }

    /**
     * Process a raw pixel buffer (RGBA or RGB) and detect motion entities.
     * @param {Buffer|Uint8Array} pixelData - Raw pixel data
     * @param {number} width - Frame width
     * @param {number} height - Frame height
     * @param {number} channels - 3 (RGB) or 4 (RGBA)
     * @returns {{entities: Array<{x:number,y:number,size:number,activity:number,id:number}>, totalMotion: number}}
     */
    processFrame(pixelData, width, height, channels = 4) {
        this.frameCount++;
        const totalPixels = width * height;

        // ── 1. Convert to grayscale ──
        const gray = new Uint8Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
            const p = i * channels;
            // ITU-R BT.601 luma coefficients
            gray[i] = (pixelData[p] * 77 + pixelData[p + 1] * 150 + pixelData[p + 2] * 29) >> 8;
        }

        // ── 2. Initialize background model on first frame ──
        if (!this.bgFrame) {
            this.bgFrame = new Float32Array(totalPixels);
            for (let i = 0; i < totalPixels; i++) this.bgFrame[i] = gray[i];
            this.prevGray = new Uint8Array(gray);
            return { entities: [], totalMotion: 0 };
        }

        // ── 3. Grid-based motion detection with adaptive background ──
        const motionGrid = this._motionGrid;
        motionGrid.fill(0);
        let totalMotionCells = 0;

        const gridW = Math.ceil(width / GRID_CELL);
        const gridH = Math.ceil(height / GRID_CELL);

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                let motionCount = 0;
                let cellPixels = 0;

                for (let dy = 0; dy < GRID_CELL; dy++) {
                    for (let dx = 0; dx < GRID_CELL; dx++) {
                        const px = gx * GRID_CELL + dx;
                        const py = gy * GRID_CELL + dy;
                        if (px >= width || py >= height) continue;

                        const idx = py * width + px;
                        const diff = Math.abs(gray[idx] - this.bgFrame[idx]);
                        if (diff > MOTION_THRESHOLD) motionCount++;
                        cellPixels++;

                        // Adaptive background update
                        this.bgFrame[idx] += (gray[idx] - this.bgFrame[idx]) * BG_LEARN_RATE;
                    }
                }

                // Cell has motion if >30% of pixels changed
                if (cellPixels > 0 && motionCount / cellPixels > 0.3) {
                    motionGrid[gy * gridW + gx] = 1;
                    totalMotionCells++;
                }
            }
        }

        this.prevGray = new Uint8Array(gray);

        // ── 4. Connected-component blob detection (flood fill) ──
        const visited = this._visited;
        visited.fill(0);
        const stack = this._floodStack;
        const rawBlobs = [];

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                const idx = gy * gridW + gx;
                if (!motionGrid[idx] || visited[idx]) continue;

                // Flood fill this blob
                const blob = { sumX: 0, sumY: 0, count: 0, minX: gx, maxX: gx, minY: gy, maxY: gy };
                let stackLen = 0;
                stack[stackLen++] = idx;
                visited[idx] = 1;

                while (stackLen > 0) {
                    const ci = stack[--stackLen];
                    const cx = ci % gridW;
                    const cy = Math.floor(ci / gridW);

                    blob.sumX += cx;
                    blob.sumY += cy;
                    blob.count++;
                    if (cx < blob.minX) blob.minX = cx;
                    if (cx > blob.maxX) blob.maxX = cx;
                    if (cy < blob.minY) blob.minY = cy;
                    if (cy > blob.maxY) blob.maxY = cy;

                    // 4-connected neighbors
                    const neighbors = [
                        cx > 0 ? ci - 1 : -1,
                        cx < gridW - 1 ? ci + 1 : -1,
                        cy > 0 ? ci - gridW : -1,
                        cy < gridH - 1 ? ci + gridW : -1,
                    ];

                    for (const ni of neighbors) {
                        if (ni >= 0 && motionGrid[ni] && !visited[ni]) {
                            visited[ni] = 1;
                            stack[stackLen++] = ni;
                        }
                    }
                }

                const blobPixels = blob.count * GRID_CELL * GRID_CELL;
                if (blobPixels >= MIN_BLOB_PIXELS) {
                    rawBlobs.push(blob);
                }
            }
        }

        // ── 5. Convert blobs to entities (normalized coords) ──
        let entities = rawBlobs.map(b => ({
            x: (b.sumX / b.count) / gridW,
            y: (b.sumY / b.count) / gridH,
            size: (b.count * GRID_CELL * GRID_CELL) / totalPixels,
            activity: Math.min(1.0, b.count / (gridW * gridH * 0.15)),
            id: 0,
        }));

        // ── 6. Merge nearby entities ──
        entities = this._mergeNearby(entities);

        // ── 7. Cap entity count ──
        if (entities.length > MAX_ENTITIES) {
            entities.sort((a, b) => b.size - a.size);
            entities = entities.slice(0, MAX_ENTITIES);
        }

        // ── 8. Assign persistent IDs ──
        entities = this._assignIds(entities);
        this.prevEntities = entities;

        const totalMotion = totalMotionCells / (gridW * gridH);

        return { entities, totalMotion };
    }

    /**
     * Merge entities that are within MERGE_DISTANCE of each other.
     */
    _mergeNearby(entities) {
        if (entities.length <= 1) return entities;

        const merged = [];
        const used = new Set();

        for (let i = 0; i < entities.length; i++) {
            if (used.has(i)) continue;

            const group = [entities[i]];
            used.add(i);

            for (let j = i + 1; j < entities.length; j++) {
                if (used.has(j)) continue;
                const dx = entities[i].x - entities[j].x;
                const dy = entities[i].y - entities[j].y;
                if (Math.sqrt(dx * dx + dy * dy) < MERGE_DISTANCE) {
                    group.push(entities[j]);
                    used.add(j);
                }
            }

            let totalSize = 0, wx = 0, wy = 0, maxActivity = 0;
            for (const e of group) {
                totalSize += e.size;
                wx += e.x * e.size;
                wy += e.y * e.size;
                maxActivity = Math.max(maxActivity, e.activity);
            }

            merged.push({
                x: wx / totalSize,
                y: wy / totalSize,
                size: totalSize,
                activity: maxActivity,
                id: 0,
            });
        }

        return merged;
    }

    /**
     * Assign stable IDs by matching current entities to previous frame's entities.
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
            let bestDist = 0.25;

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

    /**
     * Reset the background model (e.g. on scene change).
     */
    resetBackground() {
        this.bgFrame = null;
        this.prevGray = null;
        this.prevEntities = [];
        this.knownEntities.clear();
    }
}
