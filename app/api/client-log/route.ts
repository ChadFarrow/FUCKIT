import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter, clientIp } from '@/lib/rate-limit';
import { persistClientReport } from '@/lib/admin/client-error-store';

/**
 * Sink for client-side error/warning reports (lib/monitoring.ts).
 *
 * Everything here ends up as a Railway log line and nothing else — no database, no
 * retention story, no schema. That is the whole design: the question being answered
 * is "what is breaking out there", and a greppable line answers it.
 *
 * Deliberately unauthenticated. The reports worth having come from sessions that are
 * broken, often signed out, sometimes mid-failure — requiring auth would filter out
 * exactly the population being diagnosed. Abuse is bounded by the rate limit below
 * plus the hard caps on batch size and field lengths, and nothing here is trusted:
 * every field is coerced and truncated before it reaches a log line.
 */

// Same shape as the refresh-by-url limiter: in-memory, so per Railway instance.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
// Shared limiter (lib/rate-limit.ts). This route's own copy was the one that
// swept expired entries correctly; that behaviour is what the shared class took.
const limiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
const isRateLimited = (ip: string) => limiter.isLimited(ip);

/**
 * Worst case is MAX_ENTRIES * RATE_LIMIT_MAX log lines per minute per IP per instance.
 * At 50 that was 1,500 — enough to bury the Railway log this endpoint exists to make
 * readable, which is the same failure this app has already had twice from
 * /api/proxy-image. Every bit of collapsing otherwise lives on the client, and a
 * hostile caller runs no client, so the cap and the dedupe below are the only real
 * bound. Keep in sync with MAX_QUEUE in lib/client-log.ts.
 */
const MAX_ENTRIES = 20;
const MAX_MESSAGE = 300;
const MAX_CATEGORY = 60;
const MAX_DATA = 800;
const MAX_CONTEXT_FIELD = 200;

/**
 * Per-entry cap on the caller-supplied `count`. lib/client-log.ts's own throttle
 * (MAX_PER_MESSAGE=3 distinct enqueues, but unbounded in-place bumps within one
 * THROTTLE_WINDOW_MS=60s window) means a wedged client can in principle report a huge
 * count for one message — but anything above ~10,000 in a 60s window isn't a real
 * occurrence count from a browser tab, it's a caller doing something adversarial.
 * Lowered from 100,000: at MAX_ENTRIES(20) * RATE_LIMIT_MAX(30/min), entries collapsing
 * to one key could sum past int4 max (2,147,483,647) in ~36 minutes at the old cap,
 * and `count: { increment }` overflowing throws Postgres 22003 — see persistClientReport
 * (lib/admin/client-error-store.ts) for the saturating-update fix that makes
 * overflow impossible regardless of this cap.
 */
const MAX_COUNT_PER_ENTRY = 10_000;

function clamp(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  // A NUL byte makes the upsert fail with Postgres 22021 ("invalid byte sequence"),
  // caught and swallowed below — the report just silently vanishes. Strip it rather
  // than let that happen.
  return value.replace(/\0/g, '').slice(0, max);
}

function formatData(data: unknown): string {
  if (data === undefined || data === null) return '';
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    return json ? ` | ${json.slice(0, MAX_DATA)}` : '';
  } catch {
    return ' | [unserializable]';
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(clientIp(req.headers))) {
      return new NextResponse(null, { status: 429 });
    }

    const body = await req.json();
    const allEntries = Array.isArray(body?.entries) ? body.entries : [];
    const rawEntries = allEntries.slice(0, MAX_ENTRIES);
    if (rawEntries.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const path = clamp(body?.context?.path, MAX_CONTEXT_FIELD, 'unknown');
    const platform = clamp(body?.context?.platform, MAX_CONTEXT_FIELD, 'unknown');
    const display = clamp(body?.context?.display, 40, 'unknown');
    const dropped = Number(body?.dropped) || 0;

    // Collapse repeats within the batch. A cooperating client already did this, so
    // this is here for the one that doesn't: without it a caller can hand over
    // MAX_ENTRIES copies of one message and get MAX_ENTRIES log lines for it.
    const collapsed = new Map<string, { level: string; category: string; message: string; count: number; data: unknown }>();

    for (const raw of rawEntries) {
      const level = raw?.level === 'error' ? 'error' : 'warn';
      const category = clamp(raw?.category, MAX_CATEGORY, 'uncategorized');
      const message = clamp(raw?.message, MAX_MESSAGE, 'no message');
      const count = Math.max(1, Math.min(Number(raw?.count) || 1, MAX_COUNT_PER_ENTRY));

      const key = `${level}:${category}:${message}`;
      const existing = collapsed.get(key);

      if (existing) {
        existing.count += count;
      } else {
        // First occurrence keeps its data — later ones would only differ in detail.
        collapsed.set(key, { level, category, message, count, data: raw?.data });
      }
    }

    collapsed.forEach(({ level, category, message, count, data }) => {
      const repeat = count > 1 ? ` (x${count})` : '';

      const line =
        `🖥️ [client ${level} ${category}] ${message}${repeat}` +
        ` | path=${path} | ${platform} | display=${display}${formatData(data)}`;

      if (level === 'error') {
        console.error(line);
      } else {
        console.warn(line);
      }
    });

    // Fire-and-forget: reporting must never become its own outage, so the response does
    // not wait on this. Persisted as ONE detached task that awaits each write
    // sequentially — not fanned out concurrently — so a single request holds at most one
    // connection-pool slot (lib/prisma.ts caps the pool at 3 outside development) instead
    // of up to MAX_ENTRIES at once. persistClientReport catches internally and never
    // throws, so this can't produce an unhandled rejection.
    void (async () => {
      for (const { level, category, message, count, data } of collapsed.values()) {
        await persistClientReport({ level, category, message, count, data, path, platform });
      }
    })();

    // Suppressed occurrences are themselves a signal — a client dropping reports is
    // a client failing hard enough to hit the throttle. Entries cut by MAX_ENTRIES are
    // counted here too rather than vanishing: a silent cap reads as full coverage.
    const truncated = allEntries.length - rawEntries.length;
    if (dropped > 0 || truncated > 0) {
      console.warn(
        `🖥️ [client warn throttled] ${dropped} report(s) suppressed` +
        (truncated > 0 ? `, ${truncated} over the ${MAX_ENTRIES}-entry batch cap` : '') +
        ` | path=${path} | ${platform}`
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error handling client log:', error);
    // Never surface a failure to the client — reporting must not become its own bug.
    return new NextResponse(null, { status: 204 });
  }
}
