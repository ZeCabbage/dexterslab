/**
 * DEXTER'S LAB — Threat Log & Actions
 * GET: Fetch quarantined emails for the threat log
 * POST: Actions on quarantined emails (delete, restore, preview)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

// ── GET: Fetch quarantined emails ──

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  try {
    // Find QUARANTINE label
    const { data: labelsData } = await gmail.users.labels.list({ userId: 'me' });
    const quarantineLabel = labelsData.labels?.find((l: any) => l.name === 'QUARANTINE');

    if (!quarantineLabel) {
      return NextResponse.json({ threats: [], total: 0 });
    }

    // Fetch quarantined messages
    const { data: listData } = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [quarantineLabel.id!],
      maxResults: 50,
    });

    const messageIds = listData.messages?.map((m: any) => m.id!) || [];

    if (messageIds.length === 0) {
      return NextResponse.json({ threats: [], total: 0 });
    }

    // Fetch metadata for each
    const threats = await Promise.all(
      messageIds.map(async (id) => {
        try {
          const { data } = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date', 'Authentication-Results'],
          });

          const headers = data.payload?.headers || [];
          const fromRaw = headers.find((h: any) => h.name === 'From')?.value || '';
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)';
          const dateHeader = headers.find((h: any) => h.name === 'Date')?.value || '';
          const authHeader = headers.find((h: any) => h.name === 'Authentication-Results')?.value || '';

          const emailMatch = fromRaw.match(/<(.+?)>/) || fromRaw.match(/(\S+@\S+)/);
          const fromEmail = emailMatch ? emailMatch[1].toLowerCase() : fromRaw.toLowerCase();
          const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
          const fromName = nameMatch ? nameMatch[1].trim() : fromEmail.split('@')[0];

          // Determine threat type from auth header
          let threatType = 'unknown';
          if (authHeader) {
            const dmarcMatch = authHeader.match(/dmarc=(\w+)/i);
            const dkimMatch = authHeader.match(/dkim=(\w+)/i);
            if (dmarcMatch && dmarcMatch[1] !== 'pass') threatType = 'Failed DMARC';
            else if (dkimMatch && dkimMatch[1] !== 'pass') threatType = 'Failed DKIM';
          }

          return {
            messageId: id,
            sender: fromEmail,
            senderName: fromName,
            subject: subject.slice(0, 120),
            date: dateHeader,
            threatType,
            snippet: data.snippet || '',
          };
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json({
      threats: threats.filter(Boolean),
      total: threats.filter(Boolean).length,
    });
  } catch (err: any) {
    console.error('[Protect] Fetch threats failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: Actions on quarantined emails ──

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { action, messageId } = await request.json();
  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  if (!messageId || !action) {
    return NextResponse.json({ error: 'Missing messageId or action' }, { status: 400 });
  }

  try {
    // Find QUARANTINE label
    const { data: labelsData } = await gmail.users.labels.list({ userId: 'me' });
    const quarantineLabel = labelsData.labels?.find((l: any) => l.name === 'QUARANTINE');

    if (action === 'delete') {
      // Permanently trash the email
      await gmail.users.messages.trash({ userId: 'me', id: messageId });
      return NextResponse.json({ success: true, action: 'deleted', messageId });
    }

    if (action === 'restore') {
      // Remove QUARANTINE label, restore to INBOX
      const modifyBody: any = { addLabelIds: ['INBOX'] };
      if (quarantineLabel) modifyBody.removeLabelIds = [quarantineLabel.id];

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: modifyBody,
      });
      return NextResponse.json({ success: true, action: 'restored', messageId });
    }

    if (action === 'preview') {
      // Fetch full email but strip HTML for safe viewing
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      let body = '';
      const payload = data.payload;

      // Prefer plain text
      if (payload?.parts) {
        const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        } else {
          // Fall back to HTML but strip all tags
          const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
          if (htmlPart?.body?.data) {
            const html = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
            body = stripHtml(html);
          }
        }
      } else if (payload?.body?.data) {
        const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        body = decoded.includes('<') ? stripHtml(decoded) : decoded;
      }

      const headers = data.payload?.headers || [];
      return NextResponse.json({
        success: true,
        action: 'preview',
        messageId,
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        date: headers.find((h: any) => h.name === 'Date')?.value || '',
        body: body.slice(0, 5000), // Cap at 5000 chars for safety
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error(`[Protect] Action ${action} failed:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Strip ALL HTML — no images, no scripts, no tracking pixels
 */
function stripHtml(html: string): string {
  return html
    // Remove style/script tags and their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
