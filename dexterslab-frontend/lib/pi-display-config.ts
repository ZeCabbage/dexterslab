/**
 * Pi Display Configuration — Detects circular display and provides optimized settings.
 *
 * The Waveshare 5" HDMI Circular Touch Display is 1080×1080 pixels.
 * When we detect this resolution (or force via ?pi=true), we activate
 * optimizations: skip the housing, shape lids to circle, reduce effects.
 */

// Native resolution of the Waveshare 5" circular display
export const CIRCULAR_DISPLAY_SIZE = 1080;

// Tolerance for viewport detection (±20px to handle OS chrome)
const DETECTION_TOLERANCE = 40;

/**
 * Detect if we're running on a circular display based on viewport dimensions.
 * Also checks for `?pi=true` URL param for forced Pi mode on Mac.
 */
export function isCircularDisplay(): boolean {
    // URL param override
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('pi') === 'true') return true;
    }

    // Viewport detection: 1080×1080 ± tolerance
    if (typeof window !== 'undefined') {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isSquare = Math.abs(w - h) < DETECTION_TOLERANCE;
        const isCorrectSize = Math.abs(w - CIRCULAR_DISPLAY_SIZE) < DETECTION_TOLERANCE;
        return isSquare && isCorrectSize;
    }

    return false;
}

/**
 * Configuration constants tuned for Pi 5 performance on the circular display.
 */
export interface DisplayConfig {
    /** Eye rendering size in pixels */
    eyeSize: number;
    /** Scanline spacing in decay effect (higher = fewer lines = faster) */
    scanlineSpacing: number;
    /** Whether to render the housing overlay */
    renderHousing: boolean;
    /** Whether to render the decay vignette */
    renderVignette: boolean;
    /** Glitch probability */
    glitchProbability: number;
    /** Target FPS hint */
    targetFps: number;
}

export const PI_CONFIG: DisplayConfig = {
    eyeSize: CIRCULAR_DISPLAY_SIZE,
    scanlineSpacing: 4,
    renderHousing: false,
    renderVignette: false,
    glitchProbability: 0.10,
    targetFps: 60,
};

/**
 * Default configuration for non-Pi displays (desktop/Mac).
 */
export const DESKTOP_CONFIG: DisplayConfig = {
    eyeSize: 800,
    scanlineSpacing: 3,
    renderHousing: true,
    renderVignette: true,
    glitchProbability: 0.15,
    targetFps: 60,
};

/**
 * Get the active display configuration.
 */
export function getDisplayConfig(): DisplayConfig {
    return isCircularDisplay() ? PI_CONFIG : DESKTOP_CONFIG;
}
