const fs = require('fs/promises');
const path = require('path');

async function run() {
  try {
    const rawData = await fs.readFile(path.join(__dirname, '..', 'subclasses-retry.json'), 'utf-8');
    const newSubclasses = JSON.parse(rawData);

    // Look for dexterslab-frontend/app/dungeon-buddy/data/srd.ts
    const srdPath = path.join(__dirname, '..', '..', 'dexterslab-frontend', 'app', 'dungeon-buddy', 'data', 'srd.ts');
    let srdContent = await fs.readFile(srdPath, 'utf-8');

    // For each class, replace the 'subclasses: [ ... ]' block
    for (const [clsName, subclassesData] of Object.entries(newSubclasses)) {
       const capName = clsName.charAt(0).toUpperCase() + clsName.slice(1);
       
       // Build string for subclasses array
       const subStr = JSON.stringify(subclassesData, null, 8).replace(/"([^"]+)":/g, '$1:');
       
       // Regex to find: name: 'Barbarian', ... subclasses: [ ... ]
       // It's tricky to regex safely. Instead, let's find `id: '${clsName}'` up to `spellSlots:`
       const rgx = new RegExp("(id:\\s*'\\\\b" + clsName + "\\\\b'[\\\\s\\\\S]*?subclasses:\\s*\\[)[\\\\s\\\\S]*?(\\]\\s*,\\s*spellSlots:)", 'g');
       srdContent = srdContent.replace(rgx, "$1\\n        " + subStr.trim() + "\\n      $2");
    }

    await fs.writeFile(srdPath, srdContent);
    console.log('Successfully patched srd.ts!');

  } catch(e) {
    console.error(e);
  }
}
run();
