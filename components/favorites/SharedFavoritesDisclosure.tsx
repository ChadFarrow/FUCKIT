'use client';

import { Globe } from 'lucide-react';
import { useNostr } from '@/contexts/NostrContext';
import { sharedFavoritesEnabledFor } from '@/lib/nostr/favorites-sync-client';

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

  if (!isAuthenticated || !user?.nostrPubkey) return null;
  // Read-only session: no signer, so nothing of theirs is ever published.
  if (user.loginType === 'nip05') return null;

  const crossApp = sharedFavoritesEnabledFor(user.nostrPubkey);

  return (
    <p className="flex items-start gap-2 text-xs text-gray-500">
      <Globe className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
      <span>
        Favorites you sync are published to Nostr as public events signed by your key — anyone can
        see what you&apos;ve saved, the same way your follow list is public.
        {crossApp && ' They also form a shared list that other podcast apps you sign into can read.'}
      </span>
    </p>
  );
}
