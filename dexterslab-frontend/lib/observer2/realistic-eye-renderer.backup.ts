/**
 * THE OBSERVER 2 — Photorealistic Eye Renderer (WebGL2)
 *
 * A single, perfected realistic eye rendered entirely via GPU shaders.
 * No textures — everything is procedurally generated:
 *
 *   Sclera      — Smooth white with subtle vein noise, edge shadow
 *   Iris        — Multi-layered stroma fibers, crypts, collarette,
 *                 limbal ring, procedural color variation
 *   Pupil       — Clean black with feathered edge, dilation-driven sizing
 *   Corneal     — Bright specular highlights that shift with gaze
 *   Wet layer   — Glossy reflection pass for depth
 *   Lid shadow  — Soft shadow from the upper lid
 *
 * Accepts EyeState from the backend and renders at 60fps.
 */

import { EyeState } from './types';

// ── Vertex shader (full-screen quad) ──
const VERT_SOURCE = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUV;
void main() {
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ── Fragment shader (the entire eye) ──
const FRAG_SOURCE = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

// Uniforms from eye state
uniform float uTime;
uniform vec2 uIrisOffset;    // normalized iris center offset (-1..1)
uniform float uDilation;     // pupil dilation (0.5 - 1.8)
uniform float uBlink;        // lid closure (0=open, 1=closed)
uniform float uBlush;        // blush intensity
uniform vec2 uResolution;    // canvas size

// ── Constants ──
const float EYE_RADIUS = 0.42;
const float IRIS_RADIUS = 0.155;
const float PUPIL_BASE = 0.055;
const float LIMBAL_WIDTH = 0.008;
const float COLLARETTE_RADIUS = 0.09;

// ── Noise functions ──
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.01;
    f += 0.2500 * noise(p); p *= 2.02;
    f += 0.1250 * noise(p); p *= 2.03;
    f += 0.0625 * noise(p);
    return f;
}

// ── Smooth circle SDF ──
float circleSDF(vec2 p, vec2 center, float radius) {
    return length(p - center) - radius;
}

void main() {
    // Aspect-correct coordinates centered at (0,0)
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUV - 0.5) * aspect;

    // Iris center offset (mapped from pixel to UV space)
    // 0.22 = balanced: clearly tracking but iris stays within the eye
    vec2 irisCenter = uIrisOffset * 0.22;

    // ═══════════════════════════════════════
    //  BACKGROUND (pure black)
    // ═══════════════════════════════════════
    vec3 color = vec3(0.0);
    float alpha = 1.0;

    // ═══════════════════════════════════════
    //  SCLERA (white of the eye)
    // ═══════════════════════════════════════
    float scleraDist = circleSDF(uv, vec2(0.0), EYE_RADIUS);

    if (scleraDist < 0.0) {
        // Base white with warmth
        vec3 scleraBase = vec3(0.97, 0.95, 0.93);

        // Edge shadow (limbus shadow + curvature)
        float edgeFactor = smoothstep(-0.02, -EYE_RADIUS * 0.85, scleraDist);
        vec3 edgeShadow = vec3(0.82, 0.78, 0.76);
        scleraBase = mix(scleraBase, edgeShadow, edgeFactor * 0.6);

        // Upper lid shadow
        float lidShadow = smoothstep(0.12, -0.15, uv.y) * 0.25;
        scleraBase -= lidShadow;

        // Subtle veins (red/pink noise)
        float veinNoise = fbm(uv * 25.0 + vec2(uTime * 0.01, 0.0));
        float veinMask = smoothstep(0.55, 0.7, veinNoise);
        // Only show veins near edges, fading toward center
        float veinEdge = smoothstep(-EYE_RADIUS * 0.3, -EYE_RADIUS * 0.8, scleraDist);
        vec3 veinColor = vec3(0.85, 0.55, 0.5);
        scleraBase = mix(scleraBase, veinColor, veinMask * veinEdge * 0.15);

        // Subtle wet specular on sclera
        float wetHighlight = pow(max(0.0, 1.0 - length(uv - vec2(0.08, -0.12))), 8.0) * 0.12;
        scleraBase += wetHighlight;

        color = scleraBase;
    }

    // ═══════════════════════════════════════
    //  IRIS
    // ═══════════════════════════════════════
    float irisDist = circleSDF(uv, irisCenter, IRIS_RADIUS);

    if (irisDist < 0.0 && scleraDist < 0.0) {
        // Polar coordinates relative to iris center
        vec2 irisUV = uv - irisCenter;
        float r = length(irisUV) / IRIS_RADIUS;
        float theta = atan(irisUV.y, irisUV.x);

        // ── Limbal ring (dark outer border) ──
        float limbalMask = smoothstep(0.0, LIMBAL_WIDTH / IRIS_RADIUS, -irisDist / IRIS_RADIUS);
        vec3 limbalColor = vec3(0.12, 0.08, 0.05);

        // ── Base iris color (blue-grey) ──
        vec3 irisBase = vec3(0.25, 0.45, 0.6);
        vec3 irisDeep = vec3(0.1, 0.2, 0.35);

        // Radial color gradient (darker toward pupil)
        float radialGrad = smoothstep(0.3, 0.95, r);
        vec3 irisColor = mix(irisDeep, irisBase, radialGrad);

        // ── Stroma fibers (radial lines) ──
        float fiberCount = 120.0;
        float fiber = sin(theta * fiberCount) * 0.5 + 0.5;
        fiber = pow(fiber, 3.0);
        // Modulate fiber with radius (stronger further from pupil)
        float fiberStrength = smoothstep(0.25, 0.5, r) * (1.0 - smoothstep(0.85, 1.0, r));
        vec3 fiberColor = vec3(0.35, 0.55, 0.72);
        irisColor = mix(irisColor, fiberColor, fiber * fiberStrength * 0.35);

        // ── Crypts (darker irregular patches) ──
        float cryptNoise = fbm(vec2(theta * 4.0, r * 8.0) + 42.0);
        float cryptMask = smoothstep(0.45, 0.6, cryptNoise) * smoothstep(0.3, 0.5, r) * (1.0 - smoothstep(0.8, 1.0, r));
        vec3 cryptColor = vec3(0.08, 0.15, 0.22);
        irisColor = mix(irisColor, cryptColor, cryptMask * 0.4);

        // ── Collarette ring (darker band around pupil) ──
        float collaretteR = COLLARETTE_RADIUS / IRIS_RADIUS;
        float collaretteMask = 1.0 - smoothstep(0.0, 0.06, abs(r - collaretteR));
        vec3 collaretteColor = vec3(0.18, 0.3, 0.42);
        irisColor = mix(irisColor, collaretteColor, collaretteMask * 0.5);

        // ── Color variation rings (concentric subtle hue shifts) ──
        float ringVar = sin(r * 30.0) * 0.5 + 0.5;
        irisColor += vec3(0.03, 0.02, -0.01) * ringVar * 0.3;

        // ── Apply limbal ring ──
        irisColor = mix(irisColor, limbalColor, (1.0 - limbalMask) * 0.8);

        // ── Subsurface scattering (warm glow at edges) ──
        float sss = pow(1.0 - abs(r - 0.75), 4.0) * 0.08;
        irisColor += vec3(0.15, 0.08, 0.02) * sss;

        color = irisColor;
    }

    // ═══════════════════════════════════════
    //  PUPIL
    // ═══════════════════════════════════════
    float pupilRadius = PUPIL_BASE * uDilation;
    float pupilDist = circleSDF(uv, irisCenter, pupilRadius);

    if (pupilDist < 0.0 && scleraDist < 0.0) {
        // Feathered edge for realism
        float feather = smoothstep(0.0, 0.004, -pupilDist);
        color = mix(color, vec3(0.01, 0.01, 0.015), feather);
    }

    // ═══════════════════════════════════════
    //  CORNEAL REFLECTIONS (specular highlights)
    // ═══════════════════════════════════════
    if (scleraDist < 0.0) {
        // Primary light source (large window/light)
        // Primary light source (large window/light) — shifts with iris
        vec2 specPos1 = vec2(0.06 + irisCenter.x * 0.5, -0.09 + irisCenter.y * 0.4);
        float spec1 = pow(max(0.0, 1.0 - length(uv - specPos1) / 0.035), 3.0);

        // Secondary smaller highlight
        vec2 specPos2 = vec2(-0.04 + irisCenter.x * 0.35, 0.03 + irisCenter.y * 0.3);
        float spec2 = pow(max(0.0, 1.0 - length(uv - specPos2) / 0.015), 4.0);

        // Apply highlights
        color += vec3(1.0, 0.98, 0.95) * spec1 * 0.9;
        color += vec3(0.9, 0.92, 1.0) * spec2 * 0.5;
    }

    // ═══════════════════════════════════════
    //  WET LAYER (overall corneal sheen)
    // ═══════════════════════════════════════
    if (scleraDist < 0.0) {
        // Subtle overall glossy reflection
        float wetAngle = atan(uv.y, uv.x);
        float wetGloss = pow(max(0.0, 1.0 - abs(uv.y + 0.05)), 12.0) * 0.04;
        color += wetGloss;
    }

    // ═══════════════════════════════════════
    //  ANTI-ALIASED SCLERA EDGE
    // ═══════════════════════════════════════
    if (scleraDist > -0.005 && scleraDist < 0.005) {
        float edgeAA = smoothstep(0.003, -0.003, scleraDist);
        color *= edgeAA;
    } else if (scleraDist >= 0.005) {
        color = vec3(0.0);
    }

    // ═══════════════════════════════════════
    //  METALLIC SHUTTER BLINK
    //  Two horizontal metal panels close from top/bottom
    //  Like robotic eyelids — mechanical version of a human blink
    // ═══════════════════════════════════════
    if (uBlink > 0.01) {
        float eyeMask = smoothstep(0.005, -0.005, scleraDist);

        if (eyeMask > 0.01) {
            // How far the shutters have closed toward center
            // At uBlink=0: edges are at ±EYE_RADIUS (fully retracted behind rim)
            // At uBlink=1: edges meet at y=0 (fully closed)
            float shutterTravel = uBlink * EYE_RADIUS;
            float upperEdge = EYE_RADIUS - shutterTravel;    // starts at top, moves DOWN
            float lowerEdge = -EYE_RADIUS + shutterTravel;   // starts at bottom, moves UP

            // Upper panel: covers from top of eye DOWN to upperEdge
            // When uv.y is ABOVE upperEdge, the panel is there
            float upperMask = smoothstep(upperEdge - 0.004, upperEdge + 0.006, uv.y) * eyeMask;
            // Lower panel: covers from bottom of eye UP to lowerEdge  
            // When uv.y is BELOW lowerEdge, the panel is there
            float lowerMask = smoothstep(lowerEdge + 0.004, lowerEdge - 0.006, uv.y) * eyeMask;

            // Combined panel mask
            float panelMask = max(upperMask, lowerMask);

            if (panelMask > 0.01) {
                // === METAL MATERIAL ===
                vec3 metalBase = vec3(0.42, 0.44, 0.48);
                vec3 metalDark = vec3(0.18, 0.19, 0.22);
                vec3 metalLight = vec3(0.62, 0.65, 0.70);

                // Determine which panel this pixel belongs to
                float isUpper = step(0.0, uv.y);

                // Distance from the panel's leading edge (for gradient)
                float edgeDistUpper = abs(uv.y - upperEdge);
                float edgeDistLower = abs(uv.y - lowerEdge);
                float edgeDist = isUpper > 0.5 ? edgeDistUpper : edgeDistLower;

                // Distance from panel's home edge (outer rim)
                float depthUpper = (EYE_RADIUS - uv.y) / (2.0 * EYE_RADIUS);
                float depthLower = (EYE_RADIUS + uv.y) / (2.0 * EYE_RADIUS);
                float panelDepth = isUpper > 0.5 ? depthUpper : depthLower;

                // Vertical gradient: darker near leading edge, lighter near housing
                vec3 metalColor = mix(metalDark, metalBase, panelDepth * 0.8 + 0.2);

                // === BRUSHED METAL TEXTURE ===
                // Horizontal machining lines (like real brushed steel)
                float brushH = sin(uv.y * 600.0) * 0.5 + 0.5;
                float brushFine = sin(uv.y * 1400.0 + uv.x * 50.0) * 0.5 + 0.5;
                float brushMark = mix(brushH, brushFine, 0.25);
                metalColor = mix(metalColor, metalLight, brushMark * 0.12);

                // Subtle horizontal bands (panel segments)
                float bandUpper = smoothstep(0.003, 0.0, abs(mod(uv.y + 0.02, 0.08) - 0.04));
                float bandLower = smoothstep(0.003, 0.0, abs(mod(-uv.y + 0.02, 0.08) - 0.04));
                float band = isUpper > 0.5 ? bandUpper : bandLower;
                metalColor = mix(metalColor, metalDark, band * 0.3);

                // === SPECULAR HIGHLIGHT ===
                // Overhead light reflecting off the flat metal surface
                float specY = isUpper > 0.5 ? (uv.y - 0.1) : (-uv.y - 0.1);
                float spec = pow(max(0.0, 1.0 - abs(specY) * 6.0), 3.0);
                spec *= smoothstep(0.0, 0.15, abs(uv.x)) * 0.5 + 0.5;  // wider in center
                metalColor += vec3(0.85, 0.87, 0.92) * spec * 0.18;

                // === LEADING EDGE HIGHLIGHT ===
                // Bright chamfered edge where the panel meets the eye
                float leadingHighlight = smoothstep(0.010, 0.001, edgeDist);
                vec3 edgeColor = vec3(0.75, 0.78, 0.82);
                metalColor = mix(metalColor, edgeColor, leadingHighlight * 0.6);

                // Thin dark gap line at the very leading edge
                float gapLine = smoothstep(0.003, 0.0, edgeDist);
                metalColor = mix(metalColor, vec3(0.05, 0.05, 0.07), gapLine * 0.5);

                // === CENTER SEAM ===
                // When nearly closed, show the seam where panels meet
                if (uBlink > 0.85) {
                    float seamY = (upperEdge + lowerEdge) * 0.5;
                    float seam = smoothstep(0.005, 0.0, abs(uv.y - seamY));
                    metalColor = mix(metalColor, vec3(0.02, 0.02, 0.03), seam * 0.8);
                }

                // === RIVET DETAILS ===
                // Small circular rivets along each panel for mechanical feel
                float rivetSpacing = 0.12;
                float rivetY = isUpper > 0.5 ? (upperEdge + 0.04) : (lowerEdge - 0.04);
                for (float rx = -0.3; rx <= 0.3; rx += rivetSpacing) {
                    float rivetDist = length(uv - vec2(rx, rivetY));
                    float rivet = smoothstep(0.008, 0.005, rivetDist);
                    float rivetHighlight = smoothstep(0.007, 0.005, rivetDist) *
                                           smoothstep(0.004, 0.005, rivetDist);
                    metalColor = mix(metalColor, metalDark * 0.8, rivet * 0.4);
                    metalColor += vec3(0.5) * rivetHighlight * 0.15;
                }

                // === SHADOW ON EYE SURFACE ===
                // Panels cast a subtle shadow just ahead of their leading edge
                float shadowUpper = smoothstep(upperEdge + 0.025, upperEdge, uv.y) * (1.0 - upperMask);
                float shadowLower = smoothstep(lowerEdge - 0.025, lowerEdge, uv.y) * (1.0 - lowerMask);
                color *= 1.0 - (shadowUpper + shadowLower) * 0.2 * eyeMask;

                // === COMPOSITE ===
                color = mix(color, metalColor, panelMask * 0.97);
            }
        }
    }

    // ═══════════════════════════════════════
    //  BLUSH MARKS
    // ═══════════════════════════════════════
    if (uBlush > 0.01) {
        float blushY = -0.12;
        float blushSpread = 0.15;
        float blushLeft = smoothstep(0.04, 0.0, length(uv - vec2(-blushSpread, blushY)));
        float blushRight = smoothstep(0.04, 0.0, length(uv - vec2(blushSpread, blushY)));
        vec3 blushColor = vec3(1.0, 0.4, 0.45);
        color = mix(color, blushColor, (blushLeft + blushRight) * uBlush * 0.35);
    }

    fragColor = vec4(color, 1.0);
}`;

export class RealisticEyeRenderer {
    private gl: WebGL2RenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private canvas: HTMLCanvasElement | null = null;

    // Uniform locations
    private uTime = -1;
    private uIrisOffset = -1;
    private uDilation = -1;
    private uBlink = -1;
    private uBlush = -1;
    private uResolution = -1;

    // Animation state
    private startTime = 0;

    /**
     * Initialize WebGL2 on the given canvas.
     */
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

        // Compile shaders
        const vertShader = this._compileShader(gl.VERTEX_SHADER, VERT_SOURCE);
        const fragShader = this._compileShader(gl.FRAGMENT_SHADER, FRAG_SOURCE);
        if (!vertShader || !fragShader) return false;

        // Link program
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

        // Get uniform locations
        this.uTime = gl.getUniformLocation(program, 'uTime') as number;
        this.uIrisOffset = gl.getUniformLocation(program, 'uIrisOffset') as number;
        this.uDilation = gl.getUniformLocation(program, 'uDilation') as number;
        this.uBlink = gl.getUniformLocation(program, 'uBlink') as number;
        this.uBlush = gl.getUniformLocation(program, 'uBlush') as number;
        this.uResolution = gl.getUniformLocation(program, 'uResolution') as number;

        // Full-screen quad (2 triangles)
        const quadVerts = new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1,
        ]);
        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Set clear color
        gl.clearColor(0, 0, 0, 1);

        console.log('👁 WebGL2 Realistic Eye Renderer initialized');
        return true;
    }

    /**
     * Render one frame with the given eye state.
     */
    render(state: EyeState) {
        const gl = this.gl;
        if (!gl || !this.program) return;

        const canvas = this.canvas!;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const now = performance.now() / 1000 - this.startTime;

        // Map eye state to shader uniforms
        // ix/iy are pixel offsets, normalize to -1..1 range based on canvas size
        // 3.0x amplification — balanced tracking visibility
        const normX = (state.ix / (canvas.width * 0.5)) * 3.0;
        const normY = -(state.iy / (canvas.height * 0.5)) * 3.0; // flip Y for GL

        gl.uniform1f(this.uTime, now);
        gl.uniform2f(this.uIrisOffset, normX, normY);
        gl.uniform1f(this.uDilation, state.dilation);
        gl.uniform1f(this.uBlink, state.blink);
        gl.uniform1f(this.uBlush, state.blush || 0);
        gl.uniform2f(this.uResolution, canvas.width, canvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * Resize the canvas to match the window.
     */
    resize() {
        if (!this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
    }

    destroy() {
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }
        this.gl = null;
        this.program = null;
    }

    // ── Private shader compilation ──
    private _compileShader(type: number, source: string): WebGLShader | null {
        const gl = this.gl!;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}
