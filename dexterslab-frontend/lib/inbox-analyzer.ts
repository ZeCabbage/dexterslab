/**
 * DEXTER'S LAB — Inbox Buddy AI Analyzer
 * Gemini-powered inbox intelligence for VIP discovery and deep dive analysis.
 *
 * Functions:
 *   discoverVIPs     — Analyze sender patterns, return ranked VIP suggestions
 *   deepDiveAnalysis — Comprehensive inbox audit with categorized recommendations
 */

import { gmail_v1 } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface SenderStats {
  email: string;
  name: string;
  totalEmails: number;
  repliedTo: number;
  threads: number;
  latestDate: string;
  isFrequent: boolean;
}

export interface VIPSuggestion {
  email: string;
  name: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  stats: {
    totalEmails: number;
    repliedTo: number;
    threads: number;
  };
  status: 'pending' | 'approved' | 'dismissed';
}

export interface DeepDiveRecommendation {
  id: string;
  category: 'subscriptions' | 'large_attachments' | 'redundant_threads' | 'worth_keeping' | 'unsubscribe' | 'risks' | 'download';
  title: string;
  description: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  action: 'trash' | 'archive' | 'label' | 'keep' | 'review' | 'unsubscribe' | 'download';
  messageIds: string[];
  senderEmail?: string;
  sizeBytes?: number;
  count: number;
  status: 'pending' | 'applied' | 'skipped' | 'dismissed';
}

export interface DeepDiveResult {
  timestamp: string;
  recommendations: DeepDiveRecommendation[];
  summary: string;
  totalEmailsAnalyzed: number;
  duration: number;
}

// Category display info
export const CATEGORY_INFO: Record<string, { icon: string; label: string; color: string }> = {
  subscriptions:     { icon: '🗑️', label: 'SUBSCRIPTIONS TO CANCEL', color: 'var(--color-red)' },
  large_attachments: { icon: '📎', label: 'LARGE ATTACHMENTS',       color: 'var(--color-amber)' },
  redundant_threads: { icon: '🔄', label: 'REDUNDANT THREADS',       color: 'var(--color-cyan)' },
  worth_keeping:     { icon: '📌', label: 'WORTH KEEPING',           color: 'var(--color-green)' },
  unsubscribe:       { icon: '🚫', label: 'UNSUBSCRIBE CANDIDATES',  color: 'var(--color-magenta)' },
  risks:             { icon: '⚠️', label: 'POTENTIAL RISKS',          color: 'var(--color-red)' },
  download:          { icon: '💾', label: 'DOWNLOAD & SAVE',         color: 'var(--color-cyan)' },
};

// ═══════════════════════════════════════════
//  Helper: Aggregate Sender Stats
// ═══════════════════════════════════════════

async function aggregateSenders(
  gmail: gmail_v1.Gmail,
  maxMessages: number = 200
): Promise<SenderStats[]> {
  const senderMap = new Map<string, SenderStats>();

  // Fetch recent messages
  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox OR in:sent',
    maxResults: maxMessages,
  });

  const messages = data.messages || [];

  // Fetch metadata for each message (batched)
  const batchSize = 20;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    const details = await Promise.all(
      batch.map((msg) =>
        gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        }).catch(() => null)
      )
    );

    for (const detail of details) {
      if (!detail?.data?.payload?.headers) continue;

      const headers = detail.data.payload.headers;
      const fromHeader = headers.find((h) => h.name === 'From')?.value || '';
      const toHeader = headers.find((h) => h.name === 'To')?.value || '';
      const dateHeader = headers.find((h) => h.name === 'Date')?.value || '';

      // Parse sender
      const emailMatch = fromHeader.match(/<(.+?)>/) || fromHeader.match(/(\S+@\S+)/);
      const email = emailMatch ? emailMatch[1].toLowerCase() : fromHeader.toLowerCase();
      const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*</);
      const name = nameMatch ? nameMatch[1].trim() : email.split('@')[0];

      // Skip self-sent
      if (email.includes('holmes.dexter')) {
        // Check if we replied TO someone (for reply tracking)
        const toMatch = toHeader.match(/<(.+?)>/) || toHeader.match(/(\S+@\S+)/);
        if (toMatch) {
          const recipientEmail = toMatch[1].toLowerCase();
          if (senderMap.has(recipientEmail)) {
            senderMap.get(recipientEmail)!.repliedTo++;
          }
        }
        continue;
      }

      if (!senderMap.has(email)) {
        senderMap.set(email, {
          email,
          name,
          totalEmails: 0,
          repliedTo: 0,
          threads: 0,
          latestDate: dateHeader,
          isFrequent: false,
        });
      }

      const stats = senderMap.get(email)!;
      stats.totalEmails++;
      if (detail.data.threadId) stats.threads++;
      if (dateHeader > stats.latestDate) stats.latestDate = dateHeader;
    }
  }

  // Mark frequent senders
  const entries = Array.from(senderMap.values());
  const avgEmails = entries.reduce((a, b) => a + b.totalEmails, 0) / (entries.length || 1);
  entries.forEach((s) => {
    s.isFrequent = s.totalEmails > avgEmails * 1.5;
  });

  // Sort by engagement score: replies + frequency
  entries.sort((a, b) => {
    const scoreA = a.repliedTo * 3 + a.totalEmails + a.threads;
    const scoreB = b.repliedTo * 3 + b.totalEmails + b.threads;
    return scoreB - scoreA;
  });

  return entries.slice(0, 50); // Top 50 senders
}

// ═══════════════════════════════════════════
//  VIP Discovery
// ═══════════════════════════════════════════

export async function discoverVIPs(
  gmail: gmail_v1.Gmail,
  geminiApiKey: string
): Promise<VIPSuggestion[]> {
  // 1. Aggregate sender stats
  const senders = await aggregateSenders(gmail);

  if (senders.length === 0) {
    return [];
  }

  // 2. Build prompt for Gemini
  const senderSummary = senders.slice(0, 30).map((s, i) => (
    `${i + 1}. ${s.name} <${s.email}> — ${s.totalEmails} emails, ${s.repliedTo} replied to, ${s.threads} threads`
  )).join('\n');

  const prompt = `You are an email assistant analyzing a user's inbox to identify their most important contacts (VIPs).

Here are their top senders ranked by engagement:
${senderSummary}

Analyze these contacts and return a JSON array of the top 8-12 most likely VIP contacts. Consider:
- People the user replies to often (high repliedTo count)
- Frequent personal/work contacts (not automated services or newsletters)
- Filter OUT: no-reply addresses, newsletters, automated notifications, marketing

For each VIP, provide:
- email: the sender's email address
- name: display name
- reason: one short sentence explaining WHY they're important (e.g. "You reply to 80% of their emails — likely a close colleague")
- confidence: "high", "medium", or "low"

Respond ONLY with valid JSON array, no markdown fences:
[{"email":"...","name":"...","reason":"...","confidence":"high"}, ...]`;

  // 3. Call Gemini
  const genai = new GoogleGenAI({ apiKey: geminiApiKey });
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { temperature: 0.3 },
  });

  // 4. Parse response
  let suggestions: VIPSuggestion[] = [];
  try {
    const text = response.text?.trim()
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '') || '[]';
    const parsed = JSON.parse(text);

    suggestions = parsed.map((item: any) => {
      const senderStats = senders.find((s) => s.email === item.email);
      return {
        email: item.email,
        name: item.name || item.email.split('@')[0],
        reason: item.reason || 'Frequently contacted',
        confidence: item.confidence || 'medium',
        stats: {
          totalEmails: senderStats?.totalEmails || 0,
          repliedTo: senderStats?.repliedTo || 0,
          threads: senderStats?.threads || 0,
        },
        status: 'pending' as const,
      };
    });
  } catch (err) {
    console.error('[VIPDiscovery] Failed to parse Gemini response:', err);
    // Fallback: use top replied-to senders
    suggestions = senders
      .filter((s) => s.repliedTo > 0)
      .slice(0, 8)
      .map((s) => ({
        email: s.email,
        name: s.name,
        reason: `You replied to ${s.repliedTo} of their ${s.totalEmails} emails`,
        confidence: s.repliedTo > 3 ? 'high' as const : 'medium' as const,
        stats: { totalEmails: s.totalEmails, repliedTo: s.repliedTo, threads: s.threads },
        status: 'pending' as const,
      }));
  }

  return suggestions;
}

// ═══════════════════════════════════════════
//  Deep Dive Analysis
// ═══════════════════════════════════════════

async function gatherInboxMetadata(gmail: gmail_v1.Gmail) {
  const categories: Record<string, any[]> = {
    promotions: [],
    large: [],
    old_unread: [],
    frequent_senders: [],
    with_attachments: [],
  };

  // Promotions/newsletters
  const { data: promos } = await gmail.users.messages.list({
    userId: 'me',
    q: 'category:promotions OR category:social OR label:newsletters',
    maxResults: 100,
  });
  categories.promotions = promos.messages || [];

  // Large emails (>5MB)
  const { data: large } = await gmail.users.messages.list({
    userId: 'me',
    q: 'larger:5M',
    maxResults: 50,
  });
  categories.large = large.messages || [];

  // Old unread
  const { data: oldUnread } = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread older_than:60d in:inbox',
    maxResults: 100,
  });
  categories.old_unread = oldUnread.messages || [];

  // Emails with attachments older than 30 days
  const { data: attachments } = await gmail.users.messages.list({
    userId: 'me',
    q: 'has:attachment older_than:30d',
    maxResults: 50,
  });
  categories.with_attachments = attachments.messages || [];

  // Get details on a subset for Gemini analysis
  const allMsgIds = [
    ...categories.promotions.slice(0, 20),
    ...categories.large.slice(0, 10),
    ...categories.old_unread.slice(0, 20),
    ...categories.with_attachments.slice(0, 10),
  ];

  const details: any[] = [];
  const batchSize = 15;
  for (let i = 0; i < allMsgIds.length; i += batchSize) {
    const batch = allMsgIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((msg) =>
        gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date', 'Content-Type'],
        }).catch(() => null)
      )
    );
    details.push(...results.filter(Boolean));
  }

  return { categories, details };
}

export async function deepDiveAnalysis(
  gmail: gmail_v1.Gmail,
  geminiApiKey: string
): Promise<DeepDiveResult> {
  const start = Date.now();

  // 1. Gather metadata
  const { categories, details } = await gatherInboxMetadata(gmail);

  const totalAnalyzed =
    categories.promotions.length +
    categories.large.length +
    categories.old_unread.length +
    categories.with_attachments.length;

  // 2. Build email summaries for Gemini
  const emailSummaries = details.map((d: any) => {
    const headers = d.data?.payload?.headers || [];
    const from = headers.find((h: any) => h.name === 'From')?.value || 'unknown';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)';
    const date = headers.find((h: any) => h.name === 'Date')?.value || 'unknown';
    const size = d.data?.sizeEstimate || 0;
    const labels = (d.data?.labelIds || []).join(', ');
    return `From: ${from} | Subject: ${subject} | Date: ${date} | Size: ${Math.round(size / 1024)}KB | Labels: ${labels} | ID: ${d.data?.id}`;
  }).join('\n');

  // 3. Stats summary
  const statsSummary = `
Inbox Overview:
- ${categories.promotions.length} promotional/social emails found
- ${categories.large.length} large emails (>5MB)
- ${categories.old_unread.length} old unread emails (>60 days)
- ${categories.with_attachments.length} emails with attachments (>30 days old)`;

  // 4. Gemini analysis prompt
  const prompt = `You are an expert email management assistant performing a deep dive analysis of a user's inbox. Your role is to make actionable recommendations that the user will review and approve.

${statsSummary}

Here is a sample of emails from the inbox:
${emailSummaries}

Analyze these patterns and return categorized recommendations. For each recommendation:
- Group similar emails by sender or pattern
- Explain WHY you're recommending the action
- Be specific about what will happen if approved

Categories to use:
- "subscriptions": newsletters/marketing the user likely never reads → action: "trash" or "unsubscribe"
- "large_attachments": big files taking up space → action: "archive" 
- "redundant_threads": notification emails, auto-replies, duplicate content → action: "archive"
- "worth_keeping": important receipts, contracts, confirmations → action: "label" (apply "KEEP" label)
- "download": important documents with attachments (tax docs, receipts, contracts, legal docs, insurance, financial statements) that the user should download and keep locally rather than relying on email storage → action: "label" (apply "KEEP" label and alert user to download)
- "unsubscribe": senders the user receives from but never engages with → action: "unsubscribe"
- "risks": suspicious emails, breach notifications, old account alerts → action: "review"

PRIORITIZE identifying important documents to download. Look for: tax documents, receipts, invoices, contracts, insurance docs, legal documents, financial statements, booking confirmations, visa/passport docs, medical records. These are critical to flag.

Return ONLY valid JSON, no markdown fences:
{
  "summary": "One paragraph overview of inbox health and key findings",
  "recommendations": [
    {
      "category": "subscriptions",
      "title": "Short title like 'Marketing from CompanyX'",
      "description": "What emails are involved",
      "reason": "Why this action is recommended",
      "impact": "high|medium|low",
      "action": "trash|archive|label|keep|review|unsubscribe",
      "senderEmail": "sender@example.com",
      "count": 15
    }
  ]
}

Return 8-15 recommendations max, prioritized by impact. Be concise in descriptions.`;

  const genai = new GoogleGenAI({ apiKey: geminiApiKey });
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { temperature: 0.3 },
  });

  // 5. Parse Gemini response
  let recommendations: DeepDiveRecommendation[] = [];
  let summary = 'Analysis complete.';

  try {
    const text = response.text?.trim()
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '') || '{}';
    const parsed = JSON.parse(text);

    summary = parsed.summary || summary;

    recommendations = (parsed.recommendations || []).map((rec: any, idx: number) => {
      // Find matching message IDs from our fetched data
      const matchingMsgs = details
        .filter((d: any) => {
          const from = d.data?.payload?.headers?.find((h: any) => h.name === 'From')?.value || '';
          return rec.senderEmail && from.toLowerCase().includes(rec.senderEmail.toLowerCase());
        })
        .map((d: any) => d.data?.id)
        .filter(Boolean);

      return {
        id: `rec-${Date.now()}-${idx}`,
        category: rec.category || 'subscriptions',
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        reason: rec.reason || '',
        impact: rec.impact || 'medium',
        action: rec.action || 'archive',
        messageIds: matchingMsgs.length > 0 ? matchingMsgs : [],
        senderEmail: rec.senderEmail || undefined,
        count: rec.count || matchingMsgs.length || 0,
        status: 'pending' as const,
      };
    });
  } catch (err) {
    console.error('[DeepDive] Failed to parse Gemini response:', err);
    summary = 'Analysis encountered an error parsing AI response. Showing raw data instead.';

    // Fallback recommendations from raw data
    if (categories.promotions.length > 0) {
      recommendations.push({
        id: `rec-${Date.now()}-fb1`,
        category: 'subscriptions',
        title: 'Promotional Emails',
        description: `Found ${categories.promotions.length} promotional emails`,
        reason: 'These are marketing emails that could be cleaned up',
        impact: 'medium',
        action: 'trash',
        messageIds: categories.promotions.slice(0, 50).map((m) => m.id!),
        count: categories.promotions.length,
        status: 'pending',
      });
    }

    if (categories.large.length > 0) {
      recommendations.push({
        id: `rec-${Date.now()}-fb2`,
        category: 'large_attachments',
        title: 'Large Emails',
        description: `Found ${categories.large.length} emails over 5MB`,
        reason: 'These are consuming significant storage space',
        impact: 'high',
        action: 'archive',
        messageIds: categories.large.slice(0, 20).map((m) => m.id!),
        count: categories.large.length,
        status: 'pending',
      });
    }

    if (categories.old_unread.length > 0) {
      recommendations.push({
        id: `rec-${Date.now()}-fb3`,
        category: 'redundant_threads',
        title: 'Old Unread Emails',
        description: `Found ${categories.old_unread.length} unread emails older than 60 days`,
        reason: 'If unread for this long, they are likely not important',
        impact: 'medium',
        action: 'archive',
        messageIds: categories.old_unread.slice(0, 50).map((m) => m.id!),
        count: categories.old_unread.length,
        status: 'pending',
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    recommendations,
    summary,
    totalEmailsAnalyzed: totalAnalyzed,
    duration: Date.now() - start,
  };
}
