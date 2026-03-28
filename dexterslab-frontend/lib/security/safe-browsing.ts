/**
 * DEXTER'S LAB — Google Safe Browsing API Integration
 * Checks URLs against Google's threat database (malware, phishing, unwanted software)
 * 100% free, non-commercial use
 */

export interface ThreatMatch {
  url: string;
  threatType: string;    // MALWARE | SOCIAL_ENGINEERING | UNWANTED_SOFTWARE | POTENTIALLY_HARMFUL_APPLICATION
  platformType: string;  // ANY_PLATFORM | WINDOWS | LINUX etc.
}

interface SafeBrowsingResponse {
  matches?: {
    threatType: string;
    platformType: string;
    threat: { url: string };
    cacheDuration: string;
  }[];
}

/**
 * Batch check URLs against Google Safe Browsing (max 500 per request)
 */
export async function checkUrlsSafeBrowsing(urls: string[]): Promise<ThreatMatch[]> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!apiKey) {
    console.warn('[SafeBrowsing] No API key configured — skipping URL checks');
    return [];
  }

  if (urls.length === 0) return [];

  // Dedupe and cap at 500
  const uniqueUrls = [...new Set(urls)].slice(0, 500);

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            clientId: 'dexterslab-inbox-buddy',
            clientVersion: '1.0.0',
          },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: uniqueUrls.map((url) => ({ url })),
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[SafeBrowsing] API error ${res.status}: ${errText}`);
      return [];
    }

    const data: SafeBrowsingResponse = await res.json();

    if (!data.matches || data.matches.length === 0) {
      return [];
    }

    return data.matches.map((m) => ({
      url: m.threat.url,
      threatType: m.threatType,
      platformType: m.platformType,
    }));
  } catch (err: any) {
    console.error('[SafeBrowsing] Request failed:', err.message);
    return [];
  }
}
