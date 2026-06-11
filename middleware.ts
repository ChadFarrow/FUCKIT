import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkAdminAuth } from '@/lib/admin-auth';

// Decide whether an API request must present the admin bearer secret.
// Keep in sync with the matcher below. Intentionally PUBLIC (podping
// consumer, see CLAUDE.md): GET /api/feeds/exists, POST /api/feeds/refresh-by-url,
// POST /api/feeds, GET /api/feeds/opml.
function requiresAdminAuth(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  const method = request.method.toUpperCase();

  // CORS preflight always passes.
  if (method === 'OPTIONS') return false;

  if (pathname.startsWith('/api/admin/')) {
    // npub-whitelist login check used by AdminPanel before it has the secret.
    return pathname !== '/api/admin/verify';
  }

  // GET (list) and POST (podping consumer mints feeds) stay public.
  if (pathname === '/api/feeds') {
    return method === 'PUT' || method === 'DELETE';
  }

  if (pathname === '/api/tracks') {
    return method === 'DELETE';
  }

  // Expensive maintenance endpoints — only callers are the nightly workflows
  // and the admin panel.
  if (pathname === '/api/parse-feeds' || pathname === '/api/playlist-cache') {
    return true;
  }

  if (
    pathname === '/api/playlist/parse-feeds' ||
    pathname === '/api/playlist/parse-feeds-stream'
  ) {
    return true;
  }

  // Public playlist reads stay open; only the expensive ?refresh=true variant
  // is gated (the public app never sends it — if a future client feature adds
  // refresh=true, it will 401 once ADMIN_SECRET is set).
  if (pathname.startsWith('/api/playlist/')) {
    return searchParams.get('refresh') === 'true';
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (requiresAdminAuth(request)) {
      const denied = checkAdminAuth(request);
      if (denied) return denied;
    }
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  // Get hostname from headers (Vercel uses x-forwarded-host)
  const hostname = request.headers.get('x-forwarded-host')
    || request.headers.get('host')
    || '';

  // Check if this is the radio subdomain
  // Match: radio.stablekraft.app, radio.localhost, radio.localhost:3000
  const isRadioSubdomain = hostname.startsWith('radio.');

  if (isRadioSubdomain) {
    // Rewrite all radio subdomain requests to /radio route
    // This keeps the URL as radio.stablekraft.app but serves /radio page
    url.pathname = '/radio';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files, api routes, and Next.js internals
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|stablekraft-rocket.png|app-icon-new.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.webp|.*\\.ico|.*\\.js|.*\\.css).*)',
    // Admin-auth-gated API surfaces (requiresAdminAuth decides per method/query)
    '/api/admin/:path*',
    '/api/feeds',
    '/api/tracks',
    '/api/parse-feeds',
    '/api/playlist-cache',
    '/api/playlist/:path*',
  ],
};
