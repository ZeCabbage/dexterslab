/**
 * DEXTER'S LAB — VirusTotal API Integration (Free Tier)
 * Rate-limited: 4 requests/minute, 500/day
 * Uses sliding window queue to enforce limits
 */

export interface VTResult {
  resource: string;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  totalEngines: number;
  communityScore: number;
  isThreat: boolean;
  categories: string[];
}

// ── Rate Limiter ──
const REQUEST_LOG: number[] = [];
const MAX_PER_MINUTE = 4;
const MAX_PER_DAY = 500;
let dailyCount = 0;
let dailyResetTime = Date.now() + 86400000;

function canMakeRequest(): boolean {
  const now = Date.now();

  // Reset daily counter
  if (now > dailyResetTime) {
    dailyCount = 0;
    dailyResetTime = now + 86400000;
  }

  if (dailyCount >= MAX_PER_DAY) return false;

  // Clean old entries from minute window
  while (REQUEST_LOG.length > 0 && REQUEST_LOG[0] < now - 60000) {
    REQUEST_LOG.shift();
  }

  return REQUEST_LOG.length < MAX_PER_MINUTE;
}

async function waitForSlot(): Promise<void> {
  while (!canMakeRequest()) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  REQUEST_LOG.push(Date.now());
  dailyCount++;
}

/**
 * Check domain reputation via VirusTotal
 */
export async function checkDomain(domain: string): Promise<VTResult | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.warn('[VirusTotal] No API key configured — skipping domain check');
    return null;
  }

  try {
    await waitForSlot();

    const res = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { 'x-apikey': apiKey },
    });

    if (!res.ok) {
      console.error(`[VirusTotal] Domain check failed ${res.status} for ${domain}`);
      return null;
    }

    const data = await res.json();
    const stats = data.data?.attributes?.last_analysis_stats || {};
    const categories = Object.values(data.data?.attributes?.categories || {}) as string[];
    const reputation = data.data?.attributes?.reputation || 0;

    const result: VTResult = {
      resource: domain,
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      totalEngines: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
      communityScore: reputation,
      isThreat: (stats.malicious || 0) >= 2 || (stats.suspicious || 0) >= 3,
      categories,
    };

    console.log(`[VirusTotal] ${domain}: ${result.malicious} malicious, ${result.suspicious} suspicious`);
    return result;
  } catch (err: any) {
    console.error(`[VirusTotal] Error checking ${domain}:`, err.message);
    return null;
  }
}

/**
 * Check URL via VirusTotal
 */
export async function checkUrl(url: string): Promise<VTResult | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return null;

  try {
    await waitForSlot();

    // VirusTotal needs base64url-encoded URL
    const urlId = Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': apiKey },
    });

    if (res.status === 404) {
      // URL not in database — submit for scanning
      await waitForSlot();
      const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
          'x-apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(url)}`,
      });
      if (!submitRes.ok) return null;
      // Submitted for analysis — result won't be available immediately
      return { resource: url, malicious: 0, suspicious: 0, harmless: 0, undetected: 0, totalEngines: 0, communityScore: 0, isThreat: false, categories: ['pending'] };
    }

    if (!res.ok) return null;

    const data = await res.json();
    const stats = data.data?.attributes?.last_analysis_stats || {};

    return {
      resource: url,
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      totalEngines: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
      communityScore: data.data?.attributes?.reputation || 0,
      isThreat: (stats.malicious || 0) >= 2,
      categories: [],
    };
  } catch (err: any) {
    console.error(`[VirusTotal] Error checking URL ${url}:`, err.message);
    return null;
  }
}

/**
 * Get remaining rate limit info
 */
export function getRateLimitStatus() {
  const now = Date.now();
  const minuteRequests = REQUEST_LOG.filter((t) => t > now - 60000).length;
  return {
    minuteRemaining: MAX_PER_MINUTE - minuteRequests,
    dailyRemaining: MAX_PER_DAY - dailyCount,
    dailyResetsIn: Math.max(0, Math.round((dailyResetTime - now) / 1000)),
  };
}
