'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useNostr } from '@/contexts/NostrContext';
import {
  getSharedSyncStatus,
  pullSharedFavorites,
  subscribeSharedSyncStatus,
} from '@/lib/nostr/shared-favorites-client';

/**
 * "We couldn't reach the relays" made visible.
 *
 * The cross-app sync handles a degraded read correctly and silently: it
 * reconciles nothing, publishes nothing, and leaves this device's favorites
 * exactly as they are. That guard is the most important safety property in the
 * feature — the naive alternative reads "nothing answered" as "the list is
 * empty" and republishes that over the user's whole library, in every app that
 * reads the shared list, with no undo.
 *
 * The guard is right. It was just silent, and silence is expensive here: a
 * degraded read and a genuinely empty list are indistinguishable on screen, so
 * the correct behaviour looks exactly like data loss. That cost half an hour of
 * production debugging in the sibling app and nearly a revert of a correct
 * commit. See the spec's §"And say so"
 * (github.com/ChadFarrow/PC20-Nostr, specs/pc20-favorites.md), and issue #194.
 *
 * StableKraft is less exposed than a cache-backed app — favorites render from
 * Postgres, so a failed read degrades sync rather than blanking the library —
 * which is why this is a quiet inline notice rather than an error state.
 *
 * Two states deliberately render nothing:
 *
 *   - **`off`** — this account isn't in the trial allowlist, so there is no
 *     sync to fail and claiming a relay problem would be a lie.
 *   - **signed out** — same reasoning one step earlier; there is no key to
 *     sync under.
 */
export default function SharedFavoritesNotice() {
  const { user, isAuthenticated } = useNostr();
  const status = useSyncExternalStore(
    subscribeSharedSyncStatus,
    getSharedSyncStatus,
    // Server render has no status; the notice is client-only by nature.
    () => 'idle' as const
  );
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(async () => {
    if (!user?.id || !user?.nostrPubkey) return;
    // Same gate `NostrContext` applies to the mount-time pull: a nip05 session
    // is read-only and proves nothing about key ownership, so reconciling would
    // let a stranger's list delete this account's DB favorites. Unreachable
    // today (nip05 users can't toggle favorites, so nothing sets 'degraded' for
    // them), but the guard belongs with the call, not only at the other site.
    if (user.loginType === 'nip05') return;
    setRetrying(true);
    try {
      // Single-flight inside the client, so a double-tap joins the run already
      // going rather than starting a second read-merge-publish cycle. Adding a
      // retry is what makes concurrent pulls reachable in the first place.
      await pullSharedFavorites({
        userId: user.id,
        pubkey: user.nostrPubkey,
        relays: user.relays,
      });
    } catch {
      // The pull sets its own status; a throw leaves the notice up.
    } finally {
      setRetrying(false);
    }
  }, [user?.id, user?.nostrPubkey, user?.relays, user?.loginType]);

  if (!isAuthenticated || !user?.nostrPubkey) return null;

  // 'syncing' renders too, but ONLY while this component's own retry is in
  // flight. Otherwise pressing Retry sets 'syncing' and the whole notice
  // vanishes on the click — which reads as "fixed" and makes the `retrying`
  // label below unreachable — reappearing seconds later if it failed. Gating on
  // `retrying` keeps the mount-time pull silent, which is the point of not
  // rendering 'syncing' in general.
  const isRetrying = retrying && (status === 'syncing' || status === 'degraded');
  if (status !== 'degraded' && !isRetrying) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200"
    >
      <span>
        {retrying
          ? 'Reaching the relays…'
          : "Couldn't reach the relays — your favorites are up to date on this device, but cross-app sync is paused."}
      </span>
      <button
        type="button"
        onClick={retry}
        disabled={retrying}
        className="flex-shrink-0 underline underline-offset-2 hover:text-yellow-100 disabled:opacity-40"
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}
