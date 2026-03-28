/**
 * DEXTER'S LAB — Auto Unsubscribe
 * POST: Automatically unsubscribe from a sender using:
 *   1. RFC 8058 One-Click POST (if supported)
 *   2. Mailto unsubscribe (send email via Gmail API)
 *   3. HTTP GET fallback (best effort)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { senderEmail, unsubscribeLink, unsubscribeMailto, hasOneClick } = await request.json();

  if (!senderEmail) {
    return NextResponse.json({ error: 'No sender provided' }, { status: 400 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);
  const userEmail = (session as any).user?.email || 'me';

  const results: { method: string; success: boolean; detail: string }[] = [];

  // ── Method 1: One-Click POST (RFC 8058) ──
  if (hasOneClick && unsubscribeLink) {
    try {
      const res = await fetch(unsubscribeLink, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'List-Unsubscribe=One-Click',
        redirect: 'follow',
      });
      const success = res.ok || res.status === 302 || res.status === 301;
      results.push({
        method: 'one-click',
        success,
        detail: `HTTP ${res.status} ${res.statusText}`,
      });
      if (success) {
        console.log(`[Unsubscribe] ✅ One-Click POST succeeded for ${senderEmail}`);
        return NextResponse.json({
          success: true,
          method: 'one-click',
          senderEmail,
          detail: `One-Click unsubscribe sent (HTTP ${res.status})`,
        });
      }
    } catch (err: any) {
      results.push({ method: 'one-click', success: false, detail: err.message });
      console.log(`[Unsubscribe] One-Click failed for ${senderEmail}: ${err.message}`);
    }
  }

  // ── Method 2: Mailto unsubscribe (send email via Gmail API) ──
  if (unsubscribeMailto) {
    try {
      // Parse mailto: address
      const mailtoUrl = new URL(unsubscribeMailto);
      const toAddress = mailtoUrl.pathname || unsubscribeMailto.replace('mailto:', '').split('?')[0];
      const params = new URLSearchParams(mailtoUrl.search);
      const subject = params.get('subject') || 'Unsubscribe';
      const body = params.get('body') || 'Unsubscribe';

      // Build RFC 2822 email
      const emailLines = [
        `To: ${toAddress}`,
        `From: ${userEmail}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        '',
        body,
      ];
      const rawEmail = emailLines.join('\r\n');
      // Base64url encode
      const encoded = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encoded },
      });

      console.log(`[Unsubscribe] ✅ Mailto sent to ${toAddress} for ${senderEmail}`);
      return NextResponse.json({
        success: true,
        method: 'mailto',
        senderEmail,
        detail: `Unsubscribe email sent to ${toAddress}`,
      });
    } catch (err: any) {
      results.push({ method: 'mailto', success: false, detail: err.message });
      console.log(`[Unsubscribe] Mailto failed for ${senderEmail}: ${err.message}`);
    }
  }

  // ── Method 3: HTTP GET fallback ──
  if (unsubscribeLink && !hasOneClick) {
    try {
      const res = await fetch(unsubscribeLink, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'InboxBuddy/1.0 (automated unsubscribe)',
        },
      });
      const success = res.ok;
      results.push({
        method: 'http-get',
        success,
        detail: `HTTP ${res.status} ${res.statusText}`,
      });
      if (success) {
        console.log(`[Unsubscribe] ✅ HTTP GET succeeded for ${senderEmail} (best effort)`);
        return NextResponse.json({
          success: true,
          method: 'http-get',
          senderEmail,
          detail: `Unsubscribe page fetched (HTTP ${res.status}) — some senders may require confirmation`,
        });
      }
    } catch (err: any) {
      results.push({ method: 'http-get', success: false, detail: err.message });
      console.log(`[Unsubscribe] HTTP GET failed for ${senderEmail}: ${err.message}`);
    }
  }

  // All methods failed or no methods available
  if (results.length === 0) {
    return NextResponse.json({
      success: false,
      method: 'none',
      senderEmail,
      detail: 'No unsubscribe method available for this sender',
    });
  }

  return NextResponse.json({
    success: false,
    method: 'failed',
    senderEmail,
    detail: `All methods failed: ${results.map(r => `${r.method}: ${r.detail}`).join('; ')}`,
    attempts: results,
  });
}
