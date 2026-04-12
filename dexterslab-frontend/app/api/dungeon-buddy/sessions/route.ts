import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const url = 'http://localhost:8888/api/dungeon-buddy/sessions';
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return new Response(response.body, { status: response.status, headers: response.headers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
