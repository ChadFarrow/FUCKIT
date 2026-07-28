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
 *
 * THE MESSAGE IS THE THROTTLE KEY. A message that interpolates a per-item value
 * (`No match found for feedGuid: ${guid}`) is a *distinct* message every time, so it
 * collapses with nothing, fills MAX_QUEUE in one pass of the loop that emits it, and
 * leaves a permanent key behind. Keep messages constant and put the variable part in
 * `data` — see the note in lib/monitoring.ts.
 */

export type ClientLogLevel = 'error' | 'warn';

/** What a caller hands to `add` — `data` is any shape; the buffer serialises it. */
export interface ClientLogInput {
  level: ClientLogLevel;
  category: string;
  message: string;
  data?: unknown;
}

export interface ClientLogEntry {
  level: ClientLogLevel;
  category: string;
  message: string;
  /** Already serialised and truncated at intake — see clampData. */
  data?: string;
  /** Occurrences collapsed into this entry, including the first. */
  count: number;
}

/**
 * Dropped past this many distinct pending entries — a wedged client can't grow
 * unbounded. Kept equal to MAX_ENTRIES in app/api/client-log/route.ts: if the client
 * queued more than the server accepts, the surplus would vanish server-side without
 * being counted in `dropped`, and the report of what was lost would itself be wrong.
 */
export const MAX_QUEUE = 20;
/** Identical messages beyond this within the window are counted, not queued again. */
export const MAX_PER_MESSAGE = 3;
export const THROTTLE_WINDOW_MS = 60_000;

/**
 * Per-field caps, mirroring the ones the route applies. Clamping HERE as well is what
 * keeps the whole payload inside sendBeacon's ~64KB budget: the route truncating on
 * arrival is no help if the request was too big for the browser to send at all, and
 * the beacon path is the one that carries reports off a dying tab. Worst case is now
 * MAX_QUEUE * (MAX_MESSAGE + MAX_CATEGORY + MAX_DATA) ≈ 23KB.
 */
export const MAX_MESSAGE = 300;
export const MAX_CATEGORY = 60;
export const MAX_DATA = 800;

/**
 * Serialised and truncated at intake rather than at flush, so an oversized object is
 * never held in the buffer either. Returns a string, which the route's formatData
 * passes through unchanged.
 */
function clampData(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    return json ? json.slice(0, MAX_DATA) : undefined;
  } catch {
    // Circular, or a toJSON that throws.
    return '[unserializable]';
  }
}

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
  add(entry: ClientLogInput, now: number): boolean {
    // Clamped before the key is built, so two messages that differ only past the cap
    // collapse together instead of each claiming a queue slot.
    const normalized: Omit<ClientLogEntry, 'count'> = {
      level: entry.level,
      category: entry.category.slice(0, MAX_CATEGORY),
      message: entry.message.slice(0, MAX_MESSAGE),
      data: clampData(entry.data),
    };

    const key = `${normalized.level}:${normalized.category}:${normalized.message}`;
    const seen = this.seen.get(key);

    if (!seen || now - seen.windowStart >= THROTTLE_WINDOW_MS) {
      this.seen.set(key, { windowStart: now, count: 1, queuedAt: null });
      return this.enqueue(key, normalized);
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

    return this.enqueue(key, normalized);
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

  /**
   * Returns everything pending and clears it. Throttle state for the *current*
   * window deliberately survives — that is what stops a client that flushes between
   * occurrences from re-queueing the same message forever.
   *
   * Expired keys are swept here because nothing else ever removes them: `add` writes
   * a key for every message it sees, including ones it immediately drops, so without
   * this the map grows for the life of the page. Same reasoning as the sweep on the
   * rate-limit map in app/api/client-log/route.ts.
   */
  drain(now: number): { entries: ClientLogEntry[]; dropped: number } {
    const entries = this.pending;
    const dropped = this.dropped;

    this.pending = [];
    this.dropped = 0;

    this.seen.forEach((seen, key) => {
      if (now - seen.windowStart >= THROTTLE_WINDOW_MS) {
        this.seen.delete(key);
        return;
      }
      // Queue positions no longer refer to anything, so later repeats start a new entry.
      seen.queuedAt = null;
    });

    return { entries, dropped };
  }

  get size(): number {
    return this.pending.length;
  }

  /** Live throttle keys. Exposed so a test can assert the sweep above actually runs. */
  get seenSize(): number {
    return this.seen.size;
  }
}
