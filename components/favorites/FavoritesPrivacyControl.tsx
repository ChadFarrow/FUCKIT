'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Lock, CircleSlash, Loader2 } from 'lucide-react';
import { useNostr } from '@/contexts/NostrContext';
import { SettingsRow } from '@/components/Settings/SettingsLayout';
import {
  FAVORITES_PRIVACY_CHANGED_EVENT,
  getFavoritesPrivacy,
  setFavoritesPrivacy,
  sharedFavoritesEnabledFor,
  withdrawFromSharedFavorites,
  requestSharedFavoritesSync,
} from '@/lib/nostr/favorites-sync-client';
import { signerSupportsNip44 } from '@/lib/nostr/nip44';
import type { FavoritesPrivacy } from '@/lib/nostr/favorites-privacy';

/**
 * Public / Private / Not on Nostr, for the shared cross-app favorites list.
 *
 * WHY THE CHOICE EXISTS AT ALL. Every entry on the list is an `i` tag, `i` is a
 * single-letter tag, and relays INDEX those — so a `#i` filter answers *which
 * pubkeys favorited this feed*. The list is searchable in reverse, not merely
 * readable by someone who already has the pubkey. "Public" here is a stronger
 * claim than most people assume, so it has to be one they actually make.
 *
 * WHERE IT LIVES: Settings › Nostr, beside the other things that publish under
 * the user's key. It began on /favorites directly under the disclosure, on the
 * reasoning that a consequence belongs beside the thing that causes it. In
 * practice that put a bordered settings panel above the user's albums, on the
 * page they open to look at their albums, competing with the content for the
 * top of the screen. `SharedFavoritesDisclosure` stays there and names the
 * current mode with a link here — that sentence is the part that has to be
 * seen, and it is one line.
 *
 * Three things this component must not do:
 *
 *   - **Offer Private to a session that cannot encrypt.** NIP-55 (Amber over
 *     intent URIs) implements `sign_event` and nothing else, and a read-only
 *     nip05 session has no signer at all. The option is disabled with the
 *     reason shown, because an option that silently does nothing is worse than
 *     one that is visibly unavailable.
 *   - **Switch to "Not on Nostr" quietly.** The entries are already on relays,
 *     and a relay cannot be asked to forget. Leaving offers to withdraw what
 *     this device published; declining leaves the copy there and says so.
 *   - **Claim the switch happened before it did.** A mode change is a publish,
 *     and a publish can fail. The control shows the work.
 */
export default function FavoritesPrivacyControl() {
  const { user, isAuthenticated } = useNostr();
  const pubkey = user?.nostrPubkey ?? '';

  const [mode, setMode] = useState<FavoritesPrivacy | null>(null);
  const [canEncrypt, setCanEncrypt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey) return;
    setMode(getFavoritesPrivacy(pubkey));
    const onChange = () => setMode(getFavoritesPrivacy(pubkey));
    window.addEventListener(FAVORITES_PRIVACY_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FAVORITES_PRIVACY_CHANGED_EVENT, onChange);
  }, [pubkey]);

  useEffect(() => {
    // Asked once per mount rather than per render: on a NIP-46 signer this can
    // touch the connection, and it never changes within a session.
    let cancelled = false;
    signerSupportsNip44()
      .then((ok) => !cancelled && setCanEncrypt(ok))
      .catch(() => !cancelled && setCanEncrypt(false));
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const choose = useCallback(
    async (next: FavoritesPrivacy) => {
      if (!user?.id || !pubkey || next === mode) return;
      setMessage(null);

      if (next === 'off') {
        setLeaving(true);
        return;
      }

      setBusy(true);
      try {
        setFavoritesPrivacy(pubkey, next);
        // The switch IS a publish — the entries move from one half of the event
        // to the other — so it runs now rather than waiting for the next
        // favorite toggle. On a remote signer this is a prompt on the phone.
        requestSharedFavoritesSync({ userId: user.id, pubkey, relays: user.relays });
        setMessage(
          next === 'private'
            ? 'Moving your favorites into the encrypted half. Approve the signing request if your signer asks.'
            : 'Moving your favorites into the public half.'
        );
      } finally {
        setBusy(false);
      }
    },
    [user?.id, user?.relays, pubkey, mode]
  );

  const leave = useCallback(
    async (withdraw: boolean) => {
      if (!pubkey) return;
      setBusy(true);
      setMessage(null);
      try {
        if (!withdraw) {
          setFavoritesPrivacy(pubkey, 'off');
          setMessage('This app has stopped syncing. What is already on the relays stays there.');
          return;
        }
        const result = await withdrawFromSharedFavorites({ pubkey, relays: user?.relays });
        setMessage(
          result === 'ok'
            ? 'Removed what this app published. Entries added by other apps are untouched.'
            : result === 'nothing-to-do'
              ? 'There was nothing on the relays to remove.'
              : "Couldn't reach the relays, so nothing was removed. This app has stopped syncing either way."
        );
      } finally {
        setBusy(false);
        setLeaving(false);
      }
    },
    [pubkey, user?.relays]
  );

  if (!isAuthenticated || !pubkey) return null;
  // A read-only nip05 session has no signer, so nothing of theirs is ever
  // published and there is no choice to make.
  if (user?.loginType === 'nip05') return null;
  // The cross-app list is still behind the trial allowlist. Without it there is
  // no shared list under this key, so the control would govern nothing.
  if (!sharedFavoritesEnabledFor(pubkey)) return null;

  const options: {
    value: FavoritesPrivacy;
    label: string;
    icon: typeof Globe;
    hint: string;
    disabled?: string;
  }[] = [
    {
      value: 'public',
      label: 'Public',
      icon: Globe,
      hint: 'Anyone can see what you saved, and search for who saved a feed.',
    },
    {
      value: 'private',
      label: 'Private',
      icon: Lock,
      hint: 'Encrypted to your own key. Other apps you sign into can still read them.',
      disabled: canEncrypt === false ? 'Your signer cannot encrypt' : undefined,
    },
    {
      value: 'off',
      label: 'Not on Nostr',
      icon: CircleSlash,
      hint: 'Favorites stay on this device and in your account here.',
    },
  ];

  const active = options.find((o) => o.value === mode);

  return (
    <div className="border-t border-gray-700 pt-6">
      <SettingsRow
        label={
          <span className="flex items-center gap-2">
            Favorites on Nostr
            {busy && <Loader2 className="h-3 w-3 animate-spin text-gray-400" aria-hidden="true" />}
          </span>
        }
        description="Where new favorites go on the shared list other podcast apps can read."
      >
        <div
          role="radiogroup"
          aria-label="Favorites on Nostr"
          className="flex flex-wrap justify-end gap-1"
        >
          {options.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-describedby={selected ? 'sk-privacy-hint' : undefined}
                disabled={busy || !!option.disabled}
                title={option.disabled}
                onClick={() => choose(option.value)}
                // 44px is the phone target — WCAG 2.5.8 asks 24, and a segmented
                // control tapped with a thumb gets the platform figure instead.
                // A pointer does not need it, hence the smaller sm: height.
                className={`flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[32px] sm:px-3 ${
                  selected
                    ? 'bg-white/15 font-medium text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </SettingsRow>

      {/* The hint describes the SELECTED option, not whatever is hovered — this
          is a consequence the user is choosing, so it has to stay legible while
          they read it. Nothing is selected until they answer, and the text below
          says so rather than implying a default. */}
      <p id="sk-privacy-hint" className="mt-2 text-xs text-gray-400">
        {active ? active.hint : 'Not set yet — choose where new favorites go.'}
      </p>

      {/* WHY THIS IS NOT JUST THE `title` ATTRIBUTE. A phone has no hover, so a
          tooltip on the disabled button is unreachable for exactly the users
          most likely to hit this — Amber over NIP-55 is an Android signer. A
          greyed option with no stated reason reads as a broken app. */}
      {canEncrypt === false && (
        <p className="mt-1 text-xs text-gray-500">
          Private needs a signer that can encrypt (NIP-44). Amber connected over{' '}
          <span className="whitespace-nowrap">bunker://</span> can; the Android app-to-app signer
          and a read-only NIP-05 login cannot.
        </p>
      )}

      {message && <p className="mt-2 text-xs text-gray-300">{message}</p>}

      {leaving && (
        <div className="mt-3 rounded-md border border-gray-700 bg-black/30 p-3">
          <p className="text-xs text-gray-300">
            Your favorites are already published. Nostr has no delete that can be guaranteed, but
            this app can publish an update removing the entries it added.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Entries other apps added stay — they are not this app&apos;s to remove.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => leave(true)}
              className="min-h-[44px] rounded-md bg-white/15 px-3 text-xs text-white hover:bg-white/25 disabled:opacity-40 sm:min-h-[32px]"
            >
              Remove them and stop
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => leave(false)}
              className="min-h-[44px] rounded-md px-3 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 sm:min-h-[32px]"
            >
              Just stop syncing
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setLeaving(false)}
              className="min-h-[44px] rounded-md px-3 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 sm:min-h-[32px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
