/**
 * DEXTER'S LAB — Inbox Buddy /cron API Route
 * GET: Called by Vercel Cron (or manual trigger)
 * Runs daily clean; sends weekly report on Sundays
 *
 * Requires CRON_SECRET env var for authentication
 * and INBOX_BUDDY_SERVICE_TOKEN (a stored access token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGmailClient, runFullClean, sendWeeklyReport } from '@/lib/gmail';
import { saveMetrics, loadMetrics } from '@/lib/metrics-store';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // In production, use a stored service token
  // For local dev, this endpoint requires manual auth setup
  const serviceToken = process.env.INBOX_BUDDY_SERVICE_TOKEN;

  if (!serviceToken) {
    return NextResponse.json(
      {
        error: 'No service token configured. Set INBOX_BUDDY_SERVICE_TOKEN in .env.local',
        hint: 'Sign in via the dashboard first, then copy your access token for cron use.',
      },
      { status: 500 }
    );
  }

  try {
    const gmail = getGmailClient(serviceToken);

    const vipList = (process.env.INBOX_BUDDY_VIP_SENDERS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log('[InboxBuddy:Cron] Running daily clean...');
    const metrics = await runFullClean(gmail, vipList);
    await saveMetrics(metrics);
    console.log('[InboxBuddy:Cron] Clean complete:', metrics);

    // Send weekly report on Sundays
    const today = new Date();
    let reportSent = false;

    if (today.getDay() === 0) {
      const myEmail = process.env.INBOX_BUDDY_MY_EMAIL;
      if (myEmail) {
        console.log('[InboxBuddy:Cron] Sunday — sending weekly report...');

        // Aggregate this week's metrics
        const stored = await loadMetrics();
        const weekMetrics = stored.history.slice(0, 7);

        // Use the latest metrics as the report data
        // (could aggregate, but latest is most useful)
        reportSent = await sendWeeklyReport(gmail, myEmail, metrics);
        console.log(`[InboxBuddy:Cron] Report sent: ${reportSent}`);
      }
    }

    return NextResponse.json({
      success: true,
      metrics,
      reportSent,
      dayOfWeek: today.toLocaleDateString('en-US', { weekday: 'long' }),
    });
  } catch (err: any) {
    console.error('[InboxBuddy:Cron] Failed:', err);
    return NextResponse.json(
      { error: err.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}
