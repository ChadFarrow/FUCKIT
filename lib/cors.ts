/**
 * Who may read the catalog API from another website.
 *
 * These routes answered `Access-Control-Allow-Origin: *`, so any page anywhere
 * could fetch this catalog straight from a browser and build a music site on
 * this deployment's CPU and Postgres. That is a different exposure from the
 * media proxies (lib/proxy-host-allowlist.ts): the proxies were spending
 * bandwidth on arbitrary content, this is spending the database on arbitrary
 * websites.
 *
 * WHAT NARROWING THIS CANNOT BREAK. CORS is enforced by BROWSERS, on
 * cross-origin JavaScript. It is not an access control. Removing the header
 * changes nothing for:
 *   - our own site and our own Android WebView — both same-origin, and a browser
 *     never needs the header for those;
 *   - the podping consumer, which is Node (msp-podping-service consumer/src/index.ts)
 *     and ignores CORS entirely — its four routes keep their wildcard in
 *     next.config.js regardless;
 *   - curl, scripts, other servers. A determined scraper is unaffected.
 * What it stops is exactly the case worth stopping: somebody else's WEBSITE
 * quietly using this backend to render their pages.
 *
 * Checked before writing this: boostmebitch, msp-podping-service,
 * musicL-playlist-updater and ITDV-Lightning contain no browser call to
 * stablekraft.app. The only reference is the Node consumer above.
 *
 * SHIPS IN LOG MODE, which still answers `*` exactly as today but warns with the
 * Origin of any cross-origin caller. Read those warnings first — they name the
 * sites actually relying on this — then add any you want to keep to
 * CORS_ALLOWED_ORIGINS and set CORS_MODE=enforce. Both are plain server
 * variables, so neither needs a rebuild.
 */

export type CorsMode = 'log' | 'enforce';

/** Origins always allowed. Our own site, and localhost for development. */
export const DEFAULT_ALLOWED_ORIGINS = [
  'https://stablekraft.app',
  'https://www.stablekraft.app',
] as const;

/** `enforce` only when asked for explicitly; anything else logs. */
export function parseCorsMode(raw: string | undefined): CorsMode {
  return (raw ?? '').trim().toLowerCase() === 'enforce' ? 'enforce' : 'log';
}

/** Extra origins from CORS_ALLOWED_ORIGINS, comma-separated. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  const extra = (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]));
}

/** Any localhost or loopback origin, on any port, for local development. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * The value for Access-Control-Allow-Origin, or null to send no such header.
 *
 * Echoes ONE origin, never a list: a comma-joined value is not valid here and
 * every browser rejects it. (An unimported helper in lib/api-utils.ts
 * did exactly that; it is deleted rather than left as a trap.)
 *
 * A null `origin` means the request carried no Origin header — same-origin
 * fetches, curl, and server-to-server callers. Those need no header at all, so
 * returning null leaves them working untouched.
 */
export function resolveAllowedOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
  mode: CorsMode
): string | null {
  if (mode === 'log') return '*';
  if (!origin) return null;
  const normalized = origin.trim().replace(/\/$/, '');
  if (allowedOrigins.includes(normalized)) return normalized;
  if (isLocalOrigin(normalized)) return normalized;
  return null;
}

/**
 * CORS headers for the current request, for spreading into a headers object.
 *
 * Reads the incoming Origin through next/headers rather than a `request`
 * parameter, because several of these handlers are declared `GET()` and
 * `OPTIONS()` with no request at all.
 *
 * Sends `Vary: Origin` whenever it echoes a specific origin. Without it a shared
 * cache can hand one site's Access-Control-Allow-Origin to another and either
 * leak the permission or wrongly deny it.
 */
export async function corsHeaders(): Promise<Record<string, string>> {
  let origin: string | null = null;
  try {
    const { headers } = await import('next/headers');
    origin = (await headers()).get('origin');
  } catch {
    // No request context (a unit test, a build-time call). Fall through to the
    // same answer as a request with no Origin.
  }

  const mode = parseCorsMode(process.env.CORS_MODE);
  const allowed = resolveAllowedOrigin(origin, parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS), mode);

  if (mode === 'log' && origin && !resolveAllowedOrigin(origin, parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS), 'enforce')) {
    // console.warn, never console.log — next.config.js strips console.log from
    // production builds. This is the line that tells you who would break.
    console.warn(`[cors] cross-origin caller (log mode, still allowed): ${origin}`);
  }

  if (!allowed) return {};
  return allowed === '*'
    ? { 'Access-Control-Allow-Origin': '*' }
    : { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' };
}
