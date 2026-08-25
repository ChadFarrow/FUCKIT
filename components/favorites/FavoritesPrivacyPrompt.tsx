'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Lock, CircleSlash } from 'lucide-react';
import { useNostr } from '@/contexts/NostrContext';
import {
  needsPrivacyAnswer,
  setFavoritesPrivacy,
  requestSharedFavoritesSync,
} from '@/lib/nostr/favorites-sync-client';
import { signerSupportsNip44 } from '@/lib/nostr/nip44';
import type { FavoritesPrivacy } from '@/lib/nostr/favorites-privacy';

/**
 * "Where should this go?" — asked once, on the first favorite.
 *
 * THE ORDER IS THE WHOLE DESIGN. The favorite is already saved and the heart is
 * already filled when this opens. Asking first and saving after would be the
 * tidier flow and it is the wrong one: the user tapped a heart, and a dialog
 * standing between the tap and the result makes a favorite feel like a
 * transaction. Asking after is safe here only because nothing has been
 * published yet — `resolveMode` answers `'off'` while the question is
 * unanswered, so the sync writes nothing to the shared list until it is.
 *
 * That ordering does not generalise. Publishing publicly and *then* asking
 * would be backwards, because a relay cannot be asked to forget.
 *
 * Asked ONCE, and never of someone whose account already answers: `resolveMode`
 * seeds from the wire when exactly one half of the list has entries, so a
 * second device usually inherits the choice instead of being asked again.
 *
 * Mounted globally rather than inside FavoriteButton — a page can hold hundreds
 * of buttons, and the question belongs to the account, not to a row.
 */

/** Dispatched by `FavoriteButton` after a favorite is saved. */
export const FAVORITES_PRIVACY_ASK_EVENT = 'favorites-privacy-ask';

export default function FavoritesPrivacyPrompt() {
  const { user } = useNostr();
  const pubkey = user?.nostrPubkey ?? '';
  const [open, setOpen] = useState(false);
  const [canEncrypt, setCanEncrypt] = useState<boolean | null>(null);

  useEffect(() => {
    const onAsk = () => {
      if (pubkey && needsPrivacyAnswer(pubkey)) setOpen(true);
    };
    window.addEventListener(FAVORITES_PRIVACY_ASK_EVENT, onAsk);
    return () => window.removeEventListener(FAVORITES_PRIVACY_ASK_EVENT, onAsk);
  }, [pubkey]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    signerSupportsNip44()
      .then((ok) => !cancelled && setCanEncrypt(ok))
      .catch(() => !cancelled && setCanEncrypt(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const answer = useCallback(
    (mode: FavoritesPrivacy) => {
      if (!pubkey) return;
      setFavoritesPrivacy(pubkey, mode);
      setOpen(false);
      // The answer is what unblocks the first publish — until now `resolveMode`
      // returned 'off' and the sync wrote nothing. Run it rather than waiting
      // for the next toggle, or the favorite they just made sits unsynced.
      if (mode !== 'off' && user?.id) {
        requestSharedFavoritesSync({ userId: user.id, pubkey, relays: user.relays });
      }
    },
    [pubkey, user?.id, user?.relays]
  );

  if (!open || !pubkey) return null;

  const choices: {
    value: FavoritesPrivacy;
    label: string;
    body: string;
    icon: typeof Globe;
    disabled?: string;
  }[] = [
    {
      value: 'public',
      label: 'Public',
      icon: Globe,
      body: 'Other apps can read them, and so can anyone else. Relays index the list, so people can search for who saved a feed.',
    },
    {
      value: 'private',
      label: 'Private',
      icon: Lock,
      body: 'Encrypted to your own key. Other apps you sign into can read them; nobody else can.',
      disabled: canEncrypt === false ? 'Your signer cannot encrypt' : undefined,
    },
    {
      value: 'off',
      label: 'Keep them here',
      icon: CircleSlash,
      body: 'Nothing goes on the shared list. Your favorites stay on this device and in your account here.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sk-privacy-ask-title"
    >
      {/* pb + safe-area: on a phone this sits at the bottom of the screen, and
          the home indicator would otherwise overlap the last button. */}
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#16213e] p-4 shadow-xl"
        style={{ paddingBottom: 'max(1rem, var(--sk-safe-bottom, 0px))' }}
      >
        <h2 id="sk-privacy-ask-title" className="text-sm font-semibold text-white">
          Share your favorites with other podcast apps?
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          StableKraft can keep one favorites list on Nostr that other Podcasting 2.0 apps you sign
          into can read. You can change this any time on the Favorites page.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return (
              <button
                key={choice.value}
                type="button"
                disabled={!!choice.disabled}
                title={choice.disabled}
                onClick={() => answer(choice.value)}
                className="flex min-h-[44px] items-start gap-3 rounded-lg border border-white/10 p-3 text-left transition-colors hover:border-white/25 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300" aria-hidden="true" />
                <span>
                  <span className="block text-xs font-medium text-white">
                    {choice.label}
                    {choice.disabled && (
                      <span className="ml-1 font-normal text-gray-500">— {choice.disabled}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-400">{choice.body}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Your favorite is already saved either way — this only decides what leaves this app.
        </p>
      </div>
    </div>
  );
}
