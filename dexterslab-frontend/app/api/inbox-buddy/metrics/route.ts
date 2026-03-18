/**
 * DEXTER'S LAB — Inbox Buddy /metrics API Route
 * GET: Returns stored cleanup metrics
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadMetrics } from '@/lib/metrics-store';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const metrics = await loadMetrics();

    return NextResponse.json({
      success: true,
      ...metrics,
    });
  } catch (err: any) {
    console.error('[InboxBuddy] Metrics load failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load metrics' },
      { status: 500 }
    );
  }
}
