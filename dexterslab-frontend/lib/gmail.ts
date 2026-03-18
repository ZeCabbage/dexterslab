/**
 * DEXTER'S LAB — Gmail API Utilities
 * Core operations for the Inbox Buddy experiment.
 *
 * Functions:
 *   getGmailClient     — Authenticated Gmail client from access token
 *   ensureLabel         — Create/find a Gmail label by name
 *   securitySweep      — Flag phishing / suspicious emails
 *   declutter          — Trash old promotional emails
 *   highlightVIPs      — Star + label VIP sender emails
 *   autoArchive        — Archive stale un-starred emails
 *   runFullClean       — Execute all operations, return metrics
 *   sendWeeklyReport   — Email an HTML summary
 */

import { google, gmail_v1 } from 'googleapis';

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface CleanMetrics {
  timestamp: string;
  security: { scanned: number; flagged: number };
  declutter: { found: number; trashed: number };
  vip: { found: number; highlighted: number };
  archive: { found: number; archived: number };
  duration: number; // ms
}

// ═══════════════════════════════════════════
//  Client Factory
// ═══════════════════════════════════════════

export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

// ═══════════════════════════════════════════
//  Label Helpers
// ═══════════════════════════════════════════

const labelCache = new Map<string, string>();

export async function ensureLabel(
  gmail: gmail_v1.Gmail,
  name: string
): Promise<string> {
  // Check cache first
  if (labelCache.has(name)) return labelCache.get(name)!;

  // List existing labels
  const { data } = await gmail.users.labels.list({ userId: 'me' });
  const existing = data.labels?.find(
    (l) => l.name?.toLowerCase() === name.toLowerCase()
  );

  if (existing?.id) {
    labelCache.set(name, existing.id);
    return existing.id;
  }

  // Create the label
  const { data: created } = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });

  if (created.id) {
    labelCache.set(name, created.id);
    return created.id;
  }

  throw new Error(`Failed to create label: ${name}`);
}

// ═══════════════════════════════════════════
//  Security Sweep
// ═══════════════════════════════════════════

const PHISHING_KEYWORDS = [
  'verify your account',
  'confirm your identity',
  'suspended account',
  'click here immediately',
  'urgent action required',
  'unusual activity',
  'update your payment',
  'your account will be closed',
  'congratulations you won',
  'claim your prize',
  'wire transfer',
  'western union',
  'bitcoin payment',
  'social security number',
  'password expired',
];

export async function securitySweep(
  gmail: gmail_v1.Gmail
): Promise<{ scanned: number; flagged: number }> {
  const labelId = await ensureLabel(gmail, 'SECURITY REVIEW');
  let scanned = 0;
  let flagged = 0;

  // Search for recent emails with attachments from unknown senders
  // and emails containing phishing keywords
  const queries = [
    'has:attachment newer_than:7d -from:me',
    ...PHISHING_KEYWORDS.slice(0, 5).map(
      (kw) => `subject:"${kw}" newer_than:14d`
    ),
  ];

  for (const query of queries) {
    try {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      const messages = data.messages || [];
      scanned += messages.length;

      for (const msg of messages) {
        if (!msg.id) continue;

        // Get message details to check for phishing indicators
        const { data: detail } = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From'],
        });

        const subject =
          detail.payload?.headers
            ?.find((h) => h.name === 'Subject')
            ?.value?.toLowerCase() || '';

        const hasPhishingKeyword = PHISHING_KEYWORDS.some((kw) =>
          subject.includes(kw)
        );

        if (hasPhishingKeyword) {
          // Apply SECURITY REVIEW label
          await gmail.users.messages.modify({
            userId: 'me',
            id: msg.id,
            requestBody: {
              addLabelIds: [labelId],
            },
          });
          flagged++;
        }
      }
    } catch (err) {
      console.error('[SecuritySweep] Query failed:', query, err);
    }
  }

  return { scanned, flagged };
}

// ═══════════════════════════════════════════
//  Declutter — Trash Old Promos
// ═══════════════════════════════════════════

export async function declutter(
  gmail: gmail_v1.Gmail
): Promise<{ found: number; trashed: number }> {
  let found = 0;
  let trashed = 0;

  try {
    // Find promotional / newsletter emails older than 30 days
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions older_than:30d -is:starred',
      maxResults: 100,
    });

    const messages = data.messages || [];
    found = messages.length;

    // Batch trash them
    if (messages.length > 0) {
      const ids = messages.map((m) => m.id!).filter(Boolean);

      // Gmail batch modify — move to TRASH
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX'],
        },
      });

      trashed = ids.length;
    }
  } catch (err) {
    console.error('[Declutter] Failed:', err);
  }

  return { found, trashed };
}

// ═══════════════════════════════════════════
//  VIP Highlighting
// ═══════════════════════════════════════════

export async function highlightVIPs(
  gmail: gmail_v1.Gmail,
  vipList: string[]
): Promise<{ found: number; highlighted: number }> {
  const urgentLabelId = await ensureLabel(gmail, 'URGENT');
  let found = 0;
  let highlighted = 0;

  for (const vip of vipList) {
    try {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        q: `from:${vip} newer_than:7d -is:starred`,
        maxResults: 20,
      });

      const messages = data.messages || [];
      found += messages.length;

      for (const msg of messages) {
        if (!msg.id) continue;

        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id,
          requestBody: {
            addLabelIds: [urgentLabelId, 'STARRED'],
          },
        });
        highlighted++;
      }
    } catch (err) {
      console.error(`[VIP] Failed for ${vip}:`, err);
    }
  }

  return { found, highlighted };
}

// ═══════════════════════════════════════════
//  Auto-Archive
// ═══════════════════════════════════════════

export async function autoArchive(
  gmail: gmail_v1.Gmail
): Promise<{ found: number; archived: number }> {
  let found = 0;
  let archived = 0;

  try {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox older_than:90d -is:starred -is:important',
      maxResults: 200,
    });

    const messages = data.messages || [];
    found = messages.length;

    if (messages.length > 0) {
      const ids = messages.map((m) => m.id!).filter(Boolean);

      // Archive = remove INBOX label
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids,
          removeLabelIds: ['INBOX'],
        },
      });

      archived = ids.length;
    }
  } catch (err) {
    console.error('[AutoArchive] Failed:', err);
  }

  return { found, archived };
}

// ═══════════════════════════════════════════
//  Full Clean — Run All Operations
// ═══════════════════════════════════════════

export async function runFullClean(
  gmail: gmail_v1.Gmail,
  vipList: string[]
): Promise<CleanMetrics> {
  const start = Date.now();

  const [security, declutterResult, vip, archive] = await Promise.all([
    securitySweep(gmail),
    declutter(gmail),
    highlightVIPs(gmail, vipList),
    autoArchive(gmail),
  ]);

  return {
    timestamp: new Date().toISOString(),
    security,
    declutter: declutterResult,
    vip,
    archive,
    duration: Date.now() - start,
  };
}

// ═══════════════════════════════════════════
//  Weekly Report — HTML Email
// ═══════════════════════════════════════════

export async function sendWeeklyReport(
  gmail: gmail_v1.Gmail,
  toEmail: string,
  metrics: CleanMetrics
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Courier New', monospace; background: #06060e; color: #33ffc4; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #0a0a14; border: 1px solid #162040; padding: 32px; }
    h1 { color: #00ffe0; font-size: 24px; letter-spacing: 4px; text-align: center; border-bottom: 1px solid #162040; padding-bottom: 16px; }
    h2 { color: #ffaa00; font-size: 14px; letter-spacing: 2px; margin-top: 24px; }
    .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #0e1020; }
    .label { color: #6688aa; }
    .value { color: #00ffe0; font-weight: bold; }
    .value.warn { color: #ff4466; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #2a3344; letter-spacing: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📬 INBOX BUDDY</h1>
    <p style="text-align:center;color:#6688aa;font-size:12px;">WEEKLY REPORT — ${new Date(metrics.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    
    <h2>🛡 SECURITY SWEEP</h2>
    <div class="metric"><span class="label">Emails scanned</span><span class="value">${metrics.security.scanned}</span></div>
    <div class="metric"><span class="label">Flagged for review</span><span class="value${metrics.security.flagged > 0 ? ' warn' : ''}">${metrics.security.flagged}</span></div>
    
    <h2>🧹 DECLUTTER</h2>
    <div class="metric"><span class="label">Old promos found</span><span class="value">${metrics.declutter.found}</span></div>
    <div class="metric"><span class="label">Moved to trash</span><span class="value">${metrics.declutter.trashed}</span></div>
    
    <h2>⭐ VIP HIGHLIGHTING</h2>
    <div class="metric"><span class="label">VIP emails found</span><span class="value">${metrics.vip.found}</span></div>
    <div class="metric"><span class="label">Starred + labeled</span><span class="value">${metrics.vip.highlighted}</span></div>
    
    <h2>📦 AUTO-ARCHIVE</h2>
    <div class="metric"><span class="label">Stale emails found</span><span class="value">${metrics.archive.found}</span></div>
    <div class="metric"><span class="label">Archived</span><span class="value">${metrics.archive.archived}</span></div>
    
    <div class="footer">
      DEXTER'S LAB — INBOX BUDDY v1.0<br/>
      Completed in ${metrics.duration}ms
    </div>
  </div>
</body>
</html>`;

  // Build the raw RFC 2822 email
  const subject = `📬 Inbox Buddy — Weekly Report (${new Date().toLocaleDateString()})`;
  const messageParts = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ];
  const rawMessage = messageParts.join('\r\n');

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });
    return true;
  } catch (err) {
    console.error('[WeeklyReport] Failed to send:', err);
    return false;
  }
}
