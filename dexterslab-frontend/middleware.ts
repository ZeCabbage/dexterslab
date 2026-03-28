import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

// Use Edge Runtime for Next.js middleware
export const config = {
  matcher: ['/admin/:path*'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Rule 1: Cloudflare detection
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    console.warn(`[middleware] /admin blocked: Cloudflare-routed request from ${cfConnectingIp}`);
    return new NextResponse(null, { status: 404 });
  }

  // Rule 2: IP allowlist
  const ip = request.headers.get('x-real-ip') ?? (request as any).ip ?? 'unknown';
  const ALLOWED_PREFIXES = ['127.', '::1', '100.'];
  
  const isAllowedIp = ALLOWED_PREFIXES.some(prefix => ip.startsWith(prefix));
  if (!isAllowedIp) {
    console.warn(`[middleware] /admin blocked: unauthorized IP ${ip}`);
    return new NextResponse(null, { status: 404 });
  }

  // Rule 4: Login page exception
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Rule 3: Session token check
  const secretToken = process.env.ADMIN_SECRET_TOKEN;
  
  if (!secretToken || secretToken.trim() === '') {
    console.warn('[middleware] SECURITY WARNING: ADMIN_SECRET_TOKEN is not set. Admin dashboard is protected by IP only.');
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get('admin_token')?.value || '';
  
  let isMatch = false;
  if (cookieToken.length > 0 && cookieToken.length === secretToken.length) {
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(cookieToken),
        Buffer.from(secretToken)
      );
    } catch (e) {
      isMatch = false;
    }
  }

  if (!isMatch) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
