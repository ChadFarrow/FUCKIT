'use client';

const STORAGE_KEY = 'admin_secret';

/**
 * fetch() wrapper for admin-gated API calls. Attaches the admin bearer secret
 * from localStorage; on a 401, prompts once for the secret, stores it, and
 * retries. While ADMIN_SECRET is unset on the server (fail-open), requests
 * succeed with or without a stored secret.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const doFetch = (secret: string | null) =>
    fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
    });

  let secret: string | null = null;
  try {
    secret = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (SSR/private mode) — proceed without secret
  }

  let res = await doFetch(secret);
  if (res.status === 401 && typeof window !== 'undefined') {
    const entered = window.prompt('Admin secret required:');
    if (entered) {
      try {
        localStorage.setItem(STORAGE_KEY, entered);
      } catch {
        // Storage failed — still retry with the entered secret this once
      }
      res = await doFetch(entered);
    }
  }
  return res;
}
