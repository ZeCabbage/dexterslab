/**
 * DEXTER'S LAB — Email Authentication Header Analyzer
 * Native SPF/DKIM/DMARC parser — no external dependencies
 * Detects spoofed emails by analyzing Authentication-Results headers
 */

export interface AuthResult {
  spf: AuthCheck;
  dkim: AuthCheck;
  dmarc: AuthCheck;
  isSpoofed: boolean;
  spoofReason: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'clean';
  rawHeader: string;
}

export interface AuthCheck {
  status: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'temperror' | 'permerror' | 'unknown';
  detail: string;
}

// High-value domains that MUST pass auth checks
const SENSITIVE_DOMAINS = [
  // Banks
  'paypal.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com',
  'td.com', 'rbc.com', 'bmo.com', 'scotiabank.com', 'cibc.com',
  // Tech
  'apple.com', 'microsoft.com', 'google.com', 'amazon.com', 'meta.com', 'facebook.com',
  // Social
  'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'tiktok.com',
  // Crypto
  'coinbase.com', 'binance.com', 'kraken.com',
  // Gov
  'gov.ca', 'irs.gov', 'cra-arc.gc.ca',
];

// Keywords that indicate impersonation attempts
const IMPERSONATION_KEYWORDS = [
  'paypal', 'amazon', 'apple', 'microsoft', 'google', 'netflix', 'bank',
  'verify', 'suspend', 'urgent', 'confirm your', 'update your payment',
  'account locked', 'security alert', 'unusual activity',
];

/**
 * Parse Authentication-Results header and evaluate SPF/DKIM/DMARC
 */
export function analyzeAuthHeaders(
  authResultsHeader: string,
  fromEmail: string,
  fromName: string
): AuthResult {
  const result: AuthResult = {
    spf: parseCheck(authResultsHeader, 'spf'),
    dkim: parseCheck(authResultsHeader, 'dkim'),
    dmarc: parseCheck(authResultsHeader, 'dmarc'),
    isSpoofed: false,
    spoofReason: null,
    severity: 'clean',
    rawHeader: authResultsHeader,
  };

  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1].toLowerCase() : '';

  // ── Rule 1: DMARC fail on a sensitive domain = CRITICAL ──
  if (result.dmarc.status === 'fail') {
    const isSensitive = SENSITIVE_DOMAINS.some((d) => fromDomain === d || fromDomain.endsWith('.' + d));
    if (isSensitive) {
      result.isSpoofed = true;
      result.spoofReason = `DMARC fail on sensitive domain: ${fromDomain}`;
      result.severity = 'critical';
      return result;
    }
  }

  // ── Rule 2: All three fail = HIGH ──
  const failStatuses = ['fail', 'softfail', 'permerror'];
  const spfFail = failStatuses.includes(result.spf.status);
  const dkimFail = failStatuses.includes(result.dkim.status);
  const dmarcFail = failStatuses.includes(result.dmarc.status);

  if (spfFail && dkimFail && dmarcFail) {
    result.isSpoofed = true;
    result.spoofReason = `All auth checks failed: SPF=${result.spf.status}, DKIM=${result.dkim.status}, DMARC=${result.dmarc.status}`;
    result.severity = 'critical';
    return result;
  }

  // ── Rule 3: DMARC fail + impersonation keywords ──
  if (dmarcFail) {
    const combined = `${fromEmail} ${fromName}`.toLowerCase();
    const hasImpersonation = IMPERSONATION_KEYWORDS.some((kw) => combined.includes(kw));
    if (hasImpersonation) {
      result.isSpoofed = true;
      result.spoofReason = `DMARC fail with impersonation indicators in sender: "${fromName}"`;
      result.severity = 'high';
      return result;
    }
  }

  // ── Rule 4: SPF + DKIM fail (no DMARC) ──
  if (spfFail && dkimFail) {
    result.isSpoofed = true;
    result.spoofReason = `Both SPF and DKIM failed: SPF=${result.spf.status}, DKIM=${result.dkim.status}`;
    result.severity = 'high';
    return result;
  }

  // ── Rule 5: Single fail on known domain ──
  if (dmarcFail || (dkimFail && SENSITIVE_DOMAINS.some((d) => fromDomain === d))) {
    result.severity = 'medium';
    result.spoofReason = `Auth check anomaly: DMARC=${result.dmarc.status}, DKIM=${result.dkim.status}`;
  }

  return result;
}

/**
 * Extract individual check result from Authentication-Results header
 */
function parseCheck(header: string, checkType: 'spf' | 'dkim' | 'dmarc'): AuthCheck {
  if (!header) {
    return { status: 'unknown', detail: 'No Authentication-Results header' };
  }

  const regex = new RegExp(`${checkType}=([a-z]+)(?:\\s|;|$)([^;]*)`, 'i');
  const match = header.match(regex);

  if (!match) {
    return { status: 'none', detail: `No ${checkType.toUpperCase()} record found` };
  }

  const status = match[1].toLowerCase() as AuthCheck['status'];
  const detail = match[2]?.trim() || '';

  return { status, detail };
}

/**
 * Quick check if an email should be flagged based on headers
 */
export function quickSpoofCheck(authHeader: string, fromEmail: string, fromName: string): boolean {
  const result = analyzeAuthHeaders(authHeader, fromEmail, fromName);
  return result.isSpoofed;
}
