import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

let warnedNoSecret = false;

// Constant-time string compare (edge runtime has no crypto.timingSafeEqual).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Bearer-secret check for admin/destructive endpoints, called from middleware.
 * Returns null when authorized, or a 401 response.
 *
 * FAIL-OPEN by design when ADMIN_SECRET is unset: a deploy must not lock out
 * the nightly crons or the admin panel before the Railway env var and the
 * GitHub Actions secret are configured. Set both to activate enforcement.
 */
export function checkAdminAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    if (!warnedNoSecret) {
      console.warn(
        '⚠️ ADMIN_SECRET is not set — admin endpoints are UNPROTECTED. ' +
          'Set it in Railway (and as a GitHub Actions secret) to enable auth.'
      );
      warnedNoSecret = true;
    }
    return null;
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token && safeEqual(token, secret)) {
    return null;
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
