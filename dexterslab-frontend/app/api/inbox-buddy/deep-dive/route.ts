/**
 * DEXTER'S LAB — Deep Dive Analysis API Route
 * POST: Triggers comprehensive Gemini-powered inbox audit
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';
import { deepDiveAnalysis } from '@/lib/inbox-analyzer';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const accessToken = (session as any).accessToken as string;
    const gmail = getGmailClient(accessToken);
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    console.log('[InboxBuddy] Starting deep dive analysis...');
    const result = await deepDiveAnalysis(gmail, geminiApiKey);
    console.log(`[InboxBuddy] Deep dive complete: ${result.recommendations.length} recommendations`);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[InboxBuddy] Deep dive failed:', err);
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
