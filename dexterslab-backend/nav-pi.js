import { WebSocket } from 'ws';

async function navigatePi(targetUrl) {
    try {
        console.log('Connecting to Pi Chromium over Tailscale...');
        const res = await fetch('http://100.107.167.102:9222/json');
        const pages = await res.json();
        
        const page = pages.find(p => p.type === 'page');
        if (!page) {
            console.log('No active page found to navigate.');
            return;
        }

        console.log(`Found page: ${page.url}`);
        const wsUrl = page.webSocketDebuggerUrl;
        
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        
        ws.on('open', () => {
            console.log(`Navigating to ${targetUrl}...`);
            ws.send(JSON.stringify({
                id: 1,
                method: 'Page.navigate',
                params: { url: targetUrl }
            }));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.id === 1) {
                console.log('Navigation successful!');
                ws.close();
                process.exit(0);
            }
        });
        
        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            process.exit(1);
        });

    } catch (err) {
        console.error('Failed to communicate with Pi Chromium:', err.message);
        process.exit(1);
    }
}

navigatePi('http://100.119.202.9:3000/observer/eye-v2');
