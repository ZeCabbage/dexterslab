/**
 * DEXTER'S LAB — URL Extraction from Email Bodies
 * Extracts URLs from HTML and plain-text email content
 * Strips tracking parameters for cleaner analysis
 */

// Regex for URLs in text
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

// Known tracking parameters to strip
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_eid', 'mc_cid',
  '_hsenc', '_hsmi', 'hsa_', 'ref', 'source', 'mkt_tok',
]);

/**
 * Extract all URLs from HTML email body
 */
export function extractUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();

  // Extract from href attributes
  const hrefRegex = /href=["']?(https?:\/\/[^"'\s>]+)/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    urls.add(cleanUrl(match[1]));
  }

  // Extract from src attributes (images/scripts)
  const srcRegex = /src=["']?(https?:\/\/[^"'\s>]+)/gi;
  while ((match = srcRegex.exec(html)) !== null) {
    urls.add(cleanUrl(match[1]));
  }

  // Extract plaintext URLs (in case of plain text parts in HTML)
  const textMatches = html.match(URL_REGEX) || [];
  textMatches.forEach((url) => urls.add(cleanUrl(url)));

  return Array.from(urls);
}

/**
 * Extract URLs from plain text email
 */
export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_REGEX) || [];
  return [...new Set(matches.map(cleanUrl))];
}

/**
 * Clean URL — remove trailing punctuation and decode entities
 */
function cleanUrl(url: string): string {
  // Remove trailing punctuation that might have been captured
  let clean = url.replace(/[.,;:!?)}\]]+$/, '');
  // Decode HTML entities
  clean = clean.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return clean;
}

/**
 * Strip tracking parameters from URL for cleaner analysis
 */
export function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_') || key.startsWith('hsa_')) {
        params.delete(key);
      }
    }
    parsed.search = params.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract unique domains from a list of URLs
 */
export function extractDomains(urls: string[]): string[] {
  const domains = new Set<string>();
  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      domains.add(hostname);
    } catch {
      // Invalid URL, skip
    }
  }
  return Array.from(domains);
}
