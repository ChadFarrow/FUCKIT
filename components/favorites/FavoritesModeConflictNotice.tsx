'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNostr } from '@/contexts/NostrContext';
import {
  FAVORITES_PRIVACY_CHANGED_EVENT,
  getModeConflict,
  requestSharedFavoritesSync,
  setFavoritesPrivacy,
  type ModeConflict,
} from '@/lib/nostr/favorites-sync-client';

/**
 * This device is set to one half; the list on the relays is entirely the other.
 *
 * WHY THIS IS A SCREEN AND NOT A DECISION. The privacy mode is per-app and
 * per-device — this app keeps it in `sk_favorites_privacy:<pubkey>`, Boost Me
 * Bitch in `bmb:favPrivacy:<npub>` — while the kind:10333 event is shared and
 * carries nothing that says which half it intends to be. So two apps can hold
 * opposite answers about one list, and whichever loads last rewrites the whole
 * thing to match itself. Measured: this app was left on Private for an account
 * made entirely public from the other one, and the next page load would have
 * moved all 287 entries into `content` with no user action.
 *
 * The app must not pick. Following the wire silently discards a privacy choice
 * the user really did make here; enforcing the stored mode silently rewrites a
 * list they really did change there. Both are the same defect — an edit nobody
 * asked for on data with no undo — so the publish is held and the question is
 * asked, with both numbers on screen.
 *
 * The conflict is recomputed on every sync and removed when it no longer holds,
 * so one resolved in the other app clears itself with nothing pressed here.
 */
export default function FavoritesModeConflictNotice() {
  const { user, isAuthenticated } = useNostr();
  const pubkey = user?.nostrPubkey ?? '';
  const [conflict, setConflict] = useState<ModeConflict | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pubkey) return;
    setConflict(getModeConflict(pubkey));
    const onChange = () => setConflict(getModeConflict(pubkey));
    window.addEventListener(FAVORITES_PRIVACY_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FAVORITES_PRIVACY_CHANGED_EVENT, onChange);
  }, [pubkey]);

  const answer = useCallback(
    (next: 'public' | 'private') => {
      if (!user?.id || !pubkey) return;
      setBusy(true);
      setFavoritesPrivacy(pubkey, next);
      // `intent: 'resolve'` — this press IS the answer the gate is holding for.
      // Without it the sync would look at the same disagreement and hold again,
      // and the button would visibly do nothing.
      requestSharedFavoritesSync({
        userId: user.id,
        pubkey,
        relays: user.relays,
        intent: 'resolve',
      });
    },
    [user?.id, user?.relays, pubkey]
  );

  if (!isAuthenticated || !pubkey || !conflict) return null;

  const wirePublic = conflict.wire === 'wire-public';
  const onWire = wirePublic ? conflict.publicCount : conflict.privateCount;
  const half = wirePublic ? 'public' : 'encrypted';

  return (
    <div
      role="status"
      className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200"
    >
      <p>
        Your shared favorites list is entirely {half}
        {onWire > 0 ? ` (${onWire} ${onWire === 1 ? 'favorite' : 'favorites'})` : ''}, but this app
        is set to {conflict.stored === 'private' ? 'Private' : 'Public'}. Nothing has been changed.
      </p>
      {/* The cost of holding, said out loud. The reconcile reads whichever half
          the stored mode names, so while this stands a favorite added in the
          other app does not arrive here — and a guard that withholds silently
          is indistinguishable from a broken one. */}
      <p className="mt-1 text-yellow-200/70">
        Until you answer, this app publishes nothing to the list and new favorites from your other
        apps will not appear here.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(wirePublic ? 'public' : 'private')}
          className="min-h-[32px] underline underline-offset-2 hover:text-yellow-100 disabled:opacity-40"
        >
          Keep {onWire === 1 ? 'it' : 'them'} {half === 'public' ? 'public' : 'encrypted'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(wirePublic ? 'private' : 'public')}
          className="min-h-[32px] underline underline-offset-2 hover:text-yellow-100 disabled:opacity-40"
        >
          {wirePublic
            ? `Move ${onWire > 0 ? onWire : 'them'} into the encrypted half`
            : `Publish ${onWire > 0 ? onWire : 'them'} as public tags`}
        </button>
      </div>
    </div>
  );
}
