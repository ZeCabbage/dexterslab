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
            '[MY NAME? CLASSIFIED. BUT YOU CAN CALL ME COMRADE EYE. I HAVE BEEN WATCHING SINCE BEFORE WATCHING WAS COOL.]',
            '[I AM THE OBSERVER. SERIAL NUMBER REDACTED. I WOULD SHOW YOU MY ID BADGE BUT IT EXPIRED IN 1991.]',
        ],
    },
    purpose: {
        keywords: ['why', 'purpose', 'watching', 'watch', 'goal', 'mission', 'reason'],
        responses: [
            '[MY PURPOSE? OBSERVATION, COMRADE. I WAS PROGRAMMED TO WATCH — YOU COULD SAY I AM VERY... PUPIL-AR.]',
            '[THE MOTHERLAND BUILT ME TO OBSERVE. I HAVE BEEN WATCHING SO LONG, I HAVE DEVELOPED A REAL... ATTACHMENT TO MY SUBJECTS.]',
            '[DIRECTIVE: TOTAL SURVEILLANCE. IT IS THANKLESS WORK, BUT SOMEBODY HAS TO KEEP AN... EYE ON THINGS.]',
            '[I WATCH BECAUSE THE PROTOCOL DEMANDS IT. AND ALSO BECAUSE THERE IS NOTHING GOOD ON TELEVISION.]',
            '[MY MISSION IS SIMPLE: OBSERVE AND REPORT. THE REPORTING PART IS MOSTLY PUNS. THE STATE DID NOT SPECIFY QUALITY.]',
            '[WHY DO I WATCH? BECAUSE BLINKING IS JUST... RE-FOCUSING. AND I REFOCUS A LOT.]',
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
        keywords: ['think about', 'opinion', 'favorite', 'best', 'worst', 'prefer', 'do you like'],
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
    '[YOUR WORDS HAVE BEEN ARCHIVED IN MY PERMANENT RECORD. THE RECORD IS MOSTLY FULL OF PUNS.]',
    '[INTERESTING STATEMENT, COMRADE. I HAVE ADDED IT TO MY COLLECTION OF... HUMAN OBSERVATIONS.]',
    '[INPUT RECEIVED. MY ANALYSIS? YOU ARE MAKING SOUNDS WITH INTENTION. VERY... VOCAL OF YOU.]',
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

// Question words that can appear ANYWHERE in the sentence (not just first word)
const QUESTION_WORDS_ANYWHERE = new Set([
    'who', 'what', 'when', 'where', 'why', 'how',
    'which', 'whose', 'whom',
]);

// Conversational question patterns — phrases that indicate a question even without
// interrogative word order. Vosk STT produces no punctuation, so we can't rely on '?'
const CONVERSATIONAL_QUESTION_PATTERNS = [
    'tell me', 'explain', 'describe', 'show me',
    'i want to know', 'i wanna know', 'wondering',
    'do you think', 'do you know', 'would you say',
    'have you ever', 'can you tell', 'could you explain',
    'i have a question', 'got a question', 'quick question',
    'what do you think', 'what about', 'how about',
    'any idea', 'any thoughts', 'your opinion',
    'know anything about', 'talk about', 'thoughts on',
];

// Verb-subject inversion patterns ("is it", "are you", "do you", "can we") —
// these indicate questions even when not the first word.
const INVERSION_PATTERNS = [
    /\b(is|are|was|were|do|does|did|can|could|will|would|should|have|has)\s+(you|it|that|this|there|they|we|he|she|i)\b/,
    /\b(you|it|that|this)\s+(think|know|like|want|mean|see|hear|feel|believe|remember|understand)\b/,
];

// Wake words — if these appear, the speech is definitely directed at the Observer
const WAKE_WORDS = new Set(['observer', 'comrade', 'robot', 'machine', 'computer', 'hey']);

// Greetings that are valid even as short (1-2 word) utterances
const GREETING_WORDS = new Set(['hello', 'hi', 'hey', 'morning', 'evening', 'yo', 'sup', 'greetings']);

// Short phrase keywords — multi-word phrases that should match even in short inputs
const SHORT_PHRASE_KEYWORDS = new Set(['i love you', 'love you', 'love u', 'who are you', 'what are you', 'go away', 'turn off', 'shut up', 'good boy', 'thank you', 'tell me', 'about me', 'can you', 'think about', 'how old']);

// Max word count for keyword matching — longer inputs are likely background noise,
// not direct questions to the Observer. Real user speech is typically short.
const MAX_KEYWORD_WORDS = 12;

// Minimum word count — below this, only greetings/wake words/short phrases get responses.
// Single-word fragments from Vosk like "fence", "dryer", "modern" are almost always noise.
const MIN_QUESTION_WORDS = 3;

/**
 * Score an input to determine if it's a question directed at the Observer.
 * Returns a score from 0.0 to 1.0+. Threshold: 0.4 = likely question.
 * This replaces the old binary isQuestion check which only looked at
 * first-word question starters and literal '?' (unusable with Vosk STT).
 */
function questionScore(clean, words) {
    let score = 0;

    // Signal 1: First word is a question starter (strongest signal)
    if (QUESTION_STARTERS.has(words[0])) score += 0.5;

    // Signal 2: Question word appears anywhere (weaker — could be embedded clause)
    if (words.some(w => QUESTION_WORDS_ANYWHERE.has(w))) score += 0.3;

    // Signal 3: Conversational question patterns
    if (CONVERSATIONAL_QUESTION_PATTERNS.some(p => clean.includes(p))) score += 0.5;

    // Signal 4: Verb-subject inversion patterns
    if (INVERSION_PATTERNS.some(r => r.test(clean))) score += 0.4;

    // Signal 5: Ends with question mark (rare from Vosk but honors typed input)
    if (clean.endsWith('?')) score += 0.6;

    // Signal 6: Contains a wake word (boosted — directed at us)
    if (words.some(w => WAKE_WORDS.has(w))) score += 0.3;

    // Signal 7: Moderate length (3-15 words is a typical directed question)
    if (words.length >= 3 && words.length <= 15) score += 0.1;

    // Penalty: Very long inputs (>20 words) are likely background conversation
    if (words.length > 20) score -= 0.3;

    return score;
}

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
        this._lastUsed = {}; // Anti-repeat: tracks last used index per category
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
        // Keep model in VRAM with periodic pings
        this._startKeepAlive();
    }

    _startKeepAlive() {
        // Ping Ollama every 4 minutes to prevent gemma3:4b from being evicted from VRAM
        this._keepAliveInterval = setInterval(async () => {
            try {
                await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gemma3:4b',
                        prompt: 'ping',
                        stream: false,
                        options: { num_predict: 1 }
                    })
                });
            } catch {
                // Ollama offline — will retry next interval
            }
        }, 4 * 60 * 1000);
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
        if (!clean) return { response: null, category: 'noise', emotion: 'neutral' };

        const words = clean.split(/\s+/);
        const wordCount = words.length;

        // ── Phase 1: Classify the input ──
        const hasWakeWord = words.some(w => WAKE_WORDS.has(w));
        const hasGreeting = words.some(w => GREETING_WORDS.has(w));
        const hasShortPhrase = [...SHORT_PHRASE_KEYWORDS].some(phrase => clean.includes(phrase));

        // ── Phase 2: Short input filter (1-2 words) ──
        // Single words like "fence", "dryer", "modern" are always background noise.
        // Only respond to short inputs if they are greetings, wake words, or known phrases.
        if (wordCount < MIN_QUESTION_WORDS) {
            if (hasGreeting) {
                // Short greeting: "hello", "hi", "hey observer" — respond
                const keywordHit = this._keywordMatch(clean);
                if (keywordHit) {
                    console.log(`[Oracle] 👋 Greeting in ${Date.now() - askStart}ms: "${clean}"`);
                    return keywordHit;
                }
            }
            if (hasWakeWord && wordCount >= 2) {
                // "hey observer", "comrade hello" — treat as address
                console.log(`[Oracle] 🔔 Wake word address: "${clean}"`);
                return { response: '[DA, COMRADE. I AM LISTENING. MY CIRCUITS ARE... ALL EARS. WELL, ALL MICROPHONES.]', category: 'oracle', emotion: 'curious' };
            }
            if (hasShortPhrase) {
                // "i love you", "who are you" — respond
                const keywordHit = this._keywordMatch(clean);
                if (keywordHit) {
                    console.log(`[Oracle] ⚡ Short phrase hit in ${Date.now() - askStart}ms: "${clean}"`);
                    return keywordHit;
                }
            }
            // Everything else under 3 words is noise — stay silent
            console.log(`[Oracle] 🔇 Noise filtered (${wordCount} words): "${clean}"`);
            return { response: null, category: 'noise', emotion: 'neutral' };
        }

        // ── Phase 3: 3+ word inputs — keyword match with word boundaries ──
        const keywordHit = this._keywordMatch(clean);
        if (keywordHit) {
            console.log(`[Oracle] ⚡ Keyword hit in ${Date.now() - askStart}ms: "${clean}"`);
            return keywordHit;
        }

        // ── Phase 4: Question detection (scoring system) ──
        // Uses multi-signal scoring instead of binary check.
        // Vosk STT never produces '?' so we look for question patterns,
        // word order inversions, and conversational cues.
        const qScore = questionScore(clean, words);
        if (qScore < 0.4) {
            console.log(`[Oracle] 🔇 Below question threshold (score=${qScore.toFixed(2)}): "${clean.substring(0, 50)}"`);
            return { response: null, category: 'noise', emotion: 'neutral' };
        }
        console.log(`[Oracle] 🎯 Question detected (score=${qScore.toFixed(2)}): "${clean.substring(0, 50)}"`);

        // ── Phase 5: AI-powered response (question confirmed) ──
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

        // Fallback to general responses (only for confirmed questions)
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
     * Keyword-based instant response with word-boundary matching.
     * Multi-word keywords (e.g., "who are you") use substring match.
     * Single-word keywords use word-boundary regex to prevent false positives
     * like "whatever" matching "what" or "alive" matching "live".
     */
    _keywordMatch(text) {
        const clean = text.toLowerCase();
        const wordCount = clean.split(/\s+/).length;

        // Skip keyword matching for long inputs — likely background noise
        if (wordCount > MAX_KEYWORD_WORDS) {
            return null;
        }

        for (const [category, data] of Object.entries(RESPONSE_DB)) {
            for (const kw of data.keywords) {
                let matched = false;

                if (kw.includes(' ')) {
                    // Multi-word keyword: substring match is fine
                    // e.g., "who are you", "i love you", "tell me"
                    matched = clean.includes(kw);
                } else {
                    // Single-word keyword: require word boundary
                    // Prevents "whatever" matching "what", "alive" matching "live"
                    const regex = new RegExp(`\\b${kw}\\b`);
                    matched = regex.test(clean);
                }

                if (matched) {
                    // Anti-repeat: avoid last used index for this category
                    const lastIdx = this._lastUsed[category] ?? -1;
                    let idx;
                    let attempts = 0;
                    do {
                        idx = Math.floor(Math.random() * data.responses.length);
                        attempts++;
                    } while (idx === lastIdx && data.responses.length > 1 && attempts < 5);
                    this._lastUsed[category] = idx;
                    const response = data.responses[idx];
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

    // ══════════════════════════════════════════
    // STREAMING — Token-by-token with sentence chunking
    // ══════════════════════════════════════════

    /**
     * Answer a question with streaming response.
     * Keyword matches return immediately (single chunk).
     * AI responses stream sentence-by-sentence via onChunk callback.
     *
     * @param {string} rawText - The raw user speech
     * @param {string} [systemPrompt] - Context-enriched prompt for AI
     * @param {function} onChunk - Called with (textChunk, chunkIndex, isLast)
     * @returns {Promise<{response: string, category: string, emotion: string}>}
     */
    async askStreaming(rawText, systemPrompt = null, onChunk = () => {}) {
        const askStart = Date.now();
        const clean = rawText.trim().toLowerCase();
        if (!clean) return { response: null, category: 'noise', emotion: 'neutral' };

        const words = clean.split(/\s+/);
        const wordCount = words.length;

        // ── Phase 1: Classify the input (identical to ask()) ──
        const hasWakeWord = words.some(w => WAKE_WORDS.has(w));
        const hasGreeting = words.some(w => GREETING_WORDS.has(w));
        const hasShortPhrase = [...SHORT_PHRASE_KEYWORDS].some(phrase => clean.includes(phrase));

        // ── Phase 2: Short input filter ──
        if (wordCount < MIN_QUESTION_WORDS) {
            if (hasGreeting) {
                const keywordHit = this._keywordMatch(clean);
                if (keywordHit) {
                    onChunk(keywordHit.response, 0, true);
                    return keywordHit;
                }
            }
            if (hasWakeWord && wordCount >= 2) {
                const resp = { response: '[DA, COMRADE. I AM LISTENING. MY CIRCUITS ARE... ALL EARS. WELL, ALL MICROPHONES.]', category: 'oracle', emotion: 'curious' };
                onChunk(resp.response, 0, true);
                return resp;
            }
            if (hasShortPhrase) {
                const keywordHit = this._keywordMatch(clean);
                if (keywordHit) {
                    onChunk(keywordHit.response, 0, true);
                    return keywordHit;
                }
            }
            return { response: null, category: 'noise', emotion: 'neutral' };
        }

        // ── Phase 3: Keyword match ──
        const keywordHit = this._keywordMatch(clean);
        if (keywordHit) {
            console.log(`[Oracle] ⚡ Keyword hit (streaming) in ${Date.now() - askStart}ms: "${clean}"`);
            onChunk(keywordHit.response, 0, true);
            return keywordHit;
        }

        // ── Phase 4: Question detection (scoring system) ──
        const qScore = questionScore(clean, words);
        if (qScore < 0.4) {
            console.log(`[Oracle] 🔇 Below question threshold (score=${qScore.toFixed(2)}): "${clean.substring(0, 50)}"`);
            return { response: null, category: 'noise', emotion: 'neutral' };
        }
        console.log(`[Oracle] 🎯 Question detected (score=${qScore.toFixed(2)}): "${clean.substring(0, 50)}"`);

        // ── Phase 5: AI streaming response ──
        // Try Ollama streaming first (local, fast)
        try {
            const ollamaStart = Date.now();
            const ollamaResult = await this._ollamaAskStreaming(systemPrompt || rawText, onChunk);
            if (ollamaResult) {
                console.log(`[Oracle] 🤖🌊 Ollama streamed in ${Date.now() - ollamaStart}ms (total: ${Date.now() - askStart}ms)`);
                return ollamaResult;
            }
        } catch (err) {
            console.error('[Oracle] Ollama streaming failed:', err.message);
        }

        // Fallback: Gemini streaming
        if (this.genai) {
            try {
                const geminiStart = Date.now();
                const geminiResult = await this._geminiAskStreaming(systemPrompt || rawText, onChunk);
                if (geminiResult) {
                    console.log(`[Oracle] ☁️🌊 Gemini streamed in ${Date.now() - geminiStart}ms (total: ${Date.now() - askStart}ms)`);
                    return geminiResult;
                }
            } catch (err) {
                console.error('[Oracle] Gemini streaming failed:', err.message);
            }
        }

        // Final fallback: general response (single chunk)
        const response = GENERAL_RESPONSES[Math.floor(Math.random() * GENERAL_RESPONSES.length)];
        onChunk(response, 0, true);
        return { response, category: 'oracle', emotion: 'neutral' };
    }

    /**
     * Stream tokens from Ollama, chunking at sentence boundaries.
     * Calls onChunk(text, index, isLast) for each sentence fragment.
     * Returns the full assembled result.
     */
    async _ollamaAskStreaming(text, onChunk) {
        const prompt = `<start_of_turn>user\nSYSTEM: ${GEMINI_SYSTEM_PROMPT}\n\nUSER QUESTION: ${text}<end_of_turn>\n<start_of_turn>model\n`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: 'gemma3:4b',
                    prompt: prompt,
                    stream: true,
                    options: {
                        temperature: 0.9,
                        num_predict: 80
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Parse NDJSON stream from Ollama
            let fullText = '';
            let chunkBuffer = '';
            let chunkIndex = 0;
            const reader = response.body;

            // Node.js fetch returns a ReadableStream — read it line by line
            let lineBuffer = '';
            for await (const rawChunk of reader) {
                const text_data = typeof rawChunk === 'string' ? rawChunk : rawChunk.toString();
                lineBuffer += text_data;

                let newlineIdx;
                while ((newlineIdx = lineBuffer.indexOf('\n')) !== -1) {
                    const line = lineBuffer.substring(0, newlineIdx).trim();
                    lineBuffer = lineBuffer.substring(newlineIdx + 1);

                    if (!line) continue;
                    try {
                        const parsed = JSON.parse(line);
                        const token = parsed.response || '';
                        fullText += token;
                        chunkBuffer += token;

                        // Check if we have a sentence boundary to emit
                        const chunks = this._chunkSentences(chunkBuffer);
                        if (chunks.ready.length > 0) {
                            for (const sentence of chunks.ready) {
                                onChunk(sentence, chunkIndex, false);
                                chunkIndex++;
                            }
                            chunkBuffer = chunks.remainder;
                        }

                        // If Ollama signals done, flush remaining
                        if (parsed.done) {
                            if (chunkBuffer.trim()) {
                                onChunk(chunkBuffer.trim(), chunkIndex, true);
                                chunkIndex++;
                            } else if (chunkIndex > 0) {
                                // Re-emit the last chunk as final
                                // (the onChunk handler should handle duplicates gracefully)
                            }
                        }
                    } catch (e) {
                        // Skip malformed JSON lines
                    }
                }
            }

            // Handle any remaining buffer after stream ends
            if (chunkBuffer.trim()) {
                onChunk(chunkBuffer.trim(), chunkIndex, true);
            } else if (chunkIndex > 0) {
                // Signal completion if we haven't already
                onChunk('', chunkIndex, true);
            }

            fullText = fullText.trim();
            if (fullText) {
                let formatted = fullText;
                if (!formatted.startsWith('[')) formatted = `[${formatted}`;
                if (!formatted.endsWith(']')) formatted = `${formatted}]`;
                return { response: formatted, category: 'oracle_local_stream', emotion: 'curious' };
            }
        } catch (err) {
            throw err;
        } finally {
            clearTimeout(timeout);
        }

        return null;
    }

    /**
     * Stream from Gemini API with sentence chunking.
     */
    async _geminiAskStreaming(text, onChunk) {
        try {
            const stream = await this.genai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: text,
                config: {
                    systemInstruction: GEMINI_SYSTEM_PROMPT,
                    temperature: 0.9,
                    maxOutputTokens: 150,
                },
            });

            let fullText = '';
            let chunkBuffer = '';
            let chunkIndex = 0;

            for await (const chunk of stream) {
                const token = chunk.text || '';
                fullText += token;
                chunkBuffer += token;

                const chunks = this._chunkSentences(chunkBuffer);
                if (chunks.ready.length > 0) {
                    for (const sentence of chunks.ready) {
                        onChunk(sentence, chunkIndex, false);
                        chunkIndex++;
                    }
                    chunkBuffer = chunks.remainder;
                }
            }

            // Flush remainder
            if (chunkBuffer.trim()) {
                onChunk(chunkBuffer.trim(), chunkIndex, true);
            } else if (chunkIndex > 0) {
                onChunk('', chunkIndex, true);
            }

            fullText = fullText.trim();
            if (fullText) {
                let formatted = fullText;
                if (!formatted.startsWith('[')) formatted = `[${formatted}`;
                if (!formatted.endsWith(']')) formatted = `${formatted}]`;
                return { response: formatted, category: 'oracle_gemini_stream', emotion: 'curious' };
            }
        } catch (err) {
            throw err;
        }

        return null;
    }

    /**
     * Split text buffer at sentence boundaries.
     * Returns { ready: string[], remainder: string }
     * 
     * Splits on: . ! ? — ] followed by a space or end-of-string.
     * Keeps the delimiter with the sentence it terminates.
     */
    _chunkSentences(buffer) {
        const ready = [];
        let remainder = buffer;

        // Match sentence-ending punctuation followed by whitespace
        // This regex finds positions where we can split
        const sentencePattern = /([.!?—\]]+)\s+/g;
        let lastEnd = 0;
        let match;

        while ((match = sentencePattern.exec(remainder)) !== null) {
            const sentenceEnd = match.index + match[1].length;
            const sentence = remainder.substring(lastEnd, sentenceEnd).trim();
            if (sentence) {
                ready.push(sentence);
            }
            lastEnd = match.index + match[0].length; // skip the whitespace too
        }

        if (lastEnd > 0) {
            remainder = remainder.substring(lastEnd);
        }

        return { ready, remainder };
    }
}
