# Stablekraft App

## Commands
```
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:studio    # Open Prisma Studio
npm run deploy       # Build deployment package (local)
git push origin main # Deploy to production (Railway auto-deploys from git)

# Android / zapstore (requires JDK 21 + ~/.stablekraft-android.env)
npm run android:sync                                                                  # Copy web assets into android/
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release  # Signed release APK
zsp publish --skip-certificate-linking                                                # Publish new release to zapstore
```

## Boundaries
- Never commit secrets (`.env`, API keys)
- Run `npm run build` before committing
- No `src/` directory — all source lives in `app/`, `lib/`, `components/`, `contexts/`
- No `deploy-*/` artifacts in the repo — add to `.gitignore` if generated
- No JSON-file databases — all data is in PostgreSQL via Prisma
- Android keystore lives at `~/keystores/stablekraft-release.jks`; credentials in gitignored `~/.stablekraft-android.env`. Never commit either. Losing the keystore = losing the ability to ship updates to installed users.

## Tech Stack
- Next.js 15 (App Router), React 18, TypeScript, PostgreSQL/Prisma
- Podcast Index API for all feed lookups and resolution (never fetch directly from Wavlake — use PI API)
- Nostr for auth, Lightning (Alby/WebLN) for payments

## Architecture

### Two-Repo Setup
- **musicL-playlist-updater** - Generates playlist XML feeds
- **stablekraft-app** (this repo) - Consumes and displays playlists

### Daily Workflow (`.github/workflows/refresh-playlists.yml`)
Runs at 4 AM EST: clears cache → reparses feeds → refreshes playlists → parses publishers → imports missing albums from publisher feeds (Step 5b via PI API). The `PLAYLISTS` array must include ALL playlist IDs — missing ones won't get nightly processing.

### Podping Consumer Integration
External service `msp-podping-service` (repo `ChadFarrow/msp-podping-service`) tails Hive for `pp_music_*` **and** `pp_podcast_*` podpings and calls back into this app, closing the gap between the 4am batch refresh and actual publisher updates (~1 min latency). Podcast-medium hosts (Podhome, RSSBlue) typically emit `pp_podcast_*`; keep the filter permissive. Note: Podhome does not emit podpings for all feeds (UpBeats as of 2026-04-19 relies on manual MSP pushes + the scheduled-window cron).

Three public endpoints (none auth-gated today):
- `GET /api/feeds/exists?url=<URL>` or `?guid=<GUID>` → `{ exists: boolean }`. Blacklisted URLs always return `false` so podpings can't revive removed feeds. Reuses `isBlacklistedFeedUrl()` from `lib/feed-exclusions.ts`.
- `POST /api/feeds/refresh-by-url` with `{ originalUrl }` — when the feed already exists. Lookup tries URL variants (normalized + raw + original) first, then falls back to `Feed.guid`/`Feed.id` matched against a UUID extracted from the URL path (`extractUuidFromUrl` in `lib/url-utils.ts`). **Why:** some hosts store and podping-broadcast different URLs for the same feed (UpBeats: DB has `feeds.rssblue.com/upbeats`, podping carries `serve.podhome.fm/rss/<uuid>`) — without this fallback every podping minted an orphan Feed row. Do **not** remove the fallback.
- `POST /api/feeds` with `{ originalUrl, type: 'album' }` — **only** when signed by our MSP Hive account (`chadf`). Unknown signers + unknown URLs are ignored. **Why:** strangers' podpings can refresh existing feeds, but only our own MSP deploys can spawn new feed records. Signer-gate is enforced client-side in the consumer (`required_posting_auths` check at `consumer/src/index.ts:178`), not in this app — `POST /api/feeds` itself has no auth.

When modifying these endpoints, check consumer expectations in `msp-podping-service/consumer/src/index.ts` — if adding auth, wire a shared-secret env var into the consumer too.

### Targeted Podcast Reparse (`.github/workflows/refresh-podcasts-targeted.yml`)
Every 30 min from 11:00–13:59 UTC on Sundays (UpBeats) and Tuesdays (Two For Tunestr) — the observed publish windows (7 AM Eastern year-round, UTC shifts ±1h on DST). Complements the 4 AM nightly Step 2b and podping (~1 min). Catches episodes from podping-free hosts within ~30 min. Day-of-week check inside the workflow means off-day cron ticks early-exit at zero cost. When adding a curated podcast with a predictable publish schedule, update both this file's `PODCAST_FEEDS` array (and day switch if a new weekday) **and** `refresh-playlists.yml` Step 2b.

### Android Distribution (zapstore)
App is on [zapstore.dev/apps/app.stablekraft](https://zapstore.dev/apps/app.stablekraft) as a Capacitor 8 WebView wrapping `https://stablekraft.app`. No Next.js/backend changes per release — the APK just loads the live site.

**Fixed identity (never change):** appId `app.stablekraft`, keystore alias `stablekraft`, cert SHA-256 `27f4191931eeca09382066360f49abe68136be5656fc1429cd0bb952b1aff48e`. Any mismatch breaks updates for installed users.

**Per-release flow:** bump `versionCode`/`versionName` in `android/app/build.gradle:10-11` → build (see Commands) → `gh release create vX.Y.Z android/app/build/outputs/apk/release/app-release.apk --repo ChadFarrow/stablekraft-app` → `zsp publish --skip-certificate-linking` (reads `zapstore.yaml` at repo root).

**Gotchas:**
- **Capacitor 8 requires JDK 21** (system is 17). Always prefix builds with `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.
- **`server.url` in `capacitor.config.ts`** makes the APK a thin shell — a Railway outage blanks the app. Offline mode would need removing `server.url` and embedding a static export.
- **Do NOT propose Bubblewrap/TWA.** Torn out; always Capacitor WebView.
- **`zsp` CLI:** use the prebuilt `zsp-X.Y.Z-darwin-arm64` from [github.com/zapstore/zsp/releases](https://github.com/zapstore/zsp/releases) → `~/.local/bin/zsp`. Do NOT `go install` — system Go is amd64 and produces a Rosetta binary.
- **Signing:** NIP-07 extension needs 5 sequential popup approvals — easy to time out. Prefer `SIGN_WITH='bunker://…'` with Primal set to Full trust.
- **`--skip-certificate-linking`** required on every publish after v1.0.0 (cert-to-Nostr link is one-shot, already done).
- **`zapstore.yaml` NIP list:** wizard emits `- 01,` with trailing commas inside string entries. Hand-fix to `- 01` (integer) or the published event carries malformed NIPs.
- **Env file:** keystore creds in `~/.stablekraft-android.env` (chmod 600). `STABLEKRAFT_KEY_PASSWORD` = `STABLEKRAFT_KEYSTORE_PASSWORD` (PKCS12 default when `-keypass` is omitted).

## Key Behaviors

### Playlist Resolution
Playlists use `<podcast:remoteItem>` with `feedGuid` + `itemGuid`. On `?refresh`: discover feeds via PI API → parse → discover publishers → resolve tracks. Resolution rate ~80-90%.

**Feed deduplication pattern**: multi-check dedup (normalized URL, raw URL, feedGuid as ID, feedGuid as GUID column, feedGuid-in-URL substring, then secondary `podcastGuid` check). New feeds get slug-based IDs via `generateAlbumSlug`. When modifying feed import code, follow this pattern — weak dedup causes duplicate entries.

**Podcast type detection**: Non-Wavlake feeds with `<podcast:medium>podcast</podcast:medium>` auto-detect as `type: 'podcast'` on import. Wavlake feeds are excluded (they use `medium=podcast` for music). Feeds with `type: 'podcast'` auto-appear under the Podcasts filter (direct `type='podcast'` query bypassing the blacklist) and hide from the album grid. **`POST /api/admin/fix-podcast-types` flips `type: 'podcast'` → `'album'` for any feed NOT in the curated `PODCAST_FEED_IDS`/`PODCAST_FEED_URLS` allowlist** (`lib/podcast-feeds.ts`) — use to clean up misdetected podcasts, NOT to promote albums (use admin Podcast dropdown for that).

**PI API status gotcha**: `normalizeFeedResponse` in `lib/podcast-index-api.ts` must accept both `status: 'true'` (string) and `status: true` (boolean). Use `data.status !== 'true' && data.status !== true` for rejection checks.

**Podroll exclusion**: `process-remote-items/route.ts` strips `<podcast:podroll>` before extracting `<podcast:remoteItem>` tags — without this, podroll-referenced feeds get imported as albums.

### Feed Exclusions (`lib/feed-exclusions.ts`)
Two lists with different semantics:

- **`BLACKLISTED_FEED_IDS` / `BLACKLISTED_FEED_URLS`** — true bans. Applied everywhere: album grid (`albums-fast`), search, `/api/feeds/exists`, `process-remote-items`, admin bulk-import. Historical use case: `bitpunk-fm-unwound` kept getting auto-imported as an album and polluting the grid. Test feeds (`lnurl-test-*`, `podtards-test`) live here too.
- **`PLAYLIST_SOURCE_FEED_URLS`** — URLs of the podcast feeds backing curated playlists (B4TS, MMM, HGH, LT, Upbeats, IAM, ITDV, Two For Tunestr). Checked **only** by `process-remote-items` so nightly playlist refresh can't auto-create feed records for them. Admin-initiated imports (`POST /api/feeds`) never consulted the blacklist anyway, so admin can still add any of these as standalone music podcasts via `/admin`.

Helpers: `isBlacklistedFeedId()`, `isBlacklistedFeedUrl()`, `isPlaylistSourceFeedUrl()`. Do **not** move playlist-source URLs back into the blacklist — the original bug (bab/bitpunkfm auto-listing as albums) is still prevented for true blacklist entries, while admin retains the ability to promote any playlist source into the Podcasts tab.

### Admin Feed Management (`/admin`)
Single input handles both add and reparse. Type dropdown (Auto-detect/Album/Publisher/Podcast) — use when URL doesn't match auto-detect patterns. Auto-detects type from URL (`-pubfeed`, `/publisher`, `/artist/` = publisher). **Server-side fallback**: feeds with 0 items + `<podcast:remoteItem>` references auto-detect as publisher. **GUID collision handling**: if a publisher feed's `podcast:guid` collides with an existing album, the feed is created without GUID rather than failing. **Fixing duplicates**: delete all copies first (`DELETE /api/feeds?id=<feedId>`), then re-add. Initial import (`POST /api/feeds`) saves all parsed fields including chapters, VTS, and V4V via `applyParsedItemFields()` — no reparse needed.

### Adding Music Podcasts (like Upbeats, Two For Tunestr, B4TS)
Import via `/admin` (paste RSS URL). Non-Wavlake feeds with `<podcast:medium>podcast</podcast:medium>` automatically get `type: 'podcast'`, appear under the Podcasts filter, hide from the album grid, and are searchable — no config edits needed. `/podcast/[id]` dynamic route handles display, episodes sort newest-first.

**If the feed is also a playlist source** (B4TS, MMM, HGH, LT, Upbeats, IAM, ITDV, Two For Tunestr): it's in `PLAYLIST_SOURCE_FEED_URLS`, which blocks nightly auto-import but leaves admin add open. After import, register it as a curated podcast to lock in type and slug: add to **`PODCAST_FEED_IDS`** + **`PODCAST_FEED_URLS`** in `lib/podcast-feeds.ts` so `fix-podcast-types` can't flip it back to album, plus **`PODCAST_SLUGS`** + **`PODCAST_SLUG_TO_FEED_ID`** + **`PODCAST_CANONICAL_SLUGS`** to redirect `/album/<slug>` → `/podcast/<canonical-slug>`.

**If auto-detect misses the type** (feed lacks `medium=podcast`, or album-typed record from pre-detection import): delete with `DELETE /api/feeds?id=<feedId>` and re-add via `/admin` with the **Podcast** dropdown. Expect the DB id to change (e.g., `f38e27af-...` → `boo-bury-before-the-sch3m3s`).

**Slug redirects**: if the auto-generated feed ID differs from the desired URL slug (e.g., `silvie-two-for-tunestr` vs `two-for-tunestr`), add mappings to `PODCAST_SLUG_TO_FEED_ID` and `PODCAST_CANONICAL_SLUGS` in `lib/podcast-feeds.ts`.

**After import**: reparse from the admin page to ensure chapters and VTS are populated (initial import may miss them if the chapters proxy is down).

### Admin Database Cleanup (`/admin`, two-step)
**Step 1 Parse Missing Tracks** → `GET /api/playlist/parse-feeds-stream`, **Step 2 Check for Orphaned Items** → `/api/admin/orphaned-items`.

**Step 1** (`app/api/playlist/parse-feeds-stream/route.ts`): walks feeds with `status='active' AND type != 'publisher' AND Track.none()`, `take: 500`. Do **not** drop the `type != 'publisher'` filter — reclassified publishers never have tracks by design and would reappear every run, exhausting the budget. SSE emits per-feed `feedError`/`feedInfo` events with categorized `reason`: `publisher-via-medium`, `publisher-via-url`, `publisher-no-items`, `rss-fetch-failed`, `rss-zero-items`, `no-url-no-api-match`, `import-failed`, `exception`, `tracks-owned-elsewhere`. AdminPanel renders a collapsible per-feed log with reason-count summary. `parseFeedXML` always returns `{ episodes, xmlText, fetchError? }` (never null) so HTTP status / exception detail rides into `feedError.message`; 15s `AbortSignal.timeout` prevents a stalled feed from blocking the batch.

**Publisher reclassification has three signals, in order**:
1. PI API `feedData.medium === 'publisher'` from `byguid` — covers RSSBlue, Fountain, phafe.
2. URL shape `^https?://wavlake\.com/feed/artist/<uuid>`. PI API does **not** surface `medium` for Wavlake artist feeds even though their XML carries `<podcast:medium>publisher</podcast:medium>`, so URL is the only pre-fetch signal. Wavlake's `/feed/music/` = albums, `/feed/artist/` = publishers by construction. Do **not** remove this — Wavlake IP-rate-limits Railway (`HTTP 429` after ~50 sequential fetches).
3. Post-RSS `xmlText.includes('<podcast:remoteItem')` when fetch succeeds with zero `<item>` tags.

**`tracks-owned-elsewhere` reason** flags silent-loss: `Track.guid @unique` + unscoped dedup in `importFeedToDatabase` means an episode whose guid already exists under another feed falls into the "update" branch without re-linking `feedId` — metadata refreshes and `parsed++` fires, but zero tracks land, so the feed reappears next run. A post-import `prisma.track.count({ where: { feedId } })` check catches this and emits the canonical claimants. Fix tracked in `project_feed_duplicate_dedup.md`.

**Step 2** (`app/api/admin/orphaned-items/route.ts`): orphan = `type='album' AND Track.none()`. Publishers + podcasts + any album with tracks are preserved regardless of curated-playlist membership. Do **not** revert to the older "not-in-any-system-playlist" definition — it would nuke every publisher, every podcast, and every manually-added album outside the 9 curated playlists. The per-feed delete button on the Add-Feed UI handles one-offs.

**Gap — not caught by Step 2**: `type='publisher'` rows with tracks (the orphan query only targets `type='album'`). Can occur when `refresh-by-url` used to ingest episodes into a broken `feed-error-*` placeholder row before the guid-fallback lookup landed (2026-04-19). Clean up manually with `DELETE /api/feeds?id=<feedId>`. Should be rare post-fix; check with `SELECT id, title, type, _count FROM "Feed" WHERE id LIKE 'feed-error-%' OR id LIKE 'feed-%'` when auditing.

**Preview annotates each orphan with its canonical claimant** (matching title + artist + has tracks): green `→ duplicate of {id}` for safe deletes, red `⚠ no canonical match` for review. Roll-up header shows `N safe duplicates · M need review` across the full cohort (not just the 50-row sample).

### Search
- PostgreSQL trigram `similarity()`, flat 0.3 threshold. Do NOT lower below 0.3 — causes false positives.
- Artist search groups by `LOWER(artist)`. Exact mode: `?fuzzy=false`.
- Podcasts searchable by title/artist/description (queries `type: 'podcast'` feeds).

### Publisher Pages (`app/publisher/[id]/page.tsx`)
Matched by title slug, artist slug, or URL path. Multi-feed support with per-platform sections. Album resolution: (1) GUIDs/URLs from publisher feed XMLs → (2) `publisherId`-linked albums → (3) artist name matching. Do NOT re-add platform filters — they hide legitimate cross-platform albums.

**Section labels** use the publisher feed's URL for platform detection (not album URLs), so a self-hosted publisher feed referencing Wavlake-hosted albums shows "(henrikflyman.com)" not "(Wavlake)". **`linkAlbumsToPublisher`** only links albums with `publisherId: null` — already-linked albums are skipped. To re-link, use `PUT /api/feeds` with `{ id, publisherId }`.

**Phantom publisher IDs**: some albums have a `publisherId` that doesn't correspond to a feed record (e.g., Wavlake artist GUIDs auto-assigned during import). The publisher page creates synthetic feed info for these.

### Duration Filtering
Tracks over 2 hours filtered as non-music (silent, no warnings).

### Explicit Flag
Show-level `album.explicit` uses `feed.explicit ?? false` only (channel `<itunes:explicit>`). Do **not** aggregate from track-level explicit flags — that diverges from Apple Podcasts convention. UpBeats example: channel tag `false` but 2/78 episodes flagged explicit; the previous `tracks.some(t.explicit) || feed.explicit` aggregation wrongly flipped the whole show to explicit. Per-track `explicit` is unchanged; `AlbumDetailClient` renders per-row "E" badges on individual explicit episodes. Call sites: `app/api/albums/[slug]/route.ts:1228,1394`, `app/api/albums/route.ts:499`, `app/api/parsed-feeds/route.ts:112`.

### NIP-46 Remote Signer (Amber / Primal / bunker)
Key files: `lib/nostr/nip46-client.ts`, `lib/nostr/signer.ts` (NIP46Signer wrapper), `components/Nostr/hooks/useNip46Connection.ts`, `lib/nostr/signer-nudge.ts`. iOS Safari kills WebSockets after ~30s backgrounded; reconnects on `visibilitychange`. **Primal is the best iOS signer** — auto-signs with Full trust, responds <1s. Debug logging gated behind `localStorage.setItem('nip46_debug', 'true')`.

**Signer nudge toast** (`lib/nostr/signer-nudge.ts`): `withSignerNudge()` wraps `signEvent`/`getPublicKey`, shows dismissable toast after **4s** ("Waiting on Primal to approve…"), hard-fails at **125s** (outside the NIP-46 client's 120s relay-request timeout so the client's richer error surfaces first). `NIP46Signer.signEvent`/`getPublicKey` route through automatically; direct `client.signEvent` callers in `LoginModal` wrap manually. Throttled to 8s.

**iOS PWA reconnect feedback**: `useNip46Connection`'s `visibilitychange` handler emits `toast.success('Signer reconnected')` or a red actionable toast on failure. `NostrProvider` (`contexts/NostrContext.tsx`) has its *own* `visibilitychange` handler that reconnects the NIP-46 relay on every page — the modal-scoped hook only fires while `LoginModal` is mounted, so the provider-scoped handler is what keeps boost/favorite working on `/favorites`, NowPlaying, etc. Do **not** delete it as "redundant".

**Reconnect ordering** (`lib/nostr/signer-reconnect.ts` `ensureSignerAvailable`): try `verifyNIP46Connection()` on the live in-memory client *before* `restoreNIP46Connection()` rebuilds from localStorage. The in-memory client has session state localStorage can't reproduce, and Safari ITP may have cleared storage entirely. `nip46-client.ts:authenticate()` also checks `WebSocket.readyState` via `relayManager.isConnected()` and force-reconnects dead sockets via `startRelayConnection()`. Do **not** invert this ordering or remove the explicit WebSocket-state check.

**Multi-relay bunker URIs** (`lib/nostr/nip46-client.ts`): bunker:// URIs with multiple `relay=` params are subscribed *and* published across all listed relays, not just the first. Survives one-relay blocks (e.g. Firefox blocks `relay.primal.net`). Secretless bunker URIs (Aegis-style) have a 25s fail-fast timeout since they require manual approval. Do **not** simplify back to first-relay-only.

**Pre-sign ping + manual reconnect** (`lib/nostr/nip46-client.ts` `pingSigner`, `lib/nostr/signer-reconnect.ts` `reconnectSignerManually`): relay socket alive ≠ signer subscription alive. If Primal's iOS app was killed overnight, `sign_event` is published into the void and waits the full 120s. `BoostButton.tsx` pings with a 5s timeout before `signEvent`; any response (including "unknown method") = reachable. On ping failure, boost fails fast with a toast whose **Reconnect** action calls `reconnectSignerManually()` — in-memory revive via `verifyNIP46Connection`, falls back to `restoreNIP46Connection` from localStorage, **never touches the user record**. Same helper powers the "Reconnect signer" button in `NostrSettings` (NIP-46 logins only). Do **not** add the ping inside `signEvent` itself — scoping it to boost keeps the extra round-trip off non-boost callers.

**Connection persistence** (`lib/nostr/nip46-storage.ts` `saveNIP46Connection`): the signer's app-pubkey is read via three-way fallback `signerAppPubkey || signerPubkey || actualSignerAppPubkey` because different call sites stash it under different property names. `LoginModal` invokes `saveNIP46Connection` twice during login; without the fallback the second save wipes the value and post-reload `sign_event` gets encrypted with the user's pubkey → 120s hang on every Primal boost/favorite. Do **not** simplify back to a single field read.

### Nostr Login Modal (`components/Nostr/LoginModal.tsx`)
**Card-menu UI** (pattern from `hzrd149/nostrudel`) — no tabs. Cards: Browser Extension (shown only if `window.nostr` detected), Bunker URI (paste `bunker://` / `nostrconnect://`), Amber (Android), Primal (QR code). `view` state: `'menu' | 'bunker' | 'primal' | 'amber'`. The old "More options (nostr-login)" card was removed in PR #98 (with `noBanner: true` the `<nl-auth>` element never mounts). `NostrLoginInit.tsx` still mounts for session-restore of legacy nostr-login users.

**Extension path is fast-path**: `handleExtensionLogin` calls `window.nostr.signEvent(eventTemplate)` **directly**, not through `UnifiedSigner`. Keep this direct path in future UX changes.

**Bunker URI path**: `handlePastedUriConnect` uses a fresh `NIP46Client` + `signer.setNIP46Signer(client)` — bypasses nostr-login entirely. Most reliable iOS PWA path.

**nostr-login is lazy-init**: `NostrLoginInit.tsx` exports `ensureNostrLoginInitialized()` (called on demand) and `<NostrLoginAutoInit />` (mounts in `layout.tsx`, only runs `init()` if user is logged in AND `window.nostr` is absent — session-restore for polyfilled users). Extension and logged-out users pay zero cost. Do **not** reintroduce eager init.

### Post-Login Flow (`lib/nostr/auth-utils.ts`)
Login flows save user data, set `localStorage['nostr_pending_favorites_sync'] = user.id`, close the modal, and reload — no delay. `NostrContext`'s mount effect picks up the flag, runs `syncFavoritesToNostr`, clears it. Running sync pre-reload aborted in-flight fetches when reload fired.

When adding new login paths, call `markFavoritesSyncPending(userId)` instead of firing sync inline.

**Profile backfill** (`contexts/NostrContext.tsx`): the login route (`app/api/nostr/auth/login/route.ts`) returns `displayName`/`avatar`/`bio`/`lightningAddress` as null to skip a ~21s relay round-trip (login completes in ~20ms). `NostrContext` auto-calls `refreshUser()` on mount whenever `user.displayName` is falsy, fetching the kind-0 profile in the background. Do **not** reintroduce the synchronous profile lookup in the login route — 1000× perf delta was the point of PR #98. Login route also only updates `nostrNpub` on returning users so a fresh login can't wipe previously-fetched profile fields.

### iOS PWA Background Audio (`contexts/AudioContext.tsx`)
Three-layer strategy: (1) preload at 15s before end, (2) proactive timer at 5s before end, (3) visibility change safety net. `trackEndProcessedRef` prevents double-advance. **Critical**: do not auto-resume if user explicitly paused.

### Sorting
`/api/albums-fast` accepts `sort` param (`added-desc`, `added-asc`, `year-desc`, `year-asc`, `name-asc`, `name-desc`, `tracks-desc`, `tracks-asc`). **Do NOT send `sort=name-asc` as default** — bypasses format grouping (Albums → EPs → Singles). Date fields: `Feed.oldestItemPubdate` = release date, `Feed.createdAt` = when added.

### `/api/albums-fast` track fields (critical gotchas)
Main-grid play button plays tracks straight from this endpoint — fields missing here don't show up on Now Playing.

- **Two Track `select` blocks**: one in the general path (~line 163) and one inside `case 'podcasts'` (~line 451). When adding a field, update **both** (different indentation — naive `replace_all` only hits one).
- **Must include `chaptersUrl`, `chapters`, `valueTimeSplits`** in both selects and both track-mapping blocks — otherwise chapter ticks/titles and VTS playback silently fail when playing from the grid (works from `/podcast/[id]` because that uses `/api/albums/[slug]` which already selects them).
- **Bump `API_VERSION` in `app/page.tsx`** whenever the response shape changes — main page caches under `localStorage['cachedAlbums_${N}_${API_VERSION}']` and without a bump, stale field-missing data sticks indefinitely. Comment on the constant when bumping.
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

**NIP-01 tag validation**: `createFavoriteEventTemplate` (in `lib/nostr/favorites.ts`) throws if `itemId` is falsy so we never publish events with `["d", null]` tags — strict relays (nsec.app) reject them with "failed to parse envelope". When adding new NIP-51/30001-style parameterized replaceable events, validate all required tag values at build time, not publish time.

**Dead-socket filtering** (`RelayManager.publish`): write relays are filtered by `relay.connected !== false` before publishing. Personal NIP-65 relays often accept connect but close the socket before publish runs → nostr-tools throws `SendingOnClosedConnection` synchronously. Each `relay.publish()` is wrapped in `Promise.resolve().then(...)` so any remaining sync throws flow through `Promise.allSettled` instead of surfacing as unhandled rejections.

**Stale-signer recovery** (`lib/nostr/publish-queue.ts` `flushQueue`): routes through `ensureSignerAvailable()` from `signer-reconnect.ts` (same wrapper `BoostButton.tsx` uses) instead of a manual `isAvailable() + NIP-55-only` branch. Without this, a stale singleton signer (iOS WebSocket killed during backgrounding, page-mount race, first-flush after reload) silently dropped the favorite. Do **not** revert to the manual branch.

**Failure toasts** (`lib/nostr/publish-queue.ts` `flushQueue`): `ensureSignerAvailable` failure, zero-relay connectivity, and per-item sign/publish errors all emit `toast.error`/`toast.warning` instead of silent `resolve(null)`. Sign-failure toast includes a `Reconnect` action → `reconnectSignerManually()`. Added after an Amber-on-Android session where "favorites work" reports masked a full-session queue-swallowing failure. Do **not** remove the toasts or revert to silent resolve — the publish queue is the only place where a user-initiated Nostr write can fail invisibly.

### Favorites Page (`/favorites`)
Optimistic unfavorite, auto-sync on page load. **Playlist favorites gotcha**: `isPlaylist()` and `playlistImageFallbacks` must use **lowercased feedId**, not the human name. `playlistSlugOverrides` handles ID-to-slug mismatches. Nostr playlist publishing: Kind 34139 addressable event (`d` tag = `stablekraft-favorites`).

### Favorite Publishers Resolution (`app/api/favorites/albums/route.ts`)
Three feedId formats: synthetic artist IDs (`artist-adam-curry`), feed GUIDs, feed IDs. Image chain: DB → PI API → album feed image by artist name.

### BackButton (`components/BackButton.tsx`)
Uses `window.history.length`. Do NOT use `document.referrer` — doesn't update during SPA navigation.

### Lightning Wallet Detection
**Keysend capability** (`components/Lightning/BitcoinConnectProvider.tsx`): two signals combined with **OR**. Signal A = WebLN `GetInfoResponse.methods` (NWC wallets populate with `pay_keysend`/`multi_pay_keysend`, extensions with `keysend`). Signal B = provider-type whitelist (`alby`/`alby-hub`/`extension`/`coinos`) from `detectWalletProviderType()`. Either is sufficient.

**Why OR, not methods-first**: methods-first falsely rejected Alby Hub users whose `get_info` lacked `pay_keysend` (older hub versions, partial NWC permissions, stale cached responses). OR still picks up Alby Hub via pasted `nwc.generic` URL (type `'nwc'` not in whitelist → rescued by Signal A) and still rejects Primal (type `'nwc'` + methods lacks `pay_keysend` → both signals false). Eager `setKeysendSupported(...)` runs after `detectWalletProviderType` and before `provider.getInfo()` so the UI banner and lnaddress keysend-fallback don't flash `false` during the 1–5s NWC cold-start. Still do NOT probe with a real keysend — triggers a payment popup in Alby extension. `detectWalletProviderType()` in `lib/lightning/wallet-detection.ts` also drives Lightning-address inference and avatar lookup.

For `connectorType` values see `@getalby/bitcoin-connect/dist/connectors/index.d.ts`. Primal (`nwc.primal`) exposes `provider.keysend` via WebLN shim but its relay doesn't implement `pay_keysend` — the OR check correctly rejects it.

**Wallet/Nostr are independent** (`components/Lightning/BitcoinConnectProvider.tsx`): Nostr logout does **not** disconnect the Lightning wallet. Prior behavior (wipe wallet + set `wallet_manually_disconnected=true` on every Nostr logout) forced a manual wallet re-pair every time a user logged out of Nostr to reseat a broken NIP-46 signer. Remaining Nostr→wallet interactions (auto-pick-up Alby WebLN on NIP-07 login; `wallet_restore_after_login` Android fix) are *restorative*, not destructive — leave them alone.

### BoostBox & Helipad (`lib/lightning/boostbox.ts`)
LNURL payments use [BoostBox](https://tardbox.com) for Podcasting 2.0 boost metadata. Keysend unaffected (uses Helipad TLV). Client-only — always uses `/api/lightning/boostbox` proxy (API key via `BOOSTBOX_API_KEY` env var). Value splits try keysend first; BoostBox called only for LNURL fallback. Fountain.fm addresses skip keysend by design (`isFountain` check).

**Feed.guid gotcha**: `feed_guid` in BoostBox comes from `Feed.guid` in DB. If null, reparse the feed.

**Helipad metadata**: built by `buildHelipadMetadata(amount, msg)` in `BoostButton.tsx`, BLIP-0010 spec. Single helper for all payment paths — do NOT duplicate. `name` field omitted from base; `value-splits.ts` sets it per-recipient.

**BoostButton props**: `feedUrl`, `remoteFeedGuid` (must be real GUID, never feed slug/ID), `albumName`, `publisherGuid`, `episodeGuid` (omit for album-level). Do NOT fall back to `feedId` for `remoteFeedGuid` — it's a slug, not a GUID.

### VTS (Value Time Splits) Playback (`components/NowPlayingScreen.tsx`)
VTS podcasts embed `<podcast:valueTimeSplit>` segments mapping time ranges to different tracks/artists. Features: chapter tick marks on progress bar, per-song favoriting via `remoteItem`, V4V blending (`remotePercentage` splits between song and show recipients, deduped by address, `isHost` flag for grouping). GUID collision detection via `chapterTitle` param to `/api/lightning/value-splits`. When VTS blending produces both song and show recipients, BoostButton shows **Song/Show section headers** sorted track-first.

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
