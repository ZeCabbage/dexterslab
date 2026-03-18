import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8888'
  : 'https://dexterslab-api.cclottaaworld.com';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Proxy to Node backend (single source of truth for Oracle logic)
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/oracle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000),
      });
      if (backendRes.ok) {
        return NextResponse.json(await backendRes.json());
      }
    } catch {
      // Backend unreachable — minimal fallback
    }

    return NextResponse.json({ response: '[SYSTEM OFFLINE]', category: 'oracle' });
  } catch {
    return NextResponse.json({ error: 'Oracle error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/oracle/ambient`, {
      signal: AbortSignal.timeout(3000),
    });
    if (backendRes.ok) return NextResponse.json(await backendRes.json());
  } catch {}

  return NextResponse.json({ phrase: 'SURVEILLANCE ACTIVE' });
}
