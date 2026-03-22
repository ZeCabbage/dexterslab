#!/usr/bin/env node
/**
 * Camera Motion Tracker — Lightweight V4L2 camera capture + motion detection.
 * Runs on the Pi, captures frames via ffmpeg, analyzes motion, and broadcasts
 * entity tracking data via WebSocket on port 8765.
 *
 * Architecture:
 *   ffmpeg (V4L2 /dev/video4) → raw frame pipe → Node.js → motion detection
 *   → entity tracking → WebSocket broadcast to Eye frontend
 *
 * Zero npm dependencies beyond Node.js built-ins.
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const crypto = require('crypto');

// ── Config ──
const CAPTURE_WIDTH = 160;
const CAPTURE_HEIGHT = 120;
const FPS = 10;
const WS_PORT = 8765;
const MOTION_THRESHOLD = 25;
const MIN_BLOB_CELLS = 2;
const BG_LEARN_RATE = 0.02;
const MERGE_DISTANCE = 0.15;

// ── Auto-detect camera device ──
function findCameraDevice() {
    if (process.env.VIDEO_DEVICE) {
        console.log(`[tracker] Using VIDEO_DEVICE env: ${process.env.VIDEO_DEVICE}`);
        return process.env.VIDEO_DEVICE;
    }

    try {
        // v4l2-ctl may exit non-zero if /dev/video0 doesn't exist, but still lists devices
        let output;
        try {
            output = execSync('v4l2-ctl --list-devices', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (e) {
            // execSync throws on non-zero exit, but stdout is still in the error object
            output = e.stdout || '';
        }

        if (!output) {
            console.log('[tracker] v4l2-ctl returned no output');
            return '/dev/video0';
        }

        const lines = output.split('\n');
        let foundCamera = false;
        for (const line of lines) {
            // Look for USB camera headers (not ISP/pispbe, not decoder/rpi-hevc)
            if (line.match(/Camera|Webcam|UVC|usb/) && !line.match(/pispbe|hevc|rpi-/) ) {
                foundCamera = true;
                continue;
            }
            if (foundCamera && line.match(/\/dev\/video\d+/)) {
                const device = line.trim();
                // Verify it's a capture device
                try {
                    const info = execSync(`v4l2-ctl -d ${device} --info`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
                    if (info.includes('Video Capture')) {
                        console.log(`[tracker] Auto-detected camera: ${device}`);
                        return device;
                    }
                } catch (e) { /* skip this device */ }
            }
            // Reset if we hit a non-indented line (new device section)
            if (foundCamera && line.length > 0 && !line.startsWith('\t') && !line.startsWith(' ')) {
                foundCamera = false;
            }
        }
    } catch (e) {
        console.log(`[tracker] v4l2-ctl not available: ${e.message}`);
    }

    console.log('[tracker] No camera found, falling back to /dev/video0');
    return '/dev/video0';
}

const VIDEO_DEVICE = findCameraDevice();

// Grid config (4x4 cells for speed)
const GRID_CELL = 4;
const GRID_W = Math.ceil(CAPTURE_WIDTH / GRID_CELL);
const GRID_H = Math.ceil(CAPTURE_HEIGHT / GRID_CELL);

// ── State ──
let bgFrame = null;       // Float32Array — adaptive background
let prevEntities = [];     // previous frame's entities for ID persistence
let nextEntityId = 0;
const clients = new Set(); // WebSocket clients

// ── Minimal WebSocket server (no dependencies) ──
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'camera-tracker', device: VIDEO_DEVICE }));
});

server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const accept = crypto.createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-5AB5CF11F171')
        .digest('base64');

    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + accept + '\r\n' +
        '\r\n'
    );

    clients.add(socket);
    console.log(`[ws] Client connected (${clients.size} total)`);

    // Read and discard incoming data (browser sends masked frames, pings, etc.)
    socket.on('data', () => { /* consume incoming frames to prevent backpressure */ });
    socket.on('end', () => { clients.delete(socket); });
    socket.on('close', () => { clients.delete(socket); });
    socket.on('error', () => { clients.delete(socket); });

    // Keep alive: set a long timeout
    socket.setTimeout(0); // disable timeout
});

function wsBroadcast(data) {
    const payload = JSON.stringify(data);
    const buf = Buffer.from(payload);
    let frame;
    if (buf.length < 126) {
        frame = Buffer.alloc(2 + buf.length);
        frame[0] = 0x81;
        frame[1] = buf.length;
        buf.copy(frame, 2);
    } else {
        frame = Buffer.alloc(4 + buf.length);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(buf.length, 2);
        buf.copy(frame, 4);
    }
    for (const client of clients) {
        try { client.write(frame); } catch (e) { clients.delete(client); }
    }
}

server.listen(WS_PORT, () => {
    console.log(`[tracker] WebSocket server on ws://localhost:${WS_PORT}`);
});

// ── ffmpeg capture ──
console.log(`[tracker] Starting ffmpeg capture from ${VIDEO_DEVICE} (${CAPTURE_WIDTH}x${CAPTURE_HEIGHT} @ ${FPS}fps)`);

const ffmpeg = spawn('ffmpeg', [
    '-f', 'v4l2',
    '-input_format', 'yuyv422',
    '-video_size', `${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}`,
    '-framerate', String(FPS),
    '-i', VIDEO_DEVICE,
    '-f', 'rawvideo',
    '-pix_fmt', 'gray',
    '-an',
    '-v', 'warning',
    'pipe:1'
], { stdio: ['ignore', 'pipe', 'pipe'] });

ffmpeg.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[ffmpeg] ${msg}`);
});

ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] Failed to start: ${err.message}`);
    console.log('[ffmpeg] Check VIDEO_DEVICE env var or run: v4l2-ctl --list-devices');
});

ffmpeg.on('close', (code) => {
    console.log(`[ffmpeg] Exited with code ${code}`);
    if (code !== 0) {
        console.log('[tracker] Retrying in 5s...');
        setTimeout(() => process.exit(1), 5000);
    }
});

// ── Frame processing ──
const FRAME_SIZE = CAPTURE_WIDTH * CAPTURE_HEIGHT; // 1 byte per pixel (grayscale)
let frameBuffer = Buffer.alloc(0);
let frameCount = 0;

ffmpeg.stdout.on('data', (chunk) => {
    frameBuffer = Buffer.concat([frameBuffer, chunk]);

    while (frameBuffer.length >= FRAME_SIZE) {
        const gray = new Uint8Array(frameBuffer.buffer, frameBuffer.byteOffset, FRAME_SIZE);
        frameBuffer = frameBuffer.subarray(FRAME_SIZE);
        frameCount++;

        processFrame(gray);
    }
});

function processFrame(gray) {
    // ── 1. Initialize background ──
    if (!bgFrame) {
        bgFrame = new Float32Array(FRAME_SIZE);
        for (let i = 0; i < FRAME_SIZE; i++) bgFrame[i] = gray[i];
        console.log(`[tracker] Background initialized (frame ${frameCount})`);
        return;
    }

    // ── 2. Grid-based motion detection ──
    const motionGrid = new Uint8Array(GRID_W * GRID_H);
    let totalMotionCells = 0;

    for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            let motionCount = 0;
            let cellPixels = 0;

            for (let dy = 0; dy < GRID_CELL; dy++) {
                for (let dx = 0; dx < GRID_CELL; dx++) {
                    const px = gx * GRID_CELL + dx;
                    const py = gy * GRID_CELL + dy;
                    if (px >= CAPTURE_WIDTH || py >= CAPTURE_HEIGHT) continue;

                    const idx = py * CAPTURE_WIDTH + px;
                    const diff = Math.abs(gray[idx] - bgFrame[idx]);
                    if (diff > MOTION_THRESHOLD) motionCount++;
                    cellPixels++;

                    // Adaptive background update
                    bgFrame[idx] += (gray[idx] - bgFrame[idx]) * BG_LEARN_RATE;
                }
            }

            if (cellPixels > 0 && motionCount / cellPixels > 0.25) {
                motionGrid[gy * GRID_W + gx] = 1;
                totalMotionCells++;
            }
        }
    }

    // ── 3. Connected-component blob detection ──
    const visited = new Uint8Array(GRID_W * GRID_H);
    const rawBlobs = [];

    for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            const idx = gy * GRID_W + gx;
            if (!motionGrid[idx] || visited[idx]) continue;

            const blob = { sumX: 0, sumY: 0, count: 0 };
            const stack = [idx];
            visited[idx] = 1;

            while (stack.length > 0) {
                const ci = stack.pop();
                const cx = ci % GRID_W;
                const cy = Math.floor(ci / GRID_W);

                blob.sumX += cx;
                blob.sumY += cy;
                blob.count++;

                const neighbors = [
                    [cx - 1, cy], [cx + 1, cy],
                    [cx, cy - 1], [cx, cy + 1],
                ];
                for (const [nx, ny] of neighbors) {
                    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
                    const ni = ny * GRID_W + nx;
                    if (!motionGrid[ni] || visited[ni]) continue;
                    visited[ni] = 1;
                    stack.push(ni);
                }
            }

            if (blob.count >= MIN_BLOB_CELLS) {
                rawBlobs.push(blob);
            }
        }
    }

    // ── 4. Convert to entities ──
    let entities = rawBlobs.map(b => ({
        x: (b.sumX / b.count) / GRID_W,
        y: (b.sumY / b.count) / GRID_H,
        size: (b.count * GRID_CELL * GRID_CELL) / FRAME_SIZE,
        activity: Math.min(1, b.count / (GRID_W * GRID_H * 0.1)),
        id: 0,
    }));

    // ── 5. Merge nearby blobs ──
    entities = mergeNearby(entities);

    // ── 6. Assign persistent IDs ──
    entities = assignIds(entities, prevEntities);
    prevEntities = entities;

    // ── 7. Broadcast to WebSocket clients ──
    if (clients.size > 0) {
        wsBroadcast({
            type: 'tracking',
            entities: entities,
            motionCells: totalMotionCells,
            totalCells: GRID_W * GRID_H,
            frame: frameCount,
        });
    }

    // Log every 30 frames (~3s)
    if (frameCount % 30 === 0) {
        console.log(`[tracker] frame=${frameCount} motion=${totalMotionCells}/${GRID_W * GRID_H} entities=${entities.length} clients=${clients.size}`);
    }
}

function mergeNearby(entities) {
    if (entities.length <= 1) return entities;
    const merged = [];
    const used = new Set();
    for (let i = 0; i < entities.length; i++) {
        if (used.has(i)) continue;
        const group = [entities[i]];
        used.add(i);
        for (let j = i + 1; j < entities.length; j++) {
            if (used.has(j)) continue;
            const dx = entities[i].x - entities[j].x;
            const dy = entities[i].y - entities[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < MERGE_DISTANCE) {
                group.push(entities[j]);
                used.add(j);
            }
        }
        let totalSize = 0, wx = 0, wy = 0, maxAct = 0;
        for (const e of group) {
            totalSize += e.size;
            wx += e.x * e.size;
            wy += e.y * e.size;
            maxAct = Math.max(maxAct, e.activity);
        }
        merged.push({ x: wx / totalSize, y: wy / totalSize, size: totalSize, activity: maxAct, id: 0 });
    }
    return merged;
}

function assignIds(current, previous) {
    if (previous.length === 0) return current.map(e => ({ ...e, id: nextEntityId++ }));
    const result = [];
    const usedIds = new Set();
    const sorted = [...current].sort((a, b) => b.size - a.size);
    for (const entity of sorted) {
        let bestId = -1, bestDist = 0.3;
        for (const prev of previous) {
            if (usedIds.has(prev.id)) continue;
            const d = Math.sqrt((entity.x - prev.x) ** 2 + (entity.y - prev.y) ** 2);
            if (d < bestDist) { bestDist = d; bestId = prev.id; }
        }
        if (bestId >= 0) { usedIds.add(bestId); result.push({ ...entity, id: bestId }); }
        else result.push({ ...entity, id: nextEntityId++ });
    }
    return result;
}

// ── Graceful shutdown ──
process.on('SIGTERM', () => { ffmpeg.kill(); process.exit(0); });
process.on('SIGINT', () => { ffmpeg.kill(); process.exit(0); });

console.log('[tracker] Camera motion tracker ready');
