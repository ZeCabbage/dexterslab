// Quick script to save a single frame from the video ingress to disk
import { spawn } from 'child_process';
import fs from 'fs';

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

console.log('Listening on UDP :5600 for a single MJPEG frame...');

const ffmpeg = spawn(FFMPEG_BIN, [
  '-f', 'mjpeg',
  '-i', 'udp://0.0.0.0:5600',
  '-f', 'image2pipe',
  '-vcodec', 'copy',
  '-'
], { windowsHide: true });

let buf = Buffer.alloc(0);

ffmpeg.stdout.on('data', (data) => {
  buf = Buffer.concat([buf, data]);
  const soi = buf.indexOf(SOI);
  const eoi = buf.indexOf(EOI, soi + 2);
  if (soi !== -1 && eoi !== -1) {
    const frame = buf.subarray(soi, eoi + 2);
    const outPath = './data/debug-frame.jpg';
    fs.writeFileSync(outPath, frame);
    console.log(`Saved frame: ${frame.length} bytes -> ${outPath}`);
    ffmpeg.kill();
    process.exit(0);
  }
});

ffmpeg.stderr.on('data', () => {});
ffmpeg.on('error', (e) => { console.error('ffmpeg error:', e); process.exit(1); });

// Timeout after 10s
setTimeout(() => {
  console.error('No frame received in 10s');
  ffmpeg.kill();
  process.exit(1);
}, 10000);
