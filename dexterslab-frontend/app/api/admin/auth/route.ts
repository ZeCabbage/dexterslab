import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

interface FailedLog {
  count: number;
  lastAttempt: number;
}

const failedAttemptsMap = new Map<string, FailedLog>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') ?? (request as any).ip ?? 'unknown';
  
  // Rate limits
  const now = Date.now();
  let failLog = failedAttemptsMap.get(ip);
  
  if (failLog) {
    if (now - failLog.lastAttempt > WINDOW_MS) {
      failLog = { count: 0, lastAttempt: now };
    }
    
    if (failLog.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const token = body.token || '';
  const secretToken = process.env.ADMIN_SECRET_TOKEN || '';

  if (!secretToken) {
    console.warn('[auth] SECURITY WARNING: Missing ADMIN_SECRET_TOKEN');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let isMatch = false;
  if (token.length > 0 && token.length === secretToken.length) {
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(secretToken)
      );
    } catch (e) {
      isMatch = false;
    }
  }

  if (isMatch) {
    // Reset rate limits on success
    if (failLog) failedAttemptsMap.delete(ip);
    
    const response = NextResponse.json({ success: true });
    
    response.cookies.set('admin_token', secretToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true, // HTTPS via Cloudflare Tunnel
      maxAge: 86400, // 24 hours
      path: '/admin'
    });
    
    return response;
  }

  // Failed login
  const count = (failLog?.count || 0) + 1;
  failedAttemptsMap.set(ip, { count, lastAttempt: now });
  console.warn(`[auth] Failed admin login attempt from ${ip}`);

  return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
}
