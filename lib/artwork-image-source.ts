/**
 * Where /api/artwork-colors should actually fetch an image from.
 *
 * That route used to build `${NEXT_PUBLIC_BASE_URL}/api/proxy-image?url=<target>`
 * and fetch its OWN proxy, server-side, to get bytes it then handed to sharp.
 * The proxy exists for one reason — browsers enforce CORS and a page cannot read
 * pixels off another origin. A server-side fetch has no CORS to work around, so
 * the hop bought nothing and cost:
 *
 *   - double the bytes and double the latency on every colour extraction, and it
 *     runs on every track change (NowPlayingScreen, RadioPlayer);
 *   - a per-IP rate-limit bucket. NEXT_PUBLIC_BASE_URL is unset in production, so
 *     the fallback is http://localhost:<PORT> — a loopback request, which carries
 *     no x-forwarded-for, so clientIp() keys every one of them on the single
 *     bucket named 'unknown'. batch-process loops this route over albums, so
 *     under RATE_LIMIT_MODE=enforce it could 429 itself;
 *   - and, since #244, a second pass through the proxy host allowlist.
 *
 * This module answers only "what URL, and can safeFetch have it" — no fetching,
 * no sharp — so the URL handling is unit-testable on its own.
 */

/** The proxy wrapper this app puts around feed artwork. */
const PROXY_PATH = '/api/proxy-image';

/** Guards against a wrapper nested in a wrapper. Two is already pathological. */
const MAX_UNWRAP_DEPTH = 3;

export type ArtworkSource =
  /**
   * An ordinary public image URL. Fetch it with safeFetch, which applies
   * isSafePublicUrl and bounds the redirect chain.
   */
  | { kind: 'remote'; url: string }
  /**
   * An asset served by this deployment, reached over loopback. This CANNOT go
   * through safeFetch: isSafePublicUrl rejects localhost by design, so routing
   * these through it would refuse every local placeholder as an SSRF attempt.
   */
  | { kind: 'local'; url: string }
  /** Nothing worth fetching. */
  | { kind: 'none' };

/**
 * Pull the real target out of `/api/proxy-image?url=<encoded>`.
 *
 * Mirrors the unwrap in isAnimatedArtworkUrl (lib/cdn-utils.ts), including its
 * behaviour on malformed percent-encoding: fall back to the raw parameter rather
 * than to the wrapper, whose path is always /api/proxy-image and tells us
 * nothing about the image.
 */
export function unwrapProxyUrl(value: string): string {
  let current = value;

  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth++) {
    if (!current.includes(PROXY_PATH)) return current;
    const match = current.match(/[?&]url=([^&]+)/);
    if (!match) return current;

    let inner: string;
    try {
      inner = decodeURIComponent(match[1]);
    } catch {
      inner = match[1];
    }
    if (!inner || inner === current) return current;
    current = inner;
  }

  return current;
}

/**
 * Decide where to fetch `imageUrl` from.
 *
 * `baseUrl` is only consulted for a relative path, which is this deployment's
 * own asset. Note what is deliberately NOT done here: no isValidImageUrl gate on
 * a remote target. The old code applied that gate to the wrapper URL, whose
 * pathname `/api/proxy-image` contains the substring "image", so it passed
 * unconditionally for every external image. Applying it to the target instead
 * would be strictly stricter — `https://host/a/b/c123` has no extension and no
 * keyword — and would silently stop extracting colour from extensionless
 * artwork that works today. A non-image body is caught where it belongs, by
 * sharp throwing, which the caller already treats as "keep the fallback".
 */
export function resolveArtworkSource(
  imageUrl: string | null | undefined,
  baseUrl: string
): ArtworkSource {
  const raw = (imageUrl ?? '').trim();
  if (!raw) return { kind: 'none' };

  const target = unwrapProxyUrl(raw);

  if (/^https?:\/\//i.test(target)) return { kind: 'remote', url: target };

  // A rooted path is one of ours, served over loopback. `//host/path` is NOT
  // one of ours — it is protocol-relative — and the old code glued it onto the
  // base to produce `http://localhost:8080//x.com/a.png`, a guaranteed 404 and
  // a wasted round trip. Same visible outcome either way, since a failed fetch
  // keeps the fallback colour; this just declines to make the request.
  if (target.startsWith('/') && !target.startsWith('//')) {
    return { kind: 'local', url: `${baseUrl.replace(/\/$/, '')}${target}` };
  }

  // A data: URI, a bare filename, a protocol-relative URL, anything else — the
  // old code would have produced a URL that fetch or sharp rejected anyway.
  return { kind: 'none' };
}

/** The loopback origin to resolve a relative asset against. */
export function artworkBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_BASE_URL || `http://localhost:${env.PORT || 3001}`;
}
