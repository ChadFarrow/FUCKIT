# Security and Hygiene Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close an account-takeover hole caused by trusting an unverified identity header, fix two SSRF routes and an unauthenticated DoS, and add the typecheck gate the repo has never had.

**Architecture:** Login issues an HMAC-signed session token in an httpOnly cookie. A single `requireUser(request)` helper replaces `request.headers.get('x-nostr-user-id')` in all 20 route files. The client barely changes: same-origin `fetch` sends cookies by default, so the existing header sends stay in place and are simply ignored. Remaining work is independent hardening — SSRF guards, a real CSP, and CI.

**Tech Stack:** Next.js 15 App Router (all touched routes are Node runtime, confirmed — no `runtime = 'edge'` anywhere in `app/api`), `node:crypto`, Prisma, `node:test` + `tsx` for tests.

## Global Constraints

- **No test framework.** This repo has no jest/vitest. Tests are `node:test` + `tsx`, run as `npx tsx --test <file>`. Follow the style in `lib/favorite-target.test.ts`.
- **Pure logic goes in `lib/`,** dependency-free, so it is testable without a browser or database. Precedent: `lib/feed-lookup.ts`, `lib/favorite-feed-ids.ts`.
- **Fail open when `SESSION_SECRET` is unset,** with a one-time warn, mirroring `lib/admin-auth.ts` exactly.
- **Never edit these files.** `contexts/AudioContext.tsx`, `lib/feed-lookup.ts`, `lib/favorite-feed-ids.ts`, `lib/nostr/nip46-client.ts`, `lib/nostr/signer.ts`, and the Android ping-pong path. Report anything found there; do not change it.
- **Stop `npm run dev` before `npm run build`.** Both write `.next`; building over a live dev server 400s every asset. Recovery is kill dev, `rm -rf .next`, `npm run dev`.
- **Delete `public/sw.js` and `public/workbox-*.js`** after any local build you did not intend to deploy.
- **Branch is `security-audit-2026-08`.** Never commit to `main` — push to `main` is the production deploy.
- **`npm run dev` READS AND WRITES THE PRODUCTION DATABASE.** `.env.local` sets `DATABASE_URL` to `shuttle.proxy.rlwy.net` (Railway) and Next.js loads it for dev; `.env` points at localhost but only the Prisma CLI reads it. Every `curl http://localhost:3000/...` in this plan therefore hits live data. **No verification step may call a DELETE or a mutating endpoint** — favorites rows are the only copy. Read-only probes only.
- **Token format is `v1.<base64url payload>.<base64url hmac>`** and the payload is exactly `{"uid":string,"iat":number,"p":0|1}`. Every task uses these names.

---

### Task 1: Session token module

The pure core. No Next.js, no Prisma, no environment reads — the caller passes the secret in, so tests need no environment setup.

**Files:**
- Create: `lib/auth/session.ts`
- Test: `lib/auth/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `signSession(userId: string, proven: boolean, secret: string, nowMs: number): string`
  - `verifySession(token: string | null | undefined, secret: string, nowMs: number): { userId: string; proven: boolean } | null`
  - `SESSION_MAX_AGE_MS: number` (90 days in ms)
  - `SESSION_COOKIE_NAME: string` (`'sk_session'`)

- [ ] **Step 1: Write the failing test**

Create `lib/auth/session.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  signSession,
  verifySession,
  SESSION_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './session';

/**
 * What these pin: before this module, `User.id` (which IS the user's public
 * Nostr pubkey) was accepted from a client-supplied `x-nostr-user-id` header
 * with no verification, so anyone could destroy anyone's favorites with only
 * public information. A token is only trustworthy if forging one requires the
 * secret — so the tamper and wrong-secret cases matter more than the happy path.
 */

const SECRET = 'test-secret-value';
const NOW = 1_800_000_000_000;
const UID = 'a'.repeat(64);

test('a signed token round trips', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(verifySession(token, SECRET, NOW), { userId: UID, proven: true });
});

test('the proven claim survives the round trip', () => {
  const token = signSession(UID, false, SECRET, NOW);
  assert.deepEqual(verifySession(token, SECRET, NOW), { userId: UID, proven: false });
});

test('a token signed with a different secret is rejected', () => {
  const token = signSession(UID, true, 'other-secret', NOW);
  assert.equal(verifySession(token, SECRET, NOW), null);
});

test('tampering with the payload is rejected', () => {
  const token = signSession(UID, true, SECRET, NOW);
  const [version, payload, sig] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ uid: 'b'.repeat(64), iat: Math.floor(NOW / 1000), p: 1 })
  ).toString('base64url');
  assert.notEqual(forged, payload);
  assert.equal(verifySession(`${version}.${forged}.${sig}`, SECRET, NOW), null);
});

test('promoting an unproven token to proven is rejected', () => {
  // The nip05 read-only path issues p:0. Flipping that bit must not be free.
  const token = signSession(UID, false, SECRET, NOW);
  const [version, , sig] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ uid: UID, iat: Math.floor(NOW / 1000), p: 1 })
  ).toString('base64url');
  assert.equal(verifySession(`${version}.${forged}.${sig}`, SECRET, NOW), null);
});

test('an expired token is rejected', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.equal(verifySession(token, SECRET, NOW + SESSION_MAX_AGE_MS + 1000), null);
});

test('a token at exactly max age is still accepted', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(verifySession(token, SECRET, NOW + SESSION_MAX_AGE_MS), {
    userId: UID,
    proven: true,
  });
});

test('a token issued in the future is rejected', () => {
  // Clock skew is not a reason to accept a token minted ahead of us.
  const token = signSession(UID, true, SECRET, NOW + 600_000);
  assert.equal(verifySession(token, SECRET, NOW), null);
});

test('malformed input is rejected rather than throwing', () => {
  for (const bad of [null, undefined, '', 'garbage', 'v1.only-two', 'v1..', 'v2.a.b', '...']) {
    assert.equal(verifySession(bad as string, SECRET, NOW), null);
  }
});

test('a payload that is not valid JSON is rejected', () => {
  const junk = Buffer.from('not json').toString('base64url');
  assert.equal(verifySession(`v1.${junk}.sig`, SECRET, NOW), null);
});

test('a payload missing uid is rejected', () => {
  const noUid = Buffer.from(JSON.stringify({ iat: 1, p: 1 })).toString('base64url');
  assert.equal(verifySession(`v1.${noUid}.sig`, SECRET, NOW), null);
});

test('the cookie name is stable', () => {
  // Changing this logs every user out. It is asserted so the change is deliberate.
  assert.equal(SESSION_COOKIE_NAME, 'sk_session');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/auth/session.test.ts`
Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/auth/session.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/auth/session.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts lib/auth/session.test.ts
git commit -m "feat(auth): add signed session token module

User.id is the user's Nostr pubkey, which is public. Authorizing on an
unverified x-nostr-user-id header let anyone act as anyone. This is the
primitive that carries the login route's existing signature verification
forward to subsequent requests.

The proven claim keeps the nip05 read-only path read-only: that route
proves no key ownership, so its tokens cannot authorize writes."
```

---

### Task 2: requireUser helper

Wraps Task 1 with the environment read, the cookie read, and the fail-open rule.

**Files:**
- Create: `lib/auth/require-user.ts`
- Test: `lib/auth/require-user.test.ts`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_MS` from `lib/auth/session`.
- Produces:
  - `resolveUserId(cookieValue: string | null, legacyHeader: string | null, secret: string | undefined, nowMs: number, needsProof: boolean): { userId: string | null; reason: 'ok' | 'failopen' | 'none' | 'unproven' }` — pure, testable.
  - `requireUser(request: NextRequest, opts?: { write?: boolean }): string | null` — reads the cookie and env, delegates to `resolveUserId`.
  - `sessionCookie(userId: string, proven: boolean): string` — a `Set-Cookie` value, or `''` when no secret is configured.
  - `clearSessionCookie(): string`

- [ ] **Step 1: Write the failing test**

Create `lib/auth/require-user.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signSession } from './session';
import { resolveUserId } from './require-user';

const SECRET = 'test-secret-value';
const NOW = 1_800_000_000_000;
const UID = 'a'.repeat(64);

test('a valid cookie resolves the user', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, false), {
    userId: UID,
    reason: 'ok',
  });
});

test('the legacy header is ignored when a secret is configured', () => {
  // This is the whole point: the header must stop being an authorization.
  assert.deepEqual(resolveUserId(null, 'b'.repeat(64), SECRET, NOW, false), {
    userId: null,
    reason: 'none',
  });
});

test('an invalid cookie does not fall back to the header', () => {
  assert.deepEqual(resolveUserId('garbage', 'b'.repeat(64), SECRET, NOW, false), {
    userId: null,
    reason: 'none',
  });
});

test('with no secret configured it fails open to the legacy header', () => {
  // Mirrors lib/admin-auth.ts: a deploy must not break favorites for everyone
  // before the Railway env var exists.
  assert.deepEqual(resolveUserId(null, 'b'.repeat(64), undefined, NOW, false), {
    userId: 'b'.repeat(64),
    reason: 'failopen',
  });
});

test('with no secret and no header there is still no user', () => {
  assert.deepEqual(resolveUserId(null, null, undefined, NOW, false), {
    userId: null,
    reason: 'none',
  });
});

test('an unproven token is accepted for reads', () => {
  const token = signSession(UID, false, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, false), {
    userId: UID,
    reason: 'ok',
  });
});

test('an unproven token is rejected for writes', () => {
  // nip05-login proves no key ownership. It may read; it may not write.
  const token = signSession(UID, false, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, true), {
    userId: null,
    reason: 'unproven',
  });
});

test('a proven token is accepted for writes', () => {
  const token = signSession(UID, true, SECRET, NOW);
  assert.deepEqual(resolveUserId(token, null, SECRET, NOW, true), {
    userId: UID,
    reason: 'ok',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/auth/require-user.test.ts`
Expected: FAIL — `Cannot find module './require-user'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/auth/require-user.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/auth/require-user.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/auth/require-user.ts lib/auth/require-user.test.ts
git commit -m "feat(auth): add requireUser with fail-open on missing secret

Fail-open mirrors lib/admin-auth.ts so a deploy cannot break favorites
before SESSION_SECRET exists in Railway. Cookie omits Secure outside
production so the documented http://<lan-ip>:3000 phone-testing flow
still works."
```

---

### Task 3: Login routes issue the cookie; logout clears it

**Files:**
- Modify: `app/api/nostr/auth/login/route.ts:200-224` (the success response)
- Modify: `app/api/nostr/auth/nip05-login/route.ts:155-170` (the success response)
- Modify: `app/api/nostr/auth/logout/route.ts:11-15`

**Interfaces:**
- Consumes: `sessionCookie`, `clearSessionCookie` from `lib/auth/require-user`.
- Produces: a `Set-Cookie` header on both login responses and on logout.

- [ ] **Step 1: Add the import and cookie to `login/route.ts`**

Add to the imports at the top:

```typescript
import { sessionCookie } from '@/lib/auth/require-user';
```

Replace the success `return NextResponse.json({...})` at the end of the `POST` handler with:

```typescript
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        nostrPubkey: user.nostrPubkey,
        nostrNpub: user.nostrNpub,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        lightningAddress: user.lightningAddress,
        relays: user.relays,
        loginType: 'extension',
      },
    });

    // This route verified a signed Nostr event above (getEventHash
    // reconstruction + verifyEvent), so the session is proven and may write.
    const cookie = sessionCookie(user.id, true);
    if (cookie) response.headers.set('Set-Cookie', cookie);

    return response;
```

- [ ] **Step 2: Add the unproven cookie to `nip05-login/route.ts`**

Add to the imports at the top:

```typescript
import { sessionCookie } from '@/lib/auth/require-user';
```

Replace the success `return NextResponse.json({...})` at the end of the handler with:

```typescript
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nostrPubkey: user.nostrPubkey,
        nostrNpub: user.nostrNpub,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        lightningAddress: user.lightningAddress,
        relays: user.relays,
        nip05Verified: true,
        loginType: 'nip05'
      }
    });

    // proven=false. This route resolves a pubkey from /.well-known/nostr.json
    // and never demonstrates key ownership — CLAUDE.md calls out that anyone
    // can read-only "log in" as any identifier. That was acceptable only while
    // the session was read-only, so the token must not authorize writes.
    const cookie = sessionCookie(user.id, false);
    if (cookie) response.headers.set('Set-Cookie', cookie);

    return response;
```

- [ ] **Step 3: Clear the cookie in `logout/route.ts`**

Replace the whole file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/require-user';

/**
 * POST /api/nostr/auth/logout
 * Clear the session cookie. The client separately clears localStorage.
 */
export async function POST(_request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logout successful',
  });
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors introduced by these three files. Pre-existing errors elsewhere are acceptable at this stage — Task 12 measures them.

- [ ] **Step 5: Commit**

```bash
git add app/api/nostr/auth/login/route.ts app/api/nostr/auth/nip05-login/route.ts app/api/nostr/auth/logout/route.ts
git commit -m "feat(auth): issue session cookie on login, clear on logout

login/ verifies a signed event so it mints a proven token. nip05-login
proves no key ownership, so it mints an unproven one that reads but
cannot write — otherwise this change would upgrade a known read-only
impersonation into full write authority."
```

---

### Task 4: Migrate the favorites routes to requireUser

Ten route files, 19 read sites. Mechanical, but the read/write distinction is per-handler and must be right.

**Files:**
- Modify: `app/api/favorites/albums/route.ts:34,401,557,654`
- Modify: `app/api/favorites/albums/[feedId]/route.ts:20`
- Modify: `app/api/favorites/tracks/route.ts:14,209,496,613`
- Modify: `app/api/favorites/tracks/[trackId]/route.ts:20`
- Modify: `app/api/favorites/check/route.ts:15`
- Modify: `app/api/favorites/delete-all/route.ts:15,100`
- Modify: `app/api/favorites/sync-to-nostr/route.ts:22,162`
- Modify: `app/api/favorites/sync-shared/route.ts:87`
- Modify: `app/api/favorites/dedupe-tracks/route.ts:13`
- Modify: `app/api/favorites/migrate-single-tracks/route.ts:13`
- Modify: `app/api/favorites/unpublished-count/route.ts:13`

**Interfaces:**
- Consumes: `requireUser` from `lib/auth/require-user`.
- Produces: no new exports. After this task, no file under `app/api/favorites/` calls `request.headers.get('x-nostr-user-id')`.

- [ ] **Step 1: Apply the same edit to every site**

In each file add the import:

```typescript
import { requireUser } from '@/lib/auth/require-user';
```

Then replace each occurrence of:

```typescript
const userId = request.headers.get('x-nostr-user-id');
```

with, in a `GET` handler:

```typescript
const userId = requireUser(request);
```

and in a `POST`, `PUT`, `PATCH` or `DELETE` handler:

```typescript
const userId = requireUser(request, { write: true });
```

Where the local is named `currentUserId` rather than `userId`, keep the existing name — only the right-hand side changes.

Handler-by-handler mapping, so no judgement call is needed:

| File | Line | Handler | Call |
|---|---|---|---|
| `favorites/albums/route.ts` | 34 | GET | `requireUser(request)` |
| `favorites/albums/route.ts` | 401 | POST | `requireUser(request, { write: true })` |
| `favorites/albums/route.ts` | 557 | DELETE | `requireUser(request, { write: true })` |
| `favorites/albums/route.ts` | 654 | PATCH | `requireUser(request, { write: true })` |
| `favorites/albums/[feedId]/route.ts` | 20 | DELETE | `requireUser(request, { write: true })` |
| `favorites/tracks/route.ts` | 14 | GET | `requireUser(request)` |
| `favorites/tracks/route.ts` | 209 | POST | `requireUser(request, { write: true })` |
| `favorites/tracks/route.ts` | 496 | DELETE | `requireUser(request, { write: true })` |
| `favorites/tracks/route.ts` | 613 | PATCH | `requireUser(request, { write: true })` |
| `favorites/tracks/[trackId]/route.ts` | 20 | DELETE | `requireUser(request, { write: true })` |
| `favorites/check/route.ts` | 15 | POST | `requireUser(request)` — reads only, despite POST |
| `favorites/delete-all/route.ts` | 15 | DELETE | `requireUser(request, { write: true })` |
| `favorites/delete-all/route.ts` | 100 | GET | `requireUser(request)` |
| `favorites/sync-to-nostr/route.ts` | 22 | GET | `requireUser(request)` |
| `favorites/sync-to-nostr/route.ts` | 162 | POST | `requireUser(request, { write: true })` |
| `favorites/sync-shared/route.ts` | 87 | POST | `requireUser(request, { write: true })` |
| `favorites/dedupe-tracks/route.ts` | 13 | POST | `requireUser(request, { write: true })` |
| `favorites/migrate-single-tracks/route.ts` | 13 | POST | `requireUser(request, { write: true })` |
| `favorites/unpublished-count/route.ts` | 13 | GET | `requireUser(request)` |

Note `favorites/tracks/route.ts:209` assigns to an existing `userId` variable (`userId = request.headers.get(...)`, no `const`) — preserve that, writing `userId = requireUser(request, { write: true });`.

- [ ] **Step 2: Verify no reads remain**

Run: `grep -rn "x-nostr-user-id" app/api/favorites`
Expected: no output.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/api/favorites/`.

- [ ] **Step 4: Run the existing favorites tests**

Run: `npx tsx --test lib/favorite-target.test.ts lib/favorite-feed-ids.test.ts lib/favorite-status-cache.test.ts`
Expected: PASS. These cover pure helpers the routes call and must be unaffected.

- [ ] **Step 5: Commit**

```bash
git add app/api/favorites
git commit -m "fix(security): authorize favorites routes on a verified session

Replaces the unverified x-nostr-user-id header with requireUser in all
ten favorites route files. Closes the hole where
DELETE /api/favorites/delete-all with a victim's public pubkey in a
header destroyed their entire library."
```

---

### Task 5: Migrate the nostr routes to requireUser

**Files:**
- Modify: `app/api/nostr/auth/me/route.ts:13`
- Modify: `app/api/nostr/activity/route.ts:13`
- Modify: `app/api/nostr/relays/route.ts:47,103`
- Modify: `app/api/nostr/follow/route.ts:15,236`
- Modify: `app/api/nostr/followers/route.ts:15`
- Modify: `app/api/nostr/following/route.ts:15`
- Modify: `app/api/nostr/boost/route.ts:14`
- Modify: `app/api/nostr/profile/update/route.ts:16`
- Modify: `app/api/nostr/share/route.ts:14`

**Interfaces:**
- Consumes: `requireUser` from `lib/auth/require-user`.
- Produces: no new exports. After this task, `grep -rn "x-nostr-user-id" app/api` returns nothing.

- [ ] **Step 1: Apply the edits**

Add `import { requireUser } from '@/lib/auth/require-user';` to each file, then:

| File | Line | Handler | Call |
|---|---|---|---|
| `nostr/auth/me/route.ts` | 13 | GET | `requireUser(request)` |
| `nostr/activity/route.ts` | 13 | GET | `requireUser(request)` |
| `nostr/relays/route.ts` | 47 | GET | `requireUser(request)` |
| `nostr/relays/route.ts` | 103 | POST | `requireUser(request, { write: true })` |
| `nostr/follow/route.ts` | 15 | POST | `requireUser(request, { write: true })` |
| `nostr/follow/route.ts` | 236 | DELETE | `requireUser(request, { write: true })` |
| `nostr/followers/route.ts` | 15 | GET | `requireUser(request)` |
| `nostr/following/route.ts` | 15 | GET | `requireUser(request)` |
| `nostr/boost/route.ts` | 14 | POST | `requireUser(request, { write: true })` |
| `nostr/profile/update/route.ts` | 16 | POST | `requireUser(request, { write: true })` |
| `nostr/share/route.ts` | 14 | POST | `requireUser(request, { write: true })` |

`activity`, `followers` and `following` name the local `currentUserId` — keep that name.

- [ ] **Step 2: Verify no reads remain anywhere**

Run: `grep -rn "x-nostr-user-id" app/api`
Expected: no output.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/api/nostr/`.

- [ ] **Step 4: Commit**

```bash
git add app/api/nostr
git commit -m "fix(security): authorize nostr routes on a verified session

Completes the migration. profile/update in particular allowed editing
any user's profile row given only their public pubkey."
```

---

### Task 6: Client handles the 401 with a one-time re-login

Existing signed-in users hold `nostr_user` in localStorage but no cookie. They must be prompted once.

**Files:**
- Modify: `contexts/NostrContext.tsx` (add the handler; it already owns `logout` at line 265)
- Create: `lib/auth/session-expired.ts`
- Test: `lib/auth/session-expired.test.ts`
- Create: `app/api/nostr/auth/session/route.ts`

**Why a new probe endpoint rather than `/api/nostr/auth/me`:** `me` opens
relay connections and fetches a kind-0 profile on every call
(`me/route.ts:41-46`). CLAUDE.md records that the login route was deliberately
changed to stop doing exactly that — a ~21s round-trip, a 1000× perf delta.
Probing `me` on every mount would put it straight back. The new route touches
neither the database nor any relay.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `SESSION_EXPIRED_EVENT: string` (`'sk-session-expired'`)
  - `notifySessionExpired(): void` — dispatches the event, throttled to once per page load.
  - `isSessionExpiredResponse(status: number, body: unknown): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/auth/session-expired.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isSessionExpiredResponse, SESSION_EXPIRED_EVENT } from './session-expired';

test('a 401 with the session code is an expired session', () => {
  assert.equal(isSessionExpiredResponse(401, { error: 'session_expired' }), true);
});

test('a 401 without the code is not treated as expired', () => {
  // Admin routes 401 with a different body. Prompting a Nostr re-login there
  // would be wrong and confusing.
  assert.equal(isSessionExpiredResponse(401, { error: 'Unauthorized' }), false);
});

test('a non-401 is never an expired session', () => {
  assert.equal(isSessionExpiredResponse(200, { error: 'session_expired' }), false);
  assert.equal(isSessionExpiredResponse(500, { error: 'session_expired' }), false);
});

test('a non-object body does not throw', () => {
  for (const body of [null, undefined, 'text', 42, []]) {
    assert.equal(isSessionExpiredResponse(401, body), false);
  }
});

test('the event name is stable', () => {
  assert.equal(SESSION_EXPIRED_EVENT, 'sk-session-expired');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/auth/session-expired.test.ts`
Expected: FAIL — `Cannot find module './session-expired'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/auth/session-expired.ts`:

```typescript
/**
 * One-time re-login prompt for users who logged in before session cookies
 * existed. They hold `nostr_user` in localStorage but no cookie, so their
 * first authenticated request 401s.
 *
 * Event-driven, mirroring the Toast pattern in components/Toast.tsx, so this
 * module stays free of React and is unit-testable.
 */

export const SESSION_EXPIRED_EVENT = 'sk-session-expired';

let notified = false;

/**
 * Distinguishes "your Nostr session is stale" from every other 401 in the app
 * — admin routes 401 too, and prompting a Nostr re-login for those would be
 * wrong. Routes signal this case with `{ error: 'session_expired' }`.
 */
export function isSessionExpiredResponse(status: number, body: unknown): boolean {
  if (status !== 401) return false;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return (body as { error?: unknown }).error === 'session_expired';
}

/** Dispatch at most once per page load, so a burst of parallel 401s is one prompt. */
export function notifySessionExpired(): void {
  if (notified) return;
  if (typeof window === 'undefined') return;
  notified = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/** Test seam only. */
export function resetSessionExpiredNotice(): void {
  notified = false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/auth/session-expired.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Add the cheap probe endpoint**

In `lib/auth/require-user.ts`, change the top import line to include `NextResponse`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
```

and add at the end of the file:

```typescript
/** The 401 body the client recognises as "log in again". */
export function sessionExpiredResponse(): NextResponse {
  return NextResponse.json({ success: false, error: 'session_expired' }, { status: 401 });
}
```

Create `app/api/nostr/auth/session/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, sessionExpiredResponse } from '@/lib/auth/require-user';

/**
 * GET /api/nostr/auth/session
 *
 * Is this browser's session cookie valid? Nothing else.
 *
 * Deliberately separate from /api/nostr/auth/me, which opens relay
 * connections and fetches a kind-0 profile. This runs on every mount for a
 * signed-in user, so it must touch neither the database nor a relay — see the
 * profile-backfill note in CLAUDE.md for why that round-trip was removed from
 * the login path in the first place.
 */
export async function GET(request: NextRequest) {
  const userId = requireUser(request);
  if (!userId) return sessionExpiredResponse();
  return NextResponse.json({ success: true, userId });
}
```

Other routes keep their current behaviour when `requireUser` yields null — they fall through to the anonymous session path, which is correct.

- [ ] **Step 6: Wire the prompt in `NostrContext.tsx`**

Add the imports:

```typescript
import { SESSION_EXPIRED_EVENT, notifySessionExpired, isSessionExpiredResponse } from '@/lib/auth/session-expired';
```

Add an effect alongside the existing mount effects:

```typescript
  // Users who logged in before session cookies existed hold `nostr_user` in
  // localStorage but no cookie. Probe once on mount; if the session is stale,
  // clear it and let the normal logged-out UI prompt a fresh login. One signer
  // approval, once. There is deliberately no compatibility window: accepting
  // the legacy header for a grace period would leave the hole fully open for
  // its duration, since an attacker simply omits the cookie.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/nostr/auth/session');
        if (cancelled || res.ok) return;
        const body = await res.json().catch(() => null);
        if (isSessionExpiredResponse(res.status, body)) {
          notifySessionExpired();
          logout();
        }
      } catch {
        // Offline or a transient failure is not an expired session. Leave the
        // user signed in; the next load re-probes.
      }
    })();

    return () => { cancelled = true; };
  }, [user, logout]);

  useEffect(() => {
    const onExpired = () => {
      toast.info('Please sign in again — we upgraded how sessions are secured.', {
        duration: 8000,
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);
```

Import `toast` from `@/components/Toast` if `NostrContext.tsx` does not already import it.

- [ ] **Step 7: Verify it compiles and tests pass**

Run: `npx tsc --noEmit && npx tsx --test lib/auth/*.test.ts`
Expected: no new type errors; 25 tests pass across the three auth test files.

- [ ] **Step 8: Commit**

```bash
git add lib/auth/session-expired.ts lib/auth/session-expired.test.ts lib/auth/require-user.ts contexts/NostrContext.tsx app/api/nostr/auth/session/route.ts
git commit -m "feat(auth): prompt a one-time re-login for pre-cookie sessions

Probes a new cookie-only /api/nostr/auth/session on mount and clears the
stored session only on an explicit session_expired code, so admin 401s
and offline failures do not log anyone out. No compatibility window by
design.

The probe is a new endpoint rather than /api/nostr/auth/me because me
opens relay connections and fetches a kind-0 profile — the round-trip
CLAUDE.md records as deliberately removed from the login path."
```

---

### Task 7: Narrow CORS

`Access-Control-Allow-Origin: *` on every API route lets any origin read every response, and is incompatible with the cookie introduced in Task 3.

**Files:**
- Modify: `next.config.js:629-646` (the `/api/(.*)` headers block)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable.

- [ ] **Step 1: Replace the blanket API CORS block**

Replace the entire `{ source: '/api/(.*)', headers: [...] }` entry with:

```javascript
      {
        // The podping consumer (msp-podping-service) calls these four from
        // outside the browser and CLAUDE.md marks them intentionally public.
        // They carry no user data and no cookie, so a wildcard is correct here
        // and only here.
        source: '/api/feeds/:path(exists|refresh-by-url|opml)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/api/feeds',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
```

Every other `/api/*` route now sends no CORS headers at all, which is the correct default: the app itself is same-origin and needs none.

- [ ] **Step 2: Verify the podping endpoints still answer**

Run, with the dev server running:

```bash
curl -si 'http://localhost:3000/api/feeds/exists?url=https://example.com/feed.xml' | grep -i 'access-control-allow-origin'
```

Expected: `access-control-allow-origin: *`

- [ ] **Step 3: Verify a user route no longer sends a wildcard**

```bash
curl -si -X POST 'http://localhost:3000/api/favorites/check' \
  -H 'Content-Type: application/json' -d '{"trackIds":[],"feedIds":[]}' \
  | grep -i 'access-control-allow-origin' || echo "no CORS header — correct"
```

Expected: `no CORS header — correct`

- [ ] **Step 4: Commit**

```bash
git add next.config.js
git commit -m "fix(security): stop sending wildcard CORS on user API routes

Only the four podping-consumer endpoints keep a wildcard; they carry no
user data. Everything else is same-origin and needs no CORS at all."
```

---

### Task 8: Bound POST /api/favorites/check

Finding 4a. Unauthenticated, uncapped, and quadratic.

**Files:**
- Create: `lib/favorites-check-input.ts`
- Test: `lib/favorites-check-input.test.ts`
- Modify: `app/api/favorites/check/route.ts:27-28` (body destructure) and `:44-71` (the quadratic loop)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_CHECK_IDS: number` (2000)
  - `parseCheckIds(value: unknown): string[] | null` — null means invalid.
  - `buildTrackIdIndex(tracks: ReadonlyArray<{ id: string; guid: string | null; audioUrl: string | null }>): Map<string, { id: string; guid: string | null; audioUrl: string | null }>`

- [ ] **Step 1: Write the failing test**

Create `lib/favorites-check-input.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_CHECK_IDS, parseCheckIds, buildTrackIdIndex } from './favorites-check-input';

test('a normal array passes through', () => {
  assert.deepEqual(parseCheckIds(['a', 'b']), ['a', 'b']);
});

test('a missing value is an empty list, not an error', () => {
  // The route destructures with `= []`, and both arrays are optional.
  assert.deepEqual(parseCheckIds(undefined), []);
  assert.deepEqual(parseCheckIds(null), []);
});

test('a non-array is rejected', () => {
  // `{"trackIds":"abc"}` used to reach Prisma as { in: "abc" } via String.length.
  for (const bad of ['abc', 42, {}, true]) {
    assert.equal(parseCheckIds(bad), null);
  }
});

test('non-string entries are dropped', () => {
  assert.deepEqual(parseCheckIds(['a', 1, null, 'b', {}]), ['a', 'b']);
});

test('duplicates are collapsed', () => {
  assert.deepEqual(parseCheckIds(['a', 'a', 'b']), ['a', 'b']);
});

test('an over-cap array is rejected, never truncated', () => {
  // Truncating would answer "not favorited" for the dropped ids, which is
  // exactly the issue #190 symptom: a favorited album with an unfilled heart.
  const over = Array.from({ length: MAX_CHECK_IDS + 1 }, (_, i) => `id-${i}`);
  assert.equal(parseCheckIds(over), null);
});

test('an exactly-at-cap array is accepted', () => {
  const atCap = Array.from({ length: MAX_CHECK_IDS }, (_, i) => `id-${i}`);
  assert.equal(parseCheckIds(atCap)?.length, MAX_CHECK_IDS);
});

test('the index finds a track by every identifier it answers to', () => {
  const track = { id: 't1', guid: 'g1', audioUrl: 'https://x/a.mp3' };
  const index = buildTrackIdIndex([track]);
  assert.deepEqual(index.get('t1'), track);
  assert.deepEqual(index.get('g1'), track);
  assert.deepEqual(index.get('https://x/a.mp3'), track);
  assert.equal(index.get('nope'), undefined);
});

test('the index tolerates null guid and audioUrl', () => {
  const track = { id: 't1', guid: null, audioUrl: null };
  const index = buildTrackIdIndex([track]);
  assert.deepEqual(index.get('t1'), track);
  assert.equal(index.size, 1);
});

test('the index preserves first-match order on a collision', () => {
  // Matches the previous Array.find behaviour, so results cannot change.
  const first = { id: 'a', guid: 'shared', audioUrl: null };
  const second = { id: 'b', guid: 'shared', audioUrl: null };
  const index = buildTrackIdIndex([first, second]);
  assert.deepEqual(index.get('shared'), first);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/favorites-check-input.test.ts`
Expected: FAIL — `Cannot find module './favorites-check-input'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/favorites-check-input.ts`:

```typescript
/**
 * Input handling for POST /api/favorites/check.
 *
 * WHY: the route took `trackIds` and `feedIds` straight from the body with no
 * cap, no type check and no rate limit, and its tracks branch was quadratic
 * (`trackIds.forEach` wrapping `tracks.find`). Track ids are semi-public —
 * /api/albums-fast returns them — so 10k scraped ids meant ~100M comparisons
 * on the event loop from one request. The identity guard was
 * `if (!sessionId && !userId)`, and `x-session-id` is arbitrary caller text,
 * so no login was needed either.
 *
 * The Map below is the actual fix: it makes the branch linear. The cap is a
 * secondary guard that bounds the SQL IN clause.
 */

/**
 * Deliberately far above any real batch. BatchedFavoritesContext filters to
 * newly-seen ids via selectUnknownIds before sending, so genuine batches are
 * dozens — a long podcast's track list is the worst case and is nowhere near
 * this. No client-side chunking is needed, which keeps this change out of that
 * context's clobber-guard bookkeeping.
 */
export const MAX_CHECK_IDS = 2000;

/** Returns the cleaned id list, or null if the input is unusable. */
export function parseCheckIds(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_CHECK_IDS) return null;

  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && entry) seen.add(entry);
  }
  return [...seen];
}

interface TrackIdentifiers {
  id: string;
  guid: string | null;
  audioUrl: string | null;
}

/**
 * One lookup table from any identifier to its track, replacing a per-input
 * linear scan. First write wins, matching the previous Array.find semantics so
 * results are unchanged.
 */
export function buildTrackIdIndex<T extends TrackIdentifiers>(
  tracks: ReadonlyArray<T>
): Map<string, T> {
  const index = new Map<string, T>();
  for (const track of tracks) {
    for (const key of [track.id, track.guid, track.audioUrl]) {
      if (key && !index.has(key)) index.set(key, track);
    }
  }
  return index;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/favorites-check-input.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Wire it into the route**

In `app/api/favorites/check/route.ts`, add the import:

```typescript
import { MAX_CHECK_IDS, parseCheckIds, buildTrackIdIndex } from '@/lib/favorites-check-input';
```

Replace the body destructure:

```typescript
    const body = await request.json();
    const { trackIds = [], feedIds = [] } = body;
```

with:

```typescript
    const body = await request.json();
    const trackIds = parseCheckIds(body?.trackIds);
    const feedIds = parseCheckIds(body?.feedIds);

    if (trackIds === null || feedIds === null) {
      return NextResponse.json(
        {
          success: false,
          error: `trackIds and feedIds must be arrays of at most ${MAX_CHECK_IDS} strings`,
        },
        { status: 400 }
      );
    }
```

Then replace the quadratic block — the `const trackIdToAllIds = new Map...` loop through `trackIdToAllIds.set(inputId, possibleIds);` — with:

```typescript
        // One index instead of a linear scan per input. See
        // lib/favorites-check-input.ts for why this was a DoS.
        const trackIndex = buildTrackIdIndex(tracks);

        const trackIdToAllIds = new Map<string, string[]>();
        for (const inputId of trackIds) {
          const possibleIds = [inputId];
          const matchedTrack = trackIndex.get(inputId);
          if (matchedTrack) {
            if (matchedTrack.id && !possibleIds.includes(matchedTrack.id)) possibleIds.push(matchedTrack.id);
            if (matchedTrack.guid && !possibleIds.includes(matchedTrack.guid)) possibleIds.push(matchedTrack.guid);
            if (matchedTrack.audioUrl && !possibleIds.includes(matchedTrack.audioUrl)) possibleIds.push(matchedTrack.audioUrl);
          }
          trackIdToAllIds.set(inputId, possibleIds);
        }
```

- [ ] **Step 6: Verify behaviour end to end**

With the dev server running:

```bash
# over cap is rejected
python3 -c "import json;print(json.dumps({'trackIds':['id-%d'%i for i in range(2001)],'feedIds':[]}))" > /tmp/over.json
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/favorites/check \
  -H 'Content-Type: application/json' -H 'x-session-id: probe' --data @/tmp/over.json
# expected: 400

# a non-array is rejected
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/favorites/check \
  -H 'Content-Type: application/json' -H 'x-session-id: probe' -d '{"trackIds":"abc"}'
# expected: 400

# a normal request still works
curl -s -X POST localhost:3000/api/favorites/check \
  -H 'Content-Type: application/json' -H 'x-session-id: probe' \
  -d '{"trackIds":[],"feedIds":[]}'
# expected: {"success":true,...}
```

- [ ] **Step 7: Commit**

```bash
git add lib/favorites-check-input.ts lib/favorites-check-input.test.ts app/api/favorites/check/route.ts
git commit -m "fix(security): bound and linearize POST /api/favorites/check

The tracks branch was quadratic over caller-supplied ids with no cap and
no auth (x-session-id is arbitrary text), so scraped track ids from
/api/albums-fast made one request block the event loop. A Map removes
the quadratic; the cap bounds the SQL IN clause. Over-cap is rejected,
never truncated — truncation would answer 'not favorited' and re-create
the issue #190 symptom."
```

---

### Task 9: Fix the two SSRF routes

**Files:**
- Delete: `app/api/fetch-feed-metadata/route.ts`
- Modify: `app/api/gif-placeholder/route.ts`

**Interfaces:**
- Consumes: `isSafePublicUrl` from `lib/url-security`.
- Produces: nothing.

- [ ] **Step 1: Confirm the deletion is safe**

Run:

```bash
grep -rn "fetch-feed-metadata" app components lib contexts scripts 2>/dev/null | grep -v "^app/api/fetch-feed-metadata"
```

Expected: no output. If anything appears, stop and report rather than deleting.

- [ ] **Step 2: Delete the route**

```bash
git rm -r app/api/fetch-feed-metadata
```

- [ ] **Step 3: Guard `gif-placeholder`**

In `app/api/gif-placeholder/route.ts`, add the import:

```typescript
import { isSafePublicUrl } from '@/lib/url-security';
```

Immediately after the existing `if (url.protocol !== 'https:')` block, insert:

```typescript
    // The https + .gif checks above do not stop https://10.0.0.5/x.gif. Any
    // route that fetches a caller-supplied URL must go through this guard —
    // same rule /api/chapters, /api/proxy-image and /api/proxy-audio follow.
    if (!isSafePublicUrl(gifUrl)) {
      return NextResponse.json({
        success: false,
        error: 'URL not allowed'
      }, { status: 400 });
    }
```

- [ ] **Step 4: Verify the guard rejects private hosts**

With the dev server running:

```bash
for u in 'https://127.0.0.1/x.gif' 'https://10.0.0.5/x.gif' 'https://192.168.1.1/x.gif' 'https://metadata.internal/x.gif'; do
  printf '%s -> ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/api/gif-placeholder?url=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$u")"
done
# expected: 400 for all four

curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/fetch-feed-metadata?feedUrl=https://example.com/f.xml'
# expected: 404 — route deleted
```

- [ ] **Step 5: Commit**

```bash
git add -A app/api/gif-placeholder app/api/fetch-feed-metadata
git commit -m "fix(security): close two SSRF routes

fetch-feed-metadata fetched any caller-supplied URL and returned the
parsed body, with no allowlist, no protocol check and no guard — an
unauthenticated SSRF with response reflection. It had zero callers, so
it is deleted rather than hardened.

gif-placeholder checked https: and a .gif substring but not the host, so
https://10.0.0.5/x.gif was fetched. It is live (CDNImage), so it gets
isSafePublicUrl like the other proxy routes."
```

---

### Task 10: Security response headers

**Files:**
- Modify: `next.config.js:605-613` (`X-XSS-Protection`) and `:695-706` (the CSP block)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Replace `X-XSS-Protection`**

Change:

```javascript
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
```

to:

```javascript
          {
            // 0, not 1. The legacy auditor is deprecated everywhere and its
            // blocking mode was itself an XSS vector in older browsers. CSP
            // below is the real control.
            key: 'X-XSS-Protection',
            value: '0',
          },
```

- [ ] **Step 2: Replace the CSP with a report-only full policy**

Change the `Content-Security-Policy` entry in the performance-headers block to:

```javascript
          {
            // REPORT-ONLY FIRST, deliberately. A wrong script-src white-screens
            // the entire app, this repo has no preview environment, and
            // app/layout.tsx ships an inline <script> alongside Next's own
            // inline bootstrap. Watch the browser console for violations on
            // every major surface (home, album, favorites, admin, radio,
            // Now Playing, the login modal and a real boost) before switching
            // the key to 'Content-Security-Policy'.
            //
            // connect-src is copied verbatim from the previous enforcing
            // policy so no relay or wallet socket changes behaviour.
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "connect-src 'self' https: ws: wss: wss://localrelay.link:28443 wss://relay.nsec.app wss://nos.lol wss://relay.snort.social wss://nostr.oxtr.dev wss://relay.primal.net wss://theforest.nostr1.com wss://relay.damus.io",
            ].join('; '),
          },
```

- [ ] **Step 3: Verify the headers are served**

With the dev server running:

```bash
curl -sI http://localhost:3000/ | grep -iE 'x-xss-protection|content-security-policy'
```

Expected: `x-xss-protection: 0` and a `content-security-policy-report-only:` line containing `frame-ancestors 'none'`.

- [ ] **Step 4: Verify no violations on the main surfaces**

Load `http://localhost:3000/`, an album page, and `/favorites` in a browser with devtools open. Expected: no `Content Security Policy` violation messages. Record any that appear in the commit body rather than silently widening the policy.

- [ ] **Step 5: Commit**

```bash
git add next.config.js
git commit -m "fix(security): add a real CSP in report-only mode

The policy declared only connect-src, so it constrained outbound sockets
and nothing else. This adds default-src, script-src, object-src,
base-uri, form-action and frame-ancestors, with connect-src copied
verbatim so no relay or wallet socket changes.

Report-only until violations are confirmed clean: a wrong script-src
white-screens the app and there is no preview environment.

Also drops X-XSS-Protection to 0."
```

---

### Task 11: Stop leaking internal error text, and fix session ID generation

**Files:**
- Modify: `lib/session-utils.ts:8-18`
- Modify: the 22 route files returning `details: errorMessage`
- Test: `lib/session-utils.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: no signature change. `getSessionId()` keeps its exact contract.

- [ ] **Step 1: Write the failing test**

Create `lib/session-utils.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateSessionId } from './session-utils';

test('generates a v4-shaped uuid', () => {
  assert.match(
    generateSessionId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});

test('does not repeat across many draws', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(generateSessionId());
  assert.equal(seen.size, 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/session-utils.test.ts`
Expected: FAIL — `generateSessionId` is not exported.

- [ ] **Step 3: Replace the generator**

In `lib/session-utils.ts`, replace the private `generateUUID` with an exported, crypto-backed version:

```typescript
/**
 * Session IDs key anonymous favorites, so a guessable one exposes another
 * visitor's list. Math.random() is not a CSPRNG — this uses crypto.
 *
 * Exported for tests. The manual fallback exists because crypto.randomUUID is
 * unavailable in insecure contexts, and CLAUDE.md's phone-testing flow uses a
 * plain http://<lan-ip>:3000 origin.
 */
export function generateSessionId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (c?.randomUUID) return c.randomUUID();

  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error('No secure random source available for session ID generation');
}
```

Update the two call sites in the same file (`getSessionId`'s creation branch and its catch-block fallback) to call `generateSessionId()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/session-utils.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Stop returning raw error text**

Find every site:

```bash
grep -rn "details: errorMessage\|details: String(err" app/api --include=route.ts
```

In each, remove the `details` field from the response body and log it instead. The pattern:

```typescript
    console.error('<existing context string>', error);
    return NextResponse.json(
      { success: false, error: '<existing generic message>' },
      { status: 500 }
    );
```

Leave untouched the sites already gated on `process.env.NODE_ENV === 'development'` — those are correct.

- [ ] **Step 6: Verify none remain ungated**

Run:

```bash
grep -rn "details:" app/api --include=route.ts | grep -v "NODE_ENV === 'development'"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add lib/session-utils.ts lib/session-utils.test.ts app/api
git commit -m "fix(security): crypto-random session IDs, stop leaking error text

Session IDs keyed anonymous favorites and came from Math.random(), so
another visitor's list was guessable. 22 routes returned raw Prisma and
driver messages to the client; those now log server-side and return a
generic message."
```

---

### Task 12: Gate the test pages, add typecheck and CI

**Files:**
- Modify: `app/test-amber/page.tsx`
- Modify: `app/sandbox/album/page.tsx`
- Modify: `package.json` (scripts)
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run typecheck` and `npm run test:all`.

- [ ] **Step 1: Gate both pages to non-production**

At the top of the default export component in `app/test-amber/page.tsx`, and again in `app/sandbox/album/page.tsx`, add:

```typescript
import { notFound } from 'next/navigation';
```

and as the first statement of the component body:

```typescript
  // Dev harness. Kept rather than deleted: /sandbox/album renders the real
  // AlbumDetailClient and is named in lib/album-detail-routes.ts and its test,
  // and the puppeteer verification recipes in CLAUDE.md run against
  // `npm run dev`, where this gate is inactive.
  if (process.env.NODE_ENV === 'production') notFound();
```

- [ ] **Step 2: Verify the route-matching test still passes**

Run: `npx tsx --test lib/album-detail-routes.test.ts`
Expected: PASS. The predicate is a pure string check and must be unaffected.

- [ ] **Step 3: Add the scripts**

In `package.json`, add to `scripts`:

```json
    "typecheck": "tsc --noEmit",
    "test:all": "tsx --test lib/*.test.ts lib/*/*.test.ts",
```

- [ ] **Step 4: Measure the lint backlog**

Run: `npx next lint 2>&1 | tail -5`

Record the error count in the commit body. **Only** remove `--no-lint` from the `build` script if that count is zero. A failing lint gate would block deploys, and deploys are this repo's only path to production. If it is non-zero, leave `build` alone and note the number.

- [ ] **Step 5: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      # --ignore-scripts skips this repo's postinstall, which runs check-env
      # and dev-setup and is meant for a developer's machine, not CI.
      - run: npm ci --ignore-scripts
      # Prisma Client must exist before tsc; lib/ imports its generated types,
      # and postinstall would normally have generated it.
      - run: npx prisma generate
      - run: npm run typecheck
      - run: npm run test:all
```

- [ ] **Step 6: Verify locally**

Stop the dev server first, then run:

```bash
npm run typecheck && npm run test:all
```

Expected: typecheck clean, all suites pass. If `typecheck` reports pre-existing errors unrelated to this branch, fix them if trivial; otherwise report the list rather than committing a workflow that fails on arrival.

- [ ] **Step 7: Commit**

```bash
git add app/test-amber/page.tsx app/sandbox/album/page.tsx package.json .github/workflows/ci.yml
git commit -m "chore: gate dev pages in prod, add typecheck and CI

Neither lint nor tsc has ever run in this repo — build passes --no-lint
and no workflow checks either, so type errors surfaced only as Railway
build failures. CI now runs typecheck plus the existing node:test suites.

/test-amber and /sandbox/album return 404 in production and stay fully
usable in dev, where the puppeteer recipes run."
```

---

### Task 13: Full verification

No code changes. This is the gate before the branch is offered for merge.

- [ ] **Step 1: Run the entire test suite**

```bash
npx tsx --test lib/*.test.ts lib/*/*.test.ts
npm run test:downloads
```

Expected: all pass. Compare against the pre-change baseline captured on `main`.

- [ ] **Step 2: Build**

Stop `npm run dev` first — both write `.next`.

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Clean up the build artifacts**

```bash
rm -f public/sw.js public/workbox-*.js
```

These are gitignored, and leaving them makes any LAN phone testing serve stale content.

- [ ] **Step 4: Manual smoke test**

> Dev is pointed at production. Sign in as **your own account** and favorite
> or unfavorite **your own** items only. This is ordinary app usage against
> live data, which is fine; acting on another user's rows is not.

Restart dev, then confirm each by hand:

1. Logged out: home grid loads, an album page plays, favoriting works anonymously.
2. Log in with a signer: favorites migrate, the heart fills, `/favorites` lists them.
3. `document.cookie` in devtools does **not** show `sk_session` (it is httpOnly).
4. Unfavorite works and the heart clears.
5. Log out: the cookie is gone and `/favorites` shows the anonymous list.

- [ ] **Step 5: Confirm the vulnerability is closed — READ-ONLY**

> **`npm run dev` talks to PRODUCTION on this machine.** `.env.local` sets
> `DATABASE_URL` to `shuttle.proxy.rlwy.net` (Railway) and Next.js loads
> `.env.local` for dev. `.env` points at localhost but only the Prisma CLI
> reads it. So `http://localhost:3000` is a local server over **live data**.
>
> **Never verify this fix by calling a DELETE endpoint.** Favorites rows are
> the only copy — that is why `SHARED_FAVORITES_APPLY_DELETES` ships off.

Use the `GET` handler on the same route instead. It counts through the same
`requireUser` call the `DELETE` does, so it proves whether the legacy header
still carries authority while writing nothing.

With `SESSION_SECRET` set in `.env.local` and the dev server restarted:

```bash
# Pick any real user id (it is a hex pubkey) WITHOUT mutating anything:
npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.favoriteAlbum.groupBy({by:['userId'],_count:{_all:true},where:{userId:{not:null}},take:1}).then(r=>{console.log(r);process.exit(0)})"

# The header must no longer resolve that user:
curl -s 'http://localhost:3000/api/favorites/delete-all?type=nostr' \
  -H 'x-nostr-user-id: <that user id>' | python3 -m json.tool
```

Expected: `counts.nostr.total` is **0** and `hasNostrUser` is **false** — the
header was ignored. If it returns that user's real count, `SESSION_SECRET` is
not loaded and `requireUser` is still failing open.

Then confirm the positive case, that a real session still works: sign in
through the UI and load `/favorites`. Your own favorites must appear.

- [ ] **Step 5b: Optional — run the destructive check safely on a local DB**

Only if you want the `DELETE` path exercised directly. Point dev at the local
database for one run, so no production row is reachable:

```bash
mv .env.local .env.local.bak
cp .env .env.local                       # localhost:5432
# re-add SESSION_SECRET and any other keys dev needs to .env.local
npm run dev
# ... run the DELETE probe against seeded local data ...
mv .env.local.bak .env.local             # RESTORE — do not skip
```

Restore `.env.local` before doing anything else. Leaving the local copy in
place makes every later dev session silently read an empty database, which
looks like data loss.

- [ ] **Step 6: Commit any fixes and push the branch**

```bash
git push -u origin security-audit-2026-08
```

Do **not** merge to `main` — merging deploys. Confirm `SESSION_SECRET` is set in Railway first.

---

## Deploy sequence

Not optional, and in this order:

1. **Set `SESSION_SECRET` in Railway** (a long random string, e.g. `openssl rand -base64 48`). The fix is inert without it — `requireUser` fails open by design.
2. Merge and deploy. Signed-in users are prompted to log in once.
3. Watch the browser console for CSP violations across the main surfaces, then flip `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in a follow-up.

## Deferred, with reasons

- **Finding 11 — 1,355 `console.log` calls.** A wide diff through files this audit is otherwise staying out of. Worth its own pass, ideally routed through the existing `lib/monitoring.ts`.
- **Finding 12 — unbounded `findMany` on `sync-shared` and `tracks`.** These read a user's own rows and are not attacker-amplifiable. Correct at current volumes.
