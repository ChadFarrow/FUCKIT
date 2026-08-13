---
name: lightning-boost
description: "Use when working on Lightning payments: boosts, the boost modal, connecting or switching a wallet, the wallet picker, NWC and bitcoin-connect, keysend support detection, Alby, Primal, the encrypted NWC backup on Nostr, a wallet that must be re-paired on every device, BoostBox and Helipad metadata, value splits and V4V recipients, AutoBoost firing on track end or VTS segments, a boost that fails or pays only some recipients, the platform fee, boost failure triage, or the sender name showing an npub."
---

# lightning-boost

Everything from "connect a wallet" to "sats left the wallet", including the unattended AutoBoost paths.

## Tests for this subsystem

```
npx tsx --test lib/lightning/boost-failure.test.ts  # boost failure -> [category user|fix] triage tag
npx tsx --test lib/lightning/sender-name.test.ts    # boost sender name: npub/autofill rejection
```

---

## Wallet Connection UI — our own picker, not the Bitcoin Connect modal
`@getalby/bitcoin-connect` is still the transport (connectors, persistence, `onConnected`), but its **modal is never shown**. `components/Lightning/WalletConnectModal.tsx` replaces it, rendered once by `BitcoinConnectProvider` next to `{children}` so every `connect()` entry point shares one picker.

Why: bitcoin-connect's modal listed ~10 wallet tiles, but every tile except the browser extension resolves to the **same `NWCConnector`** (`dist/connectors/index.d.ts`) — they're setup instructions for pasting an NWC string, dressed as ten technologies. It also offered wallets whose relay can't keysend (Primal), so users committed and then boosts failed.

- **Two rows only**: "Browser Extension" (rendered only when `window.webln` exists, so mobile collapses to one row) → `connect({connectorType:'extension.generic'})`, and "Nostr Wallet Connect" → `connectNWC(uri)`. A third "Restore from Nostr" row appears when the session could restore (see below).
- **The library's connect functions never reject.** They `catch` internally, log, set `store.error`, and call `disconnect()`; the public `connect` is even typed `=> void`. Success is only observable as "`onConnected` fired". The modal races an `onConnected` subscription against a 30s timer — and **`onConnected` fires SYNCHRONOUSLY at subscribe time if a provider already exists**, so the first (immediate) fire must be ignored or opening the modal while connected reports instant success.
- **`connect()` in the provider only owns the view.** It opens the modal and returns a promise resolved when it closes — the same fire-and-forget contract callers already had (`launchModal()` returned void). Its resolver lives in a ref and is settled on unmount so `BoostButton`'s `await connect()` can't hang.
- **`requestProvider()` LAUNCHES the Bitcoin Connect modal** when no provider exists. The post-Nostr-login restore path must therefore check `localStorage['bc:config']` first — not `getConnectorConfig()`, which is still empty while the library's own module-load reconnect is in flight.
- **"Paste from clipboard" is touch-only** (`pointer: coarse`). `navigator.clipboard.readText()` forces a browser confirmation (Firefox/Safari show their own Paste button), making it two clicks where ⌘V is one keystroke. It also needs a **secure context**, so it is absent over `http://<lan-ip>` — that's not the gate misfiring.
- Verify with `node lib/nostr/nwc-backup.browser-probe.mjs` against a running dev server.

---

## Encrypted NWC Backup on Nostr (`lib/nostr/nwc-backup.ts`)
Publishes the user's NWC connection string, NIP-44 encrypted to their own key, as a replaceable NIP-78 event (**kind 30078**, d-tag **`stablekraft:wallet:nwc`**, content = encrypt-to-self of `{"uri":…}`) so signing in on another device restores the wallet without re-pasting. Save is **opt-in and asked for**; restore after sign-in is **automatic**.

Every one of these was learned by breaking it — do not "simplify" any of them away:

- **`RelayManager.publish()` only reaches relays you `connect()`ed first.** It iterates `this.relays`, which `connect()` populates. Skip that and `writeRelays` is empty, `publish()` resolves with `[]`, and the unchecked `await` looks like success while the event goes **nowhere**. That shipped, and made "Saved" a lie for a full round of testing. Always connect first, then assert `results.some(r => r.status === 'fulfilled')` — `publish()` returns settled results and never rejects, so an unchecked await cannot tell "stored" from "refused".
- **`window.nostr.nip44` is NOT proof the session can encrypt.** `nostr-login` installs a shim advertising `encrypt`/`decrypt` with no signer behind it; calling one opens its *"Welcome to Nostr!"* dialog instead (`noBanner: true` doesn't suppress that — it only hides the passive banner). Gate the window path on `nostr_login_type === 'extension'`; for nip46 use `UnifiedSigner`, which holds the live Amber/Primal connection.
- **A relay query has three outcomes, not two.** `querySync` waits for EOSE from every relay and dead ones never send it, so an outer `Promise.race` timeout **discards events healthy relays already returned** — an existing backup then reads as "none" and the UI asks the user to re-save it. Use `querySync`'s `maxWait`, and keep `'saved' | 'none' | 'unknown'` distinct: never cache an `'unknown'`, never render it as "Not saved", never offer to re-save on it.
- **NIP-44 through a remote signer needs ~120s, not 10s** — a human taps Approve on their phone. The outer `withTimeout` sits at 130s, *outside* `withSignerNudge`'s 125s hard fail, which is itself outside `nip46-client`'s 120s request timeout: innermost has the most specific error, so it must fire first.
- **Disconnect must NOT tombstone the backup.** It used to. With a wallet connected the menu offers Switch / NWC Backup / Disconnect and no "Connect", so the only route to the restore row *is* disconnect — the backup was always destroyed before it could be used, on every device. Removal lives solely on the account-menu row.
- **Only clear `wallet_manually_disconnected` when actually restoring.** It's also read by the WebLN extension auto-connect effect, so clearing it before confirming a backup exists silently reconnected an extension wallet for a user who had deliberately disconnected. Auto-restore is otherwise **not** gated on that flag — it never expires, so gating on it killed restore on that device forever.
- **Signer readiness is not instant.** A NIP-07 extension is synchronous, NIP-46 is not: after the post-login reload the client rebuilds and reconnects over seconds. Route through `ensureSignerAvailable()` and retry (~15s) before concluding a signer "can't" encrypt; keep the pending flag on transient failure so the next load retries, and consume it only when the answer is real.
- **Known limit**: the tombstone reaches the relays we publish to *now*, which need not be where the original landed — hence "removed (where reachable)".

Entry points: the picker's restore row, the offer after an NWC paste, a post-login offer/auto-restore driven by `markNwcBackupOfferPending` (`lib/nostr/auth-utils.ts`, same deferral pattern as favorites sync), and the account-menu row (Switch Wallet → **NWC Backup** → Disconnect Wallet, destructive last).

**Verifying a change here.** `node lib/nostr/nwc-backup.browser-probe.mjs` covers the save reaching relays, a refused save not reporting success, auto-restore, the manual-disconnect regression, and the row hiding without nip44 — but it **stubs the wallet and the signer**, so these still need a device:

| Check | Where |
|---|---|
| Amber/Primal actually answer `nip44_decrypt` | Physical phone, NIP-46 login |
| A real boost still lands after connecting | Any wallet, real sats |
| The sheet clears the status bar and nav bar | 3-button-nav Android, and an installed PWA |
| "Paste from clipboard" appears at all | Needs a **secure context** — `adb reverse tcp:3000` then `http://localhost:3000`, not `http://<lan-ip>` |

Confirm a backup really exists on relays rather than trusting the UI — this is what caught the publish-to-zero-relays bug:

```
node -e "const {SimplePool}=require('nostr-tools/pool');(async()=>{const p=new SimplePool();
const r=['wss://nos.lol','wss://relay.primal.net','wss://relay.damus.io'];
const e=await p.querySync(r,{kinds:[30078],authors:['<pubkey-hex>'],'#d':['stablekraft:wallet:nwc']});
console.log(e.length, e.map(x=>x.content.length)); p.close(r); process.exit(0)})()"
```

**Testing against the wrong build wasted a full debugging session**: a phone pointed at `https://stablekraft.app` is production and has none of your local changes. Check `location.origin` before concluding a feature is broken.

---

## Lightning Wallet Detection
**Keysend capability** (`components/Lightning/BitcoinConnectProvider.tsx`): two signals combined with **OR**. Signal A = WebLN `GetInfoResponse.methods` (NWC wallets populate with `pay_keysend`/`multi_pay_keysend`, extensions with `keysend`). Signal B = provider-type whitelist (`alby`/`alby-hub`/`extension`/`coinos`) from `detectWalletProviderType()`. Either is sufficient.

OR (not methods-first) rescues Alby Hub users whose `get_info` lacks `pay_keysend` (older versions, partial NWC permissions, stale cache) while still correctly rejecting Primal (`nwc.primal` exposes `provider.keysend` via WebLN shim but relay doesn't implement `pay_keysend`). Eager `setKeysendSupported(...)` runs after `detectWalletProviderType` and before `provider.getInfo()` so the UI banner and lnaddress keysend-fallback don't flash `false` during 1–5s NWC cold-start. Do NOT probe with a real keysend — triggers payment popup in Alby extension. `detectWalletProviderType()` in `lib/lightning/wallet-detection.ts` also drives Lightning-address inference and avatar lookup. For `connectorType` values see `@getalby/bitcoin-connect/dist/connectors/index.d.ts`.

**Wallet/Nostr are independent**: Nostr logout does **not** disconnect the Lightning wallet. Prior behavior (wipe + set `wallet_manually_disconnected=true` on every Nostr logout) forced manual wallet re-pair every time a user logged out to reseat a broken NIP-46 signer. Remaining Nostr→wallet interactions (auto-pick-up Alby WebLN on NIP-07 login; `wallet_restore_after_login` Android fix) are *restorative*, not destructive — leave alone.

---

## BoostBox & Helipad (`lib/lightning/boostbox.ts`)
LNURL payments use [BoostBox](https://tardbox.com) for Podcasting 2.0 boost metadata. Keysend unaffected (uses Helipad TLV). Client-only — always uses `/api/lightning/boostbox` proxy (API key via `BOOSTBOX_API_KEY`). Value splits try keysend first; BoostBox called only for LNURL fallback. Fountain.fm addresses skip keysend by design (`isFountain` check).

- **Feed.guid gotcha**: `feed_guid` in BoostBox comes from `Feed.guid` in DB. If null, reparse the feed.
- **Helipad metadata**: built by `buildHelipadMetadata(amount, msg)` in `BoostButton.tsx`, BLIP-0010 spec. Single helper for all payment paths — do NOT duplicate. `name` field omitted from base; `value-splits.ts` sets it per-recipient.
- **BoostButton props**: `feedUrl`, `remoteFeedGuid` (must be real GUID, never feed slug/ID), `albumName`, `publisherGuid`, `episodeGuid` (omit for album-level). Do NOT fall back to `feedId` for `remoteFeedGuid` — it's a slug, not a GUID.
- **`sendPayment` RESOLVES with `{ error }` on failure — it does not throw** (`BitcoinConnectProvider` parses the Lightning error and returns it). `sendPlatformFeeMetaboost` discarded the result, so it logged "✅ Platform fee sent" over every failed fee and its caller's `catch` was unreachable: the 2 sat fee could quietly stop going out while every boost still reported success. It now checks `result.error` and throws; the caller toasts a warning and reports `feeStatus: 'failed'`. **No retry there on purpose** — `sendPayment` already retries no-route/timeout internally, and retrying from outside re-issues a fresh invoice, double-paying whenever the first attempt actually settled but reported failure. The other two payment paths (`value-splits.ts`, single-recipient) already checked it.
- **The Post-to-Nostr row renders whether or not you're signed in** — disabled, with "Sign in with Nostr to post your boosts." While it was hidden for signed-out users its absence read as a missing feature rather than an unmet prerequisite. The send path stays gated on `isNostrAuthenticated && nostrUser && postToNostr`, so a stale `true` in localStorage can't post for a signed-out user.

---

## AutoBoost (`contexts/AudioContext.tsx`)
Two paths gated by `autoBoostEnabled` setting and `autoBoostProcessingRef` mutex:
- **`triggerAutoBoost`** — track end for non-VTS tracks. Falls back from track-level to album-level V4V.
- **`triggerChapterAutoBoost`** — VTS segment transitions. Fetches remote V4V, scales by `remotePercentage`, blends show-host recipients. Non-music chapters use show-level V4V only. API fallback via `feedGuid` if `album.v4vValue` is empty.

**Gap tracking** (`inVtsGapRef`): boosts music segments on gap entry, talk chapters on gap exit. Pre-VTS gaps (intro) tracked on track start. Track-end in a gap boosts via `triggerChapterAutoBoostRef` in `handleEnded`. **Manual seek suppression** (`isManualSeekRef`): chapter skips/progress bar don't trigger autoboost, only natural playback. **iOS foreground recovery**: `visibilitychange`/`pageshow` detect and boost missed segments.

**Every auto-boost path reports on BOTH branches** via `reportBoost` (`lib/lightning/report-boost.ts`, fire-and-forget, never throws — a reporting failure must not surface as an audio bug). Auto-boost fires while the screen is off, so a toast is not a report: the paths used to POST on success only, and a boost that failed mid-album left no trace outside a console nobody would open. Three functions report — `triggerAutoBoost` and `triggerChapterAutoBoost` in `AudioContext.tsx`, plus the separate `triggerAutoBoost` in `useAutoBoost.ts` (same name, different function) — each on all three of its success / failure / `catch` branches, so nine calls in total. A new unattended payment path must do the same.

- **`recipient` and the artist name are hoisted above the `try`** in `triggerChapterAutoBoost` (`primaryRecipient` / `resolvedArtistName`, assigned once resolved). They are computed mid-`try`, so a late throw would otherwise report `unknown` for the one field you most want in an exception. `trackTitle` genuinely can't be recovered and falls back to the argument.
- **Partial success still carries `failedRecipients`.** `sendMultiRecipientPayment` reports success as soon as *any* recipient is paid, and at ≥50% it replaces the per-recipient errors with a `"Partial success: 2/3"` summary — so without carrying the failures out, a partly-paid boost is indistinguishable from a fully-paid one.

---

## Boost failure triage (`lib/lightning/boost-failure.ts`)
`classifyBoostFailure(reason)` → `{ category, userActionable }`, rendered by `/api/lightning/log-boost` as a greppable `[category user|fix]` tag on every failure line. The point is separating failures the sender must resolve (no wallet, empty balance) from ones we must fix (no V4V config, LNURL erroring, unroutable recipient). Without it every failure reads the same and the fixable ones drown.

- **Rule order in `matchCategory` is load-bearing: specific diagnoses BEFORE the payment method.** `keysend-unsupported` is `userActionable`, i.e. "go switch wallets, nothing for us to do". A bare `text.includes('keysend')` rung sat first and swallowed `Keysend payment failed: insufficient balance` and `Keysend failed - cannot find payment route` — a balance problem and a routing problem, the latter ours — emptying the very bucket this module exists to fill. The rung now sits below `insufficient` / `no route` / `rejected` / `timeout` **and** requires an unsupported phrasing alongside the method name (`KEYSEND_UNSUPPORTED_PHRASES`, which must keep both directions: "keysend not supported" *and* "doesn't support keysend" — the latter contains neither "not supported" nor "unsupported").
- **The literal-message fixture is not enough on its own.** `boost-failure.test.ts`'s `REAL_MESSAGES` pins exact strings from the payment layer, and every one of them that names keysend *also* happened to be an unsupported-wallet message — which is exactly why the bad rung looked correct. Mixed forms (method name + ordinary failure) are tested separately; add there when adding a rung.
- **`/api/lightning/log-boost` logs failures at `console.error`** so they surface in Railway without trawling: a boost that failed entirely, recipients left unpaid on an otherwise-successful split, and a failed platform fee each get their own line. Its in-memory `boostLog` is a **ring buffer capped at `MAX_BOOST_LOG` (500)** — it is process memory on a long-lived instance with nothing evicting it, and entries carry up to 20 `failedRecipients` (~14KB each). The GET reads the tail anyway.
- Tests: `npx tsx --test lib/lightning/boost-failure.test.ts`.

---

## Boost sender name (`lib/lightning/sender-name.ts`)
`sender_name` in the Helipad / BoostBox metadata is read by artists, so it must hold a human name. Two paths put a Nostr identifier there instead, and both stick because the value is persisted: pasting a copied profile link (`nostr:npub1…`), and **browser autofill** reusing a saved Nostr-login value into what was an unnamed `<input type="text">` (truncated to `maxLength`, so the stored value is a 50-char slice of an npub). The input now carries `name` + `autoComplete="off"`, and `looksLikeNostrIdentifier` treats an identifier-shaped stored value as unset — prefix checks, not full bech32 validation, because **truncated values must still match**.

- **Two resolvers, and both are needed.** `resolveBoostSenderName({settingsName, savedName, nostrDisplayName})` for the modal (setting → legacy localStorage → Nostr display name → default). `resolveAutoBoostSenderName(settingsName)` for the unattended paths, which have no modal and no profile to hand — it sanitises the same way and preserves the `"<name> via StableKraft.app"` suffix. **Five call sites** across `AudioContext.tsx` and `useAutoBoost.ts`; sanitising only the modal leaves identifiers riding out on every unattended boost.
- **An identifier-shaped name is never persisted** on a successful boost — `resolveBoostSenderName` would skip it on the next load anyway, so storing it just leaves the two out of step.
- **The field re-prefills on every modal open** (`prefillSenderName` + the `showModal` effect, which also clears `senderNameTouchedRef`). A name typed and abandoned is never persisted, so without this it outlives the setting change or Nostr profile load that should have replaced it. `senderNameTouchedRef` is what stops the async Nostr backfill clobbering something the user is mid-way through typing.
- Tests: `npx tsx --test lib/lightning/sender-name.test.ts`.
