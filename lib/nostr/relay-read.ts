import type { Event, Filter } from 'nostr-tools';
import {
  clearRelayNotes,
  noteUnreachableRelays,
  partitionByRecentHealth,
} from './relay-health';

/** `wss://relay.damus.io/` → `relay.damus.io`, for the diagnostic line. */
function short(url: string): string {
  return url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
}

/**
 * Reading one replaceable event across a relay set, and knowing whether an
 * empty answer can be believed.
 *
 * Extracted from the kind:30078 favorites reader so it outlives that format:
 * every bug fixed into it below was found the expensive way, and the logic is
 * about relays, not about what the event contains.
 *
 * Pinned by `relay-read.test.ts`, which scripts relays that misbehave in each
 * of the ways described here.
 */

/** Backstop for stragglers. A replaceable event is one round trip; this is not
 *  the expected cost. */
const RELAY_QUERY_TIMEOUT_MS = 5_000;

/**
 * Per-relay connect budget, deliberately well under the overall timeout: a dead
 * relay must not be able to spend the whole window failing. Measured against
 * the real default list, live relays connect and EOSE inside ~1s.
 */
const CONNECT_TIMEOUT_MS = 2_000;

/**
 * Per-relay budget for the EOSE, once connected.
 *
 * This used to be "whatever is left of the overall deadline", which meant ONE
 * relay that accepted the socket and then went silent held the whole read open
 * for the full 5s — on every read, forever, because nothing remembers. Measured
 * in production: reads pinned at 5006-5007ms while the same relays answer in
 * 600-700ms from a machine that can reach all of them.
 *
 * A relay that has not answered a single-event query in this long is not about
 * to. It drops out exactly as before — unanswered, so still degrading an empty
 * read — just sooner.
 *
 * MUST stay below `AbstractRelay.baseEoseTimeout` (4400ms), and the `eoseTimeout`
 * passed to `subscribe` must stay above it: nostr-tools SYNTHESIZES an EOSE on a
 * timer when a relay never sends one, and the pool reports it as a real answer.
 * If that fake ever lands inside our window, a silent relay reads as trustworthy
 * — the exact regression `relay-read.test.ts` was written to catch.
 */
const EOSE_TIMEOUT_MS = 2_000;

export interface TrustedRead {
  /** The newest event authored by `pubkey`, or null when none was found. */
  event: Event | null;
  /**
   * The read can be trusted. False means "nothing answered", NOT "no event
   * exists" — never treat a false here as an empty list, or a relay wobble
   * looks exactly like the user having deleted everything.
   */
  trustworthy: boolean;
}

/**
 * Which of two candidate events should be treated as latest — the whole of the
 * read's trust decision, pulled out of the subscription closure so it can be
 * tested without a relay.
 *
 * Two rules, and the ORDER of them is the point:
 *
 *   1. An event whose author isn't the user never competes. This is DEFENCE IN
 *      DEPTH, not a hole being closed: nostr-tools already runs `verifyEvent`
 *      and `matchFilters` (which enforces `authors`) before our handler is
 *      reached, so a foreign event does not arrive here today. The check makes
 *      the invariant local rather than delegated to a library default that
 *      could be changed by a custom verifier or a version bump.
 *   2. Otherwise the highest `created_at` wins — a relay that is merely behind,
 *      serving a real but stale version, looks exactly as reachable as one that
 *      is current.
 *
 * Rule 1 must be applied at INTAKE rather than to the winner. A foreign event
 * with a high `created_at` would otherwise take the `best` slot and displace
 * the genuine one, and rejecting it afterwards would discard the real event
 * along with it — turning a good read into an empty one, which is the exact
 * failure `trustworthy` exists to prevent.
 */
export function preferAuthoredEvent(
  best: Event | null,
  candidate: Event,
  pubkey: string
): Event | null {
  if (candidate.pubkey !== pubkey) return best;
  if (!best || candidate.created_at > best.created_at) return candidate;
  return best;
}

/**
 * Read the newest matching event, reporting whether the absence of one can be
 * trusted.
 *
 * `querySync` cannot tell "every relay answered and none had it" from "nothing
 * answered before the timeout", and that distinction is the difference between
 * an empty list and a wiped one. An outer `Promise.race` is worse than useless
 * for the same reason it is in `nwc-backup.ts`: it discards events healthy
 * relays already returned.
 *
 * ---------------------------------------------------------------------------
 * Why this subscribes PER RELAY instead of using `pool.subscribeMany`
 *
 * `subscribeMany`'s aggregate `oneose` cannot be used as evidence, because two
 * different non-answers are folded into it and both report as EOSE:
 *
 *   - **A synthesized EOSE.** `AbstractRelay.baseEoseTimeout` (4400ms in
 *     nostr-tools 2.x) fires `receivedEose()` on a TIMER when a relay never
 *     sends one. That is below the 5s default here, so a relay that accepted
 *     the socket and then said nothing at all used to read as `trustworthy`.
 *   - **A failed connection.** A relay that never connected also counts toward
 *     the aggregate — so with no network at all, every relay "EOSEs"
 *     immediately and an offline device reported `trustworthy` in ~19ms.
 *
 * Both were measured, and both are the precise failure this flag exists to
 * prevent: believing an empty read and acting on it.
 *
 * So a relay counts as having ANSWERED only when it (a) connected and (b) sent
 * a real EOSE inside our own window. `eoseTimeout` is pushed just past that
 * window so the library's synthetic one can never fire inside it.
 *
 * The bar is then: every relay we could actually reach said "I have nothing",
 * and there was at least one of them. A relay that is simply dead drops out of
 * the denominator rather than blocking the read; a relay that hangs makes the
 * read degraded, which is the conservative answer — a skipped write is retried,
 * and clobbering someone's data is not recoverable at all.
 * ---------------------------------------------------------------------------
 */
export async function readReplaceableEvent(opts: {
  pubkey: string;
  relays: string[];
  filter: Filter;
  timeoutMs?: number;
}): Promise<TrustedRead> {
  const { pubkey, relays, filter } = opts;
  const timeoutMs = opts.timeoutMs ?? RELAY_QUERY_TIMEOUT_MS;
  const empty: TrustedRead = { event: null, trustworthy: false };
  if (!pubkey || relays.length === 0) return empty;

  // Relays that failed us in the last few minutes, held back so they cannot
  // spend this read's budget failing again. Capped at half the set and inert
  // outside a browser — see `relay-health.ts` for why each limit is there.
  const { use: toQuery, skipped } = partitionByRecentHealth(relays);

  const { SimplePool } = await import('nostr-tools/pool');
  const pool = new SimplePool();

  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let best: Event | null = null;
  let reached = 0; // relays that accepted a connection
  let answered = 0; // ...of those, the ones that sent a REAL eose in time
  const failed: string[] = []; // never connected, or connected and stayed silent
  const succeeded: string[] = [];
  const outcomes: string[] = []; // for the diagnostic line only

  try {
    await Promise.all(
      toQuery.map(async (url) => {
        const relayStartedAt = Date.now();
        const took = () => Date.now() - relayStartedAt;
        let relay: any;
        try {
          relay = await (pool as any).ensureRelay(url, {
            // Capped well below the overall deadline on purpose. Sized to the
            // full remaining budget, a single dead relay in the list burns the
            // ENTIRE window before failing — the default list carried one, and
            // it turned a ~1s read into a 5s one on every page load. A relay
            // too slow to connect inside this is simply left out of the
            // denominator, which is the safe direction.
            connectionTimeout: Math.min(CONNECT_TIMEOUT_MS, Math.max(0, deadline - Date.now())),
          });
        } catch {
          // Never connected. Not an answer — and specifically NOT counted as
          // one, which is what made an offline device look trustworthy.
          failed.push(url);
          outcomes.push(`${short(url)} ✗ unreachable ${took()}ms`);
          return;
        }
        reached += 1;

        // Capped per relay rather than sized to the whole remaining budget, so
        // one silent relay can no longer hold the read open to the deadline.
        const eoseWait = Math.max(0, Math.min(EOSE_TIMEOUT_MS, deadline - Date.now()));

        await new Promise<void>((resolve) => {
          let done = false;
          let sub: { close: () => void } | null = null;
          let sawEose = false;
          const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try {
              sub?.close();
            } catch {
              /* already closed */
            }
            if (sawEose) {
              succeeded.push(url);
              outcomes.push(`${short(url)} ${took()}ms`);
            } else {
              // Connected, then said nothing. Useless in exactly the way an
              // unreachable relay is useless, and it costs more.
              failed.push(url);
              outcomes.push(`${short(url)} ✗ silent ${took()}ms`);
            }
            resolve();
          };
          const timer = setTimeout(finish, eoseWait);
          try {
            sub = relay.subscribe([filter], {
              // Just past our own deadline, so the library's synthetic EOSE can
              // never fire inside the window and pose as an answer. The margin
              // is deliberately SMALL: this schedules a real timer that
              // `close()` does not clear, so a large value leaves it pending
              // long after the read has returned (a 110s value here kept the
              // Node event loop alive for the full 110s, and would sit in a
              // browser tab just as long).
              // Sized off OUR per-relay wait, not the overall timeout: it must
              // stay above `eoseWait` so the synthetic EOSE can never land
              // inside our window and pose as an answer, and staying close to
              // it keeps the dangling timer short.
              eoseTimeout: eoseWait + 1_000,
              onevent(e: Event) {
                best = preferAuthoredEvent(best, e, pubkey);
              },
              oneose() {
                answered += 1;
                sawEose = true;
                finish();
              },
            });
          } catch {
            finish();
          }
        });
      })
    );

    // Remember what failed, but only because something else worked — a device
    // that is merely offline must not write off every relay it has.
    noteUnreachableRelays(failed, succeeded.length > 0);
    clearRelayNotes(succeeded);

    if (typeof window !== 'undefined') {
      const held = skipped.length ? ` · skipped ${skipped.map(short).join(', ')}` : '';
      // `warn`, not `log`: production strips `log`, and this line exists for
      // production.
      console.warn(
        `🛰️ relay read ${Date.now() - startedAt}ms — ${outcomes.join(' · ') || 'nothing queried'}${held}`
      );
    }

    const event = best as Event | null;
    if (!event) {
      // Trustworthy only if every relay we actually reached said "I have
      // nothing", and there was at least one. A bare timeout, a hung relay, or
      // no connectivity at all is not evidence of anything.
      return { event: null, trustworthy: reached > 0 && answered === reached };
    }
    // An event in hand is its own proof the query worked.
    return { event, trustworthy: true };
  } catch {
    return empty;
  } finally {
    try {
      pool.close(toQuery);
    } catch {
      /* nothing to close */
    }
  }
}
