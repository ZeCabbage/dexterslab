/**
 * DEXTER'S LAB — Deep Dive Apply Action API Route v3.0
 * POST: Executes approved recommendations — processes ALL message IDs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient, ensureLabel } from '@/lib/gmail';

const BATCH_SIZE = 1000; // Gmail API batchModify limit

async function batchModify(
  gmail: any,
  ids: string[],
  addLabelIds?: string[],
  removeLabelIds?: string[]
): Promise<number> {
  let affected = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const requestBody: any = { ids: chunk };
    if (addLabelIds?.length) requestBody.addLabelIds = addLabelIds;
    if (removeLabelIds?.length) requestBody.removeLabelIds = removeLabelIds;

    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody,
    });
    affected += chunk.length;
  }

  return affected;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, messageIds, senderEmail } = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'No action specified' }, { status: 400 });
    }

    const accessToken = (session as any).accessToken as string;
    const gmail = getGmailClient(accessToken);

    let affected = 0;

    // If we have specific message IDs, act on those
    let targetIds: string[] = messageIds || [];

    // If we have a sender email but no message IDs, find ALL messages from that sender
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
      return NextResponse.json({
        success: true,
        affected: 0,
        message: 'No matching messages found',
      });
    }

    switch (action) {
      case 'trash': {
        affected = await batchModify(gmail, targetIds, ['TRASH'], ['INBOX']);
        break;
      }

      case 'archive': {
        affected = await batchModify(gmail, targetIds, undefined, ['INBOX']);
        break;
      }

      case 'label': {
        const keepLabelId = await ensureLabel(gmail, 'KEEP');
        affected = await batchModify(gmail, targetIds, [keepLabelId]);
        break;
      }

      case 'review': {
        const reviewLabelId = await ensureLabel(gmail, 'SECURITY REVIEW');
        affected = await batchModify(gmail, targetIds, [reviewLabelId]);
        break;
      }

      case 'download': {
        // Mark for keeping + return info that downloads are available
        const keepLabelId = await ensureLabel(gmail, 'KEEP');
        affected = await batchModify(gmail, targetIds, [keepLabelId]);
        break;
      }

      case 'unsubscribe': {
        // Trash all emails from this sender
        affected = await batchModify(gmail, targetIds, ['TRASH'], ['INBOX']);
        break;
      }

      case 'keep': {
        // Just acknowledge — user wants to keep these
        affected = targetIds.length;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    console.log(`[InboxBuddy] Applied ${action} to ${affected} messages`);
    return NextResponse.json({ success: true, affected, action });
  } catch (err: any) {
    console.error('[InboxBuddy] Apply action failed:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
