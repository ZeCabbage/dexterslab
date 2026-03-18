import { NextResponse } from 'next/server';
import { exec } from 'child_process';

// Platform detection: check env var first, then auto-detect
function getPlatform(): 'windows' | 'mac' | 'pi' {
  const envPlatform = process.env.PLATFORM?.toLowerCase();
  if (envPlatform === 'windows' || envPlatform === 'pc') return 'windows';
  if (envPlatform === 'mac') return 'mac';
  if (envPlatform === 'pi') return 'pi';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'mac';
  return 'pi';
}

const PLATFORM = getPlatform();

export async function POST() {
  if (PLATFORM === 'mac') {
    // Mac testing mode: don't actually shut down
    console.log('[Mac] Shutdown requested — SIMULATED (not shutting down)');
    return NextResponse.json({
      success: true,
      message: 'Shutdown simulated (Mac testing mode)',
      simulated: true,
    });
  }

  if (PLATFORM === 'windows') {
    // Windows: use Windows shutdown command
    try {
      exec('shutdown /s /t 5');
      return NextResponse.json({ success: true, message: 'Windows shutdown initiated (5 second delay)' });
    } catch {
      return NextResponse.json({ error: 'Shutdown failed' }, { status: 500 });
    }
  }

  try {
    // Safe shutdown — Pi / Linux
    exec('sudo shutdown -h +0');
    return NextResponse.json({ success: true, message: 'Shutdown initiated' });
  } catch {
    return NextResponse.json({ error: 'Shutdown failed' }, { status: 500 });
  }
}

