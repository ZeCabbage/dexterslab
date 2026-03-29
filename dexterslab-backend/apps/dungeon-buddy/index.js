import express from 'express';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'dungeon-buddy-characters.json');

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
    router.post('/characters', express.json(), (req, res) => {
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
    router.put('/characters/:id', express.json(), (req, res) => {
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
    router.post('/generate-portrait', express.json(), async (req, res) => {
      const { description, race, charClass } = req.body;
      if (!description) return res.status(400).json({ error: 'No description provided' });

      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) return res.status(500).json({ error: 'AI Provider not available' });

      try {
        const fullPrompt = `Fantasy character portrait, D&D style, painted illustration. ${race || ''} ${charClass || ''} adventurer. ${description}. Dramatic lighting, dark moody background, detailed face, high quality fantasy art, no text, no UI elements, no watermarks.`;

        const response = await genai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: fullPrompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });

        // Parse response parts for image data
        const parts = response?.candidates?.[0]?.content?.parts || [];
        let imageData = null;

        for (const part of parts) {
          if (part.inlineData) {
            imageData = part.inlineData.data;
            break;
          }
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

    return router;
  }
}
