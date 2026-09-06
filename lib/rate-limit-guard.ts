/**
 * Per-IP ceilings on the routes that actually cost money, with a log-only mode.
 *
 * Backstop for the client-side gate in lib/native-app-identity.ts. That gate is
 * the precise control; this one is what still holds if a forked shell injects
 * script to fake its package id, and it is worth having against any anonymous
 * caller regardless — /api/proxy-audio serves every track stream and every
 * offline download, and /api/podcastindex signs requests with our PAID Podcast
 * Index credentials for anyone who knows the URL.
 *
 * SHIPS IN LOG MODE. A limit tuned by guesswork and enforced immediately would
 * refuse real users on a page that legitimately fires hundreds of requests (one
 * album view loads dozens of images; one track fires many audio range requests).
 * So `RATE_LIMIT_MODE` unset or `log` records the overage and serves the request
 * anyway. It is a SERVER env var, not NEXT_PUBLIC_*, so flipping it to `enforce`
 * in Railway needs no rebuild — read the warnings first, then flip.
 */

import { NextResponse } from 'next/server';
import { RateLimiter, clientIp, rateLimitHeaders } from './rate-limit';

export type RateLimitMode = 'log' | 'enforce';

/** `enforce` only when asked for explicitly; anything else logs. */
export function parseRateLimitMode(raw: string | undefined): RateLimitMode {
  return (raw ?? '').trim().toLowerCase() === 'enforce' ? 'enforce' : 'log';
}

/**
 * One limiter per route, created once at module scope by the caller so the
 * buckets survive between requests. In-memory and therefore per instance — an
 * abuse ceiling, not a quota, exactly as lib/rate-limit.ts intends.
 */
export function createRouteLimiter(maxPerMinute: number): RateLimiter {
  return new RateLimiter(maxPerMinute, 60_000);
}

/**
 * Returns a 429 to return early, or null to carry on.
 *
 * In log mode it always returns null, so a caller reads it the same way in both
 * modes and there is no second code path to get wrong.
 */
export function enforceRateLimit(
  limiter: RateLimiter,
  headers: Headers,
  routeLabel: string,
  mode: RateLimitMode = parseRateLimitMode(process.env.RATE_LIMIT_MODE)
): NextResponse | null {
  const ip = clientIp(headers);
  const result = limiter.check(ip);
  if (result.allowed) return null;

  // console.warn, never console.log — next.config.js strips console.log from
  // production builds, so a console.log diagnostic is missing from the one
  // environment worth diagnosing.
  console.warn(`[rate-limit] ${mode === 'enforce' ? 'refused' : 'over limit (log mode)'} ${routeLabel} ip=${ip}`);

  if (mode === 'log') return null;

  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: rateLimitHeaders(result) }
  );
}
