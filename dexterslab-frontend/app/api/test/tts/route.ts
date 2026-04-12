import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || 'Speaker test successful';
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8888';
    
    // Call the PC backend to trigger the speech dispatch
    const res = await fetch(`${backendUrl}/api/test/tts?text=${encodeURIComponent(text)}`);
    const data = await res.json();
    
    // Propagate the backend's status code and response
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('TTS Test proxy failed:', error);
    return NextResponse.json({ success: false, error: 'Could not reach backend' }, { status: 500 });
  }
}
