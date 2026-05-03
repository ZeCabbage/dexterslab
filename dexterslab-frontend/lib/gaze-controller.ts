/**
 * Gaze Controller — Lifelike attention management for multi-entity tracking.
 *
 * Receives an array of detected motion entities each frame and produces
 * a single gaze target with natural attention-switching behavior:
 *
 *   - Dwells on primary target for 2-4s
 *   - Brief glances at secondary entities
 *   - Smooth interpolation between all transitions
 *   - Pupil dilation based on entity proximity
 *   - Idle → sentinel mode when no entities present
 */

export interface MotionEntity {
    /** Center X in normalized coords (0 = left, 1 = right) */
    x: number;
    /** Center Y in normalized coords (0 = top, 1 = bottom) */
    y: number;
    /** Relative size of the entity (0-1, bigger = closer) */
    size: number;
    /** Amount of motion detected (0-1) */
    activity: number;
    /** Unique ID for tracking persistence */
    id: number;
}

export interface GazeTarget {
    /** Eye offset X in pixels */
    x: number;
    /** Eye offset Y in pixels */
    y: number;
    /** Pupil dilation (0.5-1.8) */
    dilation: number;
    /** Whether anything is being tracked */
    visible: boolean;
    /** Smoothing factor for the eye lerp */
    smooth: number;
    /** Number of entities currently detected */
    entityCount: number;
}

// ── Config ──
const MAX_OFFSET = 150;              // max eye displacement in pixels
const DWELL_MIN = 2.0;               // min seconds on primary target
const DWELL_MAX = 4.0;               // max seconds on primary target
const GLANCE_DURATION = 0.6;         // seconds for a quick glance
const GLANCE_CHANCE = 0.3;           // probability of glancing at secondary per dwell cycle
const TRANSITION_SMOOTH = 0.14;      // smooth factor during transitions
const TRACKING_SMOOTH = 0.22;        // smooth factor while locked on target
const RECOGNITION_DILATION = 1.4;    // dilation burst when new entity appears
const LOST_GRACE_FRAMES = 8;         // frames before declaring entity lost

export class GazeController {
    private currentX = 0;
    private currentY = 0;
    private currentDilation = 1.0;

    private targetX = 0;
    private targetY = 0;
    private targetDilation = 1.0;

    // Attention state
    private primaryId = -1;
    private dwellEndTime = 0;
    private isGlancing = false;
    private glanceEndTime = 0;
    private glanceTargetId = -1;

    // Entity persistence
    private knownEntities: Map<number, { lastSeen: number; x: number; y: number; size: number }> = new Map();
    private frameCount = 0;

    // New entity detection
    private lastEntityCount = 0;
    private recognitionEndTime = 0;

    update(entities: MotionEntity[]): GazeTarget {
        this.frameCount++;
        const now = performance.now() / 1000;

        // ── Update known entities ──
        for (const e of entities) {
            this.knownEntities.set(e.id, {
                lastSeen: this.frameCount,
                x: e.x,
                y: e.y,
                size: e.size,
            });
        }

        // Prune stale entities
        for (const [id, data] of this.knownEntities) {
            if (this.frameCount - data.lastSeen > LOST_GRACE_FRAMES) {
                this.knownEntities.delete(id);
                if (id === this.primaryId) this.primaryId = -1;
            }
        }

        const activeEntities = entities.filter(e => e.size > 0.005); // filter noise

        // ── No entities: decay to idle ──
        if (activeEntities.length === 0) {
            this.lastEntityCount = 0;
            this.primaryId = -1;

            // Smoothly decay toward center
            this.currentX += (0 - this.currentX) * 0.02;
            this.currentY += (0 - this.currentY) * 0.02;
            this.currentDilation += (1.0 - this.currentDilation) * 0.03;

            return {
                x: this.currentX,
                y: this.currentY,
                dilation: this.currentDilation,
                visible: false,
                smooth: 0.06,
                entityCount: 0,
            };
        }

        // ── New entity appeared: recognition burst ──
        if (activeEntities.length > this.lastEntityCount && this.lastEntityCount >= 0) {
            this.recognitionEndTime = now + 0.8;
        }
        this.lastEntityCount = activeEntities.length;

        // ── Select attention target ──
        let focusEntity: MotionEntity;

        if (this.isGlancing && now < this.glanceEndTime) {
            // Mid-glance: look at glance target
            const glanceTarget = activeEntities.find(e => e.id === this.glanceTargetId);
            if (glanceTarget) {
                focusEntity = glanceTarget;
            } else {
                this.isGlancing = false;
                focusEntity = this.selectPrimary(activeEntities);
            }
        } else {
            this.isGlancing = false;

            // Check if dwell time expired
            if (now >= this.dwellEndTime || !activeEntities.find(e => e.id === this.primaryId)) {
                // Pick new primary
                focusEntity = this.selectPrimary(activeEntities);
                this.primaryId = focusEntity.id;
                this.dwellEndTime = now + DWELL_MIN + Math.random() * (DWELL_MAX - DWELL_MIN);

                // Maybe glance at a secondary entity during this dwell
                if (activeEntities.length > 1 && Math.random() < GLANCE_CHANCE) {
                    const glanceDelay = 0.8 + Math.random() * 1.5;
                    setTimeout(() => {
                        if (activeEntities.length > 1) {
                            const secondaries = activeEntities.filter(e => e.id !== this.primaryId);
                            if (secondaries.length > 0) {
                                this.glanceTargetId = secondaries[Math.floor(Math.random() * secondaries.length)].id;
                                this.isGlancing = true;
                                this.glanceEndTime = performance.now() / 1000 + GLANCE_DURATION;
                            }
                        }
                    }, glanceDelay * 1000);
                }
            } else {
                // Continue looking at current primary
                const primary = activeEntities.find(e => e.id === this.primaryId);
                focusEntity = primary || this.selectPrimary(activeEntities);
            }
        }

        // ── Map entity position to eye coordinates ──
        // X is MIRRORED: entity on camera-left → eye looks right
        this.targetX = -(focusEntity.x - 0.5) * 2 * MAX_OFFSET;
        this.targetY = (focusEntity.y - 0.5) * 2 * MAX_OFFSET * 0.6;

        // Dilation based on entity size (bigger = closer = more dilated)
        let baseDilation = 0.7 + focusEntity.size * 4.0;
        baseDilation = Math.max(0.5, Math.min(1.6, baseDilation));

        // Recognition burst
        if (now < this.recognitionEndTime) {
            baseDilation = Math.max(baseDilation, RECOGNITION_DILATION);
        }
        this.targetDilation = baseDilation;

        // ── Smooth interpolation ──
        const smooth = this.isGlancing ? TRANSITION_SMOOTH : TRACKING_SMOOTH;
        this.currentX += (this.targetX - this.currentX) * smooth;
        this.currentY += (this.targetY - this.currentY) * smooth;
        this.currentDilation += (this.targetDilation - this.currentDilation) * 0.15;

        return {
            x: this.currentX,
            y: this.currentY,
            dilation: this.currentDilation,
            visible: true,
            smooth: smooth,
            entityCount: activeEntities.length,
        };
    }

    /** Select primary target: largest entity, with bias toward current primary for stability */
    private selectPrimary(entities: MotionEntity[]): MotionEntity {
        // Current primary gets a size bonus for stability (avoids rapid switching)
        let best = entities[0];
        let bestScore = -1;

        for (const e of entities) {
            let score = e.size + e.activity * 0.3;
            if (e.id === this.primaryId) score *= 1.3; // stability bonus
            if (score > bestScore) {
                bestScore = score;
                best = e;
            }
        }

        return best;
    }
}
