/**
 * DEXTER'S LAB — Subscription Batch Actions
 * POST: Trash or archive emails from multiple selected senders at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

interface BatchSender {
  senderEmail: string;
  messageIds: string[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { senders, action } = await request.json() as {
    senders: BatchSender[];
    action: 'trash' | 'archive';
  };

  if (!senders || !Array.isArray(senders) || senders.length === 0) {
    return NextResponse.json({ error: 'No senders provided' }, { status: 400 });
  }

  if (action !== 'trash' && action !== 'archive') {
    return NextResponse.json({ error: 'Invalid action, must be "trash" or "archive"' }, { status: 400 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  try {
    // Collect all message IDs from all senders
    const allIds = senders.flatMap((s) => s.messageIds);

    if (allIds.length === 0) {
      return NextResponse.json({ success: true, affected: 0, senderCount: 0 });
    }

    // Process in 1000-ID chunks (Gmail API limit)
    let affected = 0;
    const CHUNK_SIZE = 1000;

    for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
      const chunk = allIds.slice(i, i + CHUNK_SIZE);

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
        // Archive = remove from inbox
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: chunk,
            removeLabelIds: ['INBOX'],
          },
        });
      }
      affected += chunk.length;
    }

    const senderNames = senders.map((s) => s.senderEmail).join(', ');
    console.log(`[Subscriptions] Batch ${action}: ${affected} emails from ${senders.length} senders (${senderNames})`);

    return NextResponse.json({
      success: true,
      affected,
      senderCount: senders.length,
      action,
    });
  } catch (err: any) {
    console.error('[Subscriptions] Batch action failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
