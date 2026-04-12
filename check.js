const { RACES, CLASSES, BACKGROUNDS } = require('./dexterslab-frontend/app/dungeon-buddy/data/srd.js') || {};
const fs = require('fs');

if (!RACES) {
  // Try to use ts-node or just read the file manually
  const rawts = fs.readFileSync('./dexterslab-frontend/app/dungeon-buddy/data/srd.ts', 'utf8');
  console.log("length of SRD.ts is " + rawts.length);
  return;
}
