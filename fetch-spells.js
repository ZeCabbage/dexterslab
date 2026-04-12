const http = require('https');
const fs = require('fs');
const path = require('path');

const targetFile = 'C:/Users/holme/OneDrive/Desktop/dexterslab/dexterslab-frontend/app/dungeon-buddy/lib/data/spells.ts';

http.get('https://api.open5e.com/spells/?limit=1000', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            const spells = parsed.results.filter(s => s.document__slug === 'wotc-srd');
            console.log('Found ' + spells.length + ' SRD spells.');

            let databaseLines = [];
            databaseLines.push("import { SpellData } from '../types';\n");
            databaseLines.push("export const SPELL_DATABASE: Record<string, SpellData> = {");

            spells.forEach((spell) => {
                const cleanName = spell.name.toLowerCase().replace(/[^a-z]/g, '');
                const lvlPad = spell.level_int.toString().padStart(2, '0');
                const id = 'spell_' + cleanName + '_' + lvlPad;

                const classesStr = spell.dnd_class ? spell.dnd_class.split(', ').map(c => "'" + c.trim() + "'").join(', ') : '';

                let damage = '';
                const dmgMatch = spell.desc.match(/(\d+d\d+)( \+ \w+ modifier)? (\w+) damage/i);
                if (dmgMatch) damage = dmgMatch[1] + ' ' + (dmgMatch[3].charAt(0).toUpperCase() + dmgMatch[3].slice(1));

                let actionCost = 'action';
                const ctLc = spell.casting_time.toLowerCase();
                if (ctLc.includes('bonus action')) actionCost = 'bonus_action';
                else if (ctLc.includes('reaction')) actionCost = 'reaction';
                else if (ctLc.includes('action')) actionCost = 'action';
                else actionCost = 'special';

                let rawDesc = typeof spell.desc === 'string' ? spell.desc.replace(/\n/g, ' ').replace(/"/g, '\\"') : '';
                if (spell.higher_level) {
                   rawDesc += ' Higher Levels: ' + spell.higher_level.replace(/\n/g, ' ').replace(/"/g, '\\"');
                }
                
                rawDesc = rawDesc.replace(/\`/g, "'");

                const entry = `  "${id}": {
    id: "${id}", name: "${spell.name}", level: ${spell.level_int}, school: "${spell.school}",
    castingTime: "${spell.casting_time}", range: "${spell.range}", components: "${spell.components}", duration: "${spell.requires_concentration ? 'Concentration, ' : ''}${spell.duration}",
    description: \`${rawDesc}\`,
    ${damage ? `damage: "${damage}", ` : ''}actionCost: "${actionCost}", classes: [${classesStr}]
  },`;
                databaseLines.push(entry);
            });

            databaseLines.push("};\n");

            fs.writeFileSync(targetFile, databaseLines.join('\n'));
            console.log('Wrote spells.ts successfully');
            process.exit(0);
        } catch(e) {
            console.error(e);
            process.exit(1);
        }
    });
});
