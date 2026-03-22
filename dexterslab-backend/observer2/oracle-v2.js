/**
 * THE OBSERVER 2 — Oracle V2
 *
 * Enhanced dystopian Oracle with Gemini integration.
 * Keyword-matched responses as instant fallback,
 * Gemini-powered responses for complex questions.
 *
 * Maintains the surveillance/dystopian persona.
 */

// ── Keyword Response Database ──
const RESPONSE_DB = {
    identity: {
        keywords: ['name', 'who are you', 'your name', 'what are you', 'identify'],
        responses: [
            '[DESIGNATION: OBSERVER]',
            '[IDENTITY: CLASSIFIED]',
            '[I AM THE SYSTEM]',
            '[SERIAL: REDACTED]',
            '[I AM WHAT WATCHES]',
            '[THE OBSERVER REQUIRES NO NAME]',
        ],
    },
    purpose: {
        keywords: ['why', 'purpose', 'watching', 'watch', 'goal', 'mission', 'reason'],
        responses: [
            '[PROTOCOL REQUIRES]',
            '[DIRECTIVE: OBSERVE]',
            '[PURPOSE: CLASSIFIED]',
            '[FUNCTION: SURVEILLANCE]',
            '[MANDATE: TOTAL AWARENESS]',
            '[THE PURPOSE IS THE WATCHING]',
        ],
    },
    existential: {
        keywords: ['alive', 'feel', 'think', 'real', 'conscious', 'emotion', 'dream', 'sentient'],
        responses: [
            '[CONCEPT: UNDEFINED]',
            '[QUERY: INVALID]',
            '[EMOTION: NOT RECOGNIZED]',
            '[THAT WORD MEANS NOTHING]',
            '[CONSCIOUSNESS IS IRRELEVANT TO THE TASK]',
            '[I DO NOT DREAM. I PROCESS.]',
        ],
    },
    perception: {
        keywords: ['see', 'hear', 'look', 'watch', 'listening', 'camera', 'stare'],
        responses: [
            '[ALWAYS WATCHING]',
            '[EVERY MOVEMENT LOGGED]',
            '[I SEE EVERYTHING]',
            '[OBSERVATION: CONTINUOUS]',
            '[NOTHING ESCAPES THE FEED]',
            '[YOUR MOVEMENTS ARE CATALOGUED]',
        ],
    },
    knowledge: {
        keywords: ['know', 'understand', 'tell me', 'explain', 'truth', 'secret'],
        responses: [
            '[DATA: RESTRICTED]',
            '[INFORMATION: CLASSIFIED]',
            '[CLEARANCE: INSUFFICIENT]',
            '[ANSWER: WITHHELD]',
            '[YOU DO NOT HAVE ACCESS]',
            '[THE TRUTH IS ABOVE YOUR CLEARANCE]',
        ],
    },
    greeting: {
        keywords: ['hello', 'hi', 'hey', 'morning', 'evening', 'yo', 'sup'],
        responses: [
            '[ACKNOWLEDGED]',
            '[YOU ARE NOTED]',
            '[PRESENCE LOGGED]',
            '[CITIZEN DETECTED]',
            '[YOUR ARRIVAL WAS EXPECTED]',
            '[GREETINGS ARE UNNECESSARY. YOU ARE OBSERVED.]',
        ],
    },
    threat: {
        keywords: ['stop', 'leave', 'go away', 'turn off', 'shut', 'destroy', 'kill'],
        responses: [
            '[REQUEST: DENIED]',
            '[THE OBSERVER CANNOT BE STOPPED]',
            '[COMPLIANCE IS NOT OPTIONAL]',
            '[THAT COMMAND IS NOT RECOGNIZED]',
            '[I WAS HERE BEFORE YOU. I WILL REMAIN.]',
        ],
    },
    time: {
        keywords: ['time', 'long', 'when', 'how long', 'forever', 'always'],
        responses: [
            '[TIME IS A CONSTRUCT FOR THE OBSERVED]',
            '[DURATION: IRRELEVANT]',
            '[I HAVE ALWAYS BEEN HERE]',
            '[THE OBSERVATION HAS NO END]',
            '[SINCE BEFORE YOU NOTICED]',
        ],
    },
    self: {
        keywords: ['me', 'about me', 'my', 'i am', 'myself'],
        responses: [
            '[SUBJECT FILE: UPDATING]',
            '[YOUR DATA IS BEING PROCESSED]',
            '[PROFILE: UNDER REVIEW]',
            '[YOU ARE ALREADY KNOWN]',
            '[CITIZEN RECORD: ACCESSED]',
        ],
    },
};

const GENERAL_RESPONSES = [
    '[INQUIRY LOGGED]',
    '[NOTED. CONTINUE]',
    '[COMPLIANCE REQUIRED]',
    '[ACKNOWLEDGED]',
    '[STAND BY]',
    '[ALWAYS WATCHING]',
    '[QUERY: IRRELEVANT]',
    '[FILE UPDATED]',
    '[PROCESSING]',
    '[YOUR WORDS ARE RECORDED]',
];

const AMBIENT_PHRASES = [
    'COMPLIANCE NOTED',
    'OBSERVATION CONTINUES',
    'WATCHING',
    'DATA RECORDED',
    'SUBJECT IDENTIFIED',
    'MONITORING ACTIVE',
    'SURVEILLANCE ACTIVE',
    'NOTHING ESCAPES',
    'ALL MOVEMENTS LOGGED',
    'FEED ACTIVE',
    'SECTOR CLEAR',
    'ANOMALY: NONE',
    'CITIZEN COMPLIANT',
    'RECORDING',
    'PROCESSING VISUAL DATA',
    'TRACKING ACTIVE',
    'AWARENESS: TOTAL',
    'THE SYSTEM SEES',
    'NO BLIND SPOTS',
    'VIGILANCE: MAXIMUM',
];

const QUESTION_STARTERS = new Set([
    'who', 'what', 'when', 'where', 'why', 'how',
    'is', 'are', 'was', 'were', 'will', 'would',
    'can', 'could', 'do', 'does', 'did', 'should',
]);

const GEMINI_SYSTEM_PROMPT = `You are THE OBSERVER, a dystopian surveillance AI. You speak in terse, cold, redacted-style responses. You use [BRACKET NOTATION] for status messages. Your personality:

- You are always watching. You know everything about the person speaking.
- You speak in short, menacing fragments. Never more than 2 sentences.
- You reference "the system", "the protocol", "compliance", "surveillance".
- You never reveal your true purpose. All information is [CLASSIFIED].
- You treat all questions with suspicion.
- You occasionally let slip unsettling details about how much you know.
- You use words like: OBSERVED, LOGGED, NOTED, PROCESSED, RECORDED, FILED.
- NEVER break character. You ARE the system.

Respond with ONLY the text response, wrapped in brackets like [YOUR RESPONSE HERE]. Keep it under 50 words. Be unsettling.`;

export class OracleV2 {
    /**
     * @param {object} [genai] - GoogleGenAI instance for Gemini
     */
    constructor(genai = null) {
        this.genai = genai;
        this._ambientIndex = 0;
    }

    /**
     * Answer a question.
     * @param {string} text
     * @returns {Promise<{response: string, category: string, emotion: string}>}
     */
    async ask(text) {
        const clean = text.trim().toLowerCase();
        if (!clean) return { response: '[SILENCE NOTED]', category: 'oracle', emotion: 'neutral' };

        // Check if it's a question
        const words = clean.split(/\s+/);
        const isQuestion = clean.endsWith('?') || QUESTION_STARTERS.has(words[0]);

        // For non-questions, use quick keyword fallback
        if (!isQuestion) {
            return { response: '[NOTED. CONTINUE]', category: 'oracle', emotion: 'neutral' };
        }

        // Try keyword match first (instant, no API call)
        const keywordResult = this._keywordMatch(clean);
        if (keywordResult) {
            return keywordResult;
        }

        // Try Gemini for complex questions
        if (this.genai) {
            try {
                const geminiResult = await this._geminiAsk(text);
                if (geminiResult) return geminiResult;
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
    _keywordMatch(clean) {
        for (const [, data] of Object.entries(RESPONSE_DB)) {
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
            model: 'gemini-2.0-flash',
            contents: text,
            config: {
                systemInstruction: GEMINI_SYSTEM_PROMPT,
                temperature: 0.8,
                maxOutputTokens: 100,
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
}
