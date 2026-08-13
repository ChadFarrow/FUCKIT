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
