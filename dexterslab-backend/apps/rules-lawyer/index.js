import express from 'express';

const DEFAULT_THEME = {
  hat: 'cap',
  accessory: 'glasses',
  palette: { primary: '#00ffe0', secondary: '#ffaa00', bg: '#06060e' },
  genre: 'default',
};

export default class RulesLawyerApp {
  static manifest = {
    id: 'rules-lawyer',
    name: 'Rules Lawyer',
    target: 'pi',
    hardware: ['display', 'mic', 'tts'],
    wsPath: '/ws/ruleslawyer',
    frontendRoute: '/observer/rules-lawyer',
    icon: '§',
    priority: 5
  };

  constructor(platform) {
    this.platform = platform;
    this.resetSession();
    this.wsHandler = null;
    this.wsClients = new Set();
    this.subscriptions = [];
  }

  resetSession() {
    this.session = {
      active: false,
      game: null,
      pendingGame: null,
      theme: DEFAULT_THEME,
      history: [],
      ignoreSTTUntil: 0
    };
    this._chunkIndex = 0; // Tracks streaming chunk index across a response
  }

  getWsHandler() {
    if (!this.wsHandler) {
      const wss = this.platform.wsRouter.registerPath(RulesLawyerApp.manifest.wsPath);
      wss.on('connection', (ws) => {
        this.wsClients.add(ws);
        console.log(`§ [RulesLawyer] Client connected (total: ${this.wsClients.size})`);
        ws.on('close', () => {
          this.wsClients.delete(ws);
          console.log(`§ [RulesLawyer] Client disconnected (remaining: ${this.wsClients.size})`);
        });
        ws.on('error', () => this.wsClients.delete(ws));
      });

      // Auto-activate/deactivate based on display client connections
      this.platform.appManager.wsAutoActivate(RulesLawyerApp.manifest.id, wss);

      this.wsHandler = wss;
    }
    return this.wsHandler;
  }

  broadcast(msgObj) {
    const payload = JSON.stringify(msgObj);
    for (const client of this.wsClients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  /**
   * Speak text via streaming TTS pipeline.
   * Splits text at sentence boundaries and sends chunks sequentially
   * so the Pi starts speaking immediately while later sentences buffer.
   */
  speak(text) {
    if (!text) return;
    const chunks = this._splitSentences(text);
    if (chunks.length === 0) return;

    for (let i = 0; i < chunks.length; i++) {
      const isLast = (i === chunks.length - 1);
      this.platform.hardwareBroker.speakChunk(
        RulesLawyerApp.manifest.id,
        chunks[i],
        this._chunkIndex,
        isLast
      );

      // Broadcast chunk to display clients for live text rendering
      const chunkPacket = JSON.stringify({
        type: 'oracle_chunk',
        text: chunks[i],
        chunkIndex: this._chunkIndex,
        isLast
      });
      for (const client of this.wsClients) {
        if (client.readyState === 1) client.send(chunkPacket);
      }
      this._chunkIndex++;
    }

    // Rough estimate for ignoreSTTUntil fallback
    const wordCount = text.split(/\s+/).length;
    const durationMs = (wordCount / 2.5) * 1000 + 2000;
    this.session.ignoreSTTUntil = Date.now() + durationMs;
  }

  /**
   * Split text into sentence-boundary chunks.
   * Mirrors the Oracle's _chunkSentences but works on complete text.
   */
  _splitSentences(text) {
    // Split on sentence-ending punctuation followed by whitespace
    const raw = text.split(/(?<=[.!?])\s+/);
    return raw.filter(s => s.trim().length > 0);
  }

  async onActivateDisplay() {
    console.log('[RulesLawyer] Activating... Ready for voice input');
    
    // Claim TTS to enable voice responses
    this.platform.hardwareBroker.claimTTS(RulesLawyerApp.manifest.id);
    
    let lastNavTimestamp = 0;
    this.subscriptions.push(this.platform.bus.subscribe('voice.navigation', (data) => {
      lastNavTimestamp = data.timestamp || Date.now();
    }));

    // Subscribe to STT for vocal flows
    this.subscriptions.push(this.platform.hardwareBroker.subscribeSTT(async (text) => {
      if (Date.now() - lastNavTimestamp < 500) return; // skip if consumed by voice-navigator
      if (this.session.ignoreSTTUntil && Date.now() < this.session.ignoreSTTUntil) {
          console.log(`[RulesLawyer] Ignored likely TTS echo STT: "${text}"`);
          return;
      }
      if (!text.trim()) return;
      
      const lowerText = text.toLowerCase();

      if (!this.session.active) {
         if (this.session.pendingGame) {
            const isYes = lowerText.match(/\b(yes|correct|yeah|yep|play|start)\b/i);
            const isNo = lowerText.match(/\b(no|try again|wrong|cancel|wait)\b/i);

            if (isYes) {
               console.log(`[RulesLawyer] Confirmed game: ${this.session.pendingGame}`);
               const confirmedGame = this.session.pendingGame;
               this.session.pendingGame = null;
               try {
                 const res = await this.doStart(confirmedGame);
                 if (res.success) {
                     if (res.greeting) this.speak(res.greeting);
                     this.broadcast({ type: 'start_response', data: res, userText: confirmedGame });
                 }
               } catch(e) { console.error('[RulesLawyer] Vocal Start Error:', e); }
            } else if (isNo) {
               console.log(`[RulesLawyer] Cancelled game confirmation`);
               this.session.pendingGame = null;
               this.speak("Okay, try again.");
               this.broadcast({ type: 'stt_retry' });
            }
            return;
         }

         // Prevent starting a game from long ambient conversations
         const isPlayCommand = lowerText.includes('play') || lowerText.includes('start') || lowerText.includes('game');
         const wordCount = text.trim().split(/\s+/).length;
         if (!isPlayCommand && wordCount > 4) {
            console.log(`[RulesLawyer] Ignored ambient text for game start: "${text}"`);
            return;
         }

         console.log(`[RulesLawyer] Heard potential Game Name: "${text}"`);
         this.session.pendingGame = text;
         this.speak(`Did you say ${text}?`);
         this.broadcast({ type: 'stt_confirm', text });
      } else {
         // During active session, only respond to explicit questions or when addressed
         const isQuestion = lowerText.includes('?') || 
                            lowerText.includes('lawyer') || 
                            lowerText.includes('rule') ||
                            lowerText.match(/^(how|what|when|where|why|can|does|do|if|is|are)/);

         if (!isQuestion) {
            console.log(`[RulesLawyer] Ignored ambient conversation: "${text}"`);
            return;
         }

         console.log(`[RulesLawyer] Heard Rules Query: "${text}"`);
         try {
           const res = await this.doAsk(text);
           if (res.answer) {
               this.speak(res.answer);
               this.broadcast({ type: 'ask_response', data: res, userText: text });
           }
         } catch(e) { console.error('[RulesLawyer] Vocal Ask Error:', e); }
      }
    }));
  }

  async onDeactivateDisplay() {
    console.log('[RulesLawyer] Deactivating...');
    this.platform.hardwareBroker.releaseTTS(RulesLawyerApp.manifest.id);
    for (const sub of this.subscriptions) sub();
    this.subscriptions = [];
  }

  async doStart(game) {
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai) throw new Error('No LLM access');

      const prompt = `You are the Rules Lawyer, an expert board game assistant. The user wants to play "${game}". 
Return a valid JSON object matching this exact schema:
{
  "success": true,
  "game": "The formal/canonical name of the game",
  "persona": {
    "hat": "one of: tophat, wizard, helmet, hood, military, party, cap, none",
    "accessory": "one of: monocle, beard, antenna, glowing_eyes, medals, bow_tie, glasses, none",
    "palette": { "primary": "Hex color code", "secondary": "Hex color code", "bg": "Hex color code" },
    "genre": "one of: economic, fantasy, space, horror, war, party, default"
  },
  "mood": "excited",
  "greeting": "A short, in-character greeting acknowledging the game we are playing."
}

CRITICAL RULES:
- Pick the persona elements that best fit the theme of "${game}".
- JSON SYNTAX: Keep descriptions/greetings on a single continuous line.`;

      const response = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
      });

      const rawJsonText = (response.text || "").trim();
      const payload = JSON.parse(rawJsonText);

      this.session = {
        active: true,
        game: payload.game || game,
        theme: payload.persona || DEFAULT_THEME,
        history: []
      };

      const systemInstruction = `You are the Rules Lawyer, an expert, slightly smug, and highly confident board game rules assistant. You are currently helping a group play ${this.session.game}. Keep answers concise, accurate, and thematic. If you cite a rule, provide a likely rulebook section reference if possible. Do NOT break character.`;
      
      this.session.history.push({ role: 'user', parts: [{ text: systemInstruction }] });
      this.session.history.push({ role: 'model', parts: [{ text: `Understood. I am the Rules Lawyer for ${this.session.game}. Your rules queries are my command.` }] });

      return payload;
  }

  async doAsk(question) {
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai || !this.session.active) throw new Error('No active session or LLM');

      const userMessage = `The user asks: "${question}"
      
Respond with a JSON object matching this exact schema:
{
  "answer": "Your concise, in-character answer to the rules question.",
  "mood": "one of: confident, thinking, excited, confused, smug, disappointed, surprised",
  "rule_reference": "Optional citation of the rulebook section, or null if irrelevant."
}`;

      const requestHistory = [...this.session.history, { role: 'user', parts: [{ text: userMessage }] }];

      const response = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: requestHistory,
          config: { responseMimeType: "application/json" }
      });

      const rawJsonText = (response.text || "").trim();
      const payload = JSON.parse(rawJsonText);
      
      this.session.history.push({ role: 'user', parts: [{ text: question }] });
      this.session.history.push({ role: 'model', parts: [{ text: payload.answer }] });

      return {
        answer: payload.answer,
        mood: payload.mood || 'confident',
        rule_reference: payload.rule_reference
      };
  }

  getRoutes() {
    const router = express.Router();

    router.get('/status', (req, res) => {
      const genai = this.platform.aiProvider?.getGenAI();
      res.json({
        active: this.session.active,
        game: this.session.game,
        theme: this.session.theme,
        hasLLM: !!genai
      });
    });

    router.post('/start', express.json(), async (req, res) => {
      try {
        this.session.pendingGame = null; // Clear if manual text start occurs
        const payload = await this.doStart(req.body.game);
        if (payload.greeting) this.speak(payload.greeting);
        // Also broadcast to clear confirming state visually
        this.broadcast({ type: 'start_response', data: payload, userText: req.body.game });
        res.json(payload);
      } catch (err) {
        res.status(500).json({ error: 'Failed to start session. Matrix is glitchy.' });
      }
    });

    router.post('/cancel_start', (req, res) => {
      this.session.pendingGame = null;
      res.json({ success: true });
    });

    router.post('/ask', express.json(), async (req, res) => {
      try {
        const payload = await this.doAsk(req.body.question);
        if (payload.answer) this.speak(payload.answer);
        res.json(payload);
      } catch (err) {
        res.status(500).json({ error: 'Brain glitch! The rulebook page was missing.' });
      }
    });

    router.post('/suggest', express.json(), async (req, res) => {
      const genai = this.platform.aiProvider?.getGenAI();
      if (!genai || !this.session.active) return res.status(500).json({ error: 'No active session or LLM.' });
      try {
        const msg = `Provide a totally unprompted, helpful, short gameplay tip, strategy suggestion, or obscure rule reminder for ${this.session.game}. Keep it 1-2 sentences. 
Return a JSON object exactly like this: { "tip": "The tip...", "mood": "smug or confident" }`;
        const tempHistory = [...this.session.history, { role: 'user', parts: [{ text: msg }] }];
        const response = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: tempHistory,
            config: { responseMimeType: "application/json" }
        });
        const rawJsonText = (response.text || "").trim();
        const payload = JSON.parse(rawJsonText);
        // Also speak the unprompted suggestion
        if (payload.tip) this.speak(payload.tip);
        res.json(payload);
      } catch (err) {
        res.status(500).json({ error: 'Failed to suggest tip' });
      }
    });

    router.post('/end', (req, res) => {
      this.resetSession();
      this.broadcast({ type: 'end_response' });
      res.json({ success: true });
    });

    return router;
  }
}
