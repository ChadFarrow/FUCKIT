/**
 * Single source of truth for how a media URL is fetched: directly, or through
 * `/api/proxy-audio`.
 *
 * This used to be a hand-mirrored copy of the arrays inside AudioContext's
 * `getAudioUrlsToTry`, with a "keep in sync" comment holding it together. It
 * drifted (16 entries there, 14 here), and because the download path had no
 * fallback while playback did, the drift showed up as albums that streamed
 * perfectly and could not be downloaded. Both sides now import from here.
 *
 * The ordering rule is the important part, not the lists: an unknown external
 * host gets the PROXY FIRST and the direct URL only as a fallback, because the
 * proxy is same-origin (readable, no CORS, redirects resolved server-side)
 * whereas a direct `mode: 'cors'` fetch fails outright on the many podcast CDNs
 * that send no `Access-Control-Allow-Origin`. Streaming has always done this;
 * downloads now do too.
 */

/** Hosts known to send no usable CORS headers — proxy only, never direct. */
export const CORS_PROBLEMATIC_DOMAINS = [
  'cloudfront.net',
  'amazonaws.com',
  'wavlake.com',
  'buzzsprout.com',
  'anchor.fm',
  'libsyn.com',
  'whitetriangles.com',
  'falsefinish.club',
  'behindthesch3m3s.com',
  'doerfelverse.com',
  'sirtjthewrathful.com',
  'digitaloceanspaces.com',
  'rocknrollbreakheart.com',
  'mmmusic.show',
  'cypherpunk.today',
  'thunderroad.media',
];

/** Hosts known to send CORS headers — try direct first, it's one hop faster. */
export const DIRECT_FIRST_DOMAINS = [
  'rssblue.com',
  'strangetextures.com',
  'thisisjdog.com',
  'heycitizen.xyz',
  'bitpunk.fm',
  'thebearsnare.com',
];

function matches(hostname: string, domains: readonly string[]): boolean {
  return domains.some((domain) => hostname.includes(domain.toLowerCase()));
}

export function isCorsProblematicHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  // CloudFront subdomains are called out explicitly as well as via the list.
  return (
    matches(host, CORS_PROBLEMATIC_DOMAINS) ||
    host.endsWith('.cloudfront.net') ||
    host === 'cloudfront.net'
  );
}

export function isDirectFirstHost(hostname: string): boolean {
  return matches(hostname.toLowerCase(), DIRECT_FIRST_DOMAINS);
}

export function proxiedAudioUrl(originalUrl: string): string {
  return `/api/proxy-audio?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * Ordered fetch candidates for a plain (non-HLS) media URL. Try them in order
 * and take the first that yields a readable body.
 *
 * Mirrors the external-host branch of AudioContext's `getAudioUrlsToTry`. That
 * function keeps its own extra branches for HLS manifests and op3.dev wrappers,
 * which are playback-specific; this covers the shared case.
 */
export function audioUrlCandidates(rawUrl: string): string[] {
  if (!rawUrl) return [];

  // Normalize before the host check, exactly as getAudioUrlsToTry does — an
  // op3.dev-wrapped track must be judged on its real CDN host, not on op3.dev.
  // Deliberately NOT upgrading http→https here: playback proxies the URL as the
  // feed wrote it and /api/proxy-audio accepts http (`allowHttp: true`).
  // `primaryPlaybackKey` does upgrade, which is why the download CACHE KEY and
  // the download FETCH URL are derived separately.
  let originalUrl = rawUrl;
  if (originalUrl.includes(' ') && !originalUrl.includes('%20')) {
    originalUrl = originalUrl.replace(/ /g, '%20');
  }
  if (originalUrl.includes('op3.dev/e/') && originalUrl.includes('/https://')) {
    const direct = originalUrl.split('/https://')[1];
    if (direct) originalUrl = `https://${direct}`;
  }

  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    // Relative or unparseable — hand it back untouched, same as before.
    return [originalUrl];
  }

  // Already proxied, or same-origin — needs no help. The pathname check stands
  // in for the origin check during SSR, where `window` isn't there to compare.
  if (
    url.pathname.startsWith('/api/proxy-audio') ||
    (typeof window !== 'undefined' && url.origin === window.location.origin)
  ) {
    return [originalUrl];
  }

  const hostname = url.hostname.toLowerCase();

  if (isCorsProblematicHost(hostname)) {
    // Proxy only: a direct attempt is known to fail, so don't spend a round trip.
    return [proxiedAudioUrl(originalUrl)];
  }

  if (isDirectFirstHost(hostname)) {
    return [originalUrl, proxiedAudioUrl(originalUrl)];
  }

  return [proxiedAudioUrl(originalUrl), originalUrl];
}

/**
 * The single URL to use when there's no room for a fallback (e.g. assigning to
 * an `Audio` element's src). Prefer `audioUrlCandidates` wherever you can retry.
 */
export function getProxiedAudioUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  return audioUrlCandidates(originalUrl)[0] ?? originalUrl;
}
