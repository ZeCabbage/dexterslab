// Inject motion detection diagnostics into the running Eye page
const http = require('http');
const { WebSocket } = require('ws');

http.get('http://localhost:9222/json', (r) => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
        const pages = JSON.parse(d);
        if (!pages.length) { console.log('NO PAGES'); process.exit(1); }

        const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
        ws.on('open', () => {
            // Inject a standalone motion detector to verify the pipeline
            const js = `(async () => {
                const r = [];
                
                // Get the existing video element (created by useMotionTracking)
                const videos = document.querySelectorAll('video');
                if (videos.length === 0) return 'NO VIDEO ELEMENTS';
                
                const video = videos[0];
                r.push('Video: ' + video.videoWidth + 'x' + video.videoHeight + ' ready=' + video.readyState);
                
                if (video.readyState < 2) return r.join('\\n') + '\\nVideo not ready';
                
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                
                // Capture two frames with a delay
                const canvas = document.createElement('canvas');
                canvas.width = vw;
                canvas.height = vh;
                const ctx = canvas.getContext('2d');
                
                // Frame 1
                ctx.drawImage(video, 0, 0, vw, vh);
                const frame1 = ctx.getImageData(0, 0, vw, vh);
                
                // Check if frame1 is all black (camera not delivering real data)
                let nonBlack1 = 0;
                for (let i = 0; i < frame1.data.length; i += 4) {
                    if (frame1.data[i] > 10 || frame1.data[i+1] > 10 || frame1.data[i+2] > 10) nonBlack1++;
                }
                r.push('Frame1: ' + nonBlack1 + '/' + (vw*vh) + ' non-black pixels (' + (nonBlack1/(vw*vh)*100).toFixed(1) + '%)');
                
                // Average pixel brightness
                let totalBrightness = 0;
                for (let i = 0; i < frame1.data.length; i += 4) {
                    totalBrightness += (frame1.data[i] + frame1.data[i+1] + frame1.data[i+2]) / 3;
                }
                r.push('Avg brightness: ' + (totalBrightness / (vw*vh)).toFixed(1));
                
                // Sample some pixel values
                const mid = ((vh/2) * vw + (vw/2)) * 4;
                r.push('Center pixel: R=' + frame1.data[mid] + ' G=' + frame1.data[mid+1] + ' B=' + frame1.data[mid+2]);
                
                // Wait 200ms and capture frame 2
                await new Promise(resolve => setTimeout(resolve, 200));
                
                ctx.drawImage(video, 0, 0, vw, vh);
                const frame2 = ctx.getImageData(0, 0, vw, vh);
                
                let nonBlack2 = 0;
                for (let i = 0; i < frame2.data.length; i += 4) {
                    if (frame2.data[i] > 10 || frame2.data[i+1] > 10 || frame2.data[i+2] > 10) nonBlack2++;
                }
                r.push('Frame2: ' + nonBlack2 + '/' + (vw*vh) + ' non-black pixels');
                
                // Compare frames: count changed pixels
                let changedPixels = 0;
                const THRESHOLD = 30;
                for (let i = 0; i < vw * vh; i++) {
                    const p = i * 4;
                    const gray1 = (frame1.data[p] * 77 + frame1.data[p+1] * 150 + frame1.data[p+2] * 29) >> 8;
                    const gray2 = (frame2.data[p] * 77 + frame2.data[p+1] * 150 + frame2.data[p+2] * 29) >> 8;
                    if (Math.abs(gray1 - gray2) > THRESHOLD) changedPixels++;
                }
                r.push('Changed pixels (threshold ' + THRESHOLD + '): ' + changedPixels + '/' + (vw*vh) + ' (' + (changedPixels/(vw*vh)*100).toFixed(1) + '%)');
                
                // Try lower thresholds
                for (const t of [5, 10, 15, 20]) {
                    let cnt = 0;
                    for (let i = 0; i < vw * vh; i++) {
                        const p = i * 4;
                        const g1 = (frame1.data[p] * 77 + frame1.data[p+1] * 150 + frame1.data[p+2] * 29) >> 8;
                        const g2 = (frame2.data[p] * 77 + frame2.data[p+1] * 150 + frame2.data[p+2] * 29) >> 8;
                        if (Math.abs(g1 - g2) > t) cnt++;
                    }
                    r.push('  threshold ' + t + ': ' + cnt + ' pixels (' + (cnt/(vw*vh)*100).toFixed(1) + '%)');
                }
                
                // Check observer state again
                const stateRef = window.__observerStateRef;
                if (stateRef) {
                    const s = stateRef.current;
                    r.push('');
                    r.push('State: targetX=' + s.targetX?.toFixed(2) + ' targetY=' + s.targetY?.toFixed(2));
                    r.push('State: visible=' + s.somethingVisible + ' sentinel=' + s.sentinelActive);
                }
                
                return r.join('\\n');
            })()`;

            ws.send(JSON.stringify({
                id: 1, method: 'Runtime.evaluate',
                params: { expression: js, awaitPromise: true, returnByValue: true }
            }));
        });

        ws.on('message', (msg) => {
            const r = JSON.parse(msg.toString());
            if (r.id === 1) {
                const val = r.result?.result?.value;
                const err = r.result?.exceptionDetails;
                if (err) console.log('EXCEPTION:', JSON.stringify(err, null, 2));
                else console.log(val || 'NO RESULT');
                ws.close();
                process.exit(0);
            }
        });
        ws.on('error', e => { console.log('WS Error:', e.message); process.exit(1); });
    });
}).on('error', e => { console.log('HTTP Error:', e.message); process.exit(1); });
