import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join('/');
  const url = new URL(req.url);
  
  const backendUrl = `http://127.0.0.1:8888/api/admin/${path}${url.search}`;
  try {
    const res = await fetch(backendUrl);
    if (res.headers.get('content-type')?.includes('text/csv')) {
       return new NextResponse(await res.text(), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': res.headers.get('content-disposition') || 'attachment; filename="data.csv"'
          }
       });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = (resolvedParams.path || []).join('/');
  const backendUrl = `http://127.0.0.1:8888/api/admin/${path}`;
  try {
    const body = await req.json();
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
