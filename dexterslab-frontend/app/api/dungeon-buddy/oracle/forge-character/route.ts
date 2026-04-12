import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const url = 'http://localhost:8888/api/dungeon-buddy/oracle/forge-character';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pass the raw stream to bypass Next.js JSON body parser limits
      body: req.body,
      // @ts-ignore - necessary for Node.js fetch with ReadableStream bodies
      duplex: 'half'
    });
    return new Response(response.body, { status: response.status, headers: response.headers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
