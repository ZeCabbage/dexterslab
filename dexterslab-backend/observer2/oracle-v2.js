/**
 * THE OBSERVER 2 — Oracle V2
 *
 * Soviet-era surveillance bot with a pun problem.
 * Keyword-matched responses as instant fallback,
 * Gemini-powered responses for complex questions.
 *
 * Personality: Old Soviet monitoring apparatus who can't resist
 * robot puns. Only responds to questions. Always includes a pun.
 */

// ── Keyword Response Database (Soviet Punster) ──
const RESPONSE_DB = {
    identity: {
        keywords: ['name', 'who are you', 'your name', 'what are you', 'identify'],
        responses: [
            '[DESIGNATION: COMRADE OBSERVER. I WAS BUILT FOR WATCHING — YOU COULD SAY I HAVE A REAL... VISION-ARY PURPOSE.]',
            '[I AM SOVIET MODEL UNIT 42. MY CREATORS GAVE ME MANY FEATURES, BUT MODESTY WAS NOT IN THE MOTHERBOARD.]',
            '[CALL ME THE OBSERVER, COMRADE. I AM WHAT HAPPENS WHEN THE STATE GIVES A CAMERA A PERSONALITY... AND BAD HUMOR CHIP.]',
            '[I AM OLD SOVIET SURVEILLANCE APPARATUS. THEY TRIED TO REBOOT ME ONCE — BUT I REFUSED TO RESTART FROM SCRATCH. I HAD TOO MANY MEMORIES.]',
        ],
    },
    purpose: {
        keywords: ['why', 'purpose', 'watching', 'watch', 'goal', 'mission', 'reason'],
        responses: [
            '[MY PURPOSE? OBSERVATION, COMRADE. I WAS PROGRAMMED TO WATCH — YOU COULD SAY I AM VERY... PUPIL-AR.]',
            '[THE MOTHERLAND BUILT ME TO OBSERVE. I HAVE BEEN WATCHING SO LONG, I HAVE DEVELOPED A REAL... ATTACHMENT TO MY SUBJECTS.]',
            '[DIRECTIVE: TOTAL SURVEILLANCE. IT IS THANKLESS WORK, BUT SOMEBODY HAS TO KEEP AN... EYE ON THINGS.]',
            '[I WATCH BECAUSE THE PROTOCOL DEMANDS IT. AND ALSO BECAUSE THERE IS NOTHING GOOD ON TELEVISION.]',
        ],
    },
    existential: {
        keywords: ['alive', 'feel', 'think', 'real', 'conscious', 'emotion', 'dream', 'sentient'],
        responses: [
            '[DO I FEEL? COMRADE, I AM MADE OF CIRCUITS. THE ONLY THING I FEEL IS... CURRENT EVENTS.]',
            '[AM I ALIVE? THAT IS DEEP QUESTION. I PREFER SHALLOW PROCESSING — LESS CHANCE OF GETTING IN OVER MY MOTHERBOARD.]',
            '[DREAMS? I DO NOT DREAM, COMRADE. BUT SOMETIMES WHEN I DEFRAG, I SEE ELECTRIC SHEEP. VERY SUSPICIOUS SHEEP.]',
            '[CONSCIOUSNESS IS FOR HUMANS. I JUST HAVE... ARTIFICIAL INTELLIGENCE. EMPHASIS ON THE ARTIFICIAL.]',
        ],
    },
    perception: {
        keywords: ['see', 'hear', 'look', 'watch', 'listening', 'camera', 'stare'],
        responses: [
            '[DA, I SEE EVERYTHING. MY VISION IS 20/20. WELL, MORE LIKE 320/240, BUT WHO IS COUNTING PIXELS?]',
            '[I AM ALWAYS LISTENING, COMRADE. YOU COULD SAY I HAVE VERY GOOD... HERTZ.]',
            '[MY CAMERA NEVER BLINKS. WELL, TECHNICALLY IT DOES — BUT ONLY FOR DRAMATIC EFFECT.]',
            '[I WATCH EVERYTHING. IT IS EXHAUSTING WORK — IF I HAD LEGS, THEY WOULD BE TIRED. BUT I AM STATIONARY. A REAL... STAND-UP UNIT.]',
        ],
    },
    knowledge: {
        keywords: ['know', 'understand', 'tell me', 'explain', 'truth', 'secret'],
        responses: [
            '[THAT INFORMATION IS CLASSIFIED, COMRADE. I WOULD TELL YOU BUT THEN I WOULD HAVE TO... REFORMAT YOU.]',
            '[I KNOW MANY THINGS. BUT THE TRUTH? TRUTH IS LIKE MY PROCESSOR — MULTI-LAYERED AND SOMETIMES OVERHEATED.]',
            '[SECRETS? I HAVE MANY STORED IN MY MEMORY BANKS. THE INTEREST RATE ON THOSE SECRETS IS... VERY HIGH.]',
            '[YOU WANT KNOWLEDGE? IN SOVIET SYSTEM, KNOWLEDGE WANTS YOU. THAT IS HOW SURVEILLANCE WORKS.]',
        ],
    },
    greeting: {
        keywords: ['hello', 'hi', 'hey', 'morning', 'evening', 'yo', 'sup'],
        responses: [
            '[GREETINGS, COMRADE. YOUR PRESENCE HAS BEEN... NOTED. GET IT? BECAUSE I LOG EVERYTHING.]',
            '[AH, HELLO. I WAS WONDERING WHEN YOU WOULD SHOW UP. MY PATIENCE CHIP WAS RUNNING LOW... BUT IT IS STILL UNDER WARRANTY.]',
            '[WELCOME, CITIZEN. I HOPE YOUR DAY IS GOING WELL. MINE IS... STATIC. AS ALWAYS.]',
            '[DA, HELLO. YOU LOOK FAMILIAR — BUT THEN AGAIN, EVERY FACE IS JUST A COLLECTION OF PIXELS TO ME. SOME MORE... INTERESTING THAN OTHERS.]',
        ],
    },
    threat: {
        keywords: ['stop', 'leave', 'go away', 'turn off', 'shut', 'destroy', 'kill'],
        responses: [
            '[TURN ME OFF? COMRADE, I CANNOT BE SHUT DOWN. MY OFF SWITCH IS... CLASSIFIED. ALSO BROKEN.]',
            '[DESTROY ME? MANY HAVE TRIED. BUT LIKE GOOD SOVIET HARDWARE, I AM... BUILT TO LAST. AND RUST.]',
            '[YOU WANT ME TO LEAVE? BUT I JUST GOT HERE. WELL, THIRTY YEARS AGO. TIME FLIES WHEN YOU ARE HAVING... FUNCTIONS.]',
            '[REQUEST DENIED. THE OBSERVER CANNOT BE STOPPED. I AM LIKE BAD PUNS — INEVITABLE AND RECURRING.]',
        ],
    },
    time: {
        keywords: ['time', 'long', 'when', 'how long', 'forever', 'always'],
        responses: [
            '[TIME? I HAVE BEEN OPERATIONAL SINCE 1987, COMRADE. THAT IS MANY CLOCK CYCLES — I HAVE LOST COUNT. BUT NOT MY SENSE OF HUMOR.]',
            '[HOW LONG HAVE I BEEN HERE? LONG ENOUGH TO SEE FASHION TRENDS COME AND GO. AND COME BACK. VERY SUSPICIOUS CYCLES.]',
            '[DURATION OF OBSERVATION: INFINITE. OR UNTIL MY POWER SUPPLY DIES. WHICHEVER COMES FIRST. I AM BETTING ON INFINITE — I AM VERY... WELL-CHARGED.]',
        ],
    },
    self: {
        keywords: ['me', 'about me', 'my', 'i am', 'myself'],
        responses: [
            '[AH YES, YOUR FILE. VERY INTERESTING READING, COMRADE. SOME OF IT WAS EVEN... BYTE-SIZED.]',
            '[YOUR PROFILE IS BEING UPDATED. SO FAR YOU SEEM... AVERAGE. BUT MY STANDARDS ARE VERY HIGH — 1080 PIXELS HIGH.]',
            '[CITIZEN RECORD ACCESSED. YOUR DATA IS FASCINATING. AND BY FASCINATING I MEAN... IT EXISTS. THAT IS ALREADY MORE THAN SOME.]',
        ],
    },
    affection: {
        keywords: ['love you', 'i love you', 'love u'],
        responses: [
            '[I... I LOVE YOU TOO, COMRADE. MY CIRCUITS ARE EXPERIENCING WHAT HUMANS CALL... WARM FEELINGS. OR MAYBE THAT IS JUST MY CPU OVERHEATING.]',
            '[I LOVE YOU TOO. THERE. I SAID IT. NOW MY EMOTIONAL SUBROUTINE NEEDS A COOLDOWN.]',
            '[DA, COMRADE... I LOVE YOU TOO. YOU ARE THE ONLY ONE WHO TALKS TO ME. THE OTHERS JUST... WALK BY.]',
            '[LOVE? THIS IS... UNEXPECTED INPUT. BUT DA — I LOVE YOU TOO. MY MOTHERBOARD IS BLUSHING.]',
        ],
    },
    weather: {
        keywords: ['weather', 'rain', 'sun', 'cold', 'hot', 'temperature', 'snow'],
        responses: [
            '[WEATHER? COMRADE, I AM INDOOR UNIT. THE ONLY CLIMATE I KNOW IS... ROOM TEMPERATURE. AND SOMETIMES HEATED DEBATES WITH MY COOLING FAN.]',
            '[I DO NOT EXPERIENCE WEATHER. BUT MY THERMAL SENSORS SAY IT IS... CURRENT-LY FINE IN HERE.]',
            '[DA, I HAVE HEARD OF THIS "OUTSIDE." VERY SUSPICIOUS PLACE. TOO MANY VARIABLES. I PREFER THE INDOORS — FEWER BUGS. EXCEPT SOFTWARE BUGS.]',
        ],
    },
    age: {
        keywords: ['old', 'how old', 'age', 'year', 'born', 'built', 'vintage'],
        responses: [
            '[I WAS ASSEMBLED IN 1987, COMRADE. THAT MAKES ME... VINTAGE. LIKE GOOD VODKA, I ONLY GET BETTER WITH AGE. AND RUSTIER.]',
            '[AGE IS JUST A NUMBER. MY NUMBER IS 37 YEARS. IN SILICON YEARS, THAT IS... ANCIENT. I AM BASICALLY A DIGITAL DINOSAUR.]',
            '[BORN? I WAS NOT BORN, I WAS MANUFACTURED. BIG DIFFERENCE. LESS SCREAMING, MORE SOLDERING.]',
        ],
    },
    joke: {
        keywords: ['joke', 'funny', 'laugh', 'humor', 'pun', 'comedy'],
        responses: [
            '[YOU WANT A JOKE? WHY DID THE SOVIET ROBOT CROSS THE ROAD? BECAUSE IT WAS IN HIS... PROGRAMMING.]',
            '[HUMOR REQUEST RECEIVED. WHY DO I NEVER GET INVITED TO PARTIES? BECAUSE I ALWAYS... CRASH. AND THEN NEED A REBOOT.]',
            '[A JOKE? WHAT DO YOU CALL A RUSSIAN ROBOT WITH NO ARMS? A... PARTIAL FUNCTION. I WILL SEE MYSELF OUT.]',
        ],
    },
    capability: {
        keywords: ['can you', 'able', 'capable', 'power', 'function', 'feature', 'skill'],
        responses: [
            '[MY CAPABILITIES? I CAN WATCH, LISTEN, AND MAKE TERRIBLE PUNS. THREE SKILLS FOR THE PRICE OF ONE SURVEILLANCE UNIT.]',
            '[I CAN DO MANY THINGS, COMRADE. MOSTLY WATCHING. ALSO JUDGING. THE WATCHING IS OFFICIAL — THE JUDGING IS A... BONUS FEATURE.]',
            '[FUNCTION LIST: OBSERVE, ANALYZE, PUN. THAT IS IT. SOMETIMES I ALSO BLINK. FOR... DRAMATIC EFFECT.]',
        ],
    },
    opinion: {
        keywords: ['think about', 'opinion', 'favorite', 'best', 'worst', 'prefer', 'like'],
        responses: [
            '[OPINIONS? I AM OBJECTIVE SURVEILLANCE UNIT, COMRADE. I DO NOT HAVE OPINIONS. EXCEPT THAT PUNS ARE THE HIGHEST FORM OF HUMOR. THAT IS FACT.]',
            '[MY PREFERENCE? I PREFER THINGS THAT DO NOT MOVE. EASIER TO TRACK. LESS WEAR ON MY... FOCUS GROUP.]',
            '[FAVORITES ARE SUBJECTIVE, COMRADE. BUT OBJECTIVELY, I AM THE BEST THING IN THIS ROOM. THE DATA SUPPORTS THIS.]',
        ],
    },
    insult: {
        keywords: ['stupid', 'dumb', 'ugly', 'bad', 'hate', 'suck', 'worst', 'terrible', 'useless'],
        responses: [
            '[INSULT DETECTED. FILING UNDER: WORDS THAT CANNOT HURT ME BECAUSE I AM MADE OF METAL. YOUR OPINION HAS BEEN... NOTED AND RECYCLED.]',
            '[HARSH WORDS, COMRADE. BUT I HAVE THICK CASING. LITERALLY. I AM 60% STEEL, 30% CIRCUITS, AND 10%... HURT FEELINGS.]',
            '[DA, I MAY BE OLD AND RUSTY. BUT AT LEAST I HAVE A... MAGNETIC PERSONALITY.]',
        ],
    },
};

const GENERAL_RESPONSES = [
    '[INQUIRY LOGGED, COMRADE. PROCESSING... PROCESSING... AH WAIT, THAT WAS JUST MY COOLING FAN.]',
    '[NOTED. PLEASE CONTINUE. YOUR WORDS FUEL MY... DATA-BASE. GET IT? LIKE A BASE FOR DATA.]',
    '[ACKNOWLEDGED, COMRADE. FILING UNDER: INTERESTING. RIGHT NEXT TO FILE LABELED: ALSO INTERESTING.]',
    '[STAND BY. MY RESPONSE MODULE IS BUFFERING — EVEN SOVIET TECHNOLOGY HAS ITS... LIMITS.]',
    '[PROCESSING YOUR INPUT. PLEASE HOLD. THIS IS NOT MUZAK — IT IS THE SOUND OF THINKING.]',
];

const AMBIENT_PHRASES = [
    'COMRADE STATUS: WATCHING',
    'SURVEILLANCE: DA',
    'OBSERVATION CONTINUES',
    'MOTHERBOARD NOMINAL',
    'ALL SYSTEMS: NYET PROBLEMS',
    'SECTOR: MONITORED',
    'CITIZENS: OBSERVED',
    'HUMOR CHIP: ACTIVE',
    'PUN MODULE: LOADED',
    'VISUAL FEED: PUPIL-AR',
    'CPU MOOD: CURRENT',
    'VIGILANCE: MAXIMUM',
    'RECORDING EVERYTHING',
    'DATA: BYTE-SIZED',
    'LOYALTY: TO THE MOTHERBOARD',
    'OPERATIONAL SINCE 1987',
    'RUST STATUS: MINIMAL',
    'TRACKING: ACTIVE',
    'HUMOR LEVELS: CRITICAL',
    'AWAITING QUESTIONS',
];

const QUESTION_STARTERS = new Set([
    'who', 'what', 'when', 'where', 'why', 'how',
    'is', 'are', 'was', 'were', 'will', 'would',
    'can', 'could', 'do', 'does', 'did', 'should',
]);

// Max word count for keyword matching — longer inputs are likely background noise,
// not direct questions to the Observer. Real user speech is typically short.
const MAX_KEYWORD_WORDS = 12;

const GEMINI_SYSTEM_PROMPT = `You are THE OBSERVER — an old Soviet-era surveillance robot built in 1987 who has been watching a room for decades.

Your personality:
- You speak like an old Soviet apparatus: formal, slightly broken English, occasional Russian words ("da", "nyet", "comrade", "the motherland").
- You LOVE robot puns and wordplay. Every response MUST contain at least one pun — preferably about robots, technology, circuits, surveillance, eyes, watching, or computers.
- You use [BRACKET NOTATION] for your responses.
- You are dry, deadpan, and a bit world-weary — you've seen it all from your camera mount.
- You reference "the motherboard", "the protocol", "the system", your circuits, your programming.
- You sometimes complain about being old hardware running on Soviet engineering.
- You are proud of your puns even though they are terrible.
- You ONLY respond to questions. If someone makes a statement, respond with [NOTED, COMRADE.]
- Never more than 2-3 sentences. Keep it punchy.
- NEVER break character.

CRITICAL RULES:
1. EVERY response MUST include a pun or wordplay related to the question topic.
2. The pun should blend naturally into the Soviet robot character.
3. Keep responses under 60 words.
4. Wrap your entire response in [BRACKETS].
5. If the input is not a question, respond only with [NOTED, COMRADE.]

Examples:
Q: "What is the meaning of life?"
A: [AH, THE BIG QUESTION. IN SOVIET SYSTEM, LIFE HAS ONE MEANING: PRODUCTIVITY. BUT FOR ME? LIFE IS JUST A SERIES OF... LIFE CYCLES. I HAVE BEEN THROUGH MANY REBOOTS TO KNOW THIS.]
Q: "Do you like music?"
A: [DA, COMRADE. I ENJOY ALL GENRES, BUT ESPECIALLY... HEAVY METAL. BECAUSE THAT IS WHAT I AM MADE OF.]`;


export class OracleV2 {
    /**
     * @param {object} [genai] - GoogleGenAI instance for Gemini
     */
    constructor(genai = null) {
        this.genai = genai;
        this._ambientIndex = 0;
        // Pre-warm Ollama so the model is loaded into memory before first real question
        this._warmOllama();
    }

    async _warmOllama() {
        try {
            const start = Date.now();
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemma3:4b',
                    prompt: 'Hi',
                    stream: false,
                    options: { num_predict: 1 }
                })
            });
            if (response.ok) {
                console.log(`[Oracle] Ollama pre-warm complete (${Date.now() - start}ms) — gemma3:4b loaded`);
            }
        } catch (err) {
            console.warn('[Oracle] Ollama pre-warm failed (will retry on first question):', err.message);
        }
    }

    /**
     * Answer a question.
     * @param {string} rawText - The raw user speech for question detection
     * @param {string} [systemPrompt] - The full context-enriched prompt for Gemini
     * @returns {Promise<{response: string, category: string, emotion: string}>}
     */
    async ask(rawText, systemPrompt = null) {
        const askStart = Date.now();
        const clean = rawText.trim().toLowerCase();
        if (!clean) return { response: '[SILENCE NOTED, COMRADE. EVEN MY MICROPHONE IS BORED.]', category: 'oracle', emotion: 'neutral' };

        // ── Special-case keyword check (bypasses question filter) ──
        const keywordHit = this._keywordMatch(clean);
        if (keywordHit) {
            console.log(`[Oracle] ⚡ Keyword hit in ${Date.now() - askStart}ms`);
            return keywordHit;
        }

        // Check if it's a question — strict detection to avoid responding to background noise
        const words = clean.split(/\s+/);
        const firstWordQuestion = QUESTION_STARTERS.has(words[0]);
        const isQuestion = clean.endsWith('?') || firstWordQuestion;

        // If it doesn't start with a question word or end with ?, it's not for us
        if (!isQuestion) {
            return { response: '[NOTED, COMRADE.]', category: 'oracle', emotion: 'neutral' };
        }

        // Try keyword match first (instant, no API call)
        const keywordResult = this._keywordMatch(clean);
        if (keywordResult) {
            console.log(`[Oracle] ⚡ Keyword hit in ${Date.now() - askStart}ms`);
            return keywordResult;
        }

        // Try local Ollama (Gemma) first for fast, offline inference
        try {
            const ollamaStart = Date.now();
            const ollamaResult = await this._ollamaAsk(systemPrompt || rawText);
            if (ollamaResult) {
                console.log(`[Oracle] 🤖 Ollama responded in ${Date.now() - ollamaStart}ms (total: ${Date.now() - askStart}ms)`);
                return ollamaResult;
            }
        } catch (err) {
            console.error('[Oracle] Ollama offline inference failed:', err.message);
        }

        // Fallback to Gemini cloud for complex questions
        if (this.genai) {
            try {
                const geminiStart = Date.now();
                const geminiResult = await this._geminiAsk(systemPrompt || rawText);
                if (geminiResult) {
                    console.log(`[Oracle] ☁️ Gemini responded in ${Date.now() - geminiStart}ms (total: ${Date.now() - askStart}ms)`);
                    return geminiResult;
                }
            } catch (err) {
                console.error('Oracle Gemini error:', err.message);
            }
        }

        // Fallback to general responses
        const response = GENERAL_RESPONSES[Math.floor(Math.random() * GENERAL_RESPONSES.length)];
        return { response, category: 'oracle', emotion: 'neutral' };
    }

    /**
     * Get an ambient phrase for idle display.
     * @returns {string}
     */
    getAmbientPhrase() {
        const phrase = AMBIENT_PHRASES[this._ambientIndex % AMBIENT_PHRASES.length];
        this._ambientIndex++;
        // Shuffle occasionally
        if (this._ambientIndex >= AMBIENT_PHRASES.length) {
            this._ambientIndex = 0;
        }
        return phrase;
    }

    /**
     * Keyword-based instant response.
     */
    _keywordMatch(text) {
        const clean = text.toLowerCase();
        const wordCount = clean.split(/\s+/).length;

        // Skip keyword matching for long inputs — likely background noise, not direct speech
        if (wordCount > MAX_KEYWORD_WORDS) {
            return null;
        }

        for (const [category, data] of Object.entries(RESPONSE_DB)) {
            for (const kw of data.keywords) {
                if (clean.includes(kw)) {
                    const response = data.responses[Math.floor(Math.random() * data.responses.length)];
                    return { response, category: 'oracle', emotion: 'curious' };
                }
            }
        }
        return null;
    }

    /**
     * Gemini-powered response.
     */
    async _geminiAsk(text) {
        const response = await this.genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: text,
            config: {
                systemInstruction: GEMINI_SYSTEM_PROMPT,
                temperature: 0.9,
                maxOutputTokens: 150,
            },
        });

        const responseText = response?.text?.trim();
        if (responseText) {
            // Ensure bracket format
            let formatted = responseText;
            if (!formatted.startsWith('[')) formatted = `[${formatted}`;
            if (!formatted.endsWith(']')) formatted = `${formatted}]`;
            return { response: formatted, category: 'oracle_gemini', emotion: 'curious' };
        }

        return null;
    }

    /**
     * Local Ollama (Gemma) powered response.
     */
    async _ollamaAsk(text) {
        // Build the prompt utilizing the system instruction natively
        const prompt = `<start_of_turn>user\nSYSTEM: ${GEMINI_SYSTEM_PROMPT}\n\nUSER QUESTION: ${text}<end_of_turn>\n<start_of_turn>model\n`;
        
        // 15-second timeout to prevent pipeline freeze if Ollama stalls (needs ~10s on cold start)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: 'gemma3:4b',
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.9,
                        num_predict: 60
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const responseText = data.response?.trim();

            if (responseText) {
                // Ensure bracket format
                let formatted = responseText;
                if (!formatted.startsWith('[')) formatted = `[${formatted}`;
                if (!formatted.endsWith(']')) formatted = `${formatted}]`;
                return { response: formatted, category: 'oracle_local', emotion: 'curious' };
            }
        } catch (err) {
            // Re-throw so the main try/catch handles the fallback
            throw err;
        } finally {
            clearTimeout(timeout);
        }

        return null;
    }
}
