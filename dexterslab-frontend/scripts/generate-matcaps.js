const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../public/matcaps');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function writeBMP(filename, width, height, getPixelRGB) {
    const rowBytes = Math.floor((width * 3 + 3) / 4) * 4;
    const padding = rowBytes - (width * 3);
    const pixelDataSize = rowBytes * height;
    const fileSize = 54 + pixelDataSize;
    const buf = Buffer.alloc(fileSize);

    // Header
    buf.write('BM', 0);
    buf.writeUInt32LE(fileSize, 2);
    buf.writeUInt32LE(0, 6);
    buf.writeUInt32LE(54, 10); // Offset

    // DIB
    buf.writeUInt32LE(40, 14);
    buf.writeInt32LE(width, 18);
    buf.writeInt32LE(height, 22); // Positive height = bottom-up
    buf.writeUInt16LE(1, 26);
    buf.writeUInt16LE(24, 28);
    buf.writeUInt32LE(0, 30);
    buf.writeUInt32LE(pixelDataSize, 34);
    buf.writeInt32LE(2835, 38);
    buf.writeInt32LE(2835, 42);
    buf.writeUInt32LE(0, 46);
    buf.writeUInt32LE(0, 50);

    let offset = 54;
    // Note: BMP stores rows Bottom-Up.
    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            // map [0, width-1] -> [-1, 1]
            let nx = (x / (width - 1)) * 2.0 - 1.0;
            let ny = (y / (height - 1)) * 2.0 - 1.0;
            let distSq = nx*nx + ny*ny;
            
            let r=0, g=0, b=0;
            if (distSq <= 1.0) {
                let nz = Math.sqrt(1.0 - distSq);
                [r, g, b] = getPixelRGB(nx, ny, nz);
            }

            buf.writeUInt8(Math.max(0, Math.min(255, b)), offset + 0);
            buf.writeUInt8(Math.max(0, Math.min(255, g)), offset + 1);
            buf.writeUInt8(Math.max(0, Math.min(255, r)), offset + 2);
            offset += 3;
        }
        offset += padding;
    }

    fs.writeFileSync(path.join(outDir, filename), buf);
    console.log(`Generated ${filename}`);
}

const w = 256;
const h = 256;

// 1. Sclera (White eye globe with soft top-down lighting and wet specular)
writeBMP('sclera.bmp', w, h, (nx, ny, nz) => {
    // Diffuse wrap lighting
    let diffuse = Math.max(0, (ny * 0.5 + nz * 0.8));
    diffuse = diffuse * 0.5 + 0.5; // soft wrap
    let base = [255 * diffuse * 0.98, 250 * diffuse * 0.96, 245 * diffuse * 0.94];
    
    // Specular (wet reflection)
    let viewDir = [0, 0, 1];
    let lightDir = [0.2, 0.4, 0.9];
    // Normalize lightDir
    let lMag = Math.sqrt(lightDir[0]**2 + lightDir[1]**2 + lightDir[2]**2);
    lightDir = lightDir.map(v => v/lMag);
    
    // Half vector
    let hx = viewDir[0] + lightDir[0];
    let hy = viewDir[1] + lightDir[1];
    let hz = viewDir[2] + lightDir[2];
    let hMag = Math.sqrt(hx*hx + hy*hy + hz*hz);
    hx/=hMag; hy/=hMag; hz/=hMag;
    
    let nDotH = Math.max(0, nx*hx + ny*hy + nz*hz);
    let spec = Math.pow(nDotH, 64.0); // sharp pinpoint
    
    // Ambient Occlusion from eyelids (darken top and bottom)
    let ao = Math.pow(Math.abs(ny), 2.0); // 1 at poles, 0 at equator
    let aoFactor = 1.0 - ao * 0.6; // Darken poles by 60%
    
    base[0] = (base[0] + spec * 255) * aoFactor;
    base[1] = (base[1] + spec * 255) * aoFactor;
    base[2] = (base[2] + spec * 255) * aoFactor;
    
    return base;
});

// 2. Iris (Vibrant Ocean Blue/Green with deep pupil and stylized radial fibers)
writeBMP('iris.bmp', w, h, (nx, ny, nz) => {
    let r = Math.sqrt(nx*nx + ny*ny);
    let angle = Math.atan2(ny, nx);
    
    if (r < 0.15) return [0, 0, 0]; // Deep pupil area
    
    // Radial fibers
    let fiber = Math.sin(angle * 60) * 0.5 + 0.5;
    fiber = Math.pow(fiber, 3.0) * 0.3;
    
    let base = [0, 120, 200]; // Deep azure base
    if (r < 0.3) {
        // Collarette (inner ring)
        base = [50, 200, 220]; // Cyan/Teal glow
    } else {
        base[0] += fiber * 100;
        base[1] += fiber * 150;
        base[2] += fiber * 200;
    }
    
    // Limbal ring (dark edge)
    let edge = Math.max(0, r - 0.8) / 0.2;
    base[0] *= (1.0 - edge * 0.8);
    base[1] *= (1.0 - edge * 0.8);
    base[2] *= (1.0 - edge * 0.8);

    // Deep set shading (shadow cast from cornea lip onto the iris bowl)
    let depthShadow = Math.max(0, 1.0 - r);
    base[0] *= depthShadow;
    base[1] *= depthShadow;
    base[2] *= depthShadow;
    
    return base;
});

// 3. Gunmetal (HAL-9000 Housing)
writeBMP('metal.bmp', w, h, (nx, ny, nz) => {
    // Brushed metal effect
    let brush = (Math.sin(nx * 300) * Math.cos(ny * 200)) * 0.1 + 0.9;
    let diffuse = Math.max(0, nz);
    let color = [40 * diffuse * brush, 45 * diffuse * brush, 55 * diffuse * brush];
    
    // Specular highlight
    let spec = Math.pow(Math.max(0, ny * 0.7 + nz * 0.7), 24.0);
    color[0] += spec * 150;
    color[1] += spec * 150;
    color[2] += spec * 160;
    
    return color;
});

// 4. Crimson Core (HAL-9000 Lens)
writeBMP('crimson.bmp', w, h, (nx, ny, nz) => {
    let r = Math.sqrt(nx*nx + ny*ny);
    // Glowing hot center
    let centerGlow = Math.pow(Math.max(0, 1.0 - r * 1.5), 2.0);
    let base = [150 + centerGlow * 105, 10 + centerGlow * 200, 10 + centerGlow * 200];
    
    // Edge refraction reflection
    let fresnel = Math.pow(1.0 - Math.max(0, nz), 4.0);
    base[0] += fresnel * 100;
    
    return base;
});
