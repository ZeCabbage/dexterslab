/**
 * DEXTER'S LAB — Unsubscribe Helper
 * GET:  Scan top repeat senders, extract List-Unsubscribe headers
 * POST: Trash all emails from a sender after user unsubscribes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

export interface UnsubscribeCandidate {
  senderEmail: string;
  senderName: string;
  emailCount: number;
  unsubscribeLink: string | null;
  unsubscribeMailto: string | null;
  sampleSubject: string;
  messageIds: string[];
}

// ─── GET: Find senders with unsubscribe links ────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  try {
    // Find emails with List-Unsubscribe header (marketing/newsletters)
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'list:unsubscribe -is:starred older_than:7d',
      maxResults: 200,
    });

    const messages = data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ candidates: [], total: 0 });
    }

    // Fetch metadata including List-Unsubscribe header
    const senderMap = new Map<string, {
      name: string;
      count: number;
      unsubLink: string | null;
      unsubMailto: string | null;
      subject: string;
      ids: string[];
    }>();

    const batchSize = 20;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const details = await Promise.all(
        batch.map((msg) =>
          gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'List-Unsubscribe'],
          }).catch(() => null)
        )
      );

      for (const detail of details) {
        if (!detail?.data?.payload?.headers) continue;

        const headers = detail.data.payload.headers;
        const fromRaw = headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)';
        const unsubHeader = headers.find((h: any) => h.name === 'List-Unsubscribe')?.value || '';

        // Parse sender
        const emailMatch = fromRaw.match(/<(.+?)>/) || fromRaw.match(/(\S+@\S+)/);
        const email = emailMatch ? emailMatch[1].toLowerCase() : fromRaw.toLowerCase();
        const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
        const name = nameMatch ? nameMatch[1].trim() : email.split('@')[0];

        // Parse unsubscribe links
        let unsubLink: string | null = null;
        let unsubMailto: string | null = null;

        if (unsubHeader) {
          // Extract HTTP link
          const httpMatch = unsubHeader.match(/<(https?:\/\/[^>]+)>/);
          if (httpMatch) unsubLink = httpMatch[1];

          // Extract mailto link
          const mailtoMatch = unsubHeader.match(/<(mailto:[^>]+)>/);
          if (mailtoMatch) unsubMailto = mailtoMatch[1];
        }

        if (!senderMap.has(email)) {
          senderMap.set(email, {
            name,
            count: 0,
            unsubLink,
            unsubMailto,
            subject,
            ids: [],
          });
        }

        const entry = senderMap.get(email)!;
        entry.count++;
        entry.ids.push(detail.data.id!);
        // Keep the first unsubscribe link found
        if (!entry.unsubLink && unsubLink) entry.unsubLink = unsubLink;
        if (!entry.unsubMailto && unsubMailto) entry.unsubMailto = unsubMailto;
      }
    }

    // Sort by count (most emails first) and filter to those with links
    const candidates: UnsubscribeCandidate[] = Array.from(senderMap.entries())
      .filter(([_, v]) => v.unsubLink || v.unsubMailto)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([email, v]) => ({
        senderEmail: email,
        senderName: v.name,
        emailCount: v.count,
        unsubscribeLink: v.unsubLink,
        unsubscribeMailto: v.unsubMailto,
        sampleSubject: v.subject.slice(0, 60),
        messageIds: v.ids,
      }));

    return NextResponse.json({
      candidates,
      total: candidates.length,
    });
  } catch (err: any) {
    console.error('[Unsubscribe] Scan failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: Trash all emails from a sender ────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { senderEmail, messageIds } = await request.json();
  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  try {
    // If we have messageIds, use those; otherwise find all from sender
    let targetIds: string[] = messageIds || [];

    if (targetIds.length === 0 && senderEmail) {
      let pageToken: string | undefined;
      while (true) {
        const params: any = {
          userId: 'me',
          q: `from:${senderEmail}`,
          maxResults: 500,
        };
        if (pageToken) params.pageToken = pageToken;

        const { data } = await gmail.users.messages.list(params);
        const msgs = (data.messages || []).map((m: any) => m.id!).filter(Boolean);
        targetIds.push(...msgs);

        pageToken = data.nextPageToken ?? undefined;
        if (!pageToken || targetIds.length >= 5000) break;
      }
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, affected: 0 });
    }

    // Batch trash in 1000-ID chunks
    let affected = 0;
    for (let i = 0; i < targetIds.length; i += 1000) {
      const chunk = targetIds.slice(i, i + 1000);
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX'],
        },
      });
      affected += chunk.length;
    }

    console.log(`[Unsubscribe] Trashed ${affected} emails from ${senderEmail}`);
    return NextResponse.json({ success: true, affected, senderEmail });
  } catch (err: any) {
    console.error('[Unsubscribe] Trash failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
