/**
 * DEXTER'S LAB — Mass Purge API Routes v3.0
 * POST ?action=scan   → Paginated scan through ALL matching emails (up to 5K per category)
 * POST ?action=apply  → Batch purge in 1,000-ID chunks
 * POST ?action=purgeAll → Purge every scanned category at once
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

const PURGE_QUERIES = [
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
    description: 'Auto-generated alerts and no-reply emails',
    icon: '🔔',
    query: '(from:noreply OR from:no-reply OR from:notifications OR from:alerts OR from:mailer-daemon OR from:donotreply) older_than:30d -is:starred',
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
  {
    id: 'updates-old',
    label: 'Old Updates',
    description: 'Automated updates (order confirmations, shipping, etc.)',
    icon: '📋',
    query: 'category:updates older_than:6m -is:starred -is:important',
  },
  {
    id: 'forums-old',
    label: 'Old Forum Emails',
    description: 'Forum and group discussion threads',
    icon: '💬',
    query: 'category:forums older_than:3m -is:starred',
  },
];

// ─── Paginated message list fetcher ───────────────────────
// Follows nextPageToken to collect up to `maxTotal` message IDs

async function paginatedList(
  gmail: any,
  query: string,
  maxTotal: number = 5000
): Promise<{ ids: string[]; total: number }> {
  const allIds: string[] = [];
  let pageToken: string | undefined;

  while (allIds.length < maxTotal) {
    const params: any = {
      userId: 'me',
      q: query,
      maxResults: 500, // Gmail API max per page
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await gmail.users.messages.list(params);
    const messages = data.messages || [];

    if (messages.length === 0) break;

    allIds.push(...messages.map((m: any) => m.id!));
    pageToken = data.nextPageToken;

    if (!pageToken) break; // No more pages
  }

  return { ids: allIds.slice(0, maxTotal), total: allIds.length };
}

// ─── Batch modify in 1,000-ID chunks ─────────────────────

async function batchProcess(
  gmail: any,
  ids: string[],
  action: 'trash' | 'archive'
): Promise<number> {
  const BATCH_SIZE = 1000; // Gmail's real batchModify limit
  let affected = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);

    if (action === 'trash') {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX'],
        },
      });
    } else {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          removeLabelIds: ['INBOX'],
        },
      });
    }

    affected += chunk.length;
    console.log(`[MassPurge] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${action} ${chunk.length} emails (${affected}/${ids.length} total)`);
  }

  return affected;
}

// ─── Route Handler ────────────────────────────────────────

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
  } else if (action === 'purgeAll') {
    const body = await request.json();
    return handlePurgeAll(gmail, body);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ─── Scan: Paginated ──────────────────────────────────────

async function handleScan(gmail: any) {
  try {
    console.log('[MassPurge] Starting paginated scan...');
    const categories: PurgeCategory[] = [];

    for (const pq of PURGE_QUERIES) {
      try {
        const { ids, total } = await paginatedList(gmail, pq.query, 5000);

        if (ids.length === 0) continue;

        // Get sample metadata for preview (only 5)
        const sampleIds = ids.slice(0, 5);
        const samples = await Promise.all(
          sampleIds.map((id: string) =>
            gmail.users.messages.get({
              userId: 'me',
              id,
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
          count: total,
          sampleSubjects: [...new Set(sampleSubjects)].slice(0, 3),
          sampleSenders: [...new Set(sampleSenders)].slice(0, 3),
          messageIds: ids,
        });

        console.log(`[MassPurge] ${pq.id}: ${total} emails (fetched ${ids.length} IDs)`);
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

// ─── Apply: Single Category ──────────────────────────────

async function handleApply(
  gmail: any,
  body: { categoryId: string; messageIds: string[]; action: 'trash' | 'archive' }
) {
  try {
    const { messageIds, action: purgeAction } = body;

    if (!messageIds || messageIds.length === 0) {
      return NextResponse.json({ error: 'No messages to purge' }, { status: 400 });
    }

    const affected = await batchProcess(gmail, messageIds, purgeAction);

    console.log(`[MassPurge] Applied ${purgeAction} to ${affected} messages`);
    return NextResponse.json({ success: true, affected, action: purgeAction });
  } catch (err: any) {
    console.error('[MassPurge] Apply failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Purge All: All categories at once ───────────────────

async function handlePurgeAll(
  gmail: any,
  body: { categories: { id: string; messageIds: string[]; action: 'trash' | 'archive' }[] }
) {
  try {
    const results: { id: string; affected: number; action: string }[] = [];
    let totalAffected = 0;

    for (const cat of body.categories) {
      if (!cat.messageIds || cat.messageIds.length === 0) continue;

      const affected = await batchProcess(gmail, cat.messageIds, cat.action);
      results.push({ id: cat.id, affected, action: cat.action });
      totalAffected += affected;

      console.log(`[MassPurge] Purged ${cat.id}: ${affected} emails (${cat.action})`);
    }

    console.log(`[MassPurge] PURGE ALL complete: ${totalAffected} total emails affected`);
    return NextResponse.json({
      success: true,
      totalAffected,
      results,
    });
  } catch (err: any) {
    console.error('[MassPurge] PurgeAll failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
