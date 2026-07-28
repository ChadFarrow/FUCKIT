import { NextRequest, NextResponse } from 'next/server';

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
const rateLimits = new Map<string, { count: number; windowStart: number }>();

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

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimits.get(ip);

  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });

    // Opportunistic sweep — without it the map is a slow leak across an instance's life.
    if (rateLimits.size > 5000) {
      rateLimits.forEach((value, key) => {
        if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(key);
      });
    }

    return false;
  }

  existing.count += 1;
  return existing.count > RATE_LIMIT_MAX;
}

function clamp(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, max);
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
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (isRateLimited(ip)) {
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
      const count = Math.max(1, Math.min(Number(raw?.count) || 1, 100_000));

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
