// Test camera/WS connectivity via Cloudflare Tunnel
// Connects to local Chromium CDP (PC-side) and checks the Pi video stream status
const http = require('http');
const { WebSocket } = require('ws');

// This connects to YOUR PC's Chromium, not the Pi's
http.get('http://localhost:9222/json', (r) => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
        const pages = JSON.parse(d);
        if (!pages.length) { console.log('NO PAGES'); process.exit(1); }

        const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
        ws.on('open', () => {
            // Enable console and network
            ws.send(JSON.stringify({ id: 0, method: 'Console.enable' }));
            ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));

            // Check the WebSocket URL being used
            const js = `(() => {
                const r = [];

                // Try connecting to the backend via Cloudflare
                try {
                    const testWs = new WebSocket('wss://dexterslab-api.cclottaaworld.com/ws');
                    testWs.onopen = () => {
                        document.title = 'WS_CONNECTED';
                        testWs.close();
                    };
                    testWs.onerror = (e) => {
                        document.title = 'WS_ERROR';
                    };
                    r.push('Test WS: initiated');
                } catch(e) {
                    r.push('Test WS construction error: ' + e.message);
                }

                return r.join('\\\\n');
            })()`;

            ws.send(JSON.stringify({
                id: 2, method: 'Runtime.evaluate',
                params: { expression: js, returnByValue: true }
            }));
        });

        const consoleMsgs = [];
        ws.on('message', (msg) => {
            const r = JSON.parse(msg.toString());

            // Collect console messages
            if (r.method === 'Console.messageAdded') {
                const m = r.params?.message;
                if (m && (m.text.includes('WebSocket') || m.text.includes('ws://') || m.text.includes('wss://') || m.text.includes('backend') || m.text.includes('Connected') || m.text.includes('Error') || m.text.includes('📡'))) {
                    consoleMsgs.push(`[${m.level}] ${m.text}`);
                }
            }

            if (r.method === 'Log.entryAdded') {
                const e = r.params?.entry;
                if (e && (e.text.includes('ws') || e.text.includes('WebSocket') || e.text.includes('cloudflare'))) {
                    consoleMsgs.push(`[LOG:${e.level}] ${e.text}`);
                }
            }

            if (r.id === 2) {
                console.log(r.result?.result?.value || 'NO RESULT');

                // Wait a moment for test WS to connect/fail, then check title
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        id: 3, method: 'Runtime.evaluate',
                        params: { expression: 'document.title', returnByValue: true }
                    }));
                }, 3000);
            }

            if (r.id === 3) {
                console.log('Title after WS test:', r.result?.result?.value);
                if (consoleMsgs.length) {
                    console.log('\nRelevant console messages:');
                    consoleMsgs.forEach(m => console.log(m));
                } else {
                    console.log('\nNo relevant WS/backend console messages found');
                }
                ws.close();
                process.exit(0);
            }
        });
        ws.on('error', e => { console.log('WS Error:', e.message); process.exit(1); });
    });
}).on('error', e => { console.log('HTTP Error:', e.message); process.exit(1); });
