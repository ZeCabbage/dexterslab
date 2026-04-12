import { EyeState } from './types';

// ── Constants ──
const THEME_COUNT = 4;
const THEME_NAMES = ['Classic', 'HAL-9000', 'Obsidian Void', 'Vector Reticle'];

// Transition constants
const TRANSITION_CLOSE_MS = 1500;
const TRANSITION_OPEN_MS = 2500;
const MIN_INTERVAL_S = 180.0;
const MAX_INTERVAL_S = 900.0;

// ── Vertex shader ──
const VERT_SOURCE = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUV;
void main() {
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ── Fragment shader ──
const FRAG_SOURCE = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uIrisOffset;
uniform float uDilation;
uniform float uBlink;
uniform float uBlush;
uniform vec2 uResolution;
uniform int uTheme;
uniform float uSentinel;

uniform sampler2D uMatCapSclera;
uniform sampler2D uMatCapIris;
uniform sampler2D uMatCapMetal;
uniform sampler2D uMatCapCrimson;

const float EYE_RADIUS = 0.42;
const float IRIS_RADIUS = 0.155;
const float PUPIL_BASE = 0.055;
const float PI = 3.14159265;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float circleSDF(vec2 p, vec2 center, float radius) {
    return length(p - center) - radius;
}

// ── Parallax & Depth ──
vec2 calculateParallax(vec2 uv, vec2 gaze, float depth) {
    return uv + (gaze * depth);
}

vec3 calculateSphereNormal(vec2 uv, vec2 center, float radius) {
    vec2 rel = uv - center;
    float distSq = dot(rel, rel);
    float rSq = radius * radius;
    if(distSq >= rSq) return vec3(0.0, 0.0, 1.0);
    float z = sqrt(rSq - distSq);
    return normalize(vec3(rel.x, rel.y, z));
}

vec3 calculateBowlNormal(vec2 uv, vec2 center, float radius) {
    vec2 rel = uv - center;
    float distSq = dot(rel, rel);
    float rSq = radius * radius;
    if(distSq >= rSq) return vec3(0.0, 0.0, 1.0);
    float z = sqrt(rSq - distSq);
    return normalize(vec3(rel.x, rel.y, -z)); // pointing inward
}

vec3 getMatcap(sampler2D tex, vec3 normal) {
    return texture(tex, normal.xy * 0.5 + 0.5).rgb;
}

// ════════════════════════════════════
//  THEME 0: CLASSIC (Stylized Realism)
// ════════════════════════════════════
vec3 themeClassic(vec2 uv, vec2 ic, float pupilR, float sd) {
    // 1. Sclera (Bulging out)
    vec3 nSclera = calculateSphereNormal(uv, vec2(0.0), EYE_RADIUS);
    vec3 col = getMatcap(uMatCapSclera, nSclera);

    // Subsurface scattering — warm pinkish glow near iris border
    float scleraEdge = smoothstep(IRIS_RADIUS * 1.6, IRIS_RADIUS * 1.05, length(uv - ic));
    col += vec3(0.08, 0.02, 0.02) * scleraEdge;

    // 2. Parallax Iris (Sinking inward) — reduced depth for concentricity
    vec2 irisUV = calculateParallax(uv, ic, 0.06);
    float irisDist = circleSDF(irisUV, ic, IRIS_RADIUS);

    // Smooth feathered blend instead of hard cutoff — eliminates blue bleed ring
    float irisBlend = smoothstep(0.004, -0.004, irisDist);
    if (irisBlend > 0.001) {
        vec3 nIris = calculateBowlNormal(irisUV, ic, IRIS_RADIUS);
        vec3 irisCol = getMatcap(uMatCapIris, nIris);

        // Radial fiber texture — organic iris detail
        float theta = atan(irisUV.y - ic.y, irisUV.x - ic.x);
        float irisR = length(irisUV - ic);
        float fiber = sin(theta * 60.0) * 0.5 + 0.5;
        float finerFiber = sin(theta * 120.0 + 3.0) * 0.5 + 0.5;
        float fiberMask = smoothstep(IRIS_RADIUS * 0.3, IRIS_RADIUS * 0.9, irisR);
        irisCol = mix(irisCol, irisCol * 0.7, fiber * 0.15 * fiberMask);
        irisCol = mix(irisCol, irisCol * 1.2, finerFiber * 0.08 * fiberMask);

        // Limbal ring — dark border at outer iris edge
        float limbalDist = irisR / IRIS_RADIUS;
        float limbalRing = smoothstep(0.82, 1.0, limbalDist);
        irisCol *= mix(1.0, 0.3, limbalRing);

        col = mix(col, irisCol, irisBlend);
    }

    // 3. Parallax Pupil (Deepest drop) — tighter depth to stay concentric
    vec2 pupilUV = calculateParallax(uv, ic, 0.10);
    float sPulse = sin(uTime * 2.5) * 0.15 + 1.0; 
    float effPupilR = mix(pupilR, pupilR * sPulse, uSentinel);
    float pupilDist = circleSDF(pupilUV, ic, effPupilR);

    if (pupilDist < 0.0) {
        col = mix(col, vec3(0.01), smoothstep(0.002, -0.002, pupilDist));
    }

    // 4. Cornea (Glass dome pop-out)
    vec2 corneaUV = calculateParallax(uv, -ic, 0.04);
    vec3 nCornea = calculateSphereNormal(corneaUV, ic, IRIS_RADIUS);
    
    vec3 lightDir = normalize(vec3(0.5, 0.6, 0.9));
    float spec = pow(max(0.0, dot(nCornea, lightDir)), 80.0);
    vec3 lightDir2 = normalize(vec3(-0.4, 0.3, 0.6));
    float spec2 = pow(max(0.0, dot(nCornea, lightDir2)), 40.0);
    
    float cMask = smoothstep(0.02, 0.0, circleSDF(uv, ic, IRIS_RADIUS * 1.05));
    col += vec3(1.0, 0.95, 0.9) * spec * 1.5 * cMask;
    col += vec3(0.8, 0.85, 1.0) * spec2 * 0.7 * cMask;

    // 5. Wet specular — tear film (reuse sclera normal for perf)
    vec3 wetLight = normalize(vec3(0.3, 0.7, 0.8));
    float wetSpec = pow(max(0.0, dot(nSclera, wetLight)), 64.0);
    col += vec3(1.0) * wetSpec * 0.5;

    return col;
}

// ════════════════════════════════════
//  THEME 1: HAL-9000
// ════════════════════════════════════
vec3 themeHAL(vec2 uv, vec2 ic, float pupilR, float sd) {
    // 1. Metal Housing (Static background)
    vec3 nMetal = calculateBowlNormal(uv, vec2(0.0), EYE_RADIUS);
    vec3 col = getMatcap(uMatCapMetal, nMetal);

    // 2. Heavy Beveled Ridge around Lens
    float lensR = 0.21;
    float distToLens = length(uv) - lensR;
    if (distToLens > 0.0 && distToLens < 0.02) {
        // Create an inward bevel using normal offset
        vec3 bevelN = calculateSphereNormal(uv, vec2(0.0), lensR + 0.02);
        col = getMatcap(uMatCapMetal, bevelN) * 0.6; // Darker bevel
    }

    // 3. The Crimson Lens (Sunk inward)
    vec2 lensUV = calculateParallax(uv, ic, 0.06);
    float lensDist = circleSDF(lensUV, vec2(0.0), lensR);

    if (lensDist < 0.0) {
        // Base crimson bowl
        vec3 nCrimson = calculateBowlNormal(lensUV, vec2(0.0), lensR);
        vec3 lCol = getMatcap(uMatCapCrimson, nCrimson);
        
        // 4. Inner Golden Ring (Mid depth)
        vec2 ringUV = calculateParallax(uv, ic, 0.11);
        float rDist = length(ringUV - ic);
        float ringThick = smoothstep(0.002, 0.0, abs(rDist - 0.12));
        lCol += vec3(1.0, 0.7, 0.1) * ringThick * 0.4;
        
        // 5. Deep Tracking Core (Deepest depth, actively pulsing)
        vec2 coreUV = calculateParallax(uv, ic, 0.18);
        float coreDist = length(coreUV - ic);
        float coreK = 90.0 / max(0.5, uDilation * 1.2);
        float pInt = mix(1.0, sin(uTime * 4.0) * 0.3 + 0.7, uSentinel); // Sentinel breathing
        
        // Primary core laser
        lCol += vec3(1.0, 0.8, 0.4) * exp(-coreDist * coreDist * coreK * 1.5) * 1.2 * pInt;
        // Bleed glow
        lCol += vec3(0.8, 0.15, 0.02) * exp(-coreDist * coreDist * coreK * 0.2) * 0.5 * pInt;
        // Central sharp pinpoint
        lCol += vec3(1.0, 1.0, 1.0) * smoothstep(0.005, 0.0, coreDist) * 0.8 * pInt;

        // 6. Surface Glass Dome (Popped outward)
        vec2 glassUV = calculateParallax(uv, -ic, 0.04);
        vec3 nGlass = calculateSphereNormal(glassUV, vec2(0.0), lensR);
        
        // Soft room reflection
        vec3 lightTop = normalize(vec3(0.0, 0.8, 0.6));
        float spec1 = pow(max(0.0, dot(nGlass, lightTop)), 40.0);
        lCol += vec3(1.0, 0.9, 0.8) * spec1 * 0.6;
        
        vec3 lightSide = normalize(vec3(-0.7, 0.2, 0.5));
        float spec2 = pow(max(0.0, dot(nGlass, lightSide)), 12.0);
        lCol += vec3(1.0, 0.95, 1.0) * spec2 * 0.15;

        col = lCol;
    }
    
    // Vignette shadow inside the housing ring
    col *= smoothstep(0.0, 0.012, -circleSDF(uv, vec2(0.0), lensR));

    // Outer Sentinel Sweep on Metal
    float ang = atan(uv.y, uv.x);
    float radarWarp = fract((ang / (2.0 * PI)) - uTime * 0.4);
    float radarSweep = smoothstep(1.0, 0.8, radarWarp) * smoothstep(0.0, 0.05, radarWarp);
    col += vec3(0.8, 0.1, 0.1) * radarSweep * uSentinel * smoothstep(-0.02, -EYE_RADIUS*0.8, sd) * 0.6;

    return col;
}

// ════════════════════════════════════
//  THEME 2: OBSIDIAN VOID (Cosmic)
// ════════════════════════════════════
vec3 themeVoid(vec2 uv, vec2 ic, float pupilR, float sd) {
    vec3 col = vec3(0.012, 0.006, 0.028);
    col += vec3(0.035, 0.012, 0.055) * smoothstep(-EYE_RADIUS, -EYE_RADIUS * 0.3, sd) * 0.5;

    float dist = length(uv - ic);
    float hR = pupilR * 1.8 + 0.035;
    hR = mix(hR, hR * (sin(uTime * 4.0) * 0.15 + 1.0), uSentinel); 
    float rDist = abs(dist - hR);
    vec3 gold = vec3(1.0, 0.72, 0.22);

    col += gold * 0.85 * exp(-rDist * rDist * 6000.0);
    col += gold * 0.22 * exp(-rDist * rDist * 300.0);
    float r2 = abs(dist - hR * 1.7);
    col += gold * 0.18 * exp(-r2 * r2 * 10000.0);
    float r3 = abs(dist - hR * 2.4);
    col += gold * 0.08 * exp(-r3 * r3 * 15000.0);

    float theta = atan(uv.y - ic.y, uv.x - ic.x);
    float fZone = smoothstep(hR * 0.9, hR * 1.5, dist) * smoothstep(EYE_RADIUS * 0.95, EYE_RADIUS * 0.45, dist);
    float tS1 = uTime * mix(0.4, 1.5, uSentinel);
    float tS2 = uTime * mix(0.3, 1.2, uSentinel);
    float s1 = smoothstep(0.6, 1.0, sin(theta * 3.0 + dist * 35.0 - tS1));
    float s2 = smoothstep(0.72, 1.0, sin(theta * 5.0 - dist * 25.0 + tS2));
    col += gold * 0.11 * (s1 + s2 * 0.5) * fZone;

    col *= 1.0 - smoothstep(hR * 0.85, hR * 0.2, dist) * 0.97;

    float stars = step(0.988, hash(floor((uv - ic) * 180.0)));
    float starBr = hash(floor((uv - ic) * 180.0) + vec2(7.0, 13.0));
    col += vec3(0.45, 0.35, 0.25) * stars * starBr * 0.25 * step(hR * 0.5, dist);

    return col;
}

// ════════════════════════════════════
//  THEME 3: VECTOR RETICLE (HUD)
// ════════════════════════════════════
vec3 themeReticle(vec2 uv, vec2 ic, float pupilR, float sd) {
    vec3 teal = vec3(0.0, 0.95, 0.85);
    vec3 col = vec3(0.008, 0.014, 0.02);

    float gridPulse = mix(1.0, sin(uTime * 5.0) * 0.5 + 0.5 + 0.5, uSentinel);
    float gs = 0.05;
    float gx = smoothstep(0.0012, 0.0, abs(mod(uv.x + gs * 0.5, gs) - gs * 0.5));
    float gy = smoothstep(0.0012, 0.0, abs(mod(uv.y + gs * 0.5, gs) - gs * 0.5));
    col += teal * (gx + gy) * 0.025 * gridPulse;

    float scan = sin((uv.y * 150.0 + uTime * 6.0) * PI) * 0.5 + 0.5;
    col += teal * 0.01 * scan;

    float dist = length(uv);
    col += teal * 0.45 * smoothstep(0.0012, 0.0, abs(dist - 0.08));
    col += teal * 0.38 * smoothstep(0.0012, 0.0, abs(dist - 0.16));
    col += teal * 0.30 * smoothstep(0.0012, 0.0, abs(dist - 0.24));
    col += teal * 0.24 * smoothstep(0.0012, 0.0, abs(dist - 0.32));
    col += teal * 0.18 * smoothstep(0.0012, 0.0, abs(dist - 0.40));

    col += teal * 0.10 * smoothstep(0.0006, 0.0, abs(uv.y)) * step(0.05, dist);
    col += teal * 0.10 * smoothstep(0.0006, 0.0, abs(uv.x)) * step(0.05, dist);

    // Holographic Parallax Target Gimbal (The "Pupil")
    // Compiling 3 distinct layers that offset differently to create a floating 3D mechanical effect

    float baseR = pupilR * 0.6 + 0.005;

    // Layer 1: Deep Base Target (recessed, rotating slowly CW)
    vec2 pUV1 = calculateParallax(uv, ic, 0.15); // Deep inward
    float d1 = length(pUV1 - ic);
    float a1 = atan(pUV1.y - ic.y, pUV1.x - ic.x) + uTime * 0.8;
    float ring1 = smoothstep(0.0015, 0.0, abs(d1 - baseR * 2.5));
    // Dotted pattern
    ring1 *= step(0.0, sin(a1 * 16.0));
    col += teal * ring1 * 0.35;

    // Layer 2: Mid Bracket Gimbal (mid-depth, rotating fast CCW)
    vec2 pUV2 = calculateParallax(uv, ic, 0.06); // Mid depth
    float d2 = length(pUV2 - ic);
    float a2 = atan(pUV2.y - ic.y, pUV2.x - ic.x) - uTime * 1.5;
    float ring2 = smoothstep(0.002, 0.0, abs(d2 - baseR * 1.4));
    // Dashed locking brackets
    ring2 *= step(0.6, cos(a2 * 4.0));
    col += teal * ring2 * 0.8;

    // Static Crosshair tying targeting scope to center
    float cDist = length(uv - ic);
    float gap = smoothstep(0.035, 0.05, cDist);
    float cH = smoothstep(0.0008, 0.0, abs(uv.y - ic.y)) * smoothstep(0.35, 0.12, abs(uv.x - ic.x)) * gap;
    float cV = smoothstep(0.0008, 0.0, abs(uv.x - ic.x)) * smoothstep(0.35, 0.12, abs(uv.y - ic.y)) * gap;
    col += teal * (cH + cV) * 0.35;

    // Layer 3: Pop-out Core Tracker Dot (floating above screen)
    vec2 pUV3 = calculateParallax(uv, ic, -0.06); // Popped outward
    float d3 = length(pUV3 - ic);
    
    // Crisp inner dot
    col += teal * 0.95 * smoothstep(baseR + 0.002, baseR, d3);
    // Core intense laser glow
    col += vec3(0.5, 1.0, 0.9) * 0.6 * exp(-d3 * d3 * 3000.0);
    // Outer floating lock-ring
    col += teal * 0.6 * smoothstep(0.0015, 0.0, abs(d3 - baseR * 0.6));

    float edgeR = smoothstep(-0.005, -0.001, sd);
    col += teal * 0.12 * (1.0 - edgeR) * smoothstep(-0.025, -0.003, sd);

    float rAng = atan(uv.y, uv.x);
    float rsAngle = fract(rAng / (2.0 * PI) + uTime * 0.6); 
    float rSweep = smoothstep(1.0, 0.8, rsAngle) * smoothstep(0.0, 0.05, rsAngle);
    col += teal * rSweep * uSentinel * 0.25 * step(0.05, dist) * smoothstep(-0.02, -0.05, sd);

    return col;
}

void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUV - 0.5) * aspect;
    vec2 irisCenter = uIrisOffset * 0.32;

    float scleraDist = circleSDF(uv, vec2(0.0), EYE_RADIUS);
    float pupilR = PUPIL_BASE * uDilation;

    vec3 color = vec3(0.0);
    if (scleraDist < 0.0) {
        if (uTheme == 0) color = themeClassic(uv, irisCenter, pupilR, scleraDist);
        else if (uTheme == 1) color = themeHAL(uv, irisCenter, pupilR, scleraDist);
        else if (uTheme == 2) color = themeVoid(uv, irisCenter, pupilR, scleraDist);
        else color = themeReticle(uv, irisCenter, pupilR, scleraDist);
    }

    // Soft eyeball edge — wider AA for natural blending into black
    color *= smoothstep(0.004, -0.008, scleraDist);

    // ══════════════════════════════════
    //  METALLIC SHUTTER BLINK (shared)
    // ══════════════════════════════════
    if (uBlink > 0.01) {
        float eyeMask = smoothstep(0.005, -0.005, scleraDist);
        if (eyeMask > 0.01) {
            float shutterTravel = uBlink * EYE_RADIUS;
            float upperEdge = EYE_RADIUS - shutterTravel;
            float lowerEdge = -EYE_RADIUS + shutterTravel;

            float upperMask = smoothstep(upperEdge - 0.004, upperEdge + 0.006, uv.y) * eyeMask;
            float lowerMask = smoothstep(lowerEdge + 0.004, lowerEdge - 0.006, uv.y) * eyeMask;
            float panelMask = max(upperMask, lowerMask);

            if (panelMask > 0.01) {
                vec3 metalBase = vec3(0.42, 0.44, 0.48);
                vec3 metalDark = vec3(0.18, 0.19, 0.22);
                vec3 metalLight = vec3(0.62, 0.65, 0.70);

                float isUpper = step(0.0, uv.y);
                float edgeDistU = abs(uv.y - upperEdge);
                float edgeDistL = abs(uv.y - lowerEdge);
                float edgeDist = isUpper > 0.5 ? edgeDistU : edgeDistL;

                float depthU = (EYE_RADIUS - uv.y) / (2.0 * EYE_RADIUS);
                float depthL = (EYE_RADIUS + uv.y) / (2.0 * EYE_RADIUS);
                float panelDepth = isUpper > 0.5 ? depthU : depthL;

                vec3 metalColor = mix(metalDark, metalBase, panelDepth * 0.8 + 0.2);

                float brushH = sin(uv.y * 600.0) * 0.5 + 0.5;
                float brushF = sin(uv.y * 1400.0 + uv.x * 50.0) * 0.5 + 0.5;
                metalColor = mix(metalColor, metalLight, mix(brushH, brushF, 0.25) * 0.12);

                float bandU = smoothstep(0.003, 0.0, abs(mod(uv.y + 0.02, 0.08) - 0.04));
                float bandL = smoothstep(0.003, 0.0, abs(mod(-uv.y + 0.02, 0.08) - 0.04));
                metalColor = mix(metalColor, metalDark, (isUpper > 0.5 ? bandU : bandL) * 0.3);

                float specY = isUpper > 0.5 ? (uv.y - 0.1) : (-uv.y - 0.1);
                metalColor += vec3(0.85, 0.87, 0.92) * pow(max(0.0, 1.0 - abs(specY) * 6.0), 3.0) * 0.18
                              * (smoothstep(0.0, 0.15, abs(uv.x)) * 0.5 + 0.5);

                metalColor = mix(metalColor, vec3(0.75, 0.78, 0.82), smoothstep(0.010, 0.001, edgeDist) * 0.6);
                metalColor = mix(metalColor, vec3(0.05, 0.05, 0.07), smoothstep(0.003, 0.0, edgeDist) * 0.5);

                if (uBlink > 0.85) {
                    float seamY = (upperEdge + lowerEdge) * 0.5;
                    metalColor = mix(metalColor, vec3(0.02, 0.02, 0.03), smoothstep(0.005, 0.0, abs(uv.y - seamY)) * 0.8);
                }

                color = mix(color, metalColor, panelMask);
            }
        }
    }

    fragColor = vec4(color, 1.0);
}
`;

export class RealisticEyeRenderer {
    private gl: WebGL2RenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private currentTheme = 0;
    private nextTransitionTime = 0;

    private tSclera: WebGLTexture | null = null;
    private tIris: WebGLTexture | null = null;
    private tMetal: WebGLTexture | null = null;
    private tCrimson: WebGLTexture | null = null;

    private uTime: WebGLUniformLocation | null = null;
    private uIrisOffset: WebGLUniformLocation | null = null;
    private uDilation: WebGLUniformLocation | null = null;
    private uBlink: WebGLUniformLocation | null = null;
    private uBlush: WebGLUniformLocation | null = null;
    private uResolution: WebGLUniformLocation | null = null;
    private uTheme: WebGLUniformLocation | null = null;
    private uSentinel: WebGLUniformLocation | null = null;
    
    // Matcap uniforms
    private uMatCapSclera: WebGLUniformLocation | null = null;
    private uMatCapIris: WebGLUniformLocation | null = null;
    private uMatCapMetal: WebGLUniformLocation | null = null;
    private uMatCapCrimson: WebGLUniformLocation | null = null;

    private startTime = 0;
    private transitionPhase: 'idle' | 'closing' | 'opening' = 'idle';
    private transitionStart = 0;

    private _randomInterval() {
        return MIN_INTERVAL_S + Math.random() * (MAX_INTERVAL_S - MIN_INTERVAL_S);
    }

    private _loadTexture(gl: WebGL2RenderingContext, url: string, unit: number): WebGLTexture | null {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Placeholder
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));

        const img = new Image();
        img.onload = () => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        };
        img.src = url;
        return tex;
    }

    private _compileShader(type: number, source: string): WebGLShader | null {
        const gl = this.gl!;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader validation failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    init(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl2', {
            antialias: true,
            alpha: false,
            premultipliedAlpha: false,
        });
        if (!gl) {
            console.error('WebGL2 not supported');
            return false;
        }
        this.gl = gl;
        this.startTime = performance.now() / 1000;

        const vertShader = this._compileShader(gl.VERTEX_SHADER, VERT_SOURCE);
        const fragShader = this._compileShader(gl.FRAGMENT_SHADER, FRAG_SOURCE);
        if (!vertShader || !fragShader) return false;

        const program = gl.createProgram()!;
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return false;
        }
        this.program = program;
        gl.useProgram(program);

        this.uTime = gl.getUniformLocation(program, 'uTime');
        this.uIrisOffset = gl.getUniformLocation(program, 'uIrisOffset');
        this.uDilation = gl.getUniformLocation(program, 'uDilation');
        this.uBlink = gl.getUniformLocation(program, 'uBlink');
        this.uBlush = gl.getUniformLocation(program, 'uBlush');
        this.uResolution = gl.getUniformLocation(program, 'uResolution');
        this.uTheme = gl.getUniformLocation(program, 'uTheme');
        this.uSentinel = gl.getUniformLocation(program, 'uSentinel');

        this.uMatCapSclera = gl.getUniformLocation(program, 'uMatCapSclera');
        this.uMatCapIris = gl.getUniformLocation(program, 'uMatCapIris');
        this.uMatCapMetal = gl.getUniformLocation(program, 'uMatCapMetal');
        this.uMatCapCrimson = gl.getUniformLocation(program, 'uMatCapCrimson');

        gl.uniform1i(this.uMatCapSclera, 0);
        gl.uniform1i(this.uMatCapIris, 1);
        gl.uniform1i(this.uMatCapMetal, 2);
        gl.uniform1i(this.uMatCapCrimson, 3);

        this.tSclera = this._loadTexture(gl, '/matcaps/sclera.bmp', 0);
        this.tIris = this._loadTexture(gl, '/matcaps/iris.bmp', 1);
        this.tMetal = this._loadTexture(gl, '/matcaps/metal.bmp', 2);
        this.tCrimson = this._loadTexture(gl, '/matcaps/crimson.bmp', 3);

        const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.clearColor(0, 0, 0, 1);

        this.currentTheme = 0; // Force Classic theme to demonstrate Parallax
        this.nextTransitionTime = performance.now() / 1000 + this._randomInterval();

        return true;
    }

    render(state: EyeState) {
        const gl = this.gl;
        if (!gl || !this.program) return;

        const canvas = this.canvas!;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const now = performance.now() / 1000;
        const shaderTime = now - this.startTime;

        const blinkOverride = this._updateTransition(now);
        const blink = blinkOverride !== null ? Math.max(state.blink, blinkOverride) : state.blink;

        const normX = (state.ix / (canvas.width * 0.5)) * 3.0;
        const normY = -(state.iy / (canvas.height * 0.5)) * 3.0;

        gl.uniform1f(this.uTime, shaderTime);
        gl.uniform2f(this.uIrisOffset, normX, normY);
        gl.uniform1f(this.uDilation, state.dilation);
        gl.uniform1f(this.uBlink, blink);
        gl.uniform1f(this.uBlush, state.blush || 0);
        gl.uniform2f(this.uResolution, canvas.width, canvas.height);
        gl.uniform1i(this.uTheme, this.currentTheme);
        gl.uniform1f(this.uSentinel, state.sentinel ? 1.0 : 0.0);

        // Re-bind textures explicitly in render loop to ensure safety across states
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tSclera);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tIris);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tMetal);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tCrimson);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    getThemeName(): string { return THEME_NAMES[this.currentTheme] || 'UNKNOWN'; }
    getThemeIndex(): number { return this.currentTheme; }

    setTheme(theme: number) {
        if (theme < 0 || theme >= THEME_COUNT || theme === this.currentTheme) return;
        if (this.transitionPhase !== 'idle') return;
        this.currentTheme = theme;
        this.nextTransitionTime = performance.now() / 1000 + this._randomInterval();
    }

    resize() {
        if (!this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
    }

    destroy() {
        if (this.gl && this.program) this.gl.deleteProgram(this.program);
        this.gl = null;
        this.program = null;
    }

    private _updateTransition(now: number): number | null {
        if (this.transitionPhase === 'idle') {
            if (now >= this.nextTransitionTime) {
                this.transitionPhase = 'closing';
                this.transitionStart = now;
            }
            return null;
        }
        if (this.transitionPhase === 'closing') {
            const elapsed = (now - this.transitionStart) * 1000;
            const raw = Math.min(1, elapsed / TRANSITION_CLOSE_MS);
            const eased = raw * raw * (3 - 2 * raw);
            if (raw >= 1) {
                this._pickNextTheme();
                this.transitionPhase = 'opening';
                this.transitionStart = now;
                return 1.0;
            }
            return eased;
        }
        if (this.transitionPhase === 'opening') {
            const elapsed = (now - this.transitionStart) * 1000;
            const raw = Math.min(1, elapsed / TRANSITION_OPEN_MS);
            const eased = raw * raw * (3 - 2 * raw);
            if (raw >= 1) {
                this.transitionPhase = 'idle';
                this.nextTransitionTime = now + this._randomInterval();
                return null;
            }
            return 1 - eased;
        }
        return null;
    }

    private _pickNextTheme() {
        let next: number;
        do { next = Math.floor(Math.random() * THEME_COUNT); } while (next === this.currentTheme);
        this.currentTheme = next;
    }
}
