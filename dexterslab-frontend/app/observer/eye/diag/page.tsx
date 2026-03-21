'use client';

/**
 * Camera/FaceDetector Diagnostic Page
 * Tests getUserMedia + FaceDetector API availability
 */

import { useEffect, useState, useRef } from 'react';

export default function DiagPage() {
  const [log, setLog] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const addLog = (msg: string) => {
    console.log('[DIAG]', msg);
    setLog(prev => [...prev, `${new Date().toISOString().slice(11,19)} ${msg}`]);
  };

  useEffect(() => {
    async function runDiag() {
      addLog('=== CAMERA DIAGNOSTIC ===');

      // 1. Check FaceDetector
      addLog(`window.FaceDetector: ${'FaceDetector' in window ? 'YES ✅' : 'NO ❌'}`);

      // 2. Check getUserMedia
      addLog(`navigator.mediaDevices: ${navigator.mediaDevices ? 'YES ✅' : 'NO ❌'}`);
      addLog(`getUserMedia: ${navigator.mediaDevices?.getUserMedia ? 'YES ✅' : 'NO ❌'}`);

      // 3. Enumerate devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        addLog(`Cameras found: ${cameras.length}`);
        cameras.forEach((cam, i) => {
          addLog(`  Camera ${i}: ${cam.label || '(unnamed)'} [${cam.deviceId.slice(0, 8)}...]`);
        });
      } catch (e) {
        addLog(`enumerateDevices error: ${e}`);
      }

      // 4. Try getUserMedia
      try {
        addLog('Opening camera...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        addLog(`Camera opened: ${settings.width}×${settings.height} ✅`);
        addLog(`Track label: ${track.label}`);

        // Attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          addLog(`Video playing: ${videoRef.current.videoWidth}×${videoRef.current.videoHeight}`);
        }

        // 5. Try FaceDetector
        if ('FaceDetector' in window) {
          addLog('Creating FaceDetector...');
          try {
            // @ts-expect-error FaceDetector is not in TS stdlib
            const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
            addLog('FaceDetector created ✅');

            // Wait for video to be ready
            await new Promise(r => setTimeout(r, 1000));

            if (videoRef.current && videoRef.current.readyState >= 2) {
              addLog('Running detection...');
              try {
                const faces = await detector.detect(videoRef.current);
                addLog(`Faces detected: ${faces.length} ${faces.length > 0 ? '✅' : '(none yet, try again)'}`);
                faces.forEach((face: { boundingBox: DOMRectReadOnly }, i: number) => {
                  const bb = face.boundingBox;
                  addLog(`  Face ${i}: x=${bb.x.toFixed(0)} y=${bb.y.toFixed(0)} w=${bb.width.toFixed(0)} h=${bb.height.toFixed(0)}`);
                });

                // Draw on canvas
                if (canvasRef.current && videoRef.current) {
                  const ctx = canvasRef.current.getContext('2d')!;
                  canvasRef.current.width = videoRef.current.videoWidth;
                  canvasRef.current.height = videoRef.current.videoHeight;
                  ctx.drawImage(videoRef.current, 0, 0);
                  ctx.strokeStyle = '#00ff00';
                  ctx.lineWidth = 3;
                  faces.forEach((face: { boundingBox: DOMRectReadOnly }) => {
                    const bb = face.boundingBox;
                    ctx.strokeRect(bb.x, bb.y, bb.width, bb.height);
                  });
                  addLog('Drew detection results on canvas');
                }

                // Run continuous detection for 5 seconds
                addLog('Running continuous detection for 5s...');
                let totalDetections = 0;
                let frames = 0;
                const startTime = Date.now();
                while (Date.now() - startTime < 5000) {
                  const result = await detector.detect(videoRef.current);
                  frames++;
                  if (result.length > 0) totalDetections++;
                  await new Promise(r => setTimeout(r, 100));
                }
                addLog(`Continuous: ${totalDetections}/${frames} frames had faces (${(totalDetections/frames*100).toFixed(0)}%)`);
              } catch (e) {
                addLog(`detect() error: ${e}`);
              }
            } else {
              addLog(`Video not ready (readyState: ${videoRef.current?.readyState})`);
            }
          } catch (e) {
            addLog(`FaceDetector creation error: ${e}`);
          }
        } else {
          addLog('FaceDetector NOT available — will need fallback');
        }

        // Cleanup
        stream.getTracks().forEach(t => t.stop());
        addLog('Camera closed');
      } catch (e) {
        addLog(`getUserMedia error: ${e}`);
      }

      addLog('=== DONE ===');
    }

    runDiag();
  }, []);

  return (
    <div style={{ background: '#000', color: '#0f0', fontFamily: 'monospace', padding: 20, minHeight: '100vh' }}>
      <h1 style={{ color: '#0ff' }}>📷 Camera Diagnostic</h1>
      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <h3>Camera Feed</h3>
          <video ref={videoRef} style={{ width: 320, height: 240, border: '1px solid #333' }} autoPlay playsInline muted />
          <h3>Detection Result</h3>
          <canvas ref={canvasRef} style={{ width: 320, height: 240, border: '1px solid #333' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Log</h3>
          <pre style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            {log.join('\n')}
          </pre>
        </div>
      </div>
    </div>
  );
}
