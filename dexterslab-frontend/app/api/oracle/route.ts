import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8888'
  : 'https://dexterslab.cclottaaworld.com';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Try to reach the Python backend
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/oracle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000),
      });
      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch {
      // Backend offline — fall through to built-in oracle
    }

    // ── Built-in Oracle (fallback when Python backend is offline) ──
    const response = builtinOracle(text);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Oracle error' }, { status: 500 });
  }
}

export async function GET() {
  // Ambient phrase endpoint
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/oracle/ambient`, {
      signal: AbortSignal.timeout(3000),
    });
    if (backendRes.ok) return NextResponse.json(await backendRes.json());
  } catch {}

  const phrases = [
    'COMPLIANCE NOTED', 'OBSERVATION CONTINUES', 'WATCHING', 'DATA RECORDED',
    'SUBJECT IDENTIFIED', 'MONITORING ACTIVE', 'SURVEILLANCE ACTIVE', 'NOTHING ESCAPES',
  ];
  return NextResponse.json({ phrase: phrases[Math.floor(Math.random() * phrases.length)] });
}

// ── Built-in keyword oracle (runs in-process when backend is offline) ──
const QUESTION_STARTERS = new Set([
  'who', 'what', 'when', 'where', 'why', 'how',
  'is', 'are', 'was', 'were', 'will', 'would',
  'can', 'could', 'do', 'does', 'did', 'should',
]);

const RESPONSE_DB: Record<string, { keywords: string[]; responses: string[] }> = {
  identity: {
    keywords: ['name', 'who are you', 'your name', 'what are you'],
    responses: ['[DESIGNATION: OBSERVER]', '[IDENTITY: CLASSIFIED]', '[I AM THE SYSTEM]', '[SERIAL: REDACTED]'],
  },
  purpose: {
    keywords: ['why', 'purpose', 'watching', 'watch', 'goal', 'mission'],
    responses: ['[PROTOCOL REQUIRES]', '[DIRECTIVE: OBSERVE]', '[PURPOSE: CLASSIFIED]', '[FUNCTION: SURVEILLANCE]'],
  },
  existential: {
    keywords: ['alive', 'feel', 'think', 'real', 'conscious', 'emotion', 'dream'],
    responses: ['[CONCEPT: UNDEFINED]', '[QUERY: INVALID]', '[EMOTION: NOT RECOGNIZED]', '[THAT WORD MEANS NOTHING]'],
  },
  perception: {
    keywords: ['see', 'hear', 'look', 'watch', 'listening', 'camera', 'stare'],
    responses: ['[ALWAYS WATCHING]', '[EVERY MOVEMENT LOGGED]', '[I SEE EVERYTHING]', '[OBSERVATION: CONTINUOUS]'],
  },
  knowledge: {
    keywords: ['know', 'understand', 'tell me', 'explain', 'truth', 'secret'],
    responses: ['[DATA: RESTRICTED]', '[INFORMATION: CLASSIFIED]', '[CLEARANCE: INSUFFICIENT]', '[ANSWER: WITHHELD]'],
  },
  greeting: {
    keywords: ['hello', 'hi', 'hey', 'morning', 'evening', 'yo'],
    responses: ['[ACKNOWLEDGED]', '[YOU ARE NOTED]', '[PRESENCE LOGGED]', '[CITIZEN DETECTED]'],
  },
};

const GENERAL_RESPONSES = [
  '[INQUIRY LOGGED]', '[NOTED. CONTINUE]', '[COMPLIANCE REQUIRED]', '[ACKNOWLEDGED]',
  '[STAND BY]', '[ALWAYS WATCHING]', '[QUERY: IRRELEVANT]', '[FILE UPDATED]',
];

function builtinOracle(text: string): { response: string; category: string } {
  const clean = text.trim().toLowerCase();
  if (!clean) return { response: '[SILENCE NOTED]', category: 'oracle' };

  // Check if it's a question
  const words = clean.split(/\s+/);
  const isQuestion = clean.endsWith('?') || QUESTION_STARTERS.has(words[0]);
  if (!isQuestion) return { response: '[NOTED. CONTINUE]', category: 'oracle' };

  // Match category
  for (const [, data] of Object.entries(RESPONSE_DB)) {
    for (const kw of data.keywords) {
      if (clean.includes(kw)) {
        const resp = data.responses[Math.floor(Math.random() * data.responses.length)];
        return { response: resp, category: 'oracle' };
      }
    }
  }

  const resp = GENERAL_RESPONSES[Math.floor(Math.random() * GENERAL_RESPONSES.length)];
  return { response: resp, category: 'oracle' };
}
