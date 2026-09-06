/**
 * Keeps the media proxies from being an open internet proxy.
 *
 * /api/proxy-image, /api/proxy-audio and /api/proxy-video take a caller-supplied
 * `?url=` and fetch it. Their only check was isSafePublicUrl (lib/url-security.ts),
 * which blocks PRIVATE addresses — the SSRF question — and permits every public
 * host on the internet. So a stranger could pipe any file anywhere through this
 * deployment's bandwidth and CPU. That is unrelated to any fork; it is open to
 * anyone who knows the URL shape.
 *
 * WHY NOT SIGNED URLS. The obvious fix is an HMAC of the url, keyed by
 * SESSION_SECRET, which only our server could mint. It cannot work here: every
 * proxy URL is built in the BROWSER — lib/cdn-utils.ts, components/CDNImage.tsx
 * ('use client'), lib/audio-url-utils.ts and AudioContext's getAudioUrlsToTry —
 * from artwork and audio URLs that arrive in API responses. The client holds no
 * secret, so signing would mean signing inside every API response instead, which
 * changes their shape (an API_VERSION bump, and the same field is read from many
 * places here) and would strand every proxy URL already cached in a service
 * worker or an offline download.
 *
 * So bind the proxy to the CATALOG instead of to a signature: allow a target host
 * only if it is a host this catalog actually references. That needs no client
 * change, no response-shape change, and nothing already stored goes stale — a
 * saved album's artwork URL still points at a host that is still in the catalog.
 *
 * RESIDUAL, and it is deliberate: a stranger can still proxy some OTHER file on a
 * host we already carry (any file on wavlake.com, say). Closing that would need
 * per-URL state we do not have. The abuse being closed is "proxy anything on the
 * internet", which this ends completely.
 *
 * FAILS OPEN on any database trouble. A proxy that refuses artwork because a
 * query timed out would break the catalog for real users, which costs far more
 * than the abuse does.
 */

import { CORS_PROBLEMATIC_DOMAINS, DIRECT_FIRST_DOMAINS } from './audio-url-utils';
import { hostMatches } from './host-match';

export type ProxyHostMode = 'log' | 'enforce';

/** `enforce` only when asked for explicitly; anything else logs. */
export function parseProxyHostMode(raw: string | undefined): ProxyHostMode {
  return (raw ?? '').trim().toLowerCase() === 'enforce' ? 'enforce' : 'log';
}

/**
 * Hosts allowed even when the catalog query has never run.
 *
 * Seeded from the two lists the audio path already maintains, so the media hosts
 * this app is built around keep working from a cold start. `stablekraft.app` and
 * the podcast-namespace hosts are here for artwork that is served from our own
 * domain or from a feed's own site.
 */
export const STATIC_ALLOWED_HOSTS: readonly string[] = Array.from(
  new Set([
    ...CORS_PROBLEMATIC_DOMAINS,
    ...DIRECT_FIRST_DOMAINS,
    'stablekraft.app',
    'podcastindex.org',
    'op3.dev',
    'wavlake.com',
    'megaphone.fm',
    'simplecastcdn.com',
    'transistor.fm',
    'captivate.fm',
    'redcircle.com',
    'podbean.com',
    'soundcloud.com',
    'archive.org',
    'github.io',
    'githubusercontent.com',
    'imgur.com',
    'noagendaassets.com',
  ])
);

/** Re-exported so this module stays the single import for proxy host questions. */
export { hostMatches };

/** Hosts referenced by the catalog, cached in memory. Null until first loaded. */
let catalogHosts: Set<string> | null = null;
let catalogHostsLoadedAt = 0;
let inFlight: Promise<Set<string> | null> | null = null;

/** How long a loaded host set is reused before refreshing. */
export const CATALOG_HOSTS_TTL_MS = 10 * 60 * 1000;

/** Extract a lowercased hostname, or null if the value is not a usable URL. */
export function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Distinct hosts across the catalog's URL columns.
 *
 * One raw query rather than four findMany calls: Track alone is large, and
 * pulling every audioUrl into node to extract a few hundred hostnames would be
 * the expensive way to ask a cheap question. Returns null on any failure, which
 * callers treat as "allow" rather than "deny".
 */
export async function loadCatalogHosts(): Promise<Set<string> | null> {
  try {
    // Imported lazily so the pure helpers above stay unit-testable without a
    // database, and so a proxy request that never reaches here pays nothing.
    const { prisma } = await import('./prisma');
    const rows = await prisma.$queryRaw<Array<{ host: string | null }>>`
      SELECT DISTINCT substring("audioUrl" from '://([^/]+)') AS host FROM "Track"
      UNION
      SELECT DISTINCT substring("image"    from '://([^/]+)') AS host FROM "Track"
      UNION
      SELECT DISTINCT substring("originalUrl" from '://([^/]+)') AS host FROM "Feed"
      UNION
      SELECT DISTINCT substring("image"       from '://([^/]+)') AS host FROM "Feed"
    `;
    const hosts = new Set<string>();
    for (const row of rows) {
      const host = row.host?.trim().toLowerCase();
      // Strip any userinfo/port the regex may have carried along.
      const cleaned = host?.split('@').pop()?.split(':')[0];
      if (cleaned) hosts.add(cleaned);
    }
    return hosts;
  } catch (error) {
    console.warn('[proxy-hosts] catalog host query failed, allowing all hosts', error);
    return null;
  }
}

/** The cached catalog host set, refreshing past the TTL. Never throws. */
export async function getCatalogHosts(nowMs: number = Date.now()): Promise<Set<string> | null> {
  if (catalogHosts && nowMs - catalogHostsLoadedAt < CATALOG_HOSTS_TTL_MS) return catalogHosts;
  // Collapse a stampede: many proxy requests arrive together on a page load.
  if (!inFlight) {
    inFlight = loadCatalogHosts().then((hosts) => {
      if (hosts) {
        catalogHosts = hosts;
        catalogHostsLoadedAt = Date.now();
      }
      inFlight = null;
      return hosts;
    });
  }
  const loaded = await inFlight;
  // On failure keep serving the previous set if we have one.
  return loaded ?? catalogHosts;
}

/** Test seam. */
export function resetCatalogHostCache(): void {
  catalogHosts = null;
  catalogHostsLoadedAt = 0;
  inFlight = null;
}

/**
 * Whether the proxies should fetch `targetUrl`.
 *
 * `allowed: true` with a reason of 'log-mode' or 'unavailable' means it is being
 * permitted despite not matching — the caller should serve it and warn.
 */
export async function checkProxyTarget(
  targetUrl: string,
  mode: ProxyHostMode = parseProxyHostMode(process.env.PROXY_HOST_MODE),
  /** Test seam: stand in for the catalog query. `null` simulates a failed load. */
  catalogHostsOverride?: Set<string> | null
): Promise<{ allowed: boolean; host: string | null; reason: 'static' | 'catalog' | 'unavailable' | 'log-mode' | 'foreign' }> {
  const host = hostOf(targetUrl);
  if (!host) return { allowed: true, host: null, reason: 'unavailable' };

  if (hostMatches(host, STATIC_ALLOWED_HOSTS)) return { allowed: true, host, reason: 'static' };

  const hosts = catalogHostsOverride !== undefined ? catalogHostsOverride : await getCatalogHosts();
  if (!hosts) return { allowed: true, host, reason: 'unavailable' };
  if (hostMatches(host, hosts)) return { allowed: true, host, reason: 'catalog' };

  return mode === 'enforce'
    ? { allowed: false, host, reason: 'foreign' }
    : { allowed: true, host, reason: 'log-mode' };
}

/**
 * Route-side guard: returns a 403 to return early, or null to carry on.
 *
 * In log mode it always returns null, so a route reads it identically in both
 * modes and there is no second code path to get wrong — same shape as
 * enforceRateLimit in lib/rate-limit-guard.ts.
 */
export async function guardProxyTarget(
  targetUrl: string,
  routeLabel: string,
  mode: ProxyHostMode = parseProxyHostMode(process.env.PROXY_HOST_MODE),
  catalogHostsOverride?: Set<string> | null
): Promise<{ refusal: { error: string; status: number } | null }> {
  const check = await checkProxyTarget(targetUrl, mode, catalogHostsOverride);
  if (check.reason === 'static' || check.reason === 'catalog') return { refusal: null };

  if (check.reason === 'unavailable') return { refusal: null };

  // console.warn, never console.log — next.config.js strips console.log from
  // production builds, which is the one environment worth reading.
  console.warn(
    `[proxy-hosts] ${check.allowed ? 'off-catalog host (log mode)' : 'refused'} ${routeLabel} host=${check.host}`
  );

  return check.allowed ? { refusal: null } : { refusal: { error: 'Host not allowed', status: 403 } };
}
