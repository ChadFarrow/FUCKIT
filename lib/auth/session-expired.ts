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
