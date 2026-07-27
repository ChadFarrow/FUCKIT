/**
 * Buffering and throttling for client-side error/warning reports.
 *
 * Kept pure and transport-free so it is unit-testable without a browser — the
 * fetch/sendBeacon side lives in lib/monitoring.ts.
 *
 * Throttling is not an optimisation, it is the thing that makes this safe to ship.
 * The failures worth reporting are exactly the ones that repeat: a retry loop, a
 * stalling element, a track that fails on every attempt. Reporting each occurrence
 * would let one wedged client flood the logs it is supposed to be diagnosable from.
 * So identical messages collapse into one entry carrying a `count`, which is more
 * informative than N copies anyway — "failed 40 times in a minute" is the signal.
 */

export type ClientLogLevel = 'error' | 'warn';

export interface ClientLogEntry {
  level: ClientLogLevel;
  category: string;
  message: string;
  data?: unknown;
  /** Occurrences collapsed into this entry, including the first. */
  count: number;
}

/** Dropped past this many distinct pending entries — a wedged client can't grow unbounded. */
export const MAX_QUEUE = 50;
/** Identical messages beyond this within the window are counted, not queued again. */
export const MAX_PER_MESSAGE = 3;
export const THROTTLE_WINDOW_MS = 60_000;

interface Seen {
  windowStart: number;
  count: number;
  /** Index into the pending array, so repeats update the entry already queued. */
  queuedAt: number | null;
}

export class ClientLogBuffer {
  private pending: ClientLogEntry[] = [];
  private seen = new Map<string, Seen>();
  private dropped = 0;

  /**
   * Records an entry. Returns true when the caller should schedule a flush —
   * false when the entry was collapsed into one already queued, or dropped.
   */
  add(entry: Omit<ClientLogEntry, 'count'>, now: number): boolean {
    const key = `${entry.level}:${entry.category}:${entry.message}`;
    const seen = this.seen.get(key);

    if (!seen || now - seen.windowStart >= THROTTLE_WINDOW_MS) {
      this.seen.set(key, { windowStart: now, count: 1, queuedAt: null });
      return this.enqueue(key, entry);
    }

    seen.count += 1;

    // Already queued in this window: bump its count in place rather than queue again.
    if (seen.queuedAt !== null && this.pending[seen.queuedAt]) {
      this.pending[seen.queuedAt].count = seen.count;
      return false;
    }

    if (seen.count > MAX_PER_MESSAGE) {
      this.dropped += 1;
      return false;
    }

    return this.enqueue(key, entry);
  }

  private enqueue(key: string, entry: Omit<ClientLogEntry, 'count'>): boolean {
    if (this.pending.length >= MAX_QUEUE) {
      this.dropped += 1;
      return false;
    }

    const seen = this.seen.get(key);
    if (seen) seen.queuedAt = this.pending.length;

    this.pending.push({ ...entry, count: seen?.count ?? 1 });
    return true;
  }

  /** Returns everything pending and clears it. Throttle state deliberately survives. */
  drain(): { entries: ClientLogEntry[]; dropped: number } {
    const entries = this.pending;
    const dropped = this.dropped;

    this.pending = [];
    this.dropped = 0;
    // Queue positions no longer refer to anything, so later repeats start a new entry.
    this.seen.forEach(seen => { seen.queuedAt = null; });

    return { entries, dropped };
  }

  get size(): number {
    return this.pending.length;
  }
}
