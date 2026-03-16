import { NextResponse } from 'next/server';
import { exec } from 'child_process';

const IS_MAC = process.platform === 'darwin';

export async function POST() {
  if (IS_MAC) {
    // Mac testing mode: don't actually shut down
    console.log('[Mac] Shutdown requested — SIMULATED (not shutting down)');
    return NextResponse.json({
      success: true,
      message: 'Shutdown simulated (Mac testing mode)',
      simulated: true,
    });
  }

  try {
    // Safe shutdown — Pi only
    exec('sudo shutdown -h +0');
    return NextResponse.json({ success: true, message: 'Shutdown initiated' });
  } catch {
    return NextResponse.json({ error: 'Shutdown failed' }, { status: 500 });
  }
}
