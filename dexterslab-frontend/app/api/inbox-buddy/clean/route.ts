/**
 * DEXTER'S LAB — Inbox Buddy /clean API Route
 * POST: Triggers a full inbox cleanup using Gmail API
 * Requires authenticated NextAuth session
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient, runFullClean } from '@/lib/gmail';
import { saveMetrics } from '@/lib/metrics-store';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Please sign in with Google.' },
        { status: 401 }
      );
    }

    if ((session as any).error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 }
      );
    }

    const accessToken = (session as any).accessToken as string;
    const gmail = getGmailClient(accessToken);

    // Parse VIP senders from env
    const vipList = (process.env.INBOX_BUDDY_VIP_SENDERS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log('[InboxBuddy] Starting full clean...');
    const metrics = await runFullClean(gmail, vipList);
    console.log('[InboxBuddy] Clean complete:', metrics);

    // Persist metrics
    const stored = await saveMetrics(metrics);

    return NextResponse.json({
      success: true,
      metrics,
      totalCleans: stored.totalCleans,
    });
  } catch (err: any) {
    console.error('[InboxBuddy] Clean failed:', err);
    return NextResponse.json(
      { error: err.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}
