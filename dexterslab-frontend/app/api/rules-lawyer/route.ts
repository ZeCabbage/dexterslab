import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8888'
  : 'https://dexterslab-api.cclottaaworld.com';

/**
 * Rules Lawyer API Proxy — forwards to backend.
 * POST body should include { action, ...params }
 *   action: 'start' | 'ask' | 'suggest' | 'end'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json({ error: 'No action specified' }, { status: 400 });
    }

    const endpoint = `${BACKEND_URL}/api/rules-lawyer/${action}`;

    try {
      const backendRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000), // 30s for LLM responses
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }

      const errorText = await backendRes.text();
      return NextResponse.json(
        { error: errorText || 'Backend error' },
        { status: backendRes.status }
      );
    } catch {
      return NextResponse.json(
        { error: 'Backend offline — check that dexterslab-backend is running' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/rules-lawyer/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (backendRes.ok) return NextResponse.json(await backendRes.json());
  } catch {}

  return NextResponse.json({
    active: false,
    game: null,
    theme: null,
    hasLLM: false,
  });
}
