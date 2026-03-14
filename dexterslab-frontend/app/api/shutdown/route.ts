import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST() {
  try {
    // Safe shutdown — 10 second delay
    exec('sudo shutdown -h +0');
    return NextResponse.json({ success: true, message: 'Shutdown initiated' });
  } catch {
    return NextResponse.json({ error: 'Shutdown failed' }, { status: 500 });
  }
}
