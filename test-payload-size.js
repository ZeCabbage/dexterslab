// Using require to load the JSON payload we will dynamically extract
const fs = require('fs');
const tsCode = fs.readFileSync('./dexterslab-frontend/app/dungeon-buddy/data/srd.ts', 'utf8');

// We don't need to parse everything, let's just make a very large payload.
// Let's make a payload of exactly 1MB to see if NextJS natively rejects it with 413.
const http = require('http');

let largeArray = [];
for(let i = 0; i < 5000; i++) {
   largeArray.push({ id: "class_" + i, allowedSkills: ["History", "Arcana"], numChoices: 2 });
}

const data = JSON.stringify({
  description: "chaos mode",
  mode: "chaos",
  constraints: { classes: largeArray }
});

console.log("Payload size: " + data.length + " bytes");

const req = http.request(
  'http://localhost:7777/api/dungeon-buddy/oracle/forge-character',
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
      console.log(`BODY: ${raw.slice(0, 500)}`);
    });
  }
);

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
