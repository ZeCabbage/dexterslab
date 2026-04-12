const fs = require('fs/promises');
const path = require('path');

async function run() {
  try {
    const rawData = await fs.readFile(path.join(__dirname, '..', 'subclasses-retry.json'), 'utf-8');
    const newSubclasses = JSON.parse(rawData);

    const srdPath = path.join(__dirname, '..', '..', 'dexterslab-frontend', 'app', 'dungeon-buddy', 'data', 'srd.ts');
    let srdContent = await fs.readFile(srdPath, 'utf-8');

    for (const [clsName, subclassesData] of Object.entries(newSubclasses)) {
       // We want to replace everything inside subclasses: [ ... ] for each class block.
       // The block structure is `subclasses: [\n ... \n      ], spellSlots:`
       const regexStr = "id:\\s*'" + clsName + "'[\\s\\S]*?subclasses:\\s*\\[([\\s\\S]*?)\\]\\s*,\\s*spellSlots:";
       const rgx = new RegExp(regexStr, 'g');
       
       const subStr = JSON.stringify(subclassesData, null, 8).replace(/"([^"]+)":/g, '$1:');
       
       srdContent = srdContent.replace(rgx, (match) => {
          // Replace the `subclasses: [...]` portion inside the matched class block
          return match.replace(/subclasses:\s*\[[\s\S]*?\]\s*,/, `subclasses: ${subStr.trim()},\n      `);
       });
    }

    await fs.writeFile(srdPath, srdContent);
    console.log('Successfully patched srd.ts securely!');

  } catch(e) {
    console.error(e);
  }
}
run();
