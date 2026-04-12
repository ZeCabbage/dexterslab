const fs = require('fs/promises');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const CLASSES = ['Sorcerer', 'Warlock', 'Wizard'];

async function run() {
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
       { "level": 3, "name": "Frenzy", "description": "You can go..."}
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
       if (raw.startsWith('```json')) raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
       if (raw.startsWith('```')) raw = raw.replace(/```/g, '').trim();
       finalSubclasses[className.toLowerCase()] = JSON.parse(raw);
     } catch (e) {
       console.log("Failed " + className, e);
     }
  }
  await fs.writeFile('subclasses-retry.json', JSON.stringify(finalSubclasses, null, 2));
  console.log('Done writing subclasses-retry.json');
}
run();
