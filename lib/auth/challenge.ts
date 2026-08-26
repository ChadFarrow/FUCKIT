import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Login challenges that cannot be replayed forever.
 *
 * WHAT WAS WRONG: `/api/nostr/auth/challenge` minted 32 random bytes and threw
 * them away — its own comment said "in production, store it server-side and
 * verify it matches". `/api/nostr/auth/login` then verified the signature over
 * the challenge without ever checking the challenge was one this server issued,
 * and did not bound `created_at`. So a single captured login body — from a
 * proxy log, a shared HAR file, a browser extension — minted a fresh 90-day
 * PROVEN session on demand, indefinitely.
 *
 * WHY STATELESS: the obvious fix is a server-side store, but Railway may run
 * more than one instance and a challenge issued by one would not be found by
 * another, which fails logins. Signing the challenge with SESSION_SECRET makes
 * it verifiable anywhere with no shared state and no database round-trip. The
 * replay window drops from unbounded to CHALLENGE_MAX_AGE_MS.
 *
 * `markChallengeUsed` adds best-effort single-use on top. It is per-instance,
 * so it is a hardening layer and not the guarantee — the TTL is the guarantee.
 *
 * Pure and dependency-free: no env reads, no Next.js, no Prisma. Same
 * precedent as `lib/auth/session.ts`.
 */

const VERSION = 'c1';

/** How long a freshly issued challenge stays valid. */
export const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * How far a signed event's `created_at` may sit from our clock.
 * Wider than the challenge TTL would be pointless; narrower breaks a device
 * whose clock is a little off.
 */
export const CREATED_AT_SKEW_MS = 5 * 60 * 1000;

interface ChallengePayload {
  n: string;
  iat: number;
}

function hmac(payloadB64: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${VERSION}.${payloadB64}`).digest();
}

/** A signed, self-verifying challenge string for the client to sign. */
export function issueChallenge(nonce: string, secret: string, nowMs: number): string {
  const payload: ChallengePayload = { n: nonce, iat: Math.floor(nowMs / 1000) };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${VERSION}.${payloadB64}.${hmac(payloadB64, secret).toString('base64url')}`;
}

export type ChallengeCheck =
  | { ok: true; nonce: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyChallenge(
  token: string | null | undefined,
  secret: string,
  nowMs: number,
  maxAgeMs: number = CHALLENGE_MAX_AGE_MS
): ChallengeCheck {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };

  const [version, payloadB64, sigB64] = parts;
  if (version !== VERSION || !payloadB64 || !sigB64) return { ok: false, reason: 'malformed' };

  let provided: Buffer;
  try {
    provided = Buffer.from(sigB64, 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const expected = hmac(payloadB64, secret);
  // Length must match before timingSafeEqual, which throws on a mismatch.
  if (provided.length !== expected.length) return { ok: false, reason: 'bad_signature' };
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: 'bad_signature' };

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!payload || typeof payload.n !== 'string' || !payload.n) {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) {
    return { ok: false, reason: 'malformed' };
  }

  const issuedMs = payload.iat * 1000;
  // Issued ahead of our clock is not something skew should excuse.
  if (issuedMs > nowMs) return { ok: false, reason: 'expired' };
  if (nowMs - issuedMs > maxAgeMs) return { ok: false, reason: 'expired' };

  return { ok: true, nonce: payload.n };
}

/** True when a signed event's `created_at` (SECONDS) is inside the skew window. */
export function isCreatedAtAcceptable(
  createdAtSeconds: number,
  nowMs: number,
  skewMs: number = CREATED_AT_SKEW_MS
): boolean {
  if (typeof createdAtSeconds !== 'number' || !Number.isFinite(createdAtSeconds)) return false;
  return Math.abs(nowMs - createdAtSeconds * 1000) <= skewMs;
}

/**
 * Best-effort single use, per process.
 *
 * Not the guarantee — see the header. It closes the window where the SAME
 * challenge is redeemed twice against the same instance, which is what an
 * automated replay does.
 */
const usedNonces = new Map<string, number>();

export function markChallengeUsed(nonce: string, nowMs: number): boolean {
  // Evict expired entries so this cannot grow without bound.
  if (usedNonces.size > 5000) {
    for (const [key, at] of usedNonces) {
      if (nowMs - at > CHALLENGE_MAX_AGE_MS) usedNonces.delete(key);
    }
  }

  const seenAt = usedNonces.get(nonce);
  if (seenAt !== undefined && nowMs - seenAt <= CHALLENGE_MAX_AGE_MS) {
    return false; // already redeemed
  }

  usedNonces.set(nonce, nowMs);
  return true;
}

/** Test seam. */
export function __resetUsedChallenges(): void {
  usedNonces.clear();
}
