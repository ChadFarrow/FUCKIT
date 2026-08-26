import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { issueChallenge } from '@/lib/auth/challenge';

let warnedNoSecret = false;

/**
 * POST /api/nostr/auth/challenge
 * Generate a challenge for Nostr authentication.
 *
 * The challenge is HMAC-signed with SESSION_SECRET so `/api/nostr/auth/login`
 * can prove this server issued it, and when. It used to be 32 raw random bytes
 * that nothing recorded, which meant login could not tell a fresh challenge
 * from one captured months ago — see lib/auth/challenge.ts.
 *
 * The client treats this as an opaque string and echoes it back, so the change
 * is invisible to both login paths (lib/nostr/auth-utils.ts and
 * components/Nostr/LoginModal.tsx).
 */
export async function POST(_request: NextRequest) {
  try {
    const nonce = randomBytes(32).toString('hex');
    const secret = process.env.SESSION_SECRET;

    if (!secret) {
      // FAIL-OPEN, matching lib/auth/require-user.ts and lib/admin-auth.ts:
      // a deploy must not lock everyone out before the env var is set. The
      // cost is that replay protection stays off until it is.
      if (!warnedNoSecret) {
        console.warn(
          '⚠️ SESSION_SECRET is not set — login challenges are unsigned, so a ' +
            'captured login request can be replayed indefinitely. Set it in Railway.'
        );
        warnedNoSecret = true;
      }
      return NextResponse.json({
        success: true,
        challenge: nonce,
        message: 'Challenge generated',
      });
    }

    return NextResponse.json({
      success: true,
      challenge: issueChallenge(nonce, secret, Date.now()),
      message: 'Challenge generated',
    });
  } catch (error) {
    console.error('Challenge generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate challenge',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
