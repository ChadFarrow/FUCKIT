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
