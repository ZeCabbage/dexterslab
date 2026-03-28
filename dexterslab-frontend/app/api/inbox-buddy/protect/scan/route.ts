/**
 * DEXTER'S LAB — Security Scan Pipeline
 * POST: Orchestrates the full security scan:
 *   1. Fetch recent unread emails from unknown senders
 *   2. Parse auth headers (SPF/DKIM/DMARC)
 *   3. Extract & expand URLs
 *   4. Check URLs via Safe Browsing
 *   5. Deep check suspicious domains via VirusTotal
 *   6. Auto-quarantine flagged emails
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';
import { analyzeAuthHeaders, type AuthResult } from '@/lib/security/header-analyzer';
import { checkUrlsSafeBrowsing, type ThreatMatch } from '@/lib/security/safe-browsing';
import { checkDomain, getRateLimitStatus, type VTResult } from '@/lib/security/virustotal';
import { expandUrls, isShortUrl, type UnmaskedUrl } from '@/lib/security/url-unmasker';
import { extractUrlsFromHtml, extractUrlsFromText, extractDomains } from '@/lib/security/url-extractor';

// ── Types ──

export interface ThreatEntry {
  messageId: string;
  sender: string;
  senderName: string;
  subject: string;
  date: string;
  threatType: 'spoofed' | 'malicious_link' | 'phishing' | 'malware' | 'suspicious_domain' | 'deceptive_link';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
  quarantined: boolean;
}

// QUARANTINE label name
const QUARANTINE_LABEL = 'QUARANTINE';

// ── POST: Run Security Scan ──

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string;
  const gmail = getGmailClient(accessToken);

  try {
    console.log('[Protect] ═══ Starting security scan ═══');

    // ── Step 0: Ensure QUARANTINE label exists ──
    const quarantineLabelId = await ensureLabel(gmail, QUARANTINE_LABEL);

    // ── Step 1: Fetch recent emails (last 7 days, max 200) ──
    console.log('[Protect] Step 1: Fetching recent emails...');
    const { data: listData } = await gmail.users.messages.list({
      userId: 'me',
      q: 'newer_than:6m -in:sent -in:draft',
      maxResults: 500,
    });

    const messageIds = listData.messages?.map((m: any) => m.id!) || [];
    console.log(`[Protect] Found ${messageIds.length} emails to scan`);

    if (messageIds.length === 0) {
      return NextResponse.json({ threats: [], scanned: 0, quarantined: 0, score: 100 });
    }

    // ── Step 2: Fetch metadata + body for each email ──
    const threats: ThreatEntry[] = [];
    const allUrlsToCheck: string[] = [];
    const emailDetails: Map<string, {
      messageId: string;
      from: string;
      fromName: string;
      subject: string;
      date: string;
      authHeader: string;
      urls: string[];
      body: string;
    }> = new Map();

    const BATCH_SIZE = 15;
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);
      console.log(`[Protect] Step 2: Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(messageIds.length / BATCH_SIZE)}`);

      const details = await Promise.all(
        batch.map((id) =>
          gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'full',
          }).catch(() => null)
        )
      );

      for (const detail of details) {
        if (!detail?.data?.payload?.headers) continue;

        const headers = detail.data.payload.headers;
        const fromRaw = headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)';
        const authHeader = headers.find((h: any) => h.name === 'Authentication-Results')?.value || '';
        const dateHeader = headers.find((h: any) => h.name === 'Date')?.value || '';

        // Parse sender
        const emailMatch = fromRaw.match(/<(.+?)>/) || fromRaw.match(/(\S+@\S+)/);
        const fromEmail = emailMatch ? emailMatch[1].toLowerCase() : fromRaw.toLowerCase();
        const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
        const fromName = nameMatch ? nameMatch[1].trim() : fromEmail.split('@')[0];

        // Extract body text
        let body = '';
        const payload = detail.data.payload;
        if (payload.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.parts) {
          for (const part of payload.parts) {
            if ((part.mimeType === 'text/html' || part.mimeType === 'text/plain') && part.body?.data) {
              body += Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }
        }

        // Extract URLs from body
        const urls = body.includes('<') ? extractUrlsFromHtml(body) : extractUrlsFromText(body);

        emailDetails.set(detail.data.id!, {
          messageId: detail.data.id!,
          from: fromEmail,
          fromName,
          subject: subject.slice(0, 120),
          date: dateHeader,
          authHeader,
          urls,
          body,
        });

        allUrlsToCheck.push(...urls);

        // ── Step 3: Auth header analysis ──
        if (authHeader) {
          const authResult = analyzeAuthHeaders(authHeader, fromEmail, fromName);
          if (authResult.isSpoofed) {
            threats.push({
              messageId: detail.data.id!,
              sender: fromEmail,
              senderName: fromName,
              subject: subject.slice(0, 120),
              date: dateHeader,
              threatType: 'spoofed',
              severity: authResult.severity as 'critical' | 'high' | 'medium' | 'low',
              detail: authResult.spoofReason || 'Authentication check failed',
              quarantined: false,
            });
          }
        }
      }
    }

    // ── Step 4: Expand shortened URLs ──
    console.log('[Protect] Step 4: Expanding shortened URLs...');
    const shortUrls = allUrlsToCheck.filter(isShortUrl);
    const expanded = await expandUrls(shortUrls);
    const expandedFinalUrls = expanded.map((u) => u.final);

    // Add deceptive link threats for expanded URLs that go to different domains
    for (const u of expanded) {
      if (u.hops > 2) {
        try {
          const origDomain = new URL(u.original).hostname;
          const finalDomain = new URL(u.final).hostname;
          if (origDomain !== finalDomain) {
            // Find which email contained this URL
            for (const [msgId, ed] of emailDetails) {
              if (ed.urls.includes(u.original)) {
                threats.push({
                  messageId: msgId,
                  sender: ed.from,
                  senderName: ed.fromName,
                  subject: ed.subject,
                  date: ed.date,
                  threatType: 'deceptive_link',
                  severity: 'medium',
                  detail: `Shortened URL ${u.original} redirects through ${u.hops} hops to ${u.final}`,
                  quarantined: false,
                });
                break;
              }
            }
          }
        } catch { /* invalid URL */ }
      }
    }

    // Combine all URLs for Safe Browsing check
    const allUrlsForCheck = [...new Set([...allUrlsToCheck, ...expandedFinalUrls])];

    // ── Step 5: Safe Browsing check ──
    console.log(`[Protect] Step 5: Checking ${allUrlsForCheck.length} URLs via Safe Browsing...`);
    const safeBrowsingThreats = await checkUrlsSafeBrowsing(allUrlsForCheck);

    for (const sbThreat of safeBrowsingThreats) {
      // Find which email contained this URL
      for (const [msgId, ed] of emailDetails) {
        const hasUrl = ed.urls.includes(sbThreat.url) ||
          expanded.some((e) => e.final === sbThreat.url && ed.urls.includes(e.original));
        if (hasUrl) {
          threats.push({
            messageId: msgId,
            sender: ed.from,
            senderName: ed.fromName,
            subject: ed.subject,
            date: ed.date,
            threatType: sbThreat.threatType === 'SOCIAL_ENGINEERING' ? 'phishing' :
              sbThreat.threatType === 'MALWARE' ? 'malware' : 'malicious_link',
            severity: sbThreat.threatType === 'MALWARE' ? 'critical' : 'high',
            detail: `${sbThreat.threatType}: ${sbThreat.url}`,
            quarantined: false,
          });
          break;
        }
      }
    }

    // ── Step 6: VirusTotal deep check (rate-limited, only for suspicious domains) ──
    console.log('[Protect] Step 6: VirusTotal deep check on suspicious domains...');
    const vtStatus = getRateLimitStatus();
    if (vtStatus.minuteRemaining > 0 && vtStatus.dailyRemaining > 0) {
      // Only check domains from emails that already have auth issues
      const suspiciousDomains = new Set<string>();
      for (const threat of threats) {
        const ed = emailDetails.get(threat.messageId);
        if (ed) {
          const domains = extractDomains(ed.urls);
          domains.forEach((d) => suspiciousDomains.add(d));
        }
      }

      // Check up to 3 suspicious domains (rate limit friendly)
      const domainsToCheck = [...suspiciousDomains].slice(0, 3);
      for (const domain of domainsToCheck) {
        const vtResult = await checkDomain(domain);
        if (vtResult?.isThreat) {
          for (const [msgId, ed] of emailDetails) {
            if (ed.urls.some((u) => { try { return new URL(u).hostname === domain; } catch { return false; } })) {
              // Check if we already have a threat for this message
              if (!threats.some((t) => t.messageId === msgId && t.threatType === 'suspicious_domain')) {
                threats.push({
                  messageId: msgId,
                  sender: ed.from,
                  senderName: ed.fromName,
                  subject: ed.subject,
                  date: ed.date,
                  threatType: 'suspicious_domain',
                  severity: 'high',
                  detail: `Domain ${domain}: ${vtResult.malicious} engines flagged as malicious`,
                  quarantined: false,
                });
              }
            }
          }
        }
      }
    }

    // ── Step 7: Auto-quarantine critical/high threats ──
    console.log(`[Protect] Step 7: Quarantining ${threats.filter((t) => t.severity === 'critical' || t.severity === 'high').length} threats...`);
    const toQuarantine = threats.filter((t) => t.severity === 'critical' || t.severity === 'high');
    const quarantinedIds = new Set<string>();

    if (toQuarantine.length > 0 && quarantineLabelId) {
      const uniqueIds = [...new Set(toQuarantine.map((t) => t.messageId))];

      // Batch modify: add QUARANTINE label, remove INBOX
      const inboxLabel = 'INBOX';
      for (let i = 0; i < uniqueIds.length; i += 50) {
        const batch = uniqueIds.slice(i, i + 50);
        try {
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: [quarantineLabelId],
              removeLabelIds: [inboxLabel],
            },
          });
          batch.forEach((id) => quarantinedIds.add(id));
        } catch (err: any) {
          console.error(`[Protect] Quarantine batch failed: ${err.message}`);
        }
      }
    }

    // Mark quarantined threats
    for (const threat of threats) {
      if (quarantinedIds.has(threat.messageId)) {
        threat.quarantined = true;
      }
    }

    // Compute security score (0-100)
    const criticalCount = threats.filter((t) => t.severity === 'critical').length;
    const highCount = threats.filter((t) => t.severity === 'high').length;
    const mediumCount = threats.filter((t) => t.severity === 'medium').length;
    const score = Math.max(0, 100 - (criticalCount * 25) - (highCount * 10) - (mediumCount * 3));

    console.log(`[Protect] ═══ Scan complete: ${threats.length} threats, ${quarantinedIds.size} quarantined, score=${score} ═══`);

    return NextResponse.json({
      threats,
      scanned: messageIds.length,
      quarantined: quarantinedIds.size,
      score,
      vtRateLimit: getRateLimitStatus(),
    });
  } catch (err: any) {
    console.error('[Protect] Scan failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helpers ──

async function ensureLabel(gmail: any, labelName: string): Promise<string | null> {
  try {
    const { data } = await gmail.users.labels.list({ userId: 'me' });
    const existing = data.labels?.find((l: any) => l.name === labelName);
    if (existing) return existing.id;

    const { data: created } = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color: { backgroundColor: '#cc3a21', textColor: '#ffffff' },
      },
    });
    console.log(`[Protect] Created QUARANTINE label: ${created.id}`);
    return created.id;
  } catch (err: any) {
    console.error(`[Protect] Failed to create label: ${err.message}`);
    return null;
  }
}
