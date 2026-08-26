/**
 * One in-memory rate limiter, replacing four hand-rolled copies.
 *
 * The copies had drifted in the way that matters: the one in `lib/api-utils.ts`
 * never evicted expired entries, so its Map grew for the life of the instance —
 * an unbounded allocation keyed by whatever an anonymous caller put in a header.
 * `app/api/client-log/route.ts` did sweep. This module takes the sweeping one.
 *
 * All four also read the client IP as `x-forwarded-for.split(',')[0]`, which is
 * the value the CLIENT sent — a caller can put anything there and get a fresh
 * bucket per request, which makes the limit decorative. See `clientIp` below.
 *
 * In-memory means PER INSTANCE. That is deliberate and unchanged: these limits
 * are an abuse ceiling, not a quota, and a shared store would put a network hop
 * in front of every request to endpoints that exist to be cheap.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    /** Sweep expired entries once the map passes this size. */
    private readonly sweepThreshold = 5000
  ) {}

  check(identifier: string, nowMs: number = Date.now()): RateLimitResult {
    const existing = this.buckets.get(identifier);

    if (!existing || nowMs - existing.windowStart >= this.windowMs) {
      this.buckets.set(identifier, { count: 1, windowStart: nowMs });
      this.sweep(nowMs);
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: nowMs + this.windowMs,
      };
    }

    existing.count += 1;
    const resetAt = existing.windowStart + this.windowMs;
    return {
      allowed: existing.count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - existing.count),
      resetAt,
    };
  }

  /** `check` reduced to a boolean, for call sites that want nothing else. */
  isLimited(identifier: string, nowMs: number = Date.now()): boolean {
    return !this.check(identifier, nowMs).allowed;
  }

  /** Entries currently held. Exposed for tests. */
  get size(): number {
    return this.buckets.size;
  }

  reset(): void {
    this.buckets.clear();
  }

  private sweep(nowMs: number): void {
    if (this.buckets.size <= this.sweepThreshold) return;
    for (const [key, bucket] of this.buckets) {
      if (nowMs - bucket.windowStart >= this.windowMs) this.buckets.delete(key);
    }
  }
}

/**
 * The caller's IP, as far as it can be trusted.
 *
 * `x-forwarded-for` is a comma-separated chain, appended to by each proxy:
 * `<client>, <proxy1>, <proxy2>`. The LEFTMOST entry is whatever the client
 * sent — it is client-controlled, so keying a limit on it lets one caller mint
 * unlimited buckets by varying the header. The RIGHTMOST entry is the one
 * written by the proxy closest to us, which the client cannot forge.
 *
 * This assumes exactly one trusted proxy in front of the app (Railway's edge).
 * If a second is ever added, take the second-from-last instead.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Headers describing a refusal, for a 429 response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'Retry-After': Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)).toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
  };
}
