/**
 * Shared SSRF guard for routes that fetch caller-supplied URLs
 * (chapters proxy, image proxy, audio proxy).
 *
 * Known limitation: this is a string-based hostname check with no DNS
 * resolution, so it does not defend against DNS rebinding to private IPs.
 * Same posture as the original chapters-proxy guard this was extracted from.
 */

export type UrlCheckResult = { ok: true; url: URL } | { ok: false; error: string };

export function isSafePublicUrl(
  raw: string,
  opts: { allowHttp?: boolean } = {}
): UrlCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  const allowedProtocols = opts.allowHttp ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      ok: false,
      error: opts.allowHttp ? 'Only HTTP(S) URLs are allowed' : 'Only HTTPS URLs are allowed',
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    hostname === '0.0.0.0'
  ) {
    return { ok: false, error: 'Private URLs are not allowed' };
  }

  return { ok: true, url: parsed };
}
