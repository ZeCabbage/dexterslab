/**
 * DEXTER'S LAB — VIP Discovery API Route
 * GET: Triggers Gemini-powered VIP analysis of inbox
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';
import { discoverVIPs } from '@/lib/inbox-analyzer';

export async function GET() {
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

    console.log('[InboxBuddy] Starting VIP discovery...');
    const suggestions = await discoverVIPs(gmail, geminiApiKey);
    console.log(`[InboxBuddy] Found ${suggestions.length} VIP suggestions`);

    return NextResponse.json({ success: true, suggestions });
  } catch (err: any) {
    console.error('[InboxBuddy] VIP discovery failed:', err);
    return NextResponse.json({ error: err.message || 'Discovery failed' }, { status: 500 });
  }
}
