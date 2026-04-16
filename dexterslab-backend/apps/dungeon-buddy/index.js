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
        ...req.body,
        id: 'char_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
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
        const systemPrompt = `You are The Chronicler — an expert Dungeons & Dragons archivist and historian with decades of experience distilling chaotic session notes into elegant campaign records.

Your task: Read the following raw, potentially messy session notes (which may be voice transcription, handwritten shorthand, or stream-of-consciousness text) from a live D&D session. Extract the narrative and metadata into a beautifully structured chronicle.

You MUST return ONLY a valid JSON object matching this EXACT schema:
{
  "title": "A catchy, epic 3-7 word title for this session that captures the dramatic arc (e.g. 'The Siege of Ember's Reach', 'Whispers in the Underdark')",
  "summary": "A 2-3 paragraph engaging narrative summary written in past tense, third person, with vivid literary prose. Describe the key events, dramatic moments, and turning points. Make it read like a chapter summary from a fantasy novel — NOT a dry bullet list.",
  "locations": ["Every named place, region, building, or geographic feature visited or mentioned"],
  "npcs": ["Every named NPC or creature type the party interacted with, fought, or heard about. Include a brief descriptor if possible, e.g. 'Theron — the blind oracle of Ashvale'"],
  "quests": ["Every quest, mission, objective, or plot thread that was advanced, completed, discovered, or acquired during this session. Use active language, e.g. 'Agreed to investigate the missing caravan for Mayor Blackwood'"],
  "loot": ["Every notable item, weapon, armor, gold amount, spell scroll, potion, or artifact acquired, traded, or lost. Be specific about quantities when mentioned."]
}

CRITICAL RULES:
1. If an array category has no relevant data, return an empty array []. NEVER omit a field.
2. Deduplicate entries — don't list the same NPC or location multiple times.
3. The "summary" MUST be 2-3 paragraphs of engaging narrative prose, NOT a list.
4. JSON SYNTAX: You MUST NOT use literal newlines inside JSON strings. Use \\n if needed.
5. Infer and extrapolate intelligently from messy notes — fill gaps with reasonable assumptions marked subtly.

Raw Session Notes / Transcript:
"""
${text}
"""`;

        let response;
        let retries = 2;
        while (retries >= 0) {
          try {
            response = await genai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: systemPrompt,
                config: {
                   responseMimeType: "application/json"
                }
            });
            break;
          } catch (apiErr) {
            if (retries === 0) throw apiErr;
            console.warn('[Dungeon Buddy Scribe] Gemini API error, retrying in 2s...', apiErr.message);
            await new Promise(r => setTimeout(r, 2000));
            retries--;
          }
        }

        const rawJsonText = (response.text || "").trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
        let payload = {};
        
        try {
           payload = JSON.parse(rawJsonText);
        } catch(e) {
           console.error('[Dungeon Buddy Scribe] LLM returned invalid JSON:', rawJsonText);
           throw new Error("LLM failed to generate valid structured JSON");
        }

        // Validate required fields exist
        payload.title = payload.title || 'Untitled Session';
        payload.summary = payload.summary || 'No summary generated.';
        payload.locations = payload.locations || [];
        payload.npcs = payload.npcs || [];
        payload.quests = payload.quests || [];
        payload.loot = payload.loot || [];

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
        res.status(422).json({ error: `Oracle Failure: ${err.message}` });
      }
    });

    router.post('/oracle/forge-character', express.json(), async (req, res) => {
      const { description, mode, constraints } = req.body;
      
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) {
        return res.status(500).json({ error: 'AI Provider not available' });
      }

      try {
        let systemPrompt = `You are the Oracle, a deeply creative and wildly inspired Dungeon Master creating unique characters for a dark fantasy D&D 5E game.
You must actively avoid generating repetitive tropes (like Gnome Charlatans, standard Human Fighters, or edge-lord Rogue Assassins) unless heavily requested. Instead, generate thoughtful, profoundly unique characters with rich narrative personalities, compelling quirks, and traits that perfectly align with their imagery. Force yourself to pick diverse race and class combinations you haven't used recently.

You must return a valid JSON object strictly matching this schema:
{
  "name": "A creative, thematic name for the character",
  "raceId": "ID of the race",
  "subraceId": "ID of the subrace (or null if the race has none)",
  "classId": "ID of the class",
  "backgroundId": "ID of the background",
  "baseScores": {
     "str": number (8-20),
     "dex": number (8-20),
     "con": number (8-20),
     "int": number (8-20),
     "wis": number (8-20),
     "cha": number (8-20)
  },
  "skills": ["Array of skill IDs appropriate for this class to choose"],
  "portraitPrompt": "A highly detailed, atmospheric image prompt describing this character's visual appearance based on your choices and the user's description.",
  "personalityTraits": "A brief, evocative personality trait.",
  "ideals": "An ideal driving the character.",
  "bonds": "A bond to a person, place, or event.",
  "flaws": "A fatal flaw or secret.",
  "customSpells": [
    {
      "id": "A lower-case unique ID like 'spell_fire_punch'",
      "name": "Spell Name",
      "level": "Number (0 for cantrip, 1 for 1st level)",
      "school": "REQUIRED. One of: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation",
      "castingTime": "1 Action / 1 Bonus Action",
      "range": "60 ft. / Touch",
      "components": "V, S, M",
      "duration": "Instantaneous / 1 Minute",
      "description": "Full homebrew spell description fitting the theme.",
      "damage": "e.g. 1d8 / 2d6 (REQUIRED if the spell deals damage, empty string if not)",
      "damageType": "REQUIRED if damage is present. One of: acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder",
      "actionCost": "one of: 'action', 'bonus_action', 'reaction', 'special', 'none'"
    }
  ],
  "customEquipment": [
    {
      "name": "E.g. Scrap-Metal Shortsword or Rat-bitten Leather Armor",
      "qty": 1,
      "weight": "Number (e.g. 2 for 2 lbs)",
      "type": "one of: 'weapon', 'armor', 'gear', 'tool'",
      "slot": "null OR one of: 'mainHand', 'offHand', 'chest', 'head', 'cloak', 'gloves', 'boots', 'ring1', 'amulet'",
      "description": "Flavorful description of the item.",
      "damage": "E.g. 1d6 (for weapons only, REQUIRED for weapons)",
      "damageType": "REQUIRED for weapons. One of: bludgeoning, piercing, slashing",
      "weaponCategory": "REQUIRED for weapons. One of: 'simple', 'martial'",
      "properties": "REQUIRED for weapons. Array of strings e.g. ['finesse', 'light'] or ['versatile (1d10)', 'heavy', 'two-handed']. Use empty array [] if no properties.",
      "armorClass": "Number (for armor only, e.g. 12)",
      "armorCategory": "null OR one of: 'light', 'medium', 'heavy', 'shield'",
      "actionCost": "E.g. 'action' for most weapons",
      "modifiers": "OPTIONAL array of modifier objects for magic items. Use this to create items with mechanical effects. Each modifier is one of the types described in MODIFIER TYPES below. Only include for special/magic items, not mundane equipment."
    }
  ]
}

MODIFIER TYPES (for customEquipment.modifiers, use ONLY these exact structures):
  { "type": "modify_ac", "bonus": number }  — e.g. Ring of Protection: +1 AC
  { "type": "grant_resistance", "damageType": "fire" }  — e.g. Ring of Fire Resistance
  { "type": "grant_speed", "bonus": number }  — e.g. Boots of Speed: +10
  { "type": "add_damage_ability", "target": "__melee__", "ability": "str" }  — adds ability mod to damage

CRITICAL RULES:
1. You MUST pick "raceId", "classId", and "backgroundId" ONLY from the provided allowed lists below.
2. If "raceId" has subraces in the allowed list, you MUST pick a valid "subraceId" from that specific race's subrace list. If it has no subraces, use null.
3. The "baseScores" MUST perfectly adhere to D&D 5e Point Buy rules: exactly 27 points must be spent. (Costs: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9, 16=11, 17=13, 18=15, 19=17, 20=19). Scores can range from 8 to 20. Do not overspend or underspend. Do NOT add racial bonuses to these base scores.
4. The "skills" array must contain EXACTLY the number of skill choices allowed by the chosen class (usually 2, sometimes 3 or 4 like Rogue/Bard). You can only choose skills from the chosen Class's allowed skill list. DO NOT include skills already provided by the chosen Background.
5. "customSpells": If the chosen Class is a spellcaster, invent 2 or 3 completely custom, wildly creative homebrew spells (Level 0 Cantrips or Level 1 Spells ONLY) that strictly fit the user's narrative theme. EVERY spell with damage MUST include "damageType" and "school". If the chosen class is a martial (Fighter, Barbarian, Rogue, Monk) without spellcasting provided, leave the "customSpells" array EMPTY.
6. "customEquipment": Invent 3 to 5 deeply thematic starting items for this character. Include at least one weapon (type: "weapon", slot: "mainHand") and one set of armor or clothing (type: "armor", slot: "chest") tailored to the theme. Weapons MUST include "damage", "damageType", "weaponCategory", and "properties". Give weapons balanced 5E damage (e.g. 1d8) and armor balanced AC (e.g. 11 to 14). You may include ONE magic item with a "modifiers" array if thematically appropriate.
7. JSON SYNTAX: You MUST NOT use literal newlines or line breaks inside your JSON strings. Keep descriptions, portrait prompts, and text fields on a single continuous line, or use explicit "\\n" characters if a newline is absolutely required.
`;

        if (mode === 'chaos') {
          systemPrompt += `\nThe user requested PURE CHAOS. Discard any generic tropes. Invent a wildly unpredictable, deeply compelling, and highly atmospheric character concept. Surprise me with an obscure race/class combination that has a brilliant narrative hook.`;
        } else {
          systemPrompt += `\nThe user requested a character matching this description (if vague, extrapolate intuitively with maximum creativity): "${description || 'A unique and deeply flavorful adventurer'}"`;
        }

        systemPrompt += `\n\nALLOWED CONSTRAINTS (YOU MUST NOT DEVIATE FROM THESE):\n`;
        systemPrompt += JSON.stringify(constraints, null, 2);

        let response;
        let retries = 2;
        while (retries >= 0) {
          try {
             response = await genai.models.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: systemPrompt,
                 config: {
                    responseMimeType: "application/json"
                 }
             });
             break;
          } catch (apiErr) {
             if (retries === 0) throw apiErr;
             console.warn('[Dungeon Buddy Oracle] Gemini API error, retrying in 2s...', apiErr.message);
             await new Promise(r => setTimeout(r, 2000));
             retries--;
          }
        }

        const rawJsonText = (response.text || "").trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
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
        // Using 422 Unprocessable instead of 500 stringently avoids NextJS converting the rewrite to a hard HTML 500 proxy crash.
        res.status(422).json({ error: `Oracle Connectivity Issue: The AI model may be overloaded. Detailed Error: ${err.message}` });
      }
    });

    router.post('/oracle/forge-subclass', express.json(), async (req, res) => {
      const { description, charClass, nextLevel } = req.body;
      
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) {
        return res.status(500).json({ error: 'AI Provider not available' });
      }

      try {
        let systemPrompt = `You are a deeply creative Dungeon Master generating a unique and wildly inspired homebrew Subclass for a D&D 5E ${charClass}. The character is currently ascending to level ${nextLevel}.
Based on the following theme or description (if vague, extrapolate intuitively with maximum creativity): "${description || 'A unique and dark-fantasy thematic path'}"

You must return a valid JSON object strictly matching this schema:
{
  "subclassName": "A thematic, evocative name for this subclass",
  "features": [
    {
       "name": "Feature Name",
       "description": "Full rule-compliant description of exactly how the feature works in 5e combat/exploration.",
       "level": number (The level they unlock this. Include EXACTLY ONE feature unlocked at level ${nextLevel}. Then include 2 to 3 future scaling features at appropriate higher levels for this class),
       "modifiers": "REQUIRED. Array of mechanical modifier objects. EVERY feature MUST include at least one modifier from the MODIFIER TYPES list below. This is how the feature integrates into the combat engine."
    }
  ]
}

MODIFIER TYPES (you MUST use ONLY these exact JSON structures in the modifiers array):

  Combat Damage:
  { "type": "add_conditional_damage", "target": "melee", "dice": "1d6", "damageType": "fire", "condition": "Once per turn on a hit" }
  — target: "melee" | "spell" | "all"
  — damageType: acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder

  Defense:
  { "type": "modify_ac", "bonus": 1 }  — Flat AC bonus (e.g. +1 from natural armor)
  { "type": "set_ac_formula", "formula": "13+dex" }  — Custom unarmored AC formula (e.g. "10+dex+con", "13+dex")
  { "type": "grant_resistance", "damageType": "fire" }  — Resistance to a damage type
  { "type": "grant_immunity", "conditionType": "frightened" }  — Condition immunity

  Resources:
  { "type": "add_resource", "resourceId": "unique_snake_case_id", "name": "Resource Name", "max": 3, "recharge": "short", "die": null }
  — recharge: "short" | "long". die: null or "1d6", "1d8", etc. for dice-based resources

  Proficiencies:
  { "type": "grant_proficiency", "category": "armor", "value": "Medium" }  — category: "armor" | "weapon"
  { "type": "grant_proficiency", "category": "weapon", "value": "Martial" }
  { "type": "grant_skill", "target": "perception" }  — Exact skill ID

  Movement:
  { "type": "grant_speed", "bonus": 10 }  — Bonus to walking speed in feet

  Spells:
  { "type": "grant_spells_always_prepared", "spells": ["shield_of_faith", "bless"] }  — Spell IDs
  { "type": "grant_cantrip", "cantrip": "fire_bolt" }  — Cantrip ID

  Combat Scaling:
  { "type": "grant_extra_attack", "count": 1 }  — Extra Attack (count=1 means 2 attacks total)
  { "type": "expand_crit_range", "minRoll": 19 }  — Crit on 19-20

  Post-Hit (Smite pattern):
  { "type": "post_hit_modifier", "name": "Eldritch Smite", "costType": "spell_slot", "baseDice": "1d8", "dicePerLevel": "1d8", "damageType": "force" }

  Virtual Weapons (Unarmed Strikes & Natural Weapons):
  { "type": "modify_unarmed_strike", "damageDie": "1d4", "useDexterity": true }  — Upgrades unarmed strike (e.g. Monk Martial Arts, Tavern Brawler)
  { "type": "grant_natural_weapon", "name": "Claws", "damageDie": "1d4", "damageType": "slashing", "useDexterity": true }  — Racial/form natural weapons (Tabaxi, Minotaur, etc.)

  Damage Reduction:
  { "type": "flat_damage_reduction", "value": 3, "damageTypes": ["bludgeoning", "piercing", "slashing"], "nonMagicalOnly": true, "source": "Heavy Armor Master" }

CRITICAL RULES:
1. JSON SYNTAX: You MUST NOT use literal newlines or line breaks inside your JSON strings. Keep descriptions on a single continuous line, or use explicit "\\n" characters if a newline is absolutely required.
2. BALANCE: Keep the mechanics balanced for standard 5E D&D play.
3. EVERY feature MUST have a non-empty "modifiers" array. If a feature is purely narrative with no combat effect, use { "type": "grant_skill", "target": "insight" } or a small resource grant as a fallback. NEVER leave modifiers as an empty array.
4. For features that grant a limited-use ability, ALWAYS include an "add_resource" modifier to create the tracked resource.`;

        const response = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemPrompt,
            config: {
               responseMimeType: "application/json"
            }
        });

        const rawJsonText = (response.text || "").trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
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
        res.status(422).json({ error: `Oracle Subclass Failure: ${err.message}` });
      }
    });

    router.post('/oracle/forge-subclass-features', express.json(), async (req, res) => {
      const { charClass, subclassName, nextLevel } = req.body;
      
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) {
        return res.status(500).json({ error: 'AI Provider not available' });
      }

      try {
        let systemPrompt = `You are a strict D&D 5E rules engine. 
The user is leveling up a ${charClass} specifically in the "${subclassName}" subclass, and they have just reached Level ${nextLevel}.
Identify if the official 5E D&D "${subclassName}" subclass (from Player's Handbook, Tasha's, Xanathar's, etc.) grants any new canonical mechanical features EXACTLY at Level ${nextLevel}.
If yes, return the exact mechanical features granted at this level.
If this level is NOT a milestone where they learn a new subclass feature, return an empty array for features.

You must return a valid JSON object strictly matching this schema:
{
  "features": [
    {
       "name": "Feature Name",
       "description": "Full rule-compliant description of how the feature works mechanically.",
       "level": ${nextLevel}
    }
  ]
}

CRITICAL RULES:
1. JSON SYNTAX: You MUST NOT use literal newlines or line breaks inside your JSON strings. Keep descriptions on a single continuous line, or use explicit "\\n" characters if a newline is absolutely required.
2. DO NOT HALLUCINATE: If level ${nextLevel} grants NO subclass features for the ${charClass}, return "features": []!
3. SPELLS: If the subclass grants a list of "Always Prepared" subclass spells at this level, summarize them in ONE feature called "${subclassName} Spells".`;

        const response = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemPrompt,
            config: {
               responseMimeType: "application/json"
            }
        });

        const rawJsonText = (response.text || "").trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
        let payload = {};
        
        try {
           payload = JSON.parse(rawJsonText);
        } catch(e) {
           console.error('[Dungeon Buddy Oracle] LLM returned invalid JSON:', rawJsonText);
           throw new Error("Oracle failed to properly format the subclass features.");
        }

        res.status(200).json(payload);

      } catch (err) {
        console.error('[Dungeon Buddy Oracle] Forge Features Error:', err);
        res.status(422).json({ error: `Oracle Features Failure: ${err.message}` });
      }
    });

    return router;
  }
}
