const http = require('http');

const data = JSON.stringify({
  description: "chaos mode",
  mode: "chaos",
  constraints: { classes: [] }
});

const req = http.request(
  'http://localhost:8888/api/dungeon-buddy/oracle/forge-character',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  },
  (res) => {
    let raw = '';
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      console.log(`BODY: ${raw.slice(0, 500)}`);
    });
  }
);

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
