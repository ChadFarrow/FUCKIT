import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed session tokens.
 *
 * WHY THIS EXISTS: `User.id` is the user's Nostr public key (see
 * `app/api/nostr/auth/login/route.ts`), which is public by definition — it is
 * in every event they publish and derivable from any npub. Authorizing on a
 * client-supplied `x-nostr-user-id` header therefore authorized anyone to act
 * as anyone. The login route already verifies a signed Nostr event correctly;
 * this module is what carries that proof forward to subsequent requests.
 *
 * Pure and dependency-free on purpose: no env reads, no Next.js, no Prisma, so
 * it is unit-testable without a browser or database. Same precedent as
 * `lib/feed-lookup.ts`.
 */

export const SESSION_COOKIE_NAME = 'sk_session';

/** 90 days. Long, because re-login costs a remote-signer approval (Amber). */
export const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const VERSION = 'v1';

/**
 * `proven` records whether the login actually demonstrated key ownership.
 *
 * `/api/nostr/auth/login` verifies a signed event, so it mints proven tokens.
 * `/api/nostr/auth/nip05-login` deliberately does NOT — CLAUDE.md: "no
 * key-ownership proof, no signer ... anyone can read-only 'log in' as any
 * identifier". That was an accepted tradeoff only because the session was
 * read-only. Minting an ordinary session there would silently convert it into
 * full write authority, so those tokens carry p:0 and writes reject them.
 */
interface SessionPayload {
  uid: string;
  iat: number;
  p: 0 | 1;
}

function hmac(payloadB64: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${VERSION}.${payloadB64}`).digest();
}

export function signSession(
  userId: string,
  proven: boolean,
  secret: string,
  nowMs: number
): string {
  const payload: SessionPayload = {
    uid: userId,
    iat: Math.floor(nowMs / 1000),
    p: proven ? 1 : 0,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${VERSION}.${payloadB64}.${hmac(payloadB64, secret).toString('base64url')}`;
}

export function verifySession(
  token: string | null | undefined,
  secret: string,
  nowMs: number
): { userId: string; proven: boolean } | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [version, payloadB64, sigB64] = parts;
  if (version !== VERSION || !payloadB64 || !sigB64) return null;

  let provided: Buffer;
  try {
    provided = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }

  const expected = hmac(payloadB64, secret);
  // Length must match before timingSafeEqual, which throws on a mismatch.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload.uid !== 'string' || !payload.uid) return null;
  if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) return null;

  const issuedMs = payload.iat * 1000;
  // A token minted ahead of our clock is not something skew should excuse.
  if (issuedMs > nowMs) return null;
  if (nowMs - issuedMs > SESSION_MAX_AGE_MS) return null;

  return { userId: payload.uid, proven: payload.p === 1 };
}
