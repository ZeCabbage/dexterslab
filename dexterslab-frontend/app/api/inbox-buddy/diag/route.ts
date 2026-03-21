/**
 * DEXTER'S LAB — Gmail Diagnostic Endpoint
 * Tests the full Gmail API flow and reports what works / what fails
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  // Step 1: Check session
  const session = await getServerSession(authOptions);
  if (!session) {
    results.steps.push({ step: 'Session', status: '❌ FAIL', detail: 'No session found — not signed in' });
    return NextResponse.json(results);
  }
  results.steps.push({ step: 'Session', status: '✅ OK', detail: `Signed in as ${session.user?.email}` });

  // Step 2: Check access token
  const accessToken = (session as any).accessToken;
  const sessionError = (session as any).error;

  if (sessionError) {
    results.steps.push({ step: 'Token', status: '❌ FAIL', detail: `Token error: ${sessionError}` });
    return NextResponse.json(results);
  }

  if (!accessToken) {
    results.steps.push({ step: 'Token', status: '❌ FAIL', detail: 'No access token in session — re-auth needed' });
    return NextResponse.json(results);
  }
  results.steps.push({ step: 'Token', status: '✅ OK', detail: `Token present (${accessToken.substring(0, 20)}...)` });

  // Step 3: Create Gmail client and test basic read
  const gmail = getGmailClient(accessToken);

  try {
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
    results.steps.push({
      step: 'Gmail Profile',
      status: '✅ OK',
      detail: `Email: ${profile.emailAddress}, Total messages: ${profile.messagesTotal}, Threads: ${profile.threadsTotal}`,
    });
  } catch (err: any) {
    results.steps.push({
      step: 'Gmail Profile',
      status: '❌ FAIL',
      detail: `${err.message} — Code: ${err.code || 'N/A'}`,
      hint: err.code === 403
        ? 'Gmail API may not be enabled, or scopes not granted. Disconnect and reconnect Gmail.'
        : err.code === 401
        ? 'Access token expired or invalid. Disconnect and reconnect Gmail.'
        : 'Unknown error',
    });
    return NextResponse.json(results);
  }

  // Step 4: Test list messages (read)
  try {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 5,
    });
    const count = data.resultSizeEstimate || 0;
    results.steps.push({
      step: 'List Messages',
      status: '✅ OK',
      detail: `Found ~${count} messages in inbox, retrieved ${data.messages?.length || 0} IDs`,
    });
  } catch (err: any) {
    results.steps.push({ step: 'List Messages', status: '❌ FAIL', detail: err.message });
    return NextResponse.json(results);
  }

  // Step 5: Test list labels (read + labels scope)
  try {
    const { data } = await gmail.users.labels.list({ userId: 'me' });
    const labelNames = data.labels?.map((l) => l.name).slice(0, 10) || [];
    results.steps.push({
      step: 'List Labels',
      status: '✅ OK',
      detail: `${data.labels?.length || 0} labels found. First 10: ${labelNames.join(', ')}`,
    });
  } catch (err: any) {
    results.steps.push({ step: 'List Labels', status: '❌ FAIL', detail: err.message });
  }

  // Step 6: Test finding promotions (what declutter targets)
  try {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions older_than:30d -is:starred',
      maxResults: 5,
    });
    results.steps.push({
      step: 'Find Promotions',
      status: '✅ OK',
      detail: `Found ~${data.resultSizeEstimate || 0} old promotional emails`,
    });
  } catch (err: any) {
    results.steps.push({ step: 'Find Promotions', status: '❌ FAIL', detail: err.message });
  }

  // Step 7: Test modify (write scope) — read-only test, just check if we CAN modify
  try {
    // Get one message to test modify permissions
    const { data: listData } = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });

    if (listData.messages && listData.messages.length > 0) {
      const testId = listData.messages[0].id!;
      // Get current labels
      const { data: msgData } = await gmail.users.messages.get({
        userId: 'me',
        id: testId,
        format: 'metadata',
        metadataHeaders: ['Subject'],
      });
      const subject = msgData.payload?.headers?.find((h) => h.name === 'Subject')?.value || '(no subject)';
      const labels = msgData.labelIds || [];

      results.steps.push({
        step: 'Read Message Detail',
        status: '✅ OK',
        detail: `Test message: "${subject.substring(0, 50)}" — Labels: ${labels.join(', ')}`,
      });

      // Test write access: toggle UNREAD off and back on
      const hadUnread = labels.includes('UNREAD');
      
      if (hadUnread) {
        // Remove UNREAD, then add it back
        await gmail.users.messages.modify({
          userId: 'me',
          id: testId,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
        await gmail.users.messages.modify({
          userId: 'me',
          id: testId,
          requestBody: { addLabelIds: ['UNREAD'] },
        });
        results.steps.push({
          step: 'Write Access (modify)',
          status: '✅ OK',
          detail: 'Toggled UNREAD label off and back on — write access confirmed',
        });
      } else {
        // Add UNREAD, then remove it
        await gmail.users.messages.modify({
          userId: 'me',
          id: testId,
          requestBody: { addLabelIds: ['UNREAD'] },
        });
        await gmail.users.messages.modify({
          userId: 'me',
          id: testId,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
        results.steps.push({
          step: 'Write Access (modify)',
          status: '✅ OK',
          detail: 'Toggled UNREAD label on and back off — write access confirmed',
        });
      }
    }
  } catch (err: any) {
    results.steps.push({
      step: 'Write Access (modify)',
      status: '❌ FAIL',
      detail: `${err.message} — Code: ${err.code || 'N/A'}`,
      hint: err.code === 403
        ? 'gmail.modify scope was not granted. Disconnect and reconnect Gmail.'
        : err.code === 401
        ? 'Access token expired. Disconnect and reconnect Gmail.'
        : `Unexpected error. Full: ${err.message}`,
    });
  }

  // Step 8: Test batchModify (what declutter/mass-purge actually use)
  try {
    const { data: promoData } = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions older_than:30d -is:starred',
      maxResults: 2,
    });
    const promoMsgs = promoData.messages || [];
    
    if (promoMsgs.length > 0) {
      const testIds = promoMsgs.map((m) => m.id!).filter(Boolean);
      // Get details of what we'd trash
      const details = await Promise.all(
        testIds.map((id) =>
          gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From'],
          }).catch(() => null)
        )
      );
      const subjects = details
        .filter(Boolean)
        .map((d: any) => d.data?.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || '?')
        .map((s: string) => s.substring(0, 40));

      // Actually test batchModify with TRASH (this is what declutter does)
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: testIds,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX'],
        },
      });

      results.steps.push({
        step: 'BatchModify TRASH (REAL)',
        status: '✅ OK',
        detail: `Trashed ${testIds.length} promo emails: ${subjects.join(' | ')}`,
      });
    } else {
      results.steps.push({
        step: 'BatchModify TRASH',
        status: '⚠️ SKIP',
        detail: 'No old promotional emails found to test with',
      });
    }
  } catch (err: any) {
    results.steps.push({
      step: 'BatchModify TRASH',
      status: '❌ FAIL',
      detail: `${err.message} — Code: ${err.code || 'N/A'}`,
      hint: 'batchModify failed — this is what declutter and mass purge depend on',
    });
  }

  // Summary
  const failures = results.steps.filter((s: any) => s.status.includes('FAIL'));
  results.summary = failures.length === 0
    ? '✅ ALL CHECKS PASSED — Gmail API is fully operational'
    : `❌ ${failures.length} check(s) failed — see details above`;

  return NextResponse.json(results, { status: 200 });
}
