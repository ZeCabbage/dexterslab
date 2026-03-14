/**
 * High-Performance 2D Vector Eye Styles
 *
 * Each style has a `type` that tells the renderer which drawing
 * technique to use — simple color swaps are not enough for truly
 * distinct visual identities.
 *
 * Types:
 *   'organic'    — Smooth vector fills, anime-style highlights
 *   'snes'       — Chunky pixel grid, scanlines, retro palette
 *   'robotic'    — Precision rings, crosshair, cold HUD aesthetic
 *   'pentagram'  — Satanic star pupil, blood iris, occult
 *   'arcade'     — 80s neon CRT, pixel nostalgia
 *   'crumb'      — Gross-up underground comix detail
 *   'void'       — Black hole vortex, concentric warp rings
 *   'hologram'   — Sci-fi wireframe projection, glitch aesthetic
 *   'infrared'   — Thermal/night vision sensor HUD
 *   'fractured'  — Shattered crystal prism, geometric facets
 */

export interface EyeStyle {
    name: string;
    type: 'organic' | 'snes' | 'robotic' | 'pentagram' | 'arcade' | 'crumb' | 'void' | 'hologram' | 'infrared' | 'fractured';

    // Core Colors
    scleraColor: [number, number, number];
    scleraShadow: [number, number, number];

    // Iris Palette
    irisBase: [number, number, number];
    irisHighlight: [number, number, number];
    irisRim: [number, number, number];

    // Pupil
    pupilColor: [number, number, number];

    // Proportions
    irisRadiusFrac: number;
    pupilRadiusFrac: number;

    // Optional type-specific extras
    accentColor?: [number, number, number];   // For robotic glow, SNES highlight
    scanlineAlpha?: number;                    // CRT / robotic scanline intensity
    pixelSize?: number;                        // SNES pixel grid size
}

export const EYE_STYLES: EyeStyle[] = [
    // ── 0. Base Organic ──
    {
        name: 'Organic',
        type: 'organic',
        scleraColor: [248, 245, 240],
        scleraShadow: [210, 195, 190],
        irisBase: [30, 110, 200],
        irisHighlight: [100, 180, 255],
        irisRim: [10, 30, 80],
        pupilColor: [10, 15, 25],
        irisRadiusFrac: 0.38,
        pupilRadiusFrac: 0.15,
    },

    // ── 1. SNES Retro ──
    {
        name: 'SNES',
        type: 'snes',
        scleraColor: [232, 224, 208],
        scleraShadow: [176, 152, 136],
        irisBase: [32, 144, 64],
        irisHighlight: [96, 216, 128],
        irisRim: [16, 64, 32],
        pupilColor: [8, 8, 16],
        irisRadiusFrac: 0.40,
        pupilRadiusFrac: 0.16,
        accentColor: [248, 248, 200],
        scanlineAlpha: 0.15,
        pixelSize: 6,
    },

    // ── 2. Robotic ──
    {
        name: 'Robotic',
        type: 'robotic',
        scleraColor: [15, 18, 25],
        scleraShadow: [8, 10, 15],
        irisBase: [0, 160, 200],
        irisHighlight: [0, 220, 255],
        irisRim: [0, 80, 120],
        pupilColor: [0, 0, 0],
        irisRadiusFrac: 0.36,
        pupilRadiusFrac: 0.12,
        accentColor: [0, 255, 200],
        scanlineAlpha: 0.08,
    },

    // ── 3. Abyssal (Satanic / Archaic) ──
    {
        name: 'Abyssal',
        type: 'pentagram',
        scleraColor: [18, 8, 8],
        scleraShadow: [8, 2, 2],
        irisBase: [140, 10, 5],
        irisHighlight: [200, 30, 10],
        irisRim: [60, 0, 0],
        pupilColor: [0, 0, 0],
        irisRadiusFrac: 0.44,
        pupilRadiusFrac: 0.13,
        accentColor: [90, 5, 0],
    },

    // ── 4. Arcade (80s neon) ──
    {
        name: 'Arcade',
        type: 'arcade',
        scleraColor: [10, 5, 20],
        scleraShadow: [5, 0, 15],
        irisBase: [0, 200, 80],
        irisHighlight: [80, 255, 140],
        irisRim: [0, 100, 40],
        pupilColor: [0, 0, 0],
        irisRadiusFrac: 0.38,
        pupilRadiusFrac: 0.14,
        accentColor: [255, 0, 200],
        pixelSize: 4,
    },

    // ── 5. Crumb (Gross-Up Close-Up) ──
    {
        name: 'Crumb',
        type: 'crumb',
        scleraColor: [245, 235, 215],
        scleraShadow: [210, 190, 170],
        irisBase: [170, 50, 70],
        irisHighlight: [210, 90, 110],
        irisRim: [120, 25, 40],
        pupilColor: [15, 5, 8],
        irisRadiusFrac: 0.42,
        pupilRadiusFrac: 0.16,
        accentColor: [140, 20, 30],
    },

    // ── 6. Void (Black Hole / Singularity) ──
    // A hypnotic gravitational vortex. Deep space darkness with
    // concentric warping rings that pulse like an event horizon.
    {
        name: 'Void',
        type: 'void',
        scleraColor: [5, 3, 12],                // Near-pure darkeness
        scleraShadow: [2, 0, 8],                 // Abyss shadow
        irisBase: [60, 0, 120],                  // Deep violet
        irisHighlight: [140, 40, 220],           // Electric purple
        irisRim: [20, 0, 50],                    // Dark indigo rim
        pupilColor: [0, 0, 0],                   // Absolute void
        irisRadiusFrac: 0.46,                    // Large, dominant
        pupilRadiusFrac: 0.10,                   // Small dense pupil
        accentColor: [180, 80, 255],             // Hawking radiation purple
    },

    // ── 7. Hologram (Sci-Fi Wireframe Projection) ──  [ROBOTIC]
    // A semi-transparent holographic eye — wireframe iris with scan
    // lines, glitch offset layers, digital projection aesthetic.
    {
        name: 'Hologram',
        type: 'hologram',
        scleraColor: [5, 15, 20],                // Dark teal-black
        scleraShadow: [2, 8, 12],                // Subtle teal shadow
        irisBase: [0, 180, 220],                 // Cyan hologram
        irisHighlight: [100, 240, 255],          // Bright cyan
        irisRim: [0, 90, 130],                   // Dark cyan
        pupilColor: [0, 30, 40],                 // Not quite black — glows
        irisRadiusFrac: 0.40,
        pupilRadiusFrac: 0.13,
        accentColor: [0, 255, 180],              // Green data readout
        scanlineAlpha: 0.12,
    },

    // ── 8. Infrared (Thermal Night Vision) ──  [ROBOTIC]
    // Military-grade thermal sensor. Heat-map iris gradient from
    // cool blue to hot orange/white. Hexagonal pupil grid.
    {
        name: 'Infrared',
        type: 'infrared',
        scleraColor: [8, 12, 5],                 // Dark olive-green
        scleraShadow: [4, 8, 2],                 // Darker green
        irisBase: [200, 80, 0],                  // Hot orange
        irisHighlight: [255, 200, 50],           // Thermal white-yellow
        irisRim: [120, 30, 0],                   // Dark burnt orange
        pupilColor: [255, 240, 200],             // Hot white core (inverted!)
        irisRadiusFrac: 0.38,
        pupilRadiusFrac: 0.11,
        accentColor: [0, 200, 60],               // Night vision green overlay
        scanlineAlpha: 0.10,
    },

    // ── 9. Fractured (Shattered Crystal / Prism) ──
    // A cracked gemstone eye with geometric triangular shards.
    // Light refracts through facets creating prismatic rainbows.
    {
        name: 'Fractured',
        type: 'fractured',
        scleraColor: [235, 235, 245],            // Cool white crystal
        scleraShadow: [180, 185, 200],           // Blue-grey shadow
        irisBase: [60, 140, 180],                // Cool teal-blue
        irisHighlight: [180, 220, 255],          // Icy bright blue
        irisRim: [40, 60, 90],                   // Dark steel
        pupilColor: [5, 5, 15],                  // Deep dark
        irisRadiusFrac: 0.42,
        pupilRadiusFrac: 0.14,
        accentColor: [220, 100, 255],            // Prismatic violet
    },
];
