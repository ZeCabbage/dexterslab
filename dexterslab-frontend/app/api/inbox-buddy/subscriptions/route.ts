/**
 * DEXTER'S LAB — Subscription Scanner
 * GET: Deep scan for all email subscriptions (up to 2000 messages)
 *      Groups by sender, computes frequency, auto-categorizes
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

// ─── Types ───────────────────────────────────────

export interface Subscription {
  senderEmail: string;
  senderName: string;
  domain: string;
  totalEmails: number;
  frequency: number; // estimated emails per week
  lastReceived: string; // ISO
  firstSeen: string; // ISO
  unsubscribeLink: string | null;
  unsubscribeMailto: string | null;
  hasOneClick: boolean; // RFC 8058 one-click unsubscribe support
  sampleSubjects: string[];
  messageIds: string[];
  category: 'newsletter' | 'marketing' | 'social' | 'transactional' | 'notification' | 'other';
}

// ─── Category heuristics ─────────────────────────

const CATEGORY_RULES: { pattern: RegExp; category: Subscription['category'] }[] = [
  // Social
  { pattern: /facebook|twitter|x\.com|linkedin|instagram|tiktok|reddit|discord|mastodon|threads|snapchat|pinterest/i, category: 'social' },
  // Transactional
  { pattern: /receipt|invoice|order|shipping|delivery|payment|confirm|verify|reset|password|activation|welcome/i, category: 'transactional' },
  // Newsletter
  { pattern: /newsletter|digest|weekly|daily|roundup|briefing|bulletin|recap|update|dispatch|substack|mailchimp/i, category: 'newsletter' },
  // Notification
  { pattern: /notification|alert|reminder|noreply|no-reply|do-not-reply|donotreply|automated|system/i, category: 'notification' },
  // Marketing
  { pattern: /promo|sale|offer|deal|discount|coupon|exclusive|limited|free|reward|loyalty|unsubscribe/i, category: 'marketing' },
];

function categorize(senderEmail: string, senderName: string, subjects: string[]): Subscription['category'] {
  const combined = `${senderEmail} ${senderName} ${subjects.join(' ')}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(combined)) return rule.category;
  }
  return 'other';
}

// ─── GET: Deep subscription scan ─────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  try {
    // Paginate through messages that contain "unsubscribe" (body/subject/headers)
    // This catches virtually all subscription emails since they have unsubscribe links in footers
    const allMessageIds: { id: string }[] = [];
    let pageToken: string | undefined;
    const MAX_MESSAGES = 2000;

    while (allMessageIds.length < MAX_MESSAGES) {
      const params: any = {
        userId: 'me',
        q: 'unsubscribe',
        maxResults: 500,
      };
      if (pageToken) params.pageToken = pageToken;

      const { data } = await gmail.users.messages.list(params);
      const msgs = data.messages || [];
      allMessageIds.push(...msgs.map((m: any) => ({ id: m.id! })));
      console.log(`[Subscriptions] Fetched page: ${allMessageIds.length} message IDs so far`);

      pageToken = data.nextPageToken ?? undefined;
      if (!pageToken || allMessageIds.length >= MAX_MESSAGES) break;
    }

    // Cap at MAX_MESSAGES
    const messagesToProcess = allMessageIds.slice(0, MAX_MESSAGES);
    console.log(`[Subscriptions] Total messages to process: ${messagesToProcess.length}`);

    if (messagesToProcess.length === 0) {
      return NextResponse.json({ subscriptions: [], total: 0, scanned: 0 });
    }

    // Fetch metadata in batches
    const senderMap = new Map<string, {
      name: string;
      domain: string;
      count: number;
      unsubLink: string | null;
      unsubMailto: string | null;
      hasOneClick: boolean;
      subjects: string[];
      ids: string[];
      timestamps: number[];
    }>();

    const BATCH_SIZE = 25;
    for (let i = 0; i < messagesToProcess.length; i += BATCH_SIZE) {
      const batch = messagesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`[Subscriptions] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(messagesToProcess.length / BATCH_SIZE)} (${i + batch.length}/${messagesToProcess.length})`);

      const details = await Promise.all(
        batch.map((msg) =>
          gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'List-Unsubscribe', 'List-Unsubscribe-Post', 'Date'],
          }).catch(() => null)
        )
      );

      for (const detail of details) {
        if (!detail?.data?.payload?.headers) continue;

        const headers = detail.data.payload.headers;
        const fromRaw = headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)';
        const unsubHeader = headers.find((h: any) => h.name === 'List-Unsubscribe')?.value || '';
        const unsubPostHeader = headers.find((h: any) => h.name === 'List-Unsubscribe-Post')?.value || '';
        const dateHeader = headers.find((h: any) => h.name === 'Date')?.value || '';

        // Parse sender
        const emailMatch = fromRaw.match(/<(.+?)>/) || fromRaw.match(/(\S+@\S+)/);
        const email = emailMatch ? emailMatch[1].toLowerCase() : fromRaw.toLowerCase();
        const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
        const name = nameMatch ? nameMatch[1].trim() : email.split('@')[0];
        const domain = email.includes('@') ? email.split('@')[1] : 'unknown';

        // Parse timestamp
        const timestamp = dateHeader ? new Date(dateHeader).getTime() : (detail.data.internalDate ? parseInt(detail.data.internalDate) : Date.now());

        // Parse unsubscribe links
        let unsubLink: string | null = null;
        let unsubMailto: string | null = null;
        const hasOneClick = unsubPostHeader.toLowerCase().includes('list-unsubscribe=one-click');
        if (unsubHeader) {
          const httpMatch = unsubHeader.match(/<(https?:\/\/[^>]+)>/);
          if (httpMatch) unsubLink = httpMatch[1];
          const mailtoMatch = unsubHeader.match(/<(mailto:[^>]+)>/);
          if (mailtoMatch) unsubMailto = mailtoMatch[1];
        }

        if (!senderMap.has(email)) {
          senderMap.set(email, {
            name,
            domain,
            count: 0,
            unsubLink,
            unsubMailto,
            hasOneClick,
            subjects: [],
            ids: [],
            timestamps: [],
          });
        }

        const entry = senderMap.get(email)!;
        entry.count++;
        entry.ids.push(detail.data.id!);
        entry.timestamps.push(timestamp);
        if (entry.subjects.length < 3 && subject.length > 0) {
          entry.subjects.push(subject.slice(0, 80));
        }
        if (!entry.unsubLink && unsubLink) entry.unsubLink = unsubLink;
        if (!entry.unsubMailto && unsubMailto) entry.unsubMailto = unsubMailto;
        if (hasOneClick) entry.hasOneClick = true;
      }
    }

    // Build subscription list
    const now = Date.now();
    const subscriptions: Subscription[] = Array.from(senderMap.entries())
      .map(([email, v]) => {
        const sortedTs = v.timestamps.sort((a, b) => b - a);
        const lastReceived = new Date(sortedTs[0]).toISOString();
        const firstSeen = new Date(sortedTs[sortedTs.length - 1]).toISOString();

        // Compute frequency: emails per week
        const spanMs = sortedTs[0] - sortedTs[sortedTs.length - 1];
        const spanWeeks = Math.max(spanMs / (7 * 24 * 60 * 60 * 1000), 1);
        const frequency = Math.round((v.count / spanWeeks) * 10) / 10;

        return {
          senderEmail: email,
          senderName: v.name,
          domain: v.domain,
          totalEmails: v.count,
          frequency,
          lastReceived,
          firstSeen,
          unsubscribeLink: v.unsubLink,
          unsubscribeMailto: v.unsubMailto,
          sampleSubjects: v.subjects,
          messageIds: v.ids,
          hasOneClick: v.hasOneClick,
          category: categorize(email, v.name, v.subjects),
        };
      })
      .sort((a, b) => b.totalEmails - a.totalEmails);

    const totalEmails = subscriptions.reduce((sum, s) => sum + s.totalEmails, 0);
    const totalFrequency = subscriptions.reduce((sum, s) => sum + s.frequency, 0);

    console.log(`[Subscriptions] Scanned ${messagesToProcess.length} messages, found ${subscriptions.length} subscriptions (${totalEmails} total emails)`);

    return NextResponse.json({
      subscriptions,
      total: subscriptions.length,
      scanned: messagesToProcess.length,
      totalEmails,
      estimatedWeeklyEmails: Math.round(totalFrequency * 10) / 10,
    });
  } catch (err: any) {
    console.error('[Subscriptions] Scan failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
