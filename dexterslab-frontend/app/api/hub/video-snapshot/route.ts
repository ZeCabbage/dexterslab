import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Proxies the latest JPEG frame from the backend's video ingress.
 * Frontend <img> tags poll this to show the Pi camera feed.
 */
export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8888';
    const res = await fetch(`${backendUrl}/api/video/snapshot`, {
      cache: 'no-store',
    });

    if (res.status === 204) {
      // No frame available yet
      return new NextResponse(null, { status: 204 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Backend error' }, { status: 500 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
