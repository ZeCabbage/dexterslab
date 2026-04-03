// Test WebSocket connectivity to PC backend via Cloudflare Tunnel
const { WebSocket } = require('ws');

const url = 'wss://dexterslab-api.cclottaaworld.com/ws';
console.log('Testing:', url);

const ws = new WebSocket(url);
ws.on('open', () => {
    console.log('CONNECTED to backend /ws');
    ws.close();
    process.exit(0);
});
ws.on('error', (e) => {
    console.log('ERROR:', e.message);
    process.exit(1);
});
setTimeout(() => {
    console.log('TIMEOUT after 5s');
    process.exit(1);
}, 5000);
