/**
 * DEXTER'S LAB — URL Unmasker / Unshortener
 * Follows redirect chains to reveal final destination of shortened URLs
 * Pure HTTP — no JavaScript execution, no browser rendering
 */

// Known URL shortener domains
const SHORTENER_DOMAINS = new Set([
  'bit.ly', 'bitly.com', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly',
  'is.gd', 'buff.ly', 'adf.ly', 'tiny.cc', 'lnkd.in', 'db.tt',
  'qr.ae', 'bit.do', 'rebrand.ly', 'bl.ink', 'short.io', 'cutt.ly',
  'rb.gy', 'surl.li', 'shorturl.at', 'v.gd', 'clck.ru', '1url.com',
  'hyperurl.co', 'hubs.ly', 'mtr.cool', 'shor.by',
]);

export interface UnmaskedUrl {
  original: string;
  final: string;
  redirectChain: string[];
  isShortened: boolean;
  hops: number;
}

/**
 * Check if a URL uses a known shortener
 */
export function isShortUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return SHORTENER_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Follow redirect chain to find final destination URL
 * Max 10 redirects to prevent infinite loops
 */
export async function expandUrl(shortUrl: string, maxRedirects = 10): Promise<UnmaskedUrl> {
  const chain: string[] = [shortUrl];
  let currentUrl = shortUrl;

  for (let i = 0; i < maxRedirects; i++) {
    try {
      const res = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'InboxBuddy/1.0 (security scanner)',
        },
        signal: AbortSignal.timeout(5000),
      });

      // Check for redirect
      const location = res.headers.get('location');
      if (location && (res.status >= 300 && res.status < 400)) {
        // Handle relative redirects
        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        chain.push(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      // No more redirects — HEAD might not work, try GET
      if (res.status === 405) {
        const getRes = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'InboxBuddy/1.0 (security scanner)',
          },
          signal: AbortSignal.timeout(5000),
        });
        const locGet = getRes.headers.get('location');
        if (locGet && (getRes.status >= 300 && getRes.status < 400)) {
          const nextUrl = locGet.startsWith('http') ? locGet : new URL(locGet, currentUrl).href;
          chain.push(nextUrl);
          currentUrl = nextUrl;
          continue;
        }
      }

      // Reached final destination
      break;
    } catch (err: any) {
      console.warn(`[URLUnmasker] Error following ${currentUrl}: ${err.message}`);
      break;
    }
  }

  return {
    original: shortUrl,
    final: currentUrl,
    redirectChain: chain,
    isShortened: chain.length > 1,
    hops: chain.length - 1,
  };
}

/**
 * Batch expand short URLs (only processes known shorteners)
 */
export async function expandUrls(urls: string[]): Promise<UnmaskedUrl[]> {
  const shortUrls = urls.filter(isShortUrl);
  if (shortUrls.length === 0) return [];

  const results = await Promise.allSettled(shortUrls.map((url) => expandUrl(url)));

  return results
    .filter((r): r is PromiseFulfilledResult<UnmaskedUrl> => r.status === 'fulfilled')
    .map((r) => r.value);
}
