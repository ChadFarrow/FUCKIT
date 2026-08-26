'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Lock, CircleSlash } from 'lucide-react';
import { useNostr } from '@/contexts/NostrContext';
import {
  FAVORITES_PRIVACY_CHANGED_EVENT,
  getFavoritesPrivacy,
  sharedFavoritesEnabledFor,
} from '@/lib/nostr/favorites-sync-client';
import type { FavoritesPrivacy } from '@/lib/nostr/favorites-privacy';

/**
 * "Your favorites are public" — said out loud, on the screen where favoriting
 * happens.
 *
 * The spec this app implements asks for exactly this and gives the reason:
 * favorites are published as ordinary Nostr events signed by the user's key,
 * with `content` deliberately left in plaintext so a second app can read them.
 * That is a disclosure even though it is not an endorsement — the same posture
 * as a Nostr follow list. See the spec's §"On `content` being plaintext"
 * (github.com/ChadFarrow/PC20-Nostr, specs/pc20-favorites.md).
 *
 * WHY THIS FILE EXISTS, in one line: it is the standing prerequisite for
 * deleting `sharedFavoritesEnabledFor` and shipping cross-app sync to everyone.
 * Turning that gate off without a notice would silently create a new public,
 * aggregated artifact — one `podcast:favorites` list per user, under their own
 * key — that nobody asked for. Don't remove this and the gate in the same
 * change; removing the gate is what makes this text load-bearing.
 *
 * Two things it must NOT do, both of which would make it a lie rather than a
 * disclosure:
 *
 *   - **Claim publishing for a session that can't publish.** A `nip05` login is
 *     read-only by construction (no signer, so nothing is ever signed or sent),
 *     and it deliberately skips the post-login favorites sync. Telling those
 *     users their favorites are public would be false.
 *   - **Claim the cross-app list for someone not in the trial.** Their
 *     per-item events are public, but no `podcast:favorites` list exists under
 *     their key, so the second sentence is gated separately from the first.
 *
 * Signed out renders nothing: there is no key, so nothing is published.
 *
 * Deliberately not dismissible. A notice you can permanently hide stops being a
 * disclosure for the people most likely to hide it, and it costs one quiet line.
 */
export default function SharedFavoritesDisclosure() {
  const { user, isAuthenticated } = useNostr();
  const pubkey = user?.nostrPubkey ?? '';
  const [mode, setMode] = useState<FavoritesPrivacy | null>(null);

  useEffect(() => {
    if (!pubkey) return;
    setMode(getFavoritesPrivacy(pubkey));
    const onChange = () => setMode(getFavoritesPrivacy(pubkey));
    window.addEventListener(FAVORITES_PRIVACY_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FAVORITES_PRIVACY_CHANGED_EVENT, onChange);
  }, [pubkey]);

  if (!isAuthenticated || !pubkey) return null;
  // Read-only session: no signer, so nothing of theirs is ever published.
  if (user?.loginType === 'nip05') return null;

  const crossApp = sharedFavoritesEnabledFor(pubkey);

  // The per-item kind 30001 events are public whatever the shared list does, so
  // the first sentence is unconditional. Only the SHARED list has a mode, which
  // is why the two are described separately rather than as one claim.
  const Icon = mode === 'private' ? Lock : mode === 'off' ? CircleSlash : Globe;

  return (
    <p className="flex items-start gap-2 text-xs text-gray-500">
      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
      <span>
        Favorites you sync are published to Nostr as public events signed by your key — anyone can
        see what you&apos;ve saved, the same way your follow list is public.
        {crossApp && sharedListSentence(mode)}
        {/* The link is the whole reason the control could move to Settings. A
            setting nobody can find is not a choice, and this sentence is where
            someone is already reading about the consequence. */}
        {crossApp && (
          <>
            {' '}
            <Link
              href="/settings"
              className="underline underline-offset-2 hover:text-gray-300"
            >
              Change in Settings
            </Link>
            .
          </>
        )}
      </span>
    </p>
  );
}

/**
 * What the SHARED list is doing, which is the only part the mode changes.
 *
 * Each branch has to be true of the state it describes, or this stops being a
 * disclosure. In particular `'private'` does not say "your favorites are
 * private" — the 30001 events above are still public, and the pubkey, the kind,
 * the timestamp and the event SIZE stay public on the shared list too. What is
 * hidden is which feeds are in it.
 *
 * `null` — the user has not answered yet — must not imply a default. Nothing is
 * published to the shared list until they choose, and saying so is the honest
 * version of an empty state.
 */
function sharedListSentence(mode: FavoritesPrivacy | null): string {
  switch (mode) {
    case 'public':
      return ' Your shared cross-app list is Public: other podcast apps you sign into can read it, relays index it, and anyone can search for who saved a feed.';
    case 'private':
      return ' Your shared cross-app list is Private — encrypted to your own key, so other apps you sign into can read it and nobody else can. Its size and timing stay visible.';
    case 'off':
      return ' Your shared cross-app list is off, so nothing new is published to it.';
    default:
      return ' A shared list that other podcast apps can read is available, and nothing is published to it until you choose.';
  }
}
