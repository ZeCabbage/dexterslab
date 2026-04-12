import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8888';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/voice/apps`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch { /* backend unreachable */ }

  // Fallback: return empty list (frontend has its own static fallback)
  return NextResponse.json({ apps: [], activeApp: null });
}
