/**
 * A short-lived, device-local memory of which relays just failed us.
 *
 * The read budget is spent on relays that cannot answer. A relay that refuses
 * the socket costs its connect timeout; one that accepts and then says nothing
 * costs the EOSE cap. Both are paid again on the very next read, because
 * nothing remembers. Measured in production: a read that should take ~700ms
 * took 5007ms, every time, on a browser that could not reach one default relay.
 *
 * So this records the failures and lets the next read skip them.
 *
 * **This trades a little safety for a lot of time, and the limits below are
 * what keep the trade honest.** A memoised relay is not known to be dead — it
 * is known to have failed recently. Skipping one that has since recovered, and
 * that holds a NEWER copy of a replaceable event than the relays we did read,
 * means reading a stale event; republishing on top of that is how a favorites
 * list loses entries. Three rules bound that:
 *
 *  1. **Never memoise unless another relay succeeded in the same read.** A
 *     device that is simply offline fails every relay at once. Recording those
 *     would poison the whole list from one flight-mode moment, and the next
 *     read would skip everything.
 *  2. **Never skip more than half the relays**, so a read is always answered by
 *     a majority of the set rather than by whatever is left.
 *  3. **Expire quickly.** Five minutes is long enough to cover a page's own
 *     burst of reads and short enough that a relay coming back is picked up
 *     almost immediately.
 *
 * Browser-only by construction. Every entry point is inert without a `window`,
 * so the Node relay harness exercises the real code paths unfiltered.
 */

const STORAGE_KEY = 'sk_relay_unreachable';

/** How long a failure is remembered. Deliberately short — see rule 3 above. */
const TTL_MS = 5 * 60_000;

type Memo = Record<string, number>; // url -> epoch ms when the note expires

function readMemo(): Memo {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const now = Date.now();
    const live: Memo = {};
    for (const [url, expiresAt] of Object.entries(parsed)) {
      if (typeof expiresAt === 'number' && expiresAt > now) live[url] = expiresAt;
    }
    return live;
  } catch {
    // Private browsing, quota, or something else wrote garbage to the key.
    // Losing the memo costs time, never correctness.
    return {};
  }
}

function writeMemo(memo: Memo): void {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(memo).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memo));
  } catch {
    /* quota / private browsing — the next read simply pays full price */
  }
}

/**
 * Record relays that failed, but ONLY when at least one other relay answered.
 *
 * `anotherRelayAnswered` is the whole of rule 1 and is not optional: without
 * it, one offline moment writes every relay into the memo at once.
 */
export function noteUnreachableRelays(
  urls: readonly string[],
  anotherRelayAnswered: boolean
): void {
  if (typeof window === 'undefined') return;
  if (!anotherRelayAnswered || urls.length === 0) return;
  const memo = readMemo();
  const expiresAt = Date.now() + TTL_MS;
  for (const url of urls) memo[url] = expiresAt;
  writeMemo(memo);
}

/** A relay answered, so forget any note against it. */
export function clearRelayNotes(urls: readonly string[]): void {
  if (typeof window === 'undefined') return;
  if (urls.length === 0) return;
  const memo = readMemo();
  let changed = false;
  for (const url of urls) {
    if (url in memo) {
      delete memo[url];
      changed = true;
    }
  }
  if (changed) writeMemo(memo);
}

/**
 * Drop recently-failed relays from a read, up to half of them.
 *
 * Returns the relays to query and the ones held back, so the caller can report
 * what it did rather than silently querying a smaller set.
 */
export function partitionByRecentHealth(relays: readonly string[]): {
  use: string[];
  skipped: string[];
} {
  const all = [...relays];
  if (typeof window === 'undefined' || all.length === 0) return { use: all, skipped: [] };

  const memo = readMemo();
  const suspect = all.filter((url) => url in memo);
  if (suspect.length === 0) return { use: all, skipped: [] };

  // Rule 2. A read must always be answered by a majority of the set, so at most
  // half may be held back — and with one relay in the list, none may be.
  const allowance = Math.floor(all.length / 2);
  if (allowance === 0) return { use: all, skipped: [] };

  // When more relays are suspect than we may skip, hold back the ones that
  // failed most recently: they are the likeliest to fail again.
  const ordered = suspect.sort((a, b) => (memo[b] ?? 0) - (memo[a] ?? 0));
  const skipped = new Set(ordered.slice(0, allowance));

  return {
    use: all.filter((url) => !skipped.has(url)),
    skipped: all.filter((url) => skipped.has(url)),
  };
}
