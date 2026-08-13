/**
 * Session utilities for anonymous favorites system
 * Generates and retrieves session IDs from localStorage
 */

const SESSION_ID_KEY = 'favorites-session-id';

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

/**
 * Get or create session ID from localStorage
 * Returns existing session ID if present, otherwise generates and stores a new one
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: return empty string or generate a temporary ID
    return '';
  }

  try {
    let sessionId = localStorage.getItem(SESSION_ID_KEY);
    
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    return sessionId;
  } catch (error) {
    console.error('Error getting session ID from localStorage:', error);
    // Fallback: generate a temporary session ID
    return generateSessionId();
  }
}

/**
 * Get session ID without creating one if it doesn't exist
 * Useful for checking if a session exists
 */
export function getSessionIdIfExists(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch (error) {
    console.error('Error reading session ID from localStorage:', error);
    return null;
  }
}

/**
 * Clear session ID from localStorage
 * Note: This will cause favorites to be associated with a new session
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(SESSION_ID_KEY);
  } catch (error) {
    console.error('Error clearing session ID from localStorage:', error);
  }
}

/**
 * Get session ID from request headers or cookies
 * For use in API routes
 */
export function getSessionIdFromRequest(request: Request): string | null {
  // Try to get from header first
  const headerSessionId = request.headers.get('x-session-id');
  if (headerSessionId) {
    return headerSessionId;
  }

  // Try to get from cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies[SESSION_ID_KEY] || null;
  }

  return null;
}

