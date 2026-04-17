# Stablekraft App

## Commands
```
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:studio    # Open Prisma Studio
npm run deploy       # Build deployment package (local)
git push origin main # Deploy to production (Railway auto-deploys from git)
```

## Boundaries
- Never commit secrets (`.env`, API keys)
- Run `npm run build` before committing
- No `src/` directory — all source lives in `app/`, `lib/`, `components/`, `contexts/`
- No `deploy-*/` artifacts in the repo — add to `.gitignore` if generated
- No JSON-file databases — all data is in PostgreSQL via Prisma

## Tech Stack
- Next.js 15 (App Router), React 18, TypeScript, PostgreSQL/Prisma
- Podcast Index API for all feed lookups and resolution (never fetch directly from Wavlake — use PI API)
- Nostr for auth, Lightning (Alby/WebLN) for payments

## Architecture

### Two-Repo Setup
- **musicL-playlist-updater** - Generates playlist XML feeds
- **stablekraft-app** (this repo) - Consumes and displays playlists

### Daily Workflow (`.github/workflows/refresh-playlists.yml`)
Runs at 4 AM EST: clears cache -> reparses feeds -> refreshes playlists -> parses publishers -> imports missing albums from publisher feeds (Step 5b via PI API). The `PLAYLISTS` array must include ALL playlist IDs — missing ones won't get nightly processing.

## Key Behaviors

### Playlist Resolution
Playlists use `<podcast:remoteItem>` with `feedGuid` + `itemGuid`. On `?refresh`: discover feeds via PI API → parse → discover publishers → resolve tracks. Resolution rate ~80-90%.

**Feed deduplication pattern**: multi-check dedup (normalized URL, raw URL, feedGuid as ID, feedGuid as GUID column, feedGuid-in-URL substring, then secondary `podcastGuid` check). New feeds get slug-based IDs via `generateAlbumSlug`. When modifying feed import code, follow this pattern — weak dedup causes duplicate entries.

**Podcast type detection**: Non-Wavlake feeds with `<podcast:medium>podcast</podcast:medium>` auto-detect as `type: 'podcast'` on import. Wavlake feeds are excluded from this (they use `medium=podcast` for music). Feeds with `type: 'podcast'` auto-appear under the Podcasts filter and are excluded from the album grid. If mistyped feeds appear, run `POST /api/admin/fix-podcast-types`.

**PI API status gotcha**: `normalizeFeedResponse` in `lib/podcast-index-api.ts` must accept both `status: 'true'` (string) and `status: true` (boolean). Use `data.status !== 'true' && data.status !== true` for rejection checks.

**Podroll exclusion**: `process-remote-items/route.ts` strips `<podcast:podroll>` sections before extracting `<podcast:remoteItem>` tags. Without this, podroll-referenced feeds get imported as albums.

### Feed Blacklist (`lib/feed-exclusions.ts`)
Central exclusion config: `BLACKLISTED_FEED_IDS`, `BLACKLISTED_FEED_URLS`. Helpers: `isBlacklistedFeedId()`, `isBlacklistedFeedUrl()`.

### Admin Feed Management (`/admin`)
Single input handles both add and reparse. Type dropdown (Auto-detect/Album/Publisher/Podcast) next to URL input — use for feeds whose URL doesn't match auto-detect patterns. Auto-detects type from URL (`-pubfeed`, `/publisher`, `/artist/` = publisher). **Server-side fallback**: feeds with 0 items + `<podcast:remoteItem>` references auto-detect as publisher. **GUID collision handling**: if a publisher feed's `podcast:guid` collides with an existing album, the feed is created without GUID rather than failing. **Fixing duplicates**: delete all copies first (`DELETE /api/feeds?id=<feedId>`), then re-add. Initial import (`POST /api/feeds`) saves all parsed fields including chapters, VTS, and V4V via `applyParsedItemFields()` — no reparse needed.

### Adding Music Podcasts (like Upbeats, Two For Tunestr)
Import feed via `/admin` page (paste RSS URL). Non-Wavlake feeds with `<podcast:medium>podcast</podcast:medium>` automatically get `type: 'podcast'`, appear under the Podcasts filter, hide from the album grid, and are searchable — no config file edits needed. `/podcast/[id]` dynamic route handles display, episodes sort newest-first.

**Slug redirects**: If the auto-generated feed ID differs from the desired URL slug (e.g., `silvie-two-for-tunestr` vs `two-for-tunestr`), add mappings to `PODCAST_SLUG_TO_FEED_ID` and `PODCAST_CANONICAL_SLUGS` in `lib/podcast-feeds.ts`.

**After import**: Reparse the feed from the admin page to ensure chapters and VTS are populated (the initial import may miss them if the chapters proxy is down).

### Search
- PostgreSQL trigram `similarity()`, flat 0.3 threshold. Do NOT lower below 0.3 — causes false positives.
- Artist search groups by `LOWER(artist)`. Exact mode: `?fuzzy=false`
- Podcasts searchable by title/artist/description (queries `type: 'podcast'` feeds)

### Publisher Pages (`app/publisher/[id]/page.tsx`)
Matched by: title slug, artist slug, or URL path. Multi-feed support with per-platform sections. Album resolution: (1) GUIDs/URLs from publisher feed XMLs → (2) `publisherId`-linked albums → (3) artist name matching. Do NOT re-add platform filters — hides legitimate cross-platform albums. **Section labels** use the publisher feed's URL for platform detection (not album URLs), so a self-hosted publisher feed referencing Wavlake-hosted albums shows "(henrikflyman.com)" not "(Wavlake)". **`linkAlbumsToPublisher`** only links albums with `publisherId: null` — albums already linked to another publisher are skipped. To re-link, use `PUT /api/feeds` with `{ id, publisherId }`. **Phantom publisher IDs**: some albums have a `publisherId` that doesn't correspond to a feed record (e.g., Wavlake artist GUIDs auto-assigned during import). The publisher page creates synthetic feed info for these.

### Duration Filtering
Tracks over 2 hours filtered as non-music (silent, no warnings)

### NIP-46 Remote Signer (Amber / Primal / bunker)
Key files: `lib/nostr/nip46-client.ts`, `lib/nostr/signer.ts` (NIP46Signer wrapper), `components/Nostr/hooks/useNip46Connection.ts`, `lib/nostr/signer-nudge.ts`. iOS Safari kills WebSocket connections after ~30s backgrounded; reconnects on `visibilitychange`. **Primal is the best iOS signer** — auto-signs with Full trust, responds <1s. Performance optimizations (adaptive rate limiting, pre-decrypted content, smart subscription filters, keypair cache) are gated behind `localStorage.setItem('nip46_debug', 'true')` for debug logging.

**Signer nudge toast** (`lib/nostr/signer-nudge.ts`): `withSignerNudge()` wraps `signEvent`/`getPublicKey`, shows dismissable toast after **4s** ("Waiting on Primal to approve…"), hard-fails at **45s**. `NIP46Signer.signEvent`/`getPublicKey` in `signer.ts` route through it automatically; direct `client.signEvent` callers in `LoginModal` also wrap manually. Throttled to 8s so bursts don't spam toasts. Pattern adapted from `soapbox-pub/ditto`.

**iOS PWA reconnect feedback**: `useNip46Connection`'s `visibilitychange` handler emits `toast.success('Signer reconnected')` on successful reconnect, or an actionable red toast with Retry on failure. No more silent hangs. `NostrProvider` (`contexts/NostrContext.tsx:88`) has its *own* `visibilitychange` handler that reconnects the NIP-46 relay on every page — the modal-scoped hook only fires while `LoginModal` is mounted, so the provider-scoped handler is what keeps boost/favorite working on `/favorites`, NowPlaying, etc. Do **not** delete it as "redundant".

**Reconnect ordering** (`lib/nostr/signer-reconnect.ts:317` `ensureSignerAvailable`, `:380-397` the fast-path): try `verifyNIP46Connection()` on the live in-memory NIP-46 client *before* `restoreNIP46Connection()` rebuilds from localStorage. The in-memory client has session state (signer app pubkey, bunker relays, rate-limit counters) that localStorage can't fully reproduce, and Safari ITP may have cleared storage entirely. `nip46-client.ts:authenticate()` also checks actual `WebSocket.readyState` via `relayManager.isConnected()` and force-reconnects dead sockets via `startRelayConnection()` — replacing an earlier passive 3s wait that never recovered. Do **not** invert this ordering or remove the explicit WebSocket-state check.

**Multi-relay bunker URIs** (`lib/nostr/nip46-client.ts:309` `bunkerRelays`, `:3276-3277` publish fan-out): bunker:// URIs with multiple `relay=` params are subscribed *and* published across all listed relays, not just the first. Survives one-relay blocks (e.g. Firefox blocks `relay.primal.net`). Secretless bunker URIs (Aegis-style) have a 25s fail-fast timeout since they require manual signer approval. Do **not** "simplify" back to first-relay-only.

**Connection persistence** (`lib/nostr/nip46-storage.ts:48` `saveNIP46Connection`): the signer's app-pubkey is read via a three-way fallback `signerAppPubkey || (connection as any).signerPubkey || (connection as any).actualSignerAppPubkey` because the value gets stashed under different property names by different call sites — `handleRelayEvent` writes `signerPubkey` from the connect-response, `connectDirect` writes `actualSignerAppPubkey` on restore, only the explicit client save path writes the canonical `signerAppPubkey`. `LoginModal` invokes `saveNIP46Connection` twice during login; without the fallback the second save wipes the value and post-reload `sign_event` requests get encrypted with the user's pubkey instead of the signer's → 120s hang on every Primal boost/favorite. Do **not** simplify back to a single field read.

### Nostr Login Modal (`components/Nostr/LoginModal.tsx`)
**Card-menu UI** (pattern from `hzrd149/nostrudel`) — no tabs. Cards: Browser Extension (shown only if `window.nostr` detected), Bunker URI (paste `bunker://` / `nostrconnect://`), Amber (Android), Primal (QR code). `view` state: `'menu' | 'bunker' | 'primal' | 'amber'` (`LoginModal.tsx:30`). The old "More options (nostr-login)" card was removed in PR #98 — with `noBanner: true` the `<nl-auth>` element never mounts, so clicking it dismissed the modal with nothing rendered. `NostrLoginInit.tsx` is still mounted for session-restore of legacy nostr-login users.

**Extension path is fast-path**: `handleExtensionLogin` calls `window.nostr.signEvent(eventTemplate)` **directly**, not through `UnifiedSigner`. Any future login UX change for extensions should keep this direct path.

**Bunker URI path**: `handlePastedUriConnect` uses a fresh `NIP46Client` + `signer.setNIP46Signer(client)` — bypasses nostr-login entirely. Most reliable iOS PWA path (relay-based, no native-app switching).

**nostr-login is lazy-init**: `components/Nostr/NostrLoginInit.tsx` exports `ensureNostrLoginInitialized()` (called on demand from `handleNostrLogin`) and `<NostrLoginAutoInit />` (mounts in `layout.tsx`, only runs `init()` if user is logged in AND `window.nostr` is absent — i.e., session-restore for nostr-login-polyfilled users). Extension users and logged-out users pay zero cost. Do **not** reintroduce eager init.

### Post-Login Flow (`lib/nostr/auth-utils.ts`)
Login flows save user data, set `localStorage['nostr_pending_favorites_sync'] = user.id`, close the modal, and reload — **no delay**. `NostrContext`'s mount effect picks up the flag, runs `syncFavoritesToNostr`, and clears it. Running sync pre-reload aborted the in-flight fetches when reload fired; deferring is cleaner and has no warning noise.

When adding new login paths (NIP-46, nostr-login, etc.), call `markFavoritesSyncPending(userId)` instead of firing sync inline.

**Profile backfill** (`contexts/NostrContext.tsx:174-185`): the login route (`app/api/nostr/auth/login/route.ts`) intentionally returns `displayName`/`avatar`/`bio`/`lightningAddress` as null to avoid a ~21s relay round-trip (login now completes in ~20ms). `NostrContext` auto-calls `refreshUser()` on mount whenever `user.displayName` is falsy — fetches the kind-0 profile from relays in the background, updates the DB row, and re-renders. Do **not** reintroduce the synchronous profile lookup in the login route; the 1000× perf delta was the whole point of PR #98. The login route also only updates `nostrNpub` on returning users so a fresh login can't wipe previously-fetched profile fields.

### iOS PWA Background Audio (`contexts/AudioContext.tsx`)
Three-layer strategy: (1) preload at 15s before end, (2) proactive timer at 5s before end, (3) visibility change safety net. `trackEndProcessedRef` prevents double-advance. **Critical**: do not auto-resume if user explicitly paused.

### Sorting
`/api/albums-fast` accepts `sort` param (`added-desc`, `added-asc`, `year-desc`, `year-asc`, `name-asc`, `name-desc`, `tracks-desc`, `tracks-asc`). **Do NOT send `sort=name-asc` as default** — it bypasses format grouping (Albums → EPs → Singles). Date fields: `Feed.oldestItemPubdate` = release date, `Feed.createdAt` = when added.

### `/api/albums-fast` track fields (critical gotchas)
The main-grid play button plays tracks straight from this endpoint — whatever fields are missing here don't show up on the Now Playing screen.

- **Two Track `select` blocks**: one in the general path (~line 163) and another inside the `case 'podcasts'` branch (~line 451). When adding a field, update **both**. They have different indentation so a naive `replace_all` only hits one.
- **Must include `chaptersUrl`, `chapters`, `valueTimeSplits`** in both selects and both track-mapping blocks — otherwise podcast chapter ticks/titles and VTS playback silently fail when playing from the grid (works from `/podcast/[id]` because that uses `/api/albums/[slug]` which already selects them).
- **Bump `API_VERSION` in `app/page.tsx`** whenever the response shape changes. The main page caches responses under `localStorage['cachedAlbums_${N}_${API_VERSION}']` and without a bump, users keep serving themselves stale, field-missing data indefinitely. Comment on the constant when bumping so the next change remembers.
- **15-minute in-memory server cache** in `albums-fast/route.ts` — Railway redeploy clears it; manual clear is `POST /api/admin/clear-cache`.

### Adding New Playlists
Files to modify (9 total):
1. `lib/playlist/configs.ts` - Config entry
2. `app/api/playlist/[id]/route.ts` - Main API route
3. `app/api/playlist/[id]-fast/route.ts` - Fast API route
4. `lib/playlist-track-counts.ts` - `FALLBACK_COUNTS` and `PLAYLIST_URLS`
5. `app/api/playlists-fast/route.ts` - Playlist summary
6. `app/page.tsx` - Fallback `Promise.allSettled` array
7. `app/playlist/[id]/page.tsx` - Dedicated page (`PlaylistTemplateCompact`)
8. `app/favorites/page.tsx` - `playlistTitles`, `playlistImageFallbacks`, `playlistSlugOverrides`
9. `.github/workflows/refresh-playlists.yml` - Add to `PLAYLISTS` array

Populate: `curl https://stablekraft.app/api/playlist/[id]?refresh`

### Nostr Publish Queue & Relay Management
Favoriting saves to DB immediately, queues Nostr publish (500ms debounce). **Always call `disconnectAll()`** after publishing or WebSocket connections leak. Key files: `lib/nostr/publish-queue.ts`, `lib/nostr/relay.ts`.

**NIP-01 tag validation**: `createFavoriteEventTemplate` (in `lib/nostr/favorites.ts`) throws if `itemId` is falsy so we never publish events with `["d", null]` tags — strict relays (nsec.app) reject them with "failed to parse envelope". When adding new NIP-51/30001-style parameterized replaceable events, validate all required tag values are non-empty strings at build time, not at publish time.

**Dead-socket filtering** (`RelayManager.publish`): write relays are filtered by `relay.connected !== false` before publishing. Personal NIP-65 relays often accept connect but close the socket before publish runs → nostr-tools throws `SendingOnClosedConnection` synchronously. Each `relay.publish()` is wrapped in `Promise.resolve().then(...)` so any remaining sync throws flow cleanly through `Promise.allSettled` instead of surfacing as unhandled rejections.

**Stale-signer recovery** (`lib/nostr/publish-queue.ts:101` `flushQueue`): routes through `ensureSignerAvailable()` from `signer-reconnect.ts:317` (same wrapper `BoostButton.tsx` uses) instead of a manual `isAvailable() + NIP-55-only` branch. Without this, a stale singleton signer (iOS WebSocket killed during backgrounding, page-mount race, first-flush after reload) silently dropped the favorite — boost was unaffected because it already gated on `ensureSignerAvailable`. Do **not** revert to the manual branch.

### Favorites Page (`/favorites`)
Optimistic unfavorite, auto-sync on page load. **Playlist favorites gotcha**: `isPlaylist()` and `playlistImageFallbacks` must use **lowercased feedId**, not the human name. `playlistSlugOverrides` handles ID-to-slug mismatches. Nostr playlist publishing: Kind 34139 addressable event (`d` tag = `stablekraft-favorites`).

### Favorite Publishers Resolution (`app/api/favorites/albums/route.ts`)
Three feedId formats: synthetic artist IDs (`artist-adam-curry`), feed GUIDs, feed IDs. Image chain: DB → PI API → album feed image by artist name.

### BackButton (`components/BackButton.tsx`)
Uses `window.history.length`. Do NOT use `document.referrer` — doesn't update during SPA navigation.

### Lightning Wallet Detection
Keysend inferred from provider type (`hasKeysendMethod && type !== 'unknown'`). Do NOT probe with real keysend — triggers payment popup. Alby extension detection: `detectWalletProviderType()` in `lib/lightning/wallet-detection.ts`.

### BoostBox & Helipad (`lib/lightning/boostbox.ts`)
LNURL payments use [BoostBox](https://tardbox.com) for Podcasting 2.0 boost metadata. Keysend unaffected (uses Helipad TLV). Client-only — always uses `/api/lightning/boostbox` proxy (API key via `BOOSTBOX_API_KEY` env var). Value splits try keysend first; BoostBox called only for LNURL fallback. Fountain.fm addresses skip keysend by design (`isFountain` check).

**Feed.guid gotcha**: `feed_guid` in BoostBox comes from `Feed.guid` in DB. If null, reparse the feed.

**Helipad metadata**: built by `buildHelipadMetadata(amount, msg)` in `BoostButton.tsx`, BLIP-0010 spec. Single helper for all payment paths — do NOT duplicate. `name` field omitted from base; `value-splits.ts` sets it per-recipient.

**BoostButton props**: `feedUrl`, `remoteFeedGuid` (must be real GUID, never feed slug/ID), `albumName`, `publisherGuid`, `episodeGuid` (omit for album-level). Do NOT fall back to `feedId` for `remoteFeedGuid` — it's a slug, not a GUID.

### VTS (Value Time Splits) Playback (`components/NowPlayingScreen.tsx`)
VTS podcasts embed `<podcast:valueTimeSplit>` segments that map time ranges to different tracks/artists. Features: chapter tick marks on progress bar, per-song favoriting via `remoteItem`, V4V blending (`remotePercentage` splits between song and show recipients, deduped by address, `isHost` flag for grouping). GUID collision detection via `chapterTitle` param to `/api/lightning/value-splits`. When VTS blending produces both song and show recipients, BoostButton shows **Song/Show section headers** sorted track-first.

**VTS extraction** (`lib/rss-parser-db.ts`): `applyParsedItemFields` applies chapters, VTS, and other parsed fields to track data. **VTS remoteItem interface** (`lib/podcast-types.ts`): `feedGuid`, `itemGuid`, `medium`. **XML entity gotcha**: `parseItemV4VFromXML` matches titles against raw XML — titles with `&` (encoded as `&amp;`) need both decoded and XML-encoded matching.

**Chapters fallback**: `fetchChapters()` fetches from `podcast:chapters` URL. If the `reflex.livewire.io` proxy returns 400, it extracts the direct URL from the proxy path (format: `.../chapters/https://actual-url.json`) and retries.

### AutoBoost (`contexts/AudioContext.tsx`)
Two paths gated by `autoBoostEnabled` setting and `autoBoostProcessingRef` mutex:
- **`triggerAutoBoost`** — track end for non-VTS tracks. Falls back from track-level to album-level V4V.
- **`triggerChapterAutoBoost`** — VTS segment transitions. Fetches remote V4V, scales by `remotePercentage`, blends show-host recipients. Non-music chapters use show-level V4V only. API fallback via `feedGuid` if `album.v4vValue` is empty.

**Gap tracking** (`inVtsGapRef`): boosts music segments on gap entry, talk chapters on gap exit. Pre-VTS gaps (intro) tracked on track start. Track-end in a gap boosts via `triggerChapterAutoBoostRef` in `handleEnded`. **Manual seek suppression** (`isManualSeekRef`): chapter skips/progress bar don't trigger autoboost, only natural playback. **iOS foreground recovery**: `visibilitychange`/`pageshow` detect and boost missed segments.

### Toast API (`components/Toast.tsx`)
Event-driven via `window.dispatchEvent(new CustomEvent('toast', ...))`. Helpers `toast.success/error/warning/info(message, { duration, action })` return the toast id (string). Use `toast.dismiss(id)` to programmatically remove a toast (used by `signer-nudge.ts` to clear the "Waiting on your signer…" toast the moment signing completes). A dismiss listens for a `toast-dismiss` CustomEvent.

### Episode/Play Count Markers
`<podcast:txt purpose="episode">` or `<podcast:txt purpose="playcount">` in XML. Parser decodes XML entities via `decodeXmlEntities()` in `lib/playlist/parser.ts`. Original titles stored in `SystemPlaylistTrack.episodeTitle` — do NOT reverse-engineer from episode IDs (lossy). Refresh: `curl https://stablekraft.app/api/playlist/[id]?refresh`
