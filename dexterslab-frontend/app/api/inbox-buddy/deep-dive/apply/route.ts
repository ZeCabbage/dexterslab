/**
 * DEXTER'S LAB — Deep Dive Apply Action API Route
 * POST: Executes a single approved recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient, ensureLabel } from '@/lib/gmail';

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

    // If we have a sender email but no message IDs, find messages from that sender
    if (targetIds.length === 0 && senderEmail) {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        q: `from:${senderEmail}`,
        maxResults: 100,
      });
      targetIds = (data.messages || []).map((m) => m.id!).filter(Boolean);
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
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: targetIds.slice(0, 100),
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX'],
          },
        });
        affected = targetIds.length;
        break;
      }

      case 'archive': {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: targetIds.slice(0, 100),
            removeLabelIds: ['INBOX'],
          },
        });
        affected = targetIds.length;
        break;
      }

      case 'label': {
        const keepLabelId = await ensureLabel(gmail, 'KEEP');
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: targetIds.slice(0, 100),
            addLabelIds: [keepLabelId],
          },
        });
        affected = targetIds.length;
        break;
      }

      case 'review': {
        const reviewLabelId = await ensureLabel(gmail, 'SECURITY REVIEW');
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: targetIds.slice(0, 100),
            addLabelIds: [reviewLabelId],
          },
        });
        affected = targetIds.length;
        break;
      }

      case 'unsubscribe':
      case 'keep': {
        // For unsubscribe/keep, just acknowledge — user handles manually
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
