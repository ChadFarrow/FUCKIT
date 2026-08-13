import type { NextRequest } from 'next/server';

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  signSession,
  verifySession,
} from './session';

let warnedNoSecret = false;

/**
 * Pure resolution, split out so the policy is testable without a NextRequest.
 *
 * FAIL-OPEN when `secret` is undefined, matching `lib/admin-auth.ts`. The cost
 * is explicit: the vulnerability stays live until SESSION_SECRET is set in
 * Railway. Setting it is step 1 of the deploy sequence, not a follow-up.
 */
export function resolveUserId(
  cookieValue: string | null,
  legacyHeader: string | null,
  secret: string | undefined,
  nowMs: number,
  needsProof: boolean
): { userId: string | null; reason: 'ok' | 'failopen' | 'none' | 'unproven' } {
  if (!secret) {
    return legacyHeader
      ? { userId: legacyHeader, reason: 'failopen' }
      : { userId: null, reason: 'none' };
  }

  const session = verifySession(cookieValue, secret, nowMs);
  if (!session) return { userId: null, reason: 'none' };

  if (needsProof && !session.proven) {
    return { userId: null, reason: 'unproven' };
  }

  return { userId: session.userId, reason: 'ok' };
}

/**
 * The verified user id for this request, or null.
 *
 * Pass `{ write: true }` on any route that mutates. That rejects read-only
 * NIP-05 sessions, which prove no key ownership.
 */
export function requireUser(
  request: NextRequest,
  opts: { write?: boolean } = {}
): string | null {
  const secret = process.env.SESSION_SECRET;

  if (!secret && !warnedNoSecret) {
    console.warn(
      '⚠️ SESSION_SECRET is not set — API routes are falling back to the ' +
        'unverified x-nostr-user-id header, which allows anyone to act as ' +
        'any user. Set it in Railway to enable session auth.'
    );
    warnedNoSecret = true;
  }

  const { userId } = resolveUserId(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null,
    request.headers.get('x-nostr-user-id'),
    secret,
    Date.now(),
    opts.write === true
  );

  return userId;
}

/**
 * A Set-Cookie value for a fresh session, or '' when no secret is configured
 * (in which case the caller should not set the header at all).
 *
 * SameSite=Lax is sufficient: every caller is same-origin, including the
 * Capacitor WebView, which loads the live origin.
 */
export function sessionCookie(userId: string, proven: boolean): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return '';

  const token = signSession(userId, proven, secret, Date.now());
  const attrs = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
  ];
  // Secure would make the cookie unusable over http://<lan-ip>:3000, which is
  // the documented phone-testing flow in CLAUDE.md.
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie(): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}
