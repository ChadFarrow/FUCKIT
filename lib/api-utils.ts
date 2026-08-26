/**
 * One in-memory helper used by the API routes: `ApiCache`.
 *
 * This file used to also export `createApiHandler`, `validators`,
 * `transformers`, `createCorsHeaders`, `requestUtils` and `responseUtils` —
 * roughly 200 lines with no callers anywhere in the repo. `createApiHandler`
 * was worth removing on its own rather than leaving as dead weight: it logged
 * `Object.fromEntries(req.headers.entries())` on every request, so anything
 * that had started using it would have written the session cookie and the
 * ADMIN_SECRET bearer token straight into the Railway logs.
 *
 * Its `RateLimiter` is gone too, and is NOT to be re-added here: `lib/rate-limit.ts`
 * is the one limiter now. The copy that lived here never evicted expired
 * entries, so its Map grew for the life of the instance.
 */

// Cache utility
export class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = 5 * 60 * 1000) { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const record = this.cache.get(key);
    if (!record) return null;
    
    if (Date.now() - record.timestamp > record.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return record.data;
  }
  
  delete(key: string) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
}
