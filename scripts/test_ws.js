// Test WebSocket connectivity to PC backend with correct /ws path
const { WebSocket } = require('ws');

const url = 'ws://192.168.1.136:8888/ws';
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
