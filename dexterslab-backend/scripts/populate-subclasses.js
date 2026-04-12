import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", 
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
];

async function ingestClasses() {
  const finalSubclasses = {};

  for (const className of CLASSES) {
     console.log('Fetching', className, '...');
     const prompt = `You are a D&D 5E database architect. Return a strict JSON array of standard 5E subclasses for the ${className} class. For each subclass, provide its "id" (snake_case), "name" (readable), "description" (a vivid thematic summary, 2-3 sentences), and an array of "features" which must be an array of objects representing class features gained at specific levels.
Example format:
[
  {
    "id": "path_of_the_berserker",
    "name": "Path of the Berserker",
    "description": "A path of untrammeled fury...",
    "features": [
       { "level": 3, "name": "Frenzy", "description": "You can go into a frenzy when you rage..."},
       { "level": 6, "name": "Mindless Rage", "description": "You can't be charmed or frightened..."}
    ]
  }
]
Output ONLY the raw JSON array. DO NOT wrap in markdown \`\`\`json. DO NOT include any other text. Output for 3 to 4 of the most iconic standard subclasses for this class.`;

     let raw = "";
     try {
       const response = await genai.models.generateContent({
           model: 'gemini-2.5-flash',
           contents: prompt
       });
       raw = response.text.trim();
       if (raw.startsWith('\`\`\`json')) raw = raw.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
       let parsed = JSON.parse(raw);
       finalSubclasses[className.toLowerCase()] = parsed;
     } catch(e) {
       console.error("Failed for " + className, e);
     }
  }

  await fs.writeFile('subclasses-output.json', JSON.stringify(finalSubclasses, null, 2));
  console.log('Finished writing subclasses-output.json');
}

ingestClasses();
