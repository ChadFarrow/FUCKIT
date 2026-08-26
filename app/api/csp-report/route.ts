import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter, clientIp } from '@/lib/rate-limit';
import { persistClientReport } from '@/lib/admin/client-error-store';
import { parseCspReport, violationKey, CSP_CATEGORY } from '@/lib/csp-report';

/**
 * Sink for CSP violation reports (`report-uri` in next.config.js).
 *
 * The policy has shipped as `Content-Security-Policy-Report-Only` since the
 * security audit, with the intention that someone would watch for violations
 * before promoting it to enforcing. Nothing was ever watching: there was no
 * `report-uri`, so violations went only to each user's own browser console. This
 * endpoint is what turns "watch the console on eight surfaces by hand" into data
 * on the /admin diagnostics panel.
 *
 * Reports land in `ClientErrorReport` under category `csp`, reusing the table
 * `/api/client-log` already writes to — deliberately, because a new table means a
 * migration, and Railway does not run migrations on deploy (issue #122).
 *
 * Deliberately unauthenticated, for the same reason `/api/client-log` is: the
 * browser posts these itself, with no session and no way to attach one.
 */

// --- Volume control -----------------------------------------------------------
//
// This endpoint is far more exposed than /api/client-log. That one is fed by
// lib/client-log.ts, which throttles on the client before sending. Nothing
// throttles this: the BROWSER posts a report every time the policy fires, so one
// wrong directive on the homepage is one POST per page load per user, forever.
// This repo has already had two Railway log-flood incidents, so the caps below
// are the whole safety story.

const RATE_LIMIT_WINDOW_MS = 60_000;
/** Lower than client-log's 30: a browser sending more than this is a policy bug we already know about. */
const RATE_LIMIT_MAX = 10;
const limiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
const isRateLimited = (ip: string) => limiter.isLimited(ip);

/** A Reporting API batch can carry many; more than this from one POST is not diagnostic. */
const MAX_VIOLATIONS_PER_REQUEST = 10;

/** Bodies larger than this are not CSP reports. Read as text first so we can bound it. */
const MAX_BODY_BYTES = 16_000;

/**
 * Per-process log throttle, keyed by violation.
 *
 * Persisting is already collapsed by the daily upsert bucket, but the Railway log
 * line is not — and the log is the thing that floods. One line per distinct
 * violation per window is enough to notice it; the count in the panel is where
 * magnitude lives.
 */
const LOG_WINDOW_MS = 60_000;
const loggedRecently = new Map<string, number>();


function shouldLog(key: string): boolean {
  const now = Date.now();
  const last = loggedRecently.get(key);
  if (last !== undefined && now - last < LOG_WINDOW_MS) return false;

  loggedRecently.set(key, now);
  if (loggedRecently.size > 2000) {
    loggedRecently.forEach((ts, k) => {
      if (now - ts >= LOG_WINDOW_MS) loggedRecently.delete(k);
    });
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(clientIp(req.headers))) {
      return new NextResponse(null, { status: 429 });
    }

    // Browsers send `application/csp-report` or `application/reports+json`, neither
    // of which is `application/json` — read as text and parse ourselves rather than
    // depending on how the framework treats an unfamiliar content type.
    const text = await req.text();
    if (!text || text.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const violations = parseCspReport(body).slice(0, MAX_VIOLATIONS_PER_REQUEST);
    if (violations.length === 0) {
      // Nothing to record: junk body, or every entry was extension noise.
      return new NextResponse(null, { status: 204 });
    }

    // Collapse within the request so one batch of the same violation is one row.
    const collapsed = new Map<string, { message: string; path: string; count: number }>();
    for (const v of violations) {
      const message = violationKey(v);
      const existing = collapsed.get(message);
      if (existing) existing.count += 1;
      else collapsed.set(message, { message, path: v.documentPath, count: 1 });
    }

    const platform = (req.headers.get('user-agent') || 'unknown').slice(0, 200);

    collapsed.forEach(({ message, path, count }) => {
      if (shouldLog(message)) {
        const repeat = count > 1 ? ` (x${count})` : '';
        // 'warn', not 'error': while the policy is report-only nothing is actually
        // broken for the user, and logging it as an error would make a policy that
        // needs tuning look like an outage.
        console.warn(`🛡️ [csp] ${message}${repeat} | path=${path}`);
      }
    });

    // Fire-and-forget, awaited sequentially: one request holds at most one
    // connection-pool slot (lib/prisma.ts caps the pool at 3 outside development).
    // persistClientReport catches internally and never throws.
    void (async () => {
      for (const { message, path, count } of collapsed.values()) {
        await persistClientReport({
          level: 'warn',
          category: CSP_CATEGORY,
          message,
          count,
          data: null,
          path,
          platform,
        });
      }
    })();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error handling CSP report:', error);
    // Never surface a failure to the browser — reporting must not become its own bug.
    return new NextResponse(null, { status: 204 });
  }
}
