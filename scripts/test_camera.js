// Navigate kiosk to /observer/eye and verify motion tracking is active
const http = require('http');
const { WebSocket } = require('ws');

http.get('http://localhost:9222/json', (r) => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
        const pages = JSON.parse(d);
        console.log('Current URL:', pages[0].url);
        const ws = new WebSocket(pages[0].webSocketDebuggerUrl);

        ws.on('open', () => {
            // Navigate to eye page
            ws.send(JSON.stringify({
                id: 1, method: 'Page.navigate',
                params: { url: 'http://localhost:3000/observer/eye' }
            }));
        });

        let step = 0;
        ws.on('message', (msg) => {
            const r = JSON.parse(msg.toString());
            if (r.id === 1) {
                console.log('Navigated to /observer/eye');
                // Wait for page to load, then check console for tracking messages
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        id: 2, method: 'Runtime.evaluate',
                        params: {
                            expression: '(async()=>{const r=[];r.push("URL:"+location.href);r.push("videos:"+document.querySelectorAll("video").length);r.push("canvases:"+document.querySelectorAll("canvas").length);try{const d=await navigator.mediaDevices.enumerateDevices();const c=d.filter(x=>x.kind==="videoinput");r.push("cameras:"+c.length);c.forEach((x,i)=>r.push("cam"+i+":"+x.label))}catch(e){}try{const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:160},height:{ideal:120}},audio:false});const t=s.getVideoTracks()[0];r.push("CAMERA_OK:"+t.getSettings().width+"x"+t.getSettings().height);s.getTracks().forEach(t=>t.stop())}catch(e){r.push("CAM_ERR:"+e.name+" "+e.message)}return r.join("\\n")})()',
                            awaitPromise: true, returnByValue: true,
                        }
                    }));
                }, 5000);
            }
            if (r.id === 2) {
                console.log(r.result?.result?.value || 'NO RESULT');
                const err = r.result?.exceptionDetails;
                if (err) console.log('ERR:', JSON.stringify(err));
                ws.close();
                process.exit(0);
            }
        });
    });
}).on('error', e => console.log('ERROR:', e.message));
