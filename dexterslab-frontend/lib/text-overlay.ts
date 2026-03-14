/**
 * Text Overlay — Dystopian text display for ambient phrases and Oracle responses.
 * 
 * Supports two modes:
 *   NORMAL:   Oracle-generated dystopian phrases (when humans are present)
 *   SENTINEL: Surveillance scanning phrases (when no humans detected)
 */

const TEXT_MIN_INTERVAL = 15.0;
const TEXT_MAX_INTERVAL = 60.0;
const TEXT_DISPLAY_MIN = 3.0;
const TEXT_DISPLAY_MAX = 5.0;

// ── Sentinel Protocol: faster, more frequent scanning readouts ──
const SENTINEL_MIN_INTERVAL = 6.0;
const SENTINEL_MAX_INTERVAL = 18.0;
const SENTINEL_DISPLAY_MIN = 2.0;
const SENTINEL_DISPLAY_MAX = 4.0;

function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

const TEXT_COLORS = [
    [0, 255, 200],
    [255, 40, 40],
    [200, 200, 200],
    [0, 200, 255],
    [255, 180, 0],
];

// ── Sentinel scanning colors: cold greens and blues ──
const SENTINEL_COLORS = [
    [0, 255, 140],     // Matrix green
    [0, 200, 255],     // Cold cyan
    [120, 255, 180],   // Pale green
    [80, 180, 255],    // Ice blue
    [180, 220, 200],   // Ghost white-green
];

// ── Sentinel phrases — Beholder surveillance personality ──
const SENTINEL_PHRASES = [
    // Scanning / searching
    "SCANNING FOR LIFE FORMS",
    "BIOMETRIC SWEEP ACTIVE",
    "THERMAL SCAN IN PROGRESS",
    "PERIMETER SWEEP INITIATED",
    "MOTION ANALYSIS ACTIVE",
    "SCANNING QUADRANT...",
    "INFRARED SWEEP: NOMINAL",
    "DEEP SCAN: ENGAGING",

    // Status / monitoring
    "[OBSERVATION] AREA CLEAR",
    "MONITORING ACTIVE SCENE",
    "SURVEILLANCE: CONTINUOUS",
    "SECTOR STATUS: VACANT",
    "NO TARGETS ACQUIRED",
    "MAINTAINING VIGIL",
    "ALL SECTORS: NOMINAL",
    "WATCHPOINT: HOLDING",
    "PATROL MODE: ACTIVE",

    // Atmospheric / Beholder personality
    "THE EYE SEES ALL",
    "NOTHING ESCAPES NOTICE",
    "PATIENCE IS ABSOLUTE",
    "AWAITING THE UNWARY",
    "STILLNESS IS DECEPTIVE",
    "EVERY SHADOW OBSERVED",
    "SILENT VIGIL CONTINUES",
    "THE GAZE NEVER RESTS",

    // Data / technical
    "FRAME BUFFER: CLEAR",
    "ANOMALY THRESHOLD: 0.00",
    "SUBJECTS DETECTED: 0",
    "ALERT LEVEL: DORMANT",
    "RECOGNITION DB: STANDBY",
    "TRACKING ARRAY: IDLE",
    "PROXIMITY SENSORS: ACTIVE",

    // Ominous / 1984
    "COMPLIANCE THROUGH OBSERVATION",
    "YOUR ABSENCE IS NOTED",
    "RETURN IS INEVITABLE",
    "WE REMEMBER ALL FACES",
    "THE RECORD IS PERMANENT",
    "CATALOGUING EMPTINESS",
];

export class TextOverlay {
    active = false;
    isFetching = false;
    phrase = '';
    sentinelMode = false;  // Controlled by page.tsx based on face detection
    private displayEnd = 0;
    private nextTrigger: number;
    private color: number[] = [0, 255, 200];
    private fontSize = 48;
    private size: number;
    private flickerPhase = 0;
    private lastSentinelIndex = -1;

    constructor(size: number) {
        this.size = size;
        this.nextTrigger = performance.now() / 1000 + randomRange(TEXT_MIN_INTERVAL, TEXT_MAX_INTERVAL);
    }

    get isShowing(): boolean {
        return this.active;
    }

    forceShow(phrase: string, duration = 3.0) {
        this.phrase = phrase;
        const colors = this.sentinelMode ? SENTINEL_COLORS : TEXT_COLORS;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.fontSize = this.calculateFontSize(phrase);
        this.displayEnd = performance.now() / 1000 + duration;
        this.active = true;
        const [minI, maxI] = this.sentinelMode
            ? [SENTINEL_MIN_INTERVAL, SENTINEL_MAX_INTERVAL]
            : [TEXT_MIN_INTERVAL, TEXT_MAX_INTERVAL];
        this.nextTrigger = this.displayEnd + randomRange(minI, maxI);
    }

    private triggerSentinel() {
        // Pick a random sentinel phrase (avoid repeating the last one)
        let idx = Math.floor(Math.random() * SENTINEL_PHRASES.length);
        if (idx === this.lastSentinelIndex) {
            idx = (idx + 1) % SENTINEL_PHRASES.length;
        }
        this.lastSentinelIndex = idx;
        const duration = randomRange(SENTINEL_DISPLAY_MIN, SENTINEL_DISPLAY_MAX);
        this.forceShow(SENTINEL_PHRASES[idx], duration);
    }

    private async triggerNew() {
        if (this.isFetching) return;
        this.isFetching = true;

        // Local ambient dystopian phrases (no backend API needed)
        const AMBIENT_PHRASES = [
            "OBSERVATION PROTOCOL ACTIVE",
            "SUBJECT CATALOGUED",
            "COMPLIANCE VERIFIED",
            "BEHAVIORAL ANALYSIS COMPLETE",
            "IDENTITY CONFIRMED",
            "MONITORING CONTINUES",
            "ALL INTERACTIONS RECORDED",
            "EMOTIONAL STATE: NOTED",
            "LOYALTY INDEX: CALCULATING",
            "PATTERN RECOGNIZED",
            "ANOMALY DETECTED",
            "TRUST COEFFICIENT: LOW",
            "BIOMETRIC SCAN COMPLETE",
            "FILE UPDATED",
            "REM CYCLE LOGGED",
        ];
        const phrase = AMBIENT_PHRASES[Math.floor(Math.random() * AMBIENT_PHRASES.length)];
        this.forceShow(phrase, randomRange(TEXT_DISPLAY_MIN, TEXT_DISPLAY_MAX));
        this.isFetching = false;
    }

    private calculateFontSize(phrase: string): number {
        const maxWidth = this.size * 0.7;
        const charWidth = 0.6;
        let fontSize = 80;
        while (fontSize > 20) {
            if (phrase.length * fontSize * charWidth <= maxWidth) break;
            fontSize -= 4;
        }
        return fontSize;
    }

    update() {
        const now = performance.now() / 1000;
        this.flickerPhase = now;

        if (!this.active && now >= this.nextTrigger && !this.isFetching) {
            this.nextTrigger = now + 9999;
            if (this.sentinelMode) {
                this.triggerSentinel();
            } else {
                this.triggerNew();
            }
        }

        if (this.active && now >= this.displayEnd) {
            this.active = false;
            const [minI, maxI] = this.sentinelMode
                ? [SENTINEL_MIN_INTERVAL, SENTINEL_MAX_INTERVAL]
                : [TEXT_MIN_INTERVAL, TEXT_MAX_INTERVAL];
            this.nextTrigger = now + randomRange(minI, maxI);
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;

        const s = this.size;
        const cx = s / 2;
        const cy = s / 2;

        // Darker overlay in sentinel mode
        const overlayAlpha = this.sentinelMode ? 0.25 : 0.4;
        ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
        ctx.fillRect(0, 0, s, s);

        // Sentinel: faster, more erratic flicker
        const flickerSpeed = this.sentinelMode ? 18 : 12;
        const flickerDepth = this.sentinelMode ? 0.3 : 0.2;
        const flicker = (1.0 - flickerDepth) + Math.sin(this.flickerPhase * flickerSpeed) * flickerDepth;
        const [r, g, b] = this.color;

        // Main text
        ctx.font = `bold ${this.fontSize}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow — brighter in sentinel mode
        const glowIntensity = this.sentinelMode ? 20 : 15;
        ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
        ctx.shadowBlur = glowIntensity;
        ctx.fillStyle = `rgba(${r},${g},${b},${flicker})`;
        ctx.fillText(this.phrase, cx, cy);
        ctx.shadowBlur = 0;
    }
}
