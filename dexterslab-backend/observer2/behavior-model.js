/**
 * THE OBSERVER 2 — Behavior Model
 *
 * The "brain" of the eye. Receives motion entities and produces
 * lifelike gaze targets with emotional state.
 *
 * Behaviors:
 *   Gaze control   — Dwell on primary target (2-4s), glance at secondaries
 *   Curiosity      — Dilate + lean toward new entities
 *   Boredom        — Slow drift when nothing changes
 *   Startle        — Snap focus + dilate on sudden motion
 *   Recognition    — Pupil pulse when a known entity returns
 *   Microsaccades  — Tiny random jitter (2-5× per second)
 *   Pupil rhythms  — Slow breathing oscillation
 *   Fatigue        — Gradually shorter dwell times over sustained attention
 */

// ── Config ──
const MAX_OFFSET = 160;             // max eye displacement in px — wider range for visible tracking
const DWELL_MIN = 2.0;              // min seconds on primary target
const DWELL_MAX = 4.5;              // max seconds on primary target
const GLANCE_DURATION = 0.5;        // quick glance duration
const GLANCE_CHANCE = 0.35;         // probability of glancing at secondary
const TRACKING_SMOOTH = 0.18;       // smooth factor while locked — responsive pan speed
const TRANSITION_SMOOTH = 0.12;     // smooth factor during transitions — snappier target switches
const RECOGNITION_DILATION = 1.5;   // dilation burst for new entity
const STARTLE_DILATION = 1.8;       // dilation burst for sudden motion
const STARTLE_MOTION_THRESHOLD = 0.12; // total motion jump to trigger startle (more sensitive)

// Microsaccade config
const SACCADE_INTERVAL_MIN = 200;   // ms between microsaccades
const SACCADE_INTERVAL_MAX = 500;
const SACCADE_AMPLITUDE = 4.0;      // pixels — visible micro-movements for lifelike feel

// Pupil breathing rhythm
const PUPIL_BREATH_SPEED = 0.12;    // Hz — slower, more organic
const PUPIL_BREATH_AMPLITUDE = 0.04;

export class BehaviorModel {
    constructor() {
        // ── Gaze state ──
        this.currentX = 0;
        this.currentY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.currentDilation = 1.0;
        this.targetDilation = 1.0;

        // ── Attention ──
        this.primaryId = -1;
        this.dwellEndTime = 0;
        this.isGlancing = false;
        this.glanceEndTime = 0;
        this.glanceTargetId = -1;
        this._glanceScheduled = false;

        // ── Emotional state ──
        this.emotion = 'neutral';  // neutral, curious, startled, bored, tracking
        this.emotionEndTime = 0;

        // ── Entity tracking ──
        this.lastEntityCount = 0;
        this.recognitionEndTime = 0;
        this.startleEndTime = 0;
        this.lastTotalMotion = 0;
        this.entitySeenHistory = new Set();  // IDs we've seen before

        // ── Microsaccades ──
        this.saccadeX = 0;
        this.saccadeY = 0;
        this.nextSaccadeTime = 0;
        this.saccadeDecay = 0;

        // ── Fatigue ──
        this.attentionStartTime = 0;
        this.fatigueLevel = 0;  // 0-1, increases over sustained attention

        // ── Time tracking ──
        this.lastUpdateTime = Date.now() / 1000;
    }

    /**
     * Update gaze based on detected entities.
     * @param {Array<{x:number,y:number,size:number,activity:number,id:number}>} entities
     * @param {number} totalMotion - 0-1 overall scene motion
     * @returns {{x:number, y:number, dilation:number, emotion:string, visible:boolean, entityCount:number, saccadeX:number, saccadeY:number}}
     */
    update(entities, totalMotion = 0) {
        const now = Date.now() / 1000;
        const dt = Math.min(now - this.lastUpdateTime, 0.1);
        this.lastUpdateTime = now;

        // ── Microsaccades ──
        this._updateSaccades(now);

        // ── Pupil breathing rhythm ──
        const breathOffset = Math.sin(now * Math.PI * 2 * PUPIL_BREATH_SPEED) * PUPIL_BREATH_AMPLITUDE;

        // Filter noise — lowered from 0.004 for Centerm USB cam small blob profiles
        const activeEntities = entities.filter(e => e.size > 0.0008);

        // ══════════════════════════════════════════
        // NO ENTITIES: decay to idle
        // ══════════════════════════════════════════
        if (activeEntities.length === 0) {
            this.lastEntityCount = 0;
            this.primaryId = -1;
            this._glanceScheduled = false;
            this.fatigueLevel = Math.max(0, this.fatigueLevel - dt * 0.1);

            // Decay toward center
            this.currentX += (0 - this.currentX) * 0.015;
            this.currentY += (0 - this.currentY) * 0.015;
            this.currentDilation += (1.0 + breathOffset - this.currentDilation) * 0.025;

            if (now > this.emotionEndTime) this.emotion = 'neutral';

            return this._buildOutput(false, 0);
        }

        // ══════════════════════════════════════════
        // STARTLE: sudden motion spike
        // ══════════════════════════════════════════
        if (totalMotion - this.lastTotalMotion > STARTLE_MOTION_THRESHOLD && now > this.startleEndTime) {
            this.emotion = 'startled';
            this.emotionEndTime = now + 1.5;
            this.startleEndTime = now + 2.0;
            this.targetDilation = STARTLE_DILATION;
        }
        this.lastTotalMotion = totalMotion;

        // ══════════════════════════════════════════
        // NEW ENTITY: Recognition / Curiosity
        // ══════════════════════════════════════════
        if (activeEntities.length > this.lastEntityCount) {
            this.recognitionEndTime = now + 0.8;

            // Check if this is a truly new entity vs returning one
            const newIds = activeEntities.filter(e => !this.entitySeenHistory.has(e.id));
            if (newIds.length > 0) {
                this.emotion = 'curious';
                this.emotionEndTime = now + 2.0;
            }
        }
        this.lastEntityCount = activeEntities.length;

        // Record all seen entity IDs
        for (const e of activeEntities) {
            this.entitySeenHistory.add(e.id);
        }
        // Cap history to prevent memory issues
        if (this.entitySeenHistory.size > 200) {
            const arr = [...this.entitySeenHistory];
            this.entitySeenHistory = new Set(arr.slice(-100));
        }

        // ══════════════════════════════════════════
        // ATTENTION: Select focus target
        // ══════════════════════════════════════════
        let focusEntity;

        if (this.isGlancing && now < this.glanceEndTime) {
            // Mid-glance: look at secondary target
            const glanceTarget = activeEntities.find(e => e.id === this.glanceTargetId);
            if (glanceTarget) {
                focusEntity = glanceTarget;
            } else {
                this.isGlancing = false;
                focusEntity = this._selectPrimary(activeEntities);
            }
        } else {
            this.isGlancing = false;

            // Fatigue: reduce dwell time under sustained attention
            const fatigueAdjust = this.fatigueLevel * 1.0;
            const adjustedDwellMax = Math.max(DWELL_MIN, DWELL_MAX - fatigueAdjust);

            if (now >= this.dwellEndTime || !activeEntities.find(e => e.id === this.primaryId)) {
                // Pick new primary
                focusEntity = this._selectPrimary(activeEntities);
                this.primaryId = focusEntity.id;
                this.dwellEndTime = now + DWELL_MIN + Math.random() * (adjustedDwellMax - DWELL_MIN);
                this.attentionStartTime = now;
                this._glanceScheduled = false;

                // Schedule a glance at a secondary
                if (activeEntities.length > 1 && Math.random() < GLANCE_CHANCE && !this._glanceScheduled) {
                    this._glanceScheduled = true;
                    const glanceDelay = 0.8 + Math.random() * 1.5;
                    setTimeout(() => {
                        if (this.lastEntityCount > 1) {
                            const secondaries = activeEntities.filter(e => e.id !== this.primaryId);
                            if (secondaries.length > 0) {
                                this.glanceTargetId = secondaries[Math.floor(Math.random() * secondaries.length)].id;
                                this.isGlancing = true;
                                this.glanceEndTime = Date.now() / 1000 + GLANCE_DURATION;
                            }
                        }
                    }, glanceDelay * 1000);
                }

                if (this.emotion === 'neutral') {
                    this.emotion = 'tracking';
                    this.emotionEndTime = now + 3.0;
                }
            } else {
                // Continue looking at current primary
                const primary = activeEntities.find(e => e.id === this.primaryId);
                focusEntity = primary || this._selectPrimary(activeEntities);
            }
        }

        // ── Update fatigue ──
        if (activeEntities.length > 0) {
            this.fatigueLevel = Math.min(1.0, this.fatigueLevel + dt * 0.02);
        }

        // ══════════════════════════════════════════
        // MAP: Entity position → eye offset
        // ══════════════════════════════════════════
        // X is MIRRORED: entity on camera-left → eye looks right
        this.targetX = -(focusEntity.x - 0.5) * 2 * MAX_OFFSET;
        this.targetY = (focusEntity.y - 0.5) * 2 * MAX_OFFSET * 0.5;  // Y range slightly less than X

        // ── Dilation — distance-based pupil response ──
        // Face size roughly maps to distance:
        //   size < 0.02  = very far (15+ ft)  → neutral pupil, just tracking
        //   size 0.02-0.05 = far (5-15 ft)    → neutral pupil, just tracking
        //   size 0.05-0.12 = close (~3-5 ft)  → pupil dilates (interest/arousal)
        //   size > 0.12 = very close (<3 ft)   → pupil constricts (focused attention)
        let baseDilation;
        const CLOSE_THRESHOLD = 0.05;   // ~5 feet — dilation starts here
        const VERY_CLOSE = 0.12;        // ~3 feet — constriction starts

        if (focusEntity.size < CLOSE_THRESHOLD) {
            // Far away — neutral pupil, just tracking
            baseDilation = 1.0;
        } else if (focusEntity.size < VERY_CLOSE) {
            // Within 5 feet — dilate with interest (bigger = closer = more dilation)
            const proximity = (focusEntity.size - CLOSE_THRESHOLD) / (VERY_CLOSE - CLOSE_THRESHOLD);
            baseDilation = 1.0 + proximity * 0.45;  // 1.0 → 1.45
        } else {
            // Very close — constrict for focused attention
            baseDilation = 1.45 - Math.min(0.5, (focusEntity.size - VERY_CLOSE) * 3.0);
        }
        baseDilation = Math.max(0.7, Math.min(1.5, baseDilation));

        // Recognition burst — pupil dilates when spotting someone new
        if (now < this.recognitionEndTime) {
            baseDilation = Math.max(baseDilation, RECOGNITION_DILATION);
        }
        // Startle burst
        if (now < this.startleEndTime) {
            baseDilation = Math.max(baseDilation, STARTLE_DILATION);
        }

        this.targetDilation = baseDilation + breathOffset;

        // ── Distance-adaptive smooth interpolation ──
        // Big movements snap fast (alert), small movements glide (natural)
        const dx = this.targetX - this.currentX;
        const dy = this.targetY - this.currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const baseSmooth = this.isGlancing ? TRANSITION_SMOOTH : TRACKING_SMOOTH;
        // Scale: large displacements (>40px) get up to 2.5x the smooth factor
        const distBoost = Math.min(2.5, 1.0 + (dist / 50) * 1.5);
        const smooth = Math.min(0.45, baseSmooth * distBoost);
        this.currentX += dx * smooth;
        this.currentY += dy * smooth;
        this.currentDilation += (this.targetDilation - this.currentDilation) * 0.18;  // responsive dilation

        // Expire emotion
        if (now > this.emotionEndTime && this.emotion !== 'neutral') {
            this.emotion = activeEntities.length > 0 ? 'tracking' : 'neutral';
            this.emotionEndTime = now + 5.0;
        }

        return this._buildOutput(true, activeEntities.length);
    }

    /**
     * Select primary target: largest entity with stability bias.
     */
    _selectPrimary(entities) {
        let best = entities[0];
        let bestScore = -1;

        for (const e of entities) {
            let score = e.size + e.activity * 0.3;
            if (e.id === this.primaryId) score *= 1.3;  // stability bonus
            if (score > bestScore) {
                bestScore = score;
                best = e;
            }
        }

        return best;
    }

    /**
     * Update microsaccade jitter.
     */
    _updateSaccades(now) {
        if (now > this.nextSaccadeTime) {
            // Fire a new microsaccade
            const angle = Math.random() * Math.PI * 2;
            const amp = SACCADE_AMPLITUDE * (0.5 + Math.random() * 0.5);
            this.saccadeX = Math.cos(angle) * amp;
            this.saccadeY = Math.sin(angle) * amp;
            this.saccadeDecay = 1.0;

            const interval = SACCADE_INTERVAL_MIN + Math.random() * (SACCADE_INTERVAL_MAX - SACCADE_INTERVAL_MIN);
            this.nextSaccadeTime = now + interval / 1000;
        }

        // Exponential decay
        this.saccadeDecay *= 0.85;
        if (this.saccadeDecay < 0.01) {
            this.saccadeX = 0;
            this.saccadeY = 0;
        }
    }

    _buildOutput(visible, entityCount) {
        return {
            x: this.currentX,
            y: this.currentY,
            dilation: this.currentDilation,
            emotion: this.emotion,
            visible,
            entityCount,
            saccadeX: this.saccadeX * this.saccadeDecay,
            saccadeY: this.saccadeY * this.saccadeDecay,
        };
    }
}
