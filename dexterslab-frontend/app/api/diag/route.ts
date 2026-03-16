/**
 * Diagnostic Logging API — Browser → Server log relay
 *
 * POST /api/diag  — receive a log entry from the browser
 * GET  /api/diag  — return all stored log entries
 * DELETE /api/diag — clear logs
 *
 * Used to capture browser console output when we can't
 * access the Chromium DevTools directly (e.g., on the Pi).
 */

import { NextResponse } from 'next/server';

// In-memory log buffer (survives across requests, cleared on restart)
const logs: { time: string; msg: string }[] = [];
const MAX_LOGS = 100;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const msg = typeof body.msg === 'string' ? body.msg : JSON.stringify(body);
    const entry = {
      time: new Date().toISOString(),
      msg,
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ logs });
}

export async function DELETE() {
  logs.length = 0;
  return NextResponse.json({ ok: true, cleared: true });
}
