import express from 'express';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'dungeon-buddy-characters.json');
const SESSIONS_FILE = path.join(process.cwd(), 'data', 'dungeon-buddy-sessions.json');

export default class DungeonBuddyApp {
  static manifest = {
    id: 'dungeon-buddy',
    name: 'Dungeon Buddy',
    target: 'pc',
    hardware: [],
    wsPath: null,
    frontendRoute: '/dungeon-buddy',
    icon: '🐉',
    priority: 10
  };

  constructor(platform) {
    this.platform = platform;
    this.initDataFile();
  }

  initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(SESSIONS_FILE)) {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  readData() {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[Dungeon Buddy] Error reading data:', err);
      return [];
    }
  }

  writeData(data) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Dungeon Buddy] Error writing data:', err);
    }
  }

  readSessions() {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[Dungeon Buddy] Error reading sessions data:', err);
      return [];
    }
  }

  writeSessions(data) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Dungeon Buddy] Error writing sessions data:', err);
    }
  }

  getRoutes() {
    const router = express.Router();

    // Get all characters (summary for lobby)
    router.get('/characters', (req, res) => {
      const characters = this.readData();
      // Only send back high-level stats to save bandwidth if many
      const summaries = characters.map(c => ({
        id: c.id,
        name: c.name || 'Unknown',
        class: c.class || 'Classless',
        level: c.level || 1,
        hp: c.currentHp || 0,
        maxHp: c.maxHp || 0,
        portrait: c.portrait || ''
      }));
      res.json(summaries);
    });

    // Get specific character details
    router.get('/characters/:id', (req, res) => {
      const characters = this.readData();
      const char = characters.find(c => c.id === req.params.id);
      if (char) {
        res.json(char);
      } else {
        res.status(404).json({ error: 'Character not found' });
      }
    });

    // Create new character
    router.post('/characters', express.json({ limit: '10mb' }), (req, res) => {
      const characters = this.readData();
      const newChar = {
        id: 'char_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        ...req.body,
        logbook: req.body.logbook || []
      };
      characters.push(newChar);
      this.writeData(characters);
      res.status(201).json(newChar);
    });

    // Update existing character
    router.put('/characters/:id', express.json({ limit: '10mb' }), (req, res) => {
      let characters = this.readData();
      const index = characters.findIndex(c => c.id === req.params.id);
      if (index !== -1) {
        characters[index] = { ...characters[index], ...req.body, id: req.params.id };
        this.writeData(characters);
        res.json(characters[index]);
      } else {
        res.status(404).json({ error: 'Character not found' });
      }
    });

    // Delete character
    router.delete('/characters/:id', (req, res) => {
      let characters = this.readData();
      const index = characters.findIndex(c => c.id === req.params.id);
      if (index !== -1) {
        characters.splice(index, 1);
        this.writeData(characters);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Character not found' });
      }
    });

    // Generate character portrait via Gemini Nano Banana (image generation)
    router.post('/generate-portrait', express.json({ limit: '10mb' }), async (req, res) => {
      const { description, race, charClass } = req.body;
      if (!description) return res.status(400).json({ error: 'No description provided' });

      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) return res.status(500).json({ error: 'AI Provider not available' });

      try {
        const fullPrompt = `Fantasy character portrait, D&D style, painted illustration. ${race || ''} ${charClass || ''} adventurer. ${description}. Dramatic lighting, dark moody background, detailed face, high quality fantasy art, no text, no UI elements, no watermarks.`;

        const response = await genai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: fullPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1'
          },
        });

        let imageData = null;
        if (response.generatedImages && response.generatedImages.length > 0) {
          imageData = response.generatedImages[0].image.imageBytes;
        }

        if (imageData) {
          res.json({ success: true, imageData });
        } else {
          res.json({ success: false, error: 'No image generated — model returned text only' });
        }
      } catch (err) {
        console.error('[Dungeon Buddy] Portrait generation error:', err.message);
        res.status(500).json({ error: 'Failed to generate portrait: ' + err.message });
      }
    });

    // --- Session Scribe & Campaign Minutes ---

    router.get('/sessions', (req, res) => {
      res.json(this.readSessions().sort((a,b) => b.timestamp - a.timestamp));
    });

    router.post('/scribe/summarize', express.json({ limit: '50mb' }), async (req, res) => {
      const { text } = req.body;
      if (!text || text.trim().length < 10) {
        return res.status(400).json({ error: 'Not enough transcript data to summarize.' });
      }

      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) {
        return res.status(500).json({ error: 'AI Provider not available' });
      }

      try {
        const p = `Act as an expert Dungeons & Dragons Dungeon Master Assistant.
Read the following raw, potentially messy voice transcription of a live D&D session.

Extract the following details and return ONLY a valid JSON object matching this schema exactly:
{
  "title": "Epic 3-6 word title for this session",
  "summary": "A 1-2 paragraph narrative summary of what happened.",
  "locations": ["Name or description of locations visited"],
  "npcs": ["NPC names or generic identifiers that were interacted with"],
  "quests": ["Updates or resolutions to tasks/quests"],
  "loot": ["Any items, gold, or artifacts mentioned as acquired"]
}

Raw Session Transcript:
"""
${text}
"""
`;

        const response = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: p,
            config: {
               responseMimeType: "application/json"
            }
        });

        const rawJsonText = (response.text || "").trim();
        let payload = {};
        
        try {
           payload = JSON.parse(rawJsonText);
        } catch(e) {
           console.error('[Dungeon Buddy Scribe] LLM returned invalid JSON:', rawJsonText);
           throw new Error("LLM failed to generate valid structured JSON");
        }

        const newSession = {
           id: 'session_' + Date.now(),
           timestamp: Date.now(),
           ...payload,
           rawTranscriptLength: text.length
        };

        const sessions = this.readSessions();
        sessions.push(newSession);
        this.writeSessions(sessions);

        res.status(200).json(newSession);

      } catch (err) {
        console.error('[Dungeon Buddy Scribe] Summarization Error:', err);
        res.status(500).json({ error: `Oracle Failure: ${err.message}` });
      }
    });

    router.post('/oracle/forge-character', express.json(), async (req, res) => {
      const { description, mode, constraints } = req.body;
      
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) {
        return res.status(500).json({ error: 'AI Provider not available' });
      }

      try {
        let systemPrompt = `You are the Oracle of character creation for a D&D 5E game.
You must return a valid JSON object strictly matching this schema:
{
  "raceId": "ID of the race",
  "subraceId": "ID of the subrace (or null if the race has none)",
  "classId": "ID of the class",
  "backgroundId": "ID of the background",
  "baseScores": {
     "str": number (8-15),
     "dex": number (8-15),
     "con": number (8-15),
     "int": number (8-15),
     "wis": number (8-15),
     "cha": number (8-15)
  },
  "skills": ["Array of skill IDs appropriate for this class to choose"],
  "portraitPrompt": "A highly detailed, atmospheric image prompt describing this character's visual appearance based on your choices and the user's description."
}

CRITICAL RULES:
1. You MUST pick "raceId", "classId", and "backgroundId" ONLY from the provided allowed lists below.
2. If "raceId" has subraces in the allowed list, you MUST pick a valid "subraceId" from that specific race's subrace list. If it has no subraces, use null.
3. The "baseScores" MUST perfectly adhere to D&D 5e Point Buy rules: exactly 27 points must be spent. (Costs: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9). Do not overspend or underspend. Do NOT add racial bonuses to these base scores.
4. The "skills" array must contain EXACTLY the number of skill choices allowed by the chosen class (usually 2, sometimes 3 or 4 like Rogue/Bard). You can only choose skills from the chosen Class's allowed skill list. DO NOT include skills already provided by the chosen Background.
`;

        if (mode === 'chaos') {
          systemPrompt += `\nThe user requested PURE CHAOS. Ignore their description if any, and invent a fully randomized but thematically brilliant character concept.`;
        } else {
          systemPrompt += `\nThe user requested a character matching this description (if vague, extrapolate intuitively): "${description || 'A generic adventurer'}"`;
        }

        systemPrompt += `\n\nALLOWED CONSTRAINTS (YOU MUST NOT DEVIATE FROM THESE):\n`;
        systemPrompt += JSON.stringify(constraints, null, 2);

        const response = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemPrompt,
            config: {
               responseMimeType: "application/json"
            }
        });

        const rawJsonText = (response.text || "").trim();
        let payload = {};
        
        try {
           payload = JSON.parse(rawJsonText);
        } catch(e) {
           console.error('[Dungeon Buddy Oracle] LLM returned invalid JSON:', rawJsonText);
           throw new Error("Oracle failed to forge a coherent structure");
        }

        res.status(200).json(payload);

      } catch (err) {
        console.error('[Dungeon Buddy Oracle] Forge Error:', err);
        res.status(500).json({ error: `Oracle Failure: ${err.message}` });
      }
    });

    return router;
  }
}
