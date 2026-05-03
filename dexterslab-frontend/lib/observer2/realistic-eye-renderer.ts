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

const float EYE_RADIUS = 0.48;
const float IRIS_RADIUS = 0.175;
const float PUPIL_BASE = 0.062;
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
//  THEME 0: CRYSTAL GLASS EYE
// ════════════════════════════════════
vec3 themeClassic(vec2 uv, vec2 ic, float pupilR, float sd) {
    // ── 1. SCLERA ──
    vec3 nSclera = calculateSphereNormal(uv, vec2(0.0), EYE_RADIUS);
    vec3 col = getMatcap(uMatCapSclera, nSclera);

    // Healthy vein pattern — subtle branching from periphery
    float vDist = length(uv);
    float vAng = atan(uv.y, uv.x);
    float veinZone = smoothstep(IRIS_RADIUS * 1.15, IRIS_RADIUS * 2.2, vDist)
                   * smoothstep(EYE_RADIUS, EYE_RADIUS * 0.55, vDist);
    float v1 = smoothstep(0.007, 0.0, abs(sin(vAng * 4.0 + cos(vAng * 9.0) * 0.8) * 0.03
               + vDist - EYE_RADIUS * 0.72));
    float v2 = smoothstep(0.005, 0.0, abs(sin(vAng * 7.0 + 1.5 + sin(vAng * 13.0) * 0.4) * 0.02
               + vDist - EYE_RADIUS * 0.65));
    float v3 = smoothstep(0.003, 0.0, abs(sin(vAng * 11.0 - 0.8 + cos(vAng * 5.0) * 0.6) * 0.015
               + vDist - EYE_RADIUS * 0.78));
    col += vec3(0.2, 0.03, 0.01) * (v1 * 0.6 + v2 * 0.4 + v3 * 0.25) * veinZone * 0.08;

    // Subsurface warmth near iris border
    float scleraEdge = smoothstep(IRIS_RADIUS * 1.8, IRIS_RADIUS * 1.05, length(uv - ic));
    col += vec3(0.06, 0.015, 0.015) * scleraEdge;

    // ── 2. CRYSTAL GLASS IRIS ──
    vec2 irisUV = calculateParallax(uv, ic, 0.08);
    float irisDist = circleSDF(irisUV, ic, IRIS_RADIUS);
    float irisBlend = smoothstep(0.005, -0.005, irisDist);

    if (irisBlend > 0.001) {
        vec3 nIris = calculateBowlNormal(irisUV, ic, IRIS_RADIUS);
        vec3 irisCol = getMatcap(uMatCapIris, nIris);

        float theta = atan(irisUV.y - ic.y, irisUV.x - ic.x);
        float irisR = length(irisUV - ic);
        float normR = irisR / IRIS_RADIUS;

        // ── Color bands (gold inner → base → dark outer) ──
        float innerRing = smoothstep(0.45, 0.12, normR);
        float outerRing = smoothstep(0.55, 0.92, normR);
        irisCol = mix(irisCol, irisCol * vec3(1.8, 1.4, 0.5), innerRing * 0.45);
        irisCol = mix(irisCol, irisCol * vec3(0.3, 0.35, 0.5), outerRing * 0.5);

        // ── Prismatic iridescence (crystal refraction) ──
        float prismPhase = theta * 2.0 + normR * 6.0 + uTime * 0.08;
        vec3 prism = vec3(
            sin(prismPhase) * 0.5 + 0.5,
            sin(prismPhase + 2.094) * 0.5 + 0.5,
            sin(prismPhase + 4.189) * 0.5 + 0.5
        );
        irisCol = mix(irisCol, irisCol * (prism * 0.6 + 0.7), 0.18);

        // ── Clear radial fibers (35% intensity — visible) ──
        float fiber = sin(theta * 80.0) * 0.5 + 0.5;
        float finerFiber = sin(theta * 160.0 + 5.0) * 0.5 + 0.5;
        float fiberMask = smoothstep(0.12, 0.82, normR);
        irisCol = mix(irisCol, irisCol * 0.5, fiber * 0.35 * fiberMask);
        irisCol = mix(irisCol, irisCol * 1.35, finerFiber * 0.12 * fiberMask);

        // ── Tech: iris color pulse (warm↔cool ~12s cycle) ──
        float techPulse = sin(uTime * 0.52) * 0.5 + 0.5;
        irisCol *= mix(vec3(1.06, 0.98, 0.92), vec3(0.92, 0.98, 1.06), techPulse);

        // ── Tech: digital micro-flicker ──
        float flickerSeed = fract(uTime * 0.33);
        float flicker = step(0.96, flickerSeed) * (sin(uTime * 180.0) * 0.5 + 0.5);
        irisCol *= 1.0 + flicker * 0.5;

        // ── Limbal ring (realistic gradual darkening) ──
        float limbalRing = smoothstep(0.72, 1.0, normR);
        irisCol *= mix(1.0, 0.12, limbalRing);

        // ── PUPIL (rendered in iris UV space — fixes blue circle bug) ──
        float sPulse = sin(uTime * 2.5) * 0.15 + 1.0;
        float effPupilR = mix(pupilR, pupilR * sPulse, uSentinel);
        float pupilSDF = length(irisUV - ic) - effPupilR;
        float pupilMask = smoothstep(0.005, -0.005, pupilSDF);

        // Faint pupil glow — cool inner light
        float glowFalloff = exp(-irisR * irisR * 600.0);
        vec3 pupilCore = vec3(0.008, 0.012, 0.02) + vec3(0.015, 0.02, 0.035) * glowFalloff;

        // Tech: pupil scan line
        float scanY = sin(uTime * PI * 0.5) * effPupilR * 0.7;
        float scanLine = smoothstep(0.002, 0.0, abs(irisUV.y - ic.y - scanY)) * pupilMask;
        pupilCore += vec3(0.02, 0.03, 0.05) * scanLine;

        irisCol = mix(irisCol, pupilCore, pupilMask);

        col = mix(col, irisCol, irisBlend);
    }

    // ── 3. CORNEA SPECULAR (glass dome) ──
    vec2 corneaUV = calculateParallax(uv, -ic, 0.04);
    vec3 nCornea = calculateSphereNormal(corneaUV, ic, IRIS_RADIUS * 1.1);
    vec3 ld1 = normalize(vec3(0.5, 0.6, 0.9));
    float spec1 = pow(max(0.0, dot(nCornea, ld1)), 80.0);
    vec3 ld2 = normalize(vec3(-0.4, 0.3, 0.6));
    float spec2 = pow(max(0.0, dot(nCornea, ld2)), 40.0);
    float cMask = smoothstep(0.02, 0.0, circleSDF(uv, ic, IRIS_RADIUS * 1.08));
    col += vec3(1.0, 0.97, 0.93) * spec1 * 1.6 * cMask;
    col += vec3(0.85, 0.88, 1.0) * spec2 * 0.8 * cMask;

    // ── 4. TEAR FILM ──
    vec3 wetDir = normalize(vec3(0.25, 0.65, 0.75));
    float wetSpec = pow(max(0.0, dot(nSclera, wetDir)), 50.0);
    col += vec3(1.0, 0.99, 0.97) * wetSpec * 0.6;

    // ── 5. PRISMATIC FLASH on focus change ──
    float focusMag = length(ic);
    float flashZone = smoothstep(0.005, -0.005, irisDist);
    float flashIntensity = smoothstep(0.08, 0.2, focusMag) * flashZone;
    float flashTheta = atan(uv.y - ic.y, uv.x - ic.x);
    vec3 flashRainbow = vec3(
        sin(flashTheta * 3.0) * 0.5 + 0.5,
        sin(flashTheta * 3.0 + 2.094) * 0.5 + 0.5,
        sin(flashTheta * 3.0 + 4.189) * 0.5 + 0.5
    );
    col += flashRainbow * flashIntensity * 0.12;

    return col;
}

// ════════════════════════════════════
//  THEME 1: HAL-9000 (Reserved — redirects to Crystal)
// ════════════════════════════════════
vec3 themeHAL(vec2 uv, vec2 ic, float pupilR, float sd) {
    return themeClassic(uv, ic, pupilR, sd);
}

// ════════════════════════════════════
//  THEME 2: OBSIDIAN VOID (Reserved — redirects to Crystal)
// ════════════════════════════════════
vec3 themeVoid(vec2 uv, vec2 ic, float pupilR, float sd) {
    return themeClassic(uv, ic, pupilR, sd);
}

// ════════════════════════════════════
//  THEME 3: VECTOR RETICLE (Reserved — redirects to Crystal)
// ════════════════════════════════════
vec3 themeReticle(vec2 uv, vec2 ic, float pupilR, float sd) {
    return themeClassic(uv, ic, pupilR, sd);
}

void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUV - 0.5) * aspect;

    // ══════════════════════════════════════════
    //  DISTORTION PROTOCOL — Decaying Hardware
    //  Pre-render UV distortions
    // ══════════════════════════════════════════

    float t = uTime;

    // ── Frame jitter — whole-image micro-shift (~every 0.3s chance) ──
    float jSeed = floor(t * 3.0);
    float jChance = step(0.86, fract(sin(jSeed * 91.3) * 43.7));
    uv += vec2(
        (fract(sin(jSeed * 17.1) * 43.7) - 0.5) * 0.005,
        (fract(sin(jSeed * 31.3) * 17.1) - 0.5) * 0.003
    ) * jChance;

    // ── Horizontal tear — shift a strip sideways (~every 5-8s) ──
    float tearCycle = floor(t * 0.18);
    float tearActive = step(0.82, fract(sin(tearCycle * 43.1) * 17.3));
    float tearY = (fract(sin(tearCycle * 71.7) * 31.5) - 0.5) * 0.8;
    float inTearBand = (1.0 - smoothstep(0.0, 0.035, abs(uv.y - tearY))) * tearActive;
    float tearDir = fract(sin(tearCycle * 13.7) * 97.1) - 0.5;
    uv.x += inTearBand * tearDir * 0.07;

    // ── Pixelation burst — momentary resolution drop (~every 8-12s) ──
    float pixCycle = floor(t * 0.12);
    float pixActive = step(0.88, fract(sin(pixCycle * 67.3) * 29.1));
    if (pixActive > 0.5) {
        float pixS = 0.014;
        uv = floor(uv / pixS) * pixS + pixS * 0.5;
    }

    // ══════════════════════════════════════════
    //  EYE RENDERING (with distorted UVs)
    // ══════════════════════════════════════════

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

    // ══════════════════════════════════════════════
    //  DISTORTION PROTOCOL — Post-Processing
    //  CRT / VHS / Signal Decay
    // ══════════════════════════════════════════════

    // ── CRT scan lines — subtle horizontal darkening ──
    float scanFreq = vUV.y * uResolution.y * 0.8;
    float scanline = sin(scanFreq * PI) * 0.5 + 0.5;
    color *= 0.87 + 0.13 * scanline;

    // ── Signal noise — static grain ──
    float grain = fract(sin(dot(vUV * 997.0 + t * 7.13, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.03;

    // ── VHS tracking band — horizontal interference line drifting down ──
    float trackY = fract(t * 0.06);
    float trackBand = smoothstep(0.02, 0.0, abs(vUV.y - trackY));
    color = mix(color, vec3(0.6, 0.6, 0.65), trackBand * 0.25);

    // ── Chromatic aberration — RGB channel split during glitch events ──
    float caActive = max(tearActive, jChance);
    float caDist = length(vUV - 0.5);
    float caStrength = caActive * 0.018 + 0.003; // always-on subtle + boost during glitch
    color.r *= 1.0 + caDist * caStrength * 4.0;
    color.b *= 1.0 - caDist * caStrength * 4.0;
    // Slight green shift on tear band
    color.g *= 1.0 + inTearBand * 0.08;

    // ── Brightness flicker — random frame dimming ──
    float fSeed = floor(t * 5.0);
    float fChance = step(0.91, fract(sin(fSeed * 53.7) * 29.3));
    color *= 1.0 - fChance * 0.18;

    // ── Horizontal interlace — alternating line brightness ──
    float interlace = step(0.5, fract(vUV.y * uResolution.y * 0.5));
    color *= 0.97 + 0.03 * interlace;

    // ── CRT vignette — darker edges like a curved display ──
    float vigDist = length(vUV - 0.5) * 1.8;
    color *= smoothstep(1.3, 0.35, vigDist);

    // ── Phosphor warmth — slight amber CRT tint ──
    color *= vec3(0.98, 1.0, 0.95);

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
    private smoothDilation = 1.0;
    private lastRenderTime = 0;

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

        // Light dilation smoothing — backend spring handles main interpolation,
        // this just prevents any visual stutter from network jitter
        const dt = this.lastRenderTime > 0 ? Math.min(now - this.lastRenderTime, 0.1) : 0.016;
        this.lastRenderTime = now;
        const dilationSpeed = 8.0; // units/sec — fast pass-through, backend does the real work
        this.smoothDilation += (state.dilation - this.smoothDilation) * Math.min(1, dt * dilationSpeed);

        const blinkOverride = this._updateTransition(now);
        const blink = blinkOverride !== null ? Math.max(state.blink, blinkOverride) : state.blink;

        const normX = (state.ix / (canvas.width * 0.5)) * 3.0;
        const normY = -(state.iy / (canvas.height * 0.5)) * 3.0;

        gl.uniform1f(this.uTime, shaderTime);
        gl.uniform2f(this.uIrisOffset, normX, normY);
        gl.uniform1f(this.uDilation, this.smoothDilation);
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
