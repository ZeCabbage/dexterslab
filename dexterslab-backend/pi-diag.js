// Quick diagnostic: connect to Pi's Chromium via CDP and check console + WS state
const ws = require('ws');

const WS_URL = 'ws://192.168.1.113:9222/devtools/page/A7CCC22799810BFF87C0F131E727D6D2';

const client = new ws(WS_URL);
let msgId = 1;

function send(method, params = {}) {
    const id = msgId++;
    client.send(JSON.stringify({ id, method, params }));
    return id;
}

client.on('open', () => {
    console.log('Connected to Pi Chromium CDP');

    // Enable console message capture
    send('Runtime.enable');
    send('Log.enable');

    // Check what the page sees for WS connection and camera
    const evalId = send('Runtime.evaluate', {
        expression: `JSON.stringify({
            // Check if our WS client exists
            wsExists: typeof window.__wsDebug !== 'undefined',
            // Try to read connection status from the page
            pageTitle: document.title,
            url: window.location.href,
            // Check if there are any error elements visible
            backendOffline: document.body.innerText.includes('BACKEND OFFLINE'),
            // Check navigator.mediaDevices
            hasMediaDevices: !!navigator.mediaDevices,
            hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            // Check secure context
            isSecureContext: window.isSecureContext,
        })`,
        returnByValue: true,
    });

    console.log('Sent eval, id:', evalId);
});

const results = [];
client.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    // Console messages from the page
    if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        console.log('[CONSOLE]', text);
    }

    if (msg.method === 'Log.entryAdded') {
        console.log('[LOG]', msg.params.entry.level, msg.params.entry.text);
    }

    // Our eval result
    if (msg.id && msg.result && msg.result.result) {
        const val = msg.result.result.value;
        if (typeof val === 'string') {
            try {
                console.log('[EVAL RESULT]', JSON.parse(val));
            } catch {
                console.log('[EVAL RESULT]', val);
            }
        } else {
            console.log('[EVAL RESULT]', val);
        }
    }

    results.push(msg);
});

// Close after 3 seconds
setTimeout(() => {
    console.log(`\nCollected ${results.length} messages`);
    client.close();
    process.exit(0);
}, 3000);

client.on('error', (err) => {
    console.error('CDP connection error:', err.message);
    process.exit(1);
});
