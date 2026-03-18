/**
 * DEXTER'S LAB — Mass Purge API Routes
 * POST /scan:  Scans historically for junk, subscriptions, repetitive senders
 * POST /apply: Executes mass purge on approved categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

export interface PurgeCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  query: string;
  count: number;
  sampleSubjects: string[];
  sampleSenders: string[];
  messageIds: string[];
}

// Scan for purgeable email categories
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'scan';

  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  if (action === 'scan') {
    return handleScan(gmail);
  } else if (action === 'apply') {
    const body = await request.json();
    return handleApply(gmail, body);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

async function handleScan(gmail: any) {
  try {
    console.log('[MassPurge] Starting historical scan...');

    // Define purge queries — go deep historically
    const purgeQueries = [
      {
        id: 'old-promos',
        label: 'Old Promotions',
        description: 'Marketing emails older than 30 days',
        icon: '🛍️',
        query: 'category:promotions older_than:30d -is:starred',
      },
      {
        id: 'social-noise',
        label: 'Social Notifications',
        description: 'Social media notifications and updates',
        icon: '📱',
        query: 'category:social older_than:14d -is:starred',
      },
      {
        id: 'old-newsletters',
        label: 'Old Newsletters',
        description: 'Newsletter emails older than 60 days',
        icon: '📰',
        query: '(subject:newsletter OR subject:digest OR subject:"weekly update" OR list:) older_than:60d -is:starred -is:important',
      },
      {
        id: 'notifications',
        label: 'Automated Notifications',
        description: 'Auto-generated notifications and alerts',
        icon: '🔔',
        query: '(from:noreply OR from:no-reply OR from:notifications OR from:alerts OR from:mailer-daemon) older_than:30d -is:starred',
      },
      {
        id: 'read-old',
        label: 'Read & Old',
        description: 'Already-read emails older than 6 months',
        icon: '📖',
        query: 'is:read older_than:6m in:inbox -is:starred -is:important',
      },
      {
        id: 'unread-ancient',
        label: 'Unread & Ancient',
        description: 'Unread emails older than 1 year (never opened)',
        icon: '💀',
        query: 'is:unread older_than:1y -is:starred -is:important',
      },
      {
        id: 'large-old',
        label: 'Large & Old Emails',
        description: 'Emails over 5MB older than 3 months',
        icon: '📦',
        query: 'larger:5M older_than:3m -is:starred',
      },
    ];

    const categories: PurgeCategory[] = [];

    for (const pq of purgeQueries) {
      try {
        const { data } = await gmail.users.messages.list({
          userId: 'me',
          q: pq.query,
          maxResults: 500,
        });

        const messages = data.messages || [];
        if (messages.length === 0) continue;

        // Get sample metadata for preview
        const sampleIds = messages.slice(0, 5);
        const samples = await Promise.all(
          sampleIds.map((msg: any) =>
            gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject'],
            }).catch(() => null)
          )
        );

        const sampleSubjects: string[] = [];
        const sampleSenders: string[] = [];

        for (const s of samples) {
          if (!s?.data?.payload?.headers) continue;
          const subj = s.data.payload.headers.find((h: any) => h.name === 'Subject')?.value;
          const from = s.data.payload.headers.find((h: any) => h.name === 'From')?.value;
          if (subj) sampleSubjects.push(subj.slice(0, 60));
          if (from) {
            const match = from.match(/^"?([^"<]+)"?\s*</);
            sampleSenders.push(match ? match[1].trim() : from.split('@')[0]);
          }
        }

        categories.push({
          ...pq,
          count: data.resultSizeEstimate || messages.length,
          sampleSubjects: [...new Set(sampleSubjects)].slice(0, 3),
          sampleSenders: [...new Set(sampleSenders)].slice(0, 3),
          messageIds: messages.map((m: any) => m.id!),
        });
      } catch (err) {
        console.error(`[MassPurge] Query failed for ${pq.id}:`, err);
      }
    }

    const totalPurgeable = categories.reduce((a, c) => a + c.count, 0);

    console.log(`[MassPurge] Scan complete: ${totalPurgeable} emails across ${categories.length} categories`);

    return NextResponse.json({
      success: true,
      categories,
      totalPurgeable,
    });
  } catch (err: any) {
    console.error('[MassPurge] Scan failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleApply(gmail: any, body: { categoryId: string; messageIds: string[]; action: 'trash' | 'archive' }) {
  try {
    const { messageIds, action } = body;

    if (!messageIds || messageIds.length === 0) {
      return NextResponse.json({ error: 'No messages to purge' }, { status: 400 });
    }

    // Process in batches of 100 (Gmail API limit)
    let affected = 0;
    for (let i = 0; i < messageIds.length; i += 100) {
      const batch = messageIds.slice(i, i + 100);

      if (action === 'trash') {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX'],
          },
        });
      } else {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            removeLabelIds: ['INBOX'],
          },
        });
      }

      affected += batch.length;
    }

    console.log(`[MassPurge] Applied ${action} to ${affected} messages`);
    return NextResponse.json({ success: true, affected, action });
  } catch (err: any) {
    console.error('[MassPurge] Apply failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
