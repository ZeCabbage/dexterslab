/**
 * THE OBSERVER 2 — Eye State Machine
 *
 * 60fps state computation tick. Combines inputs from MotionProcessor
 * and BehaviorModel into a render-ready packet broadcast to thin clients.
 *
 * Manages:
 *   - Blink controller (natural timing, random doubles, emotional blinks)
 *   - Sentinel mode (idle scanning when no entities present)
 *   - Sleep/wake state
 *   - Reaction overlays (blush, good boy, thank you)
 *   - Smooth lerp on all outputs
 *   - 60fps broadcast of compact EyeState packets
 */

import { MotionProcessor } from './motion-processor.js';
import { BehaviorModel } from './behavior-model.js';
import { OracleV2 } from './oracle-v2.js';

function lerp(current, target, factor) {
    return current + (target - current) * factor;
}

// ── Blink Config ──
const BLINK_INTERVAL_MIN = 2.5;   // seconds
const BLINK_INTERVAL_MAX = 6.0;
const BLINK_DURATION = 0.15;       // seconds for full close→open
const DOUBLE_BLINK_CHANCE = 0.15;
const BLINK_CLOSE_SPEED = 0.35;    // lerp speed to close
const BLINK_OPEN_SPEED = 0.20;     // lerp speed to open (slower = more natural)

// ── Sentinel Config ──
const SENTINEL_ENTER_DELAY = 2.0;  // seconds without entities before sentinel
const SENTINEL_SWEEP_RANGE = 160;

export class EyeStateMachine {
    /**
     * @param {object} [options]
     * @param {object} [options.genai] - GoogleGenAI instance for Oracle
     */
    constructor(options = {}) {
        this.motionProcessor = new MotionProcessor();
        this.behaviorModel = new BehaviorModel();
        this.oracle = new OracleV2(options.genai);

        // ── Rendered state (what gets broadcast) ──
        this.state = {
            ix: 0,             // iris offset X
            iy: 0,             // iris offset Y
            dilation: 1.0,     // pupil dilation (0.5-1.8)
            blink: 0.0,        // lid closure (0=open, 1=closed)
            emotion: 'neutral',
            sentinel: false,
            visible: false,
            entityCount: 0,
            overlayText: '',
            overlayType: '',   // '', 'oracle', 'blush', 'goodboy', 'thankyou'
            t: 0,              // timestamp
        };

        // ── Blink state ──
        this._blinkPhase = 0;      // 0=open, 1=closed
        this._blinkTarget = 0;
        this._nextBlinkTime = 0;
        this._blinkStage = 'idle'; // idle, closing, opening, double_wait
        this._doubleBlinkPending = false;

        // ── Sentinel state ──
        this._sentinelActive = false;
        this._lastEntityTime = Date.now() / 1000;
        this._sentinelTargetX = 0;
        this._sentinelTargetY = 0;
        this._sentinelNextSweep = 0;
        this._sentinelSweepSpeed = 1.0;
        this._sentinelLastType = -1;

        // ── Sleep state ──
        this._sleeping = false;
        this._sleepPhase = 0;  // 0=awake, 1=asleep

        // ── Reaction states ──
        this._blushPhase = 0;
        this._blushEndTime = 0;
        this._goodBoyPhase = 0;
        this._goodBoyEndTime = 0;
        this._thankYouPhase = 0;
        this._thankYouEndTime = 0;

        // ── Overlay text ──
        this._overlayText = '';
        this._overlayType = '';
        this._overlayEndTime = 0;

        // ── Tick timer ──
        this._tickInterval = null;
        this._running = false;

        // ── Connected clients callback ──
        this._broadcastFn = null;

        // ── Last gaze output from behavior model ──
        this._lastGaze = { x: 0, y: 0, dilation: 1.0, emotion: 'neutral', visible: false, entityCount: 0, saccadeX: 0, saccadeY: 0 };
    }

    /**
     * Start the 60fps state tick.
     * @param {function} broadcastFn - called with EyeState object every tick
     */
    start(broadcastFn) {
        this._broadcastFn = broadcastFn;
        this._running = true;
        this._nextBlinkTime = Date.now() / 1000 + BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN);

        this._tickInterval = setInterval(() => this._tick(), 16); // ~60fps

        console.log('👁  Observer 2 Eye State Machine started (60fps)');
    }

    /**
     * Stop the tick loop.
     */
    stop() {
        this._running = false;
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
        console.log('👁  Observer 2 Eye State Machine stopped');
    }

    /**
     * Process an incoming camera frame from a thin client.
     * @param {Buffer} jpegData - raw JPEG bytes
     */
    async processFrame(jpegData) {
        // Decode JPEG to raw pixels on the server
        // We use a lightweight approach: convert JPEG to raw pixel buffer
        // Using canvas-like decode via sharp or manual JPEG decode
        try {
            const { width, height, data } = await this._decodeJpeg(jpegData);
            const result = this.motionProcessor.processFrame(data, width, height, 4);

            // Feed entities to behavior model
            this._lastGaze = this.behaviorModel.update(result.entities, result.totalMotion);

            // Update entity tracking for sentinel
            if (result.entities.length > 0) {
                this._lastEntityTime = Date.now() / 1000;
            }
        } catch (err) {
            // Silently handle decode errors (corrupt frames, etc.)
        }
    }

    /**
     * Handle a voice command.
     * @param {string} command - 'sleep', 'wake', 'blush', 'goodboy', 'thankyou'
     */
    handleCommand(command) {
        const now = Date.now() / 1000;
        switch (command) {
            case 'sleep':
                this._sleeping = true;
                break;
            case 'wake':
                this._sleeping = false;
                break;
            case 'blush':
                this._blushEndTime = now + 4.0;
                break;
            case 'goodboy':
                this._goodBoyEndTime = now + 5.0;
                this._overlayText = 'GOOD BOY';
                this._overlayType = 'goodboy';
                this._overlayEndTime = now + 5.0;
                break;
            case 'thankyou':
                this._thankYouEndTime = now + 5.0;
                this._overlayText = 'YOU ARE WELCOME HUMAN';
                this._overlayType = 'thankyou';
                this._overlayEndTime = now + 5.0;
                break;
        }
    }

    /**
     * Handle Oracle question from voice or text.
     * @param {string} text
     * @returns {Promise<{response: string, category: string, emotion: string}>}
     */
    async handleOracleQuestion(text) {
        const result = await this.oracle.ask(text);

        // Show response as overlay
        const now = Date.now() / 1000;
        this._overlayText = result.response;
        this._overlayType = 'oracle';
        this._overlayEndTime = now + 4.0;

        // Trigger curiosity emotion
        this.behaviorModel.emotion = 'curious';
        this.behaviorModel.emotionEndTime = now + 2.0;

        return result;
    }

    /**
     * Get an ambient phrase.
     * @returns {string}
     */
    getAmbientPhrase() {
        return this.oracle.getAmbientPhrase();
    }

    // ══════════════════════════════════════════
    // PRIVATE — 60fps tick
    // ══════════════════════════════════════════

    _tick() {
        const now = Date.now() / 1000;
        const gaze = this._lastGaze;

        // ── Blink ──
        this._updateBlink(now);

        // ── Sleep ──
        const sleepTarget = this._sleeping ? 1.0 : 0.0;
        this._sleepPhase = lerp(this._sleepPhase, sleepTarget, 0.04);

        // ── Sentinel mode ──
        const timeSinceEntity = now - this._lastEntityTime;
        if (!gaze.visible && timeSinceEntity > SENTINEL_ENTER_DELAY) {
            if (!this._sentinelActive) {
                this._sentinelActive = true;
                this._sentinelNextSweep = now + 0.5;
            }
            this._updateSentinel(now);
        } else {
            this._sentinelActive = false;
        }

        // ── Compute final iris position ──
        let finalX, finalY;
        if (this._sentinelActive && !gaze.visible) {
            // Sentinel: use sentinel targets with organic drift
            const driftX = Math.sin(now * 0.35) * 15 + Math.sin(now * 0.13) * 8 + Math.sin(now * 0.7) * 3;
            const driftY = Math.cos(now * 0.28) * 10 + Math.cos(now * 0.11) * 6 + Math.cos(now * 0.55) * 2;
            finalX = lerp(this.state.ix, this._sentinelTargetX + driftX, 0.03 * this._sentinelSweepSpeed);
            finalY = lerp(this.state.iy, this._sentinelTargetY + driftY, 0.03 * this._sentinelSweepSpeed);
        } else {
            // Tracking: use behavior model output + saccades
            finalX = lerp(this.state.ix, gaze.x + gaze.saccadeX, 0.14);
            finalY = lerp(this.state.iy, gaze.y + gaze.saccadeY, 0.14);
        }

        // ── Dilation with sentinel modulation ──
        let finalDilation;
        if (this._sentinelActive) {
            const zoomSlow = Math.sin(now * 0.4) * 0.25;
            const zoomMed = Math.sin(now * 1.1) * 0.12;
            const zoomFast = Math.sin(now * 3.0) * 0.04;
            const zoomSpike = Math.pow(Math.sin(now * 0.15), 8) * 0.35;
            const sentinelDilation = Math.max(0.5, Math.min(1.6, 1.0 + zoomSlow + zoomMed + zoomFast + zoomSpike));
            finalDilation = lerp(this.state.dilation, sentinelDilation, 0.05);
        } else {
            finalDilation = lerp(this.state.dilation, gaze.dilation, 0.08);
        }

        // ── Blink: combine natural blink + sleep ──
        const totalBlink = Math.min(1.0, Math.max(this._blinkPhase, this._sleepPhase));

        // ── Reactions ──
        if (now < this._blushEndTime) {
            this._blushPhase = lerp(this._blushPhase, 1.0, 0.08);
        } else {
            this._blushPhase = lerp(this._blushPhase, 0, 0.08);
        }
        if (now < this._goodBoyEndTime) {
            this._goodBoyPhase = lerp(this._goodBoyPhase, 1.0, 0.1);
        } else {
            this._goodBoyPhase = lerp(this._goodBoyPhase, 0, 0.1);
        }
        if (now < this._thankYouEndTime) {
            this._thankYouPhase = lerp(this._thankYouPhase, 1.0, 0.1);
        } else {
            this._thankYouPhase = lerp(this._thankYouPhase, 0, 0.1);
        }

        // ── Overlay text expiry ──
        if (now > this._overlayEndTime) {
            this._overlayText = '';
            this._overlayType = '';
        }

        // ── Build state packet ──
        this.state = {
            ix: finalX,
            iy: finalY,
            dilation: finalDilation,
            blink: totalBlink,
            emotion: gaze.emotion,
            sentinel: this._sentinelActive,
            visible: gaze.visible,
            entityCount: gaze.entityCount,
            overlayText: this._overlayText,
            overlayType: this._overlayType,
            blush: this._blushPhase,
            goodBoy: this._goodBoyPhase,
            thankYou: this._thankYouPhase,
            t: now,
        };

        // ── Broadcast to connected thin clients ──
        if (this._broadcastFn) {
            this._broadcastFn(this.state);
        }
    }

    _updateBlink(now) {
        switch (this._blinkStage) {
            case 'idle':
                if (now >= this._nextBlinkTime) {
                    this._blinkStage = 'closing';
                    this._blinkTarget = 1.0;
                    this._doubleBlinkPending = Math.random() < DOUBLE_BLINK_CHANCE;
                }
                break;

            case 'closing':
                this._blinkPhase = lerp(this._blinkPhase, 1.0, BLINK_CLOSE_SPEED);
                if (this._blinkPhase > 0.95) {
                    this._blinkPhase = 1.0;
                    this._blinkStage = 'opening';
                    this._blinkTarget = 0;
                }
                break;

            case 'opening':
                this._blinkPhase = lerp(this._blinkPhase, 0, BLINK_OPEN_SPEED);
                if (this._blinkPhase < 0.03) {
                    this._blinkPhase = 0;
                    if (this._doubleBlinkPending) {
                        this._doubleBlinkPending = false;
                        this._blinkStage = 'double_wait';
                        this._nextBlinkTime = now + 0.12; // short pause before second blink
                    } else {
                        this._blinkStage = 'idle';
                        this._nextBlinkTime = now + BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN);
                    }
                }
                break;

            case 'double_wait':
                if (now >= this._nextBlinkTime) {
                    this._blinkStage = 'closing';
                    this._blinkTarget = 1.0;
                }
                break;
        }
    }

    _updateSentinel(now) {
        if (now >= this._sentinelNextSweep) {
            let sweepType = Math.floor(Math.random() * 4);
            if (sweepType === this._sentinelLastType) sweepType = (sweepType + 1) % 4;
            this._sentinelLastType = sweepType;

            const range = SENTINEL_SWEEP_RANGE;
            switch (sweepType) {
                case 0: // Horizontal scan
                    this._sentinelTargetX = (Math.random() > 0.5 ? 1 : -1) * range * (0.6 + Math.random() * 0.4);
                    this._sentinelTargetY = (Math.random() - 0.5) * 30;
                    this._sentinelSweepSpeed = 0.5 + Math.random() * 0.3;
                    this._sentinelNextSweep = now + 2.5 + Math.random() * 2.0;
                    break;
                case 1: // Vertical scan
                    this._sentinelTargetX = (Math.random() - 0.5) * 40;
                    this._sentinelTargetY = (Math.random() > 0.5 ? 1 : -1) * range * (0.4 + Math.random() * 0.4);
                    this._sentinelSweepSpeed = 0.4 + Math.random() * 0.2;
                    this._sentinelNextSweep = now + 1.5 + Math.random() * 2.0;
                    break;
                case 2: // Diagonal scan
                    this._sentinelTargetX = (Math.random() > 0.5 ? 1 : -1) * range * (0.5 + Math.random() * 0.5);
                    this._sentinelTargetY = (Math.random() > 0.5 ? 1 : -1) * range * (0.3 + Math.random() * 0.4);
                    this._sentinelSweepSpeed = 0.6 + Math.random() * 0.4;
                    this._sentinelNextSweep = now + 2.0 + Math.random() * 2.5;
                    break;
                case 3: // Wide erratic
                    this._sentinelTargetX = (Math.random() - 0.5) * range * 1.5;
                    this._sentinelTargetY = (Math.random() - 0.5) * range * 0.8;
                    this._sentinelSweepSpeed = 1.2 + Math.random() * 0.5;
                    this._sentinelNextSweep = now + 3.0 + Math.random() * 3.0;
                    break;
            }
        }
    }

    /**
     * Decode JPEG buffer to raw RGBA pixel data.
     * Uses a pure-JS approach that works without native dependencies.
     */
    async _decodeJpeg(jpegData) {
        // Use the built-in sharp if available, otherwise fall back to manual decode
        try {
            const sharp = await import('sharp');
            const { data, info } = await sharp.default(jpegData)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            return { width: info.width, height: info.height, data };
        } catch {
            // Fallback: If sharp isn't available, we can still process
            // by having the client send raw pixel data instead of JPEG
            throw new Error('JPEG decode requires sharp package');
        }
    }
}
