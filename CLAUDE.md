# Stablekraft App

## Commands
```
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:studio    # Open Prisma Studio
npm run deploy       # Build deployment package (local)
git push origin main # Deploy to production (Railway auto-deploys from git)

# Android / zapstore (requires JDK 21 + ~/.stablekraft-android.env) — see project_zapstore_distribution.md memory
npm run android:sync                                                                  # Copy web assets into android/
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release
zsp publish --skip-certificate-linking                                                # Publish to zapstore
```

## Boundaries
- Never commit secrets (`.env`, API keys)
- Run `npm run build` before committing
- No `src/` directory — all source lives in `app/`, `lib/`, `components/`, `contexts/`
- No `deploy-*/` artifacts in the repo — add to `.gitignore` if generated
- No JSON-file databases — all data is in PostgreSQL via Prisma
- Android keystore at `~/keystores/stablekraft-release.jks`, creds in `~/.stablekraft-android.env` — never commit either. Losing the keystore = losing the ability to ship updates to installed users.

## Tech Stack
- Next.js 15 (App Router), React 18, TypeScript, PostgreSQL/Prisma
- Podcast Index API for all feed lookups and resolution (never fetch directly from Wavlake — use PI API)
- Nostr for auth, Lightning (Alby/WebLN) for payments

## Architecture

### Two-Repo Setup
- **musicL-playlist-updater** - Generates playlist XML feeds
- **stablekraft-app** (this repo) - Consumes and displays playlists

### Daily Workflow (`.github/workflows/refresh-playlists.yml`)
Runs at 4 AM EST: clears cache → reparses feeds → refreshes playlists → parses publishers → imports missing albums from publisher feeds (Step 5b via PI API) → reparses each newly imported feed from its real RSS (Step 5c, driven by `importedFeedIds` in the Step 5b response). Step 5c exists because PI's episodes API doesn't surface `<podcast:episode>`/`<podcast:season>` ordering, chapters, or VTS — only the RSS has them. The `PLAYLISTS` array must include ALL playlist IDs — missing ones won't get nightly processing.

### Podping Consumer Integration
External service `msp-podping-service` (repo `ChadFarrow/msp-podping-service`) tails Hive for `pp_music_*` / `pp_podcast_*` podpings. For each ping the consumer (`consumer/src/index.ts:handleIri`) calls `/api/feeds/exists`; if it exists, calls `/api/feeds/refresh-by-url` **regardless of signer**. Only `/api/feeds` (new-feed minting) is gated to signer=`chadf` via `fromMsp` check in the consumer.

Four public endpoints (intentionally exempt from the `ADMIN_SECRET` middleware gate — see Admin API Auth below; consumer-side auth only). `refresh-by-url` is rate-limited 30 req/min/IP (in-memory, per Railway instance):
- `GET /api/feeds/exists?url=<URL>` or `?guid=<GUID>` → `{ exists: boolean }`. Blacklisted URLs always return `false` (reuses `isBlacklistedFeedUrl()` from `lib/feed-exclusions.ts`). URL lookup tries normalized + raw variants; on miss, falls back to `extractUuidFromUrl()` → `Feed.guid`/`Feed.id` lookup. **Keep this fallback** — without it, Podhome podpings for UpBeats (broadcasts `serve.podhome.fm/rss/<uuid>` while DB stores `feeds.rssblue.com/upbeats`) silently no-op. Keep matching logic in sync with `refresh-by-url` — divergence caused the Podhome/UpBeats silent-skip bug.
- `POST /api/feeds/refresh-by-url` with `{ originalUrl }` — same lookup pattern (URL variants → uuid-from-URL fallback). **Does NOT mint new feeds** unless caller passes explicit `feedId` in body (guards against rogue unauthed POSTs creating garbage rows). Must stay fast + idempotent. Current `feedId` callers: LNURL and Podtards test-feed buttons in `AdminPanel.tsx`.
- `POST /api/feeds` with `{ originalUrl, type: 'album' }` — **consumer-gated to signer=`chadf`** (only our MSP can mint new feed records). Stranger podpings drop at the consumer's `!exists && fromMsp` branch. Server-side has no auth.
- `GET /api/feeds/opml?type=<album|podcast|publisher>&grouped=<false>` → OPML 2.0 XML of every active, non-blacklisted feed. Filters `BLACKLISTED_FEED_IDS`/`BLACKLISTED_FEED_URLS` (does **not** filter `PLAYLIST_SOURCE_FEED_URLS`). 15-min in-memory cache keyed off full feed list; `type` filter applies in-memory. `?refresh=true` bypasses.

When modifying these endpoints, check consumer expectations in `msp-podping-service/consumer/src/index.ts` — if adding auth, wire a shared-secret env var into the consumer too.

**Host latency summary:** Fountain ≈ real-time via podping; Wavlake + self-hosted music sites = nightly 4 AM reparse only. Full per-host table and HafSQL provenance in `reference_podping_host_coverage.md` memory.

### Admin API Auth (`ADMIN_SECRET`, since PR #153)
`middleware.ts` + `lib/admin-auth.ts` enforce a bearer secret on destructive/expensive endpoints: all `/api/admin/*` **except** `/api/admin/verify` (npub-whitelist login check — must stay open or AdminPanel login breaks), `PUT`/`DELETE /api/feeds`, `DELETE /api/tracks`, `/api/parse-feeds`, `/api/playlist-cache`, `/api/playlist/parse-feeds(-stream)`, and `GET /api/playlist/<name>?refresh=true` (plain playlist GETs stay public — the gate is the query param). The four podping-consumer endpoints above are never gated.

- **Ad-hoc curl to any gated endpoint needs `-H "Authorization: Bearer $ADMIN_SECRET"`** — including the documented duplicate-fix (`DELETE /api/feeds?id=`) and stale-track (`DELETE /api/tracks?id=`) flows.
- **Fail-open by design**: if the `ADMIN_SECRET` env var is unset, auth passes with a warn log (deploys can't lock out crons before secrets exist). Do **not** "fix" this to fail-closed without coordinating all three secret locations.
- **Secret lives in three places** — Railway env (enforcement), GitHub Actions secret (workflows send it via `AUTH_HEADER` env in both refresh workflows), browser `localStorage['admin_secret']` (AdminPanel routes gated calls through `adminFetch` in `lib/admin-fetch.ts`, which prompts on first 401). Rotate = update all three.
- When adding an admin route, the `/api/admin/:path*` matcher covers it automatically. When adding a *non-admin* gated path, update both `requiresAdminAuth()` **and** the `matcher` array in `middleware.ts` — a path missing from the matcher silently bypasses auth.
- The radio-subdomain rewrite in `middleware.ts` is gated on `!pathname.startsWith('/api/')` — keep it that way.

### SSRF Guard (`lib/url-security.ts`)
`isSafePublicUrl(url, { allowHttp? })` rejects private/internal hosts (localhost, RFC-1918, link-local, `.local`/`.internal`). Used by `/api/chapters` (https-only), `/api/proxy-image` (returns placeholder on rejection — never break Next Image), and `/api/proxy-audio` (400). Any new endpoint that fetches a caller-supplied URL must use it. Known limit: string check only, no DNS-rebinding defense.

### Targeted Podcast Reparse (`.github/workflows/refresh-podcasts-targeted.yml`)
Every 30 min from 11:00–13:59 UTC on Sundays (UpBeats) and Tuesdays (Two For Tunestr) — the observed publish windows (7 AM Eastern year-round, UTC shifts ±1h on DST). Belt-and-suspenders safety net for consumer outages or Podhome emission gaps; catches new episodes within ~30 min of publish. Day-of-week check inside the workflow means off-day cron ticks early-exit at zero cost. When adding a curated podcast with a predictable publish schedule, update both this file's `PODCAST_FEEDS` array (and day switch if a new weekday) **and** `refresh-playlists.yml` Step 2b.

### Android Distribution (zapstore)
See `project_zapstore_distribution.md` memory for appId, keystore path, cert fingerprint, JDK 21 requirement, `zsp` CLI binary source, per-release flow, and gotchas (Bubblewrap/TWA banned, `--skip-certificate-linking` always, etc.).

## Key Behaviors

### Playlist Resolution
Playlists use `<podcast:remoteItem>` with `feedGuid` + `itemGuid`. On `?refresh`: discover feeds via PI API → parse → discover publishers → resolve tracks. Resolution rate ~80-90%.

**Feed deduplication pattern**: multi-check dedup (normalized URL, raw URL, feedGuid as ID, feedGuid as GUID column, feedGuid-in-URL substring, then secondary `podcastGuid` check). New feeds get slug-based IDs via `generateAlbumSlug`. When modifying feed import code, follow this pattern — weak dedup causes duplicate entries.

**Podcast type detection**: Non-Wavlake feeds with `<podcast:medium>podcast</podcast:medium>` auto-detect as `type: 'podcast'` on import. Wavlake feeds are excluded (they use `medium=podcast` for music). Feeds with `type: 'podcast'` auto-appear under the Podcasts filter (direct `type='podcast'` query bypassing the blacklist) and hide from the album grid. **`POST /api/admin/fix-podcast-types` flips `type: 'podcast'` → `'album'` for any feed NOT in the curated `PODCAST_FEED_IDS`/`PODCAST_FEED_URLS` allowlist** (`lib/podcast-feeds.ts`) — use to clean up misdetected podcasts, NOT to promote albums (use admin Podcast dropdown for that).

**PI API status gotcha**: `normalizeFeedResponse` in `lib/podcast-index-api.ts` must accept both `status: 'true'` (string) and `status: true` (boolean). Use `data.status !== 'true' && data.status !== true` for rejection checks.

**Podroll exclusion**: `process-remote-items/route.ts` strips `<podcast:podroll>` before extracting `<podcast:remoteItem>` tags — without this, podroll-referenced feeds get imported as albums.

### Feed Exclusions (`lib/feed-exclusions.ts`)
Two lists with different semantics:
- **`BLACKLISTED_FEED_IDS` / `BLACKLISTED_FEED_URLS`** — true bans. Applied everywhere: album grid, search, `/api/feeds/exists`, `process-remote-items`, admin bulk-import, the Step 5b publisher-album cron, and the `/publisher/[id]` page (PR #156 — it queries the DB directly, so it filters via `isNotBlacklistedFeed` rather than inheriting a gate). Includes test feeds (`lnurl-test-*`, `podtards-test`) and repeat-offenders like `bitpunk-fm-unwound`. **Blacklist is the only durable removal for talk podcasts that declare `<podcast:medium>music</podcast:medium>`** (e.g. Phantom Power Business Hour): they evade the `medium=podcast` auto-detect, PI reports them as music, and Step 5b re-mints them from PI artist search with a fresh `createdAt` (top of the "new" tab) every time they're deleted.
- **`PLAYLIST_SOURCE_FEED_URLS`** — URLs of podcast feeds backing curated playlists (B4TS, MMM, HGH, LT, Upbeats, IAM, ITDV, Two For Tunestr). Checked by `process-remote-items` (so nightly playlist refresh can't auto-create feed records for them) and by `/api/feeds/recent` (so the home `'new'` filter doesn't surface music-podcast source feeds). Admin-initiated imports (`POST /api/feeds`) never consulted these. **MMM has two entries** (legacy `mmmusic-project.ams3.cdn.digitaloceanspaces.com` and current `mmmusic.show`) because DB rows reference different hosts — keep both.

- **`isHenrikFlymanWavlakeMirror(entry)`** — artist-scoped "flag as dead" rule (NOT a URL/ID ban): treats any `wavlake.com` feed whose artist is "Henrik Flyman" as dead. He pulled all his music off Wavlake and self-hosts at henrikflyman.com, and Wavlake mints new mirrors faster than URLs can be listed, so this catches current + future mirrors without enumeration. Rows **stay in the DB** — they're just hidden. Applied in the album grid (`albums-fast`), "New" (`feeds/recent`), search, the `/publisher/[id]` page (via `keepFeed`), the single-album route `/api/albums/[slug]` (collision-scoped — see below), and the Step 5b publisher-album cron (skips re-mint so they don't come back). The **one sanctioned exception** to the no-platform-filter rule; scoped to a single artist — do NOT generalize into a global "hide Wavlake" filter. See the Publisher Pages section for the page-scoped `keepFeed` layer.

  **Slug-collision gotcha (`/api/albums/[slug]`)**: Henrik has duplicate DB rows per title — a working self-hosted henrikflyman.com feed **and** a dead Wavlake mirror (Wavlake CDN 403s his pulled catalog). The single-album route resolves a title slug (e.g. `unbreakable`) by generated-slug/ID/title match, filtering only `status:'active'` — so it used to pick the dead mirror on a tie and the album wouldn't play, even though every *listing* surface already hid the mirror (the route was the one surface not applying the exclusions). Fix: after gathering `potentialMatches`, drop any that are `markedDead`, blacklisted, or `isHenrikFlymanWavlakeMirror`, **but only when a visible alternative remains** (`length > 1` and `visibleMatches.length < potentialMatches.length`) — so an album whose *only* row is hidden still resolves rather than 404ing. This is why the publisher page's title-slug album cards now land on the self-hosted rows.

Helpers: `isBlacklistedFeedId()`, `isBlacklistedFeedUrl()`, `isPlaylistSourceFeedUrl()`, `isBowlAfterBowlPodcastEntry()`, `isHenrikFlymanWavlakeMirror()`. The BAB helper is shared by `/api/albums-fast` and `/api/feeds/recent` to keep the BAB-vs-Bowl-Covers rule in one place — do not re-inline it. Do **not** move playlist-source URLs back into the blacklist — doing so would block admin from promoting any of them into the Podcasts tab.

### Hiding Feeds (`Feed.markedDead`, admin "Hide Feed")
General-purpose "never show this feed" flag — for feeds **taken down upstream** (removed from Wavlake, etc.), leftover **test feeds**, or **stray podcasts**. Unlike deleting — which lets the 4 AM Step 5b cron re-mint the feed from PI artist search — this keeps the row in the DB and hides it. `Feed.markedDead Boolean @default(false)` (migration `20260716000000_add_marked_dead_to_feed`). The DB field is named `markedDead`; the admin UI labels it "Hide Feed" since it's not limited to dead feeds. NOTE: it flags an **existing row** — it does not ban a URL from re-import under a *new* row via other paths (playlist refresh / podping / remote-items); that would need a URL/ID-level ban (the code blacklist, or a future admin-editable ban list).

- **Deliberately orthogonal to `status`** — `refresh-all-feeds`, nightly reparse, and `refresh-by-url` all rewrite `status` to `'active'`/`'error'`, so a `status='dead'` value would get clobbered. `markedDead` never is. Do **not** collapse it into `status`.
- **Read paths filter `markedDead: false`**: `albums-fast` (grid + podcasts case), `feeds/recent` (both query sites), `search` (Prisma albums exact path, the podcast-search query, the raw-SQL artist exact-match fallback — `f."markedDead" = false`, **and** both raw-SQL fuzzy queries in `lib/fuzzy-search.ts`), `/api/albums` (`feedWhere`), the `/publisher/[id]` page (all 5 album/artist queries), `/api/publishers` + `/api/publishers/[id]` (publisher grid + detail-API, both queries each), `/api/parsed-feeds` (core data loader via `lib/data-service.ts`), `/api/feeds/opml`, and the single-album route `/api/albums/[slug]` (collision-scoped: drops `markedDead`/blacklisted/Henrik-mirror `potentialMatches` only when a visible alternative remains — see the `isHenrikFlymanWavlakeMirror` slug-collision gotcha above). When adding a new feed-listing surface, add the filter there too. **Out of scope on purpose**: track-level surfaces (a hidden feed's individual tracks still surface in track search — `lib/fuzzy-search.ts` track query, `tracks/search`) since the flag hides *feeds*, not tracks.
- **Step 5b skips dead rows**: `import-albums` bails in the `existing.markedDead` branch (before the publisherId re-link), so a dead feed is never re-touched or re-minted.
- **Admin UI**: `/admin` → "Mark Feed as Dead" card. Paste the feed's RSS URL **or** feed ID → Look up → Mark as Dead / Restore. Backed by `POST /api/admin/feeds/mark-dead` (`{ url?, id?, dead?, preview? }`; resolves by exact ID then normalized/raw `originalUrl`; gated by the `/api/admin/:path*` matcher). Invalidates albums-fast + search caches on write.
- **Railway migrate gotcha (issue #122)**: the Dockerfile does NOT run migrations on deploy. The `20260716000000_add_marked_dead_to_feed` migration is **already applied to prod** (2026-07-17, run before the PR #157 merge — additive column with a default, so applying ahead of the code deploy avoided the 500 window). Remember this pattern for any *future* `markedDead`-adjacent column: run `railway run --service StableKraft --environment production npm run db:migrate` before the code that filters on it goes live, or every filtered query 500s until the column exists.

#### Dead-feed check (auto-hide taken-down feeds, `POST /api/admin/check-dead-feeds`)
Periodic sweep for feeds whose URL went dead upstream (an artist pulled their catalog, a Wavlake mirror now 404s). The album stays visible because its tracks are cached in the DB, and `status` can't durably flag it — the nightly `fix-feed-status` step flips any error feed that still has tracks back to `'active'`. So this hides via `markedDead` instead. **Two-signal, never hides on a hunch:**
1. **Discover (cheap, catalog-wide):** query `status:'active', markedDead:false` feeds, look each up in PI via `podcastIndexAPI.getFeedByGuid()` (exact; preferred) or `getFeedByUrl()` (fallback — note it prefers the *newest* duplicate by ID, which can mask a dead older entry, so GUID-first). Candidate = PI `feed.dead > 0`. **We never HTTP-probe the whole catalog** — Wavlake 429-rate-limits Railway after ~50 sequential fetches; PI's crawler already did the 404 detection. Feeds not in PI return `null` → never flagged.
2. **Confirm (only the small PI-flagged set):** direct GET of `originalUrl` (`AbortSignal.timeout(15s)`). Hard **404/410 → auto-hide** (`markedDead:true`); **200 → `needsReview`** (PI lag / false positive, not hidden); other/timeout → `unconfirmed` (not hidden).

Body `{ dryRun?, limit?, offset? }` — `dryRun:true` returns `wouldHide` and writes nothing. On write it invalidates albums-fast + search caches (like `mark-dead`). Reversible via the "Hide Feed" card's Restore. **Paginated — this is mandatory, not optional:** the active-feed set is ~4k+ and one synchronous PI-per-feed scan blows past the request timeout (proven: a single unpaginated call 000'd at 300s). Each request handles one `limit`-sized slice (default 300, max 1000, `id asc` order) and returns `nextOffset` (null when done) + `totalActive`; **callers must loop until `nextOffset` is null** — the weekly workflow and the admin button both do. Do **not** revert to a single-shot scan. **Admin UI:** `/admin` → "Check for Dead Feeds" card — Preview (dryRun, loops pages showing progress) then "Hide N confirmed-dead feeds". **Cron:** `.github/workflows/check-dead-feeds.yml`, weekly (Mon 10:00 UTC) + `workflow_dispatch`, loops pages with auto-hide and logs each hidden/needs-review feed as the audit trail. Gated by the `/api/admin/:path*` matcher (Bearer `ADMIN_SECRET`).

### Admin Feed Management (`/admin`)
Single input handles both add and reparse. Type dropdown (Auto-detect/Album/Publisher/Podcast) — use when URL doesn't match auto-detect patterns (`-pubfeed`, `/publisher`, `/artist/` = publisher). **Server-side fallback**: feeds with 0 items + `<podcast:remoteItem>` references auto-detect as publisher. **Playlist mediums rejected**: `POST /api/feeds` returns 400 when the parsed `<podcast:medium>` ends with `'L'` (e.g. `musicL`, `podcastL`, `videoL`) — Podcasting 2.0 list feeds reference existing items via remoteItem and have no generic surface in the app (curated playlists are hard-coded). Issue #127 traced to `medium="musicL"` URLs being misclassified by the publisher auto-detect. **GUID collision handling**: if a publisher feed's `podcast:guid` collides with an existing album, the feed is created without GUID rather than failing. **Fixing duplicates**: delete all copies first (`DELETE /api/feeds?id=<feedId>`), then re-add. Initial import (`POST /api/feeds`) saves all parsed fields including chapters, VTS, and V4V via `applyParsedItemFields()` — no reparse needed.

**Reparse is additive, not authoritative** (`app/api/admin/feeds/[id]/reparse/route.ts`): upserts existing tracks by guid (or title+audioUrl) and appends new ones, but never deletes Track rows whose guids have disappeared from upstream. If an artist re-versions XML with new item guids on the same songs, old Track rows stick around and album pages show doubles. **Fix ad-hoc, not via tooling**: cross-check DB guids vs upstream (`GET /api/tracks?feedId=<id>`), then `DELETE /api/tracks?id=<trackId>` each stale row. **Track.id format is `${feedId}-${guid}`** — construct without a lookup once you have the stale guid. Do not propose adding a stale-track sweep to reparse or a cron job (see `feedback_stale_track_cleanup.md`).

### Adding Music Podcasts (like Upbeats, Two For Tunestr, B4TS)
Import via `/admin` (paste RSS URL). Non-Wavlake feeds with `<podcast:medium>podcast</podcast:medium>` automatically get `type: 'podcast'`, appear under the Podcasts filter, hide from the album grid, and are searchable — no config edits needed. `/podcast/[id]` dynamic route handles display.

**If the feed is also a playlist source** (B4TS, MMM, HGH, LT, Upbeats, IAM, ITDV, Two For Tunestr): it's in `PLAYLIST_SOURCE_FEED_URLS`, which blocks nightly auto-import but leaves admin add open. After import, register it as a curated podcast in `lib/podcast-feeds.ts`: add to `PODCAST_FEED_IDS` + `PODCAST_FEED_URLS` so `fix-podcast-types` can't flip it back to album, plus `PODCAST_SLUGS` + `PODCAST_SLUG_TO_FEED_ID` + `PODCAST_CANONICAL_SLUGS` to redirect `/album/<slug>` → `/podcast/<canonical-slug>`.

**Slug redirects**: if the auto-generated feed ID differs from the desired URL slug (e.g., `silvie-two-for-tunestr` vs `two-for-tunestr`), add mappings to `PODCAST_SLUG_TO_FEED_ID` and `PODCAST_CANONICAL_SLUGS`.

**After import**: reparse from the admin page to ensure chapters and VTS are populated (initial import may miss them if the chapters proxy is down).

### Admin Database Cleanup (`/admin`, two-step)
**Step 1 Parse Missing Tracks** → `GET /api/playlist/parse-feeds-stream`, **Step 2 Check for Orphaned Items** → `/api/admin/orphaned-items`.

**Step 1** (`app/api/playlist/parse-feeds-stream/route.ts`): walks feeds with `status='active' AND type != 'publisher' AND Track.none()`, `take: 500`. Do **not** drop the `type != 'publisher'` filter — reclassified publishers never have tracks by design and would reappear every run. SSE emits per-feed `feedError`/`feedInfo` events with categorized `reason` codes; AdminPanel renders a collapsible per-feed log with reason-count summary. `parseFeedXML` always returns `{ episodes, xmlText, fetchError? }` (never null); 15s `AbortSignal.timeout` per feed.

**Publisher reclassification has three signals, in order**:
1. PI API `feedData.medium === 'publisher'` from `byguid` (RSSBlue, Fountain, phafe).
2. URL shape `^https?://wavlake\.com/feed/artist/<uuid>` — PI API does **not** surface `medium` for Wavlake artist feeds, so URL is the only pre-fetch signal. Wavlake's `/feed/music/` = albums, `/feed/artist/` = publishers by construction. Do **not** remove — Wavlake IP-rate-limits Railway (`HTTP 429` after ~50 sequential fetches).
3. Post-RSS `xmlText.includes('<podcast:remoteItem')` when fetch succeeds with zero `<item>` tags.

**`tracks-owned-elsewhere` reason** flags silent-loss: `Track.guid @unique` + unscoped dedup in `importFeedToDatabase` means an episode whose guid already exists under another feed falls into the "update" branch without re-linking `feedId` — metadata refreshes and `parsed++` fires, but zero tracks land, so the feed reappears next run. A post-import `prisma.track.count({ where: { feedId } })` check catches this and emits the canonical claimants. Fix tracked in `project_feed_duplicate_dedup.md`.

**Step 2** (`app/api/admin/orphaned-items/route.ts`): orphan = `type='album' AND Track.none()`. Publishers + podcasts + any album with tracks are preserved regardless of curated-playlist membership. Do **not** revert to the older "not-in-any-system-playlist" definition — it would nuke every publisher, every podcast, and every manually-added album outside the 9 curated playlists.

**Preview annotates each orphan with its canonical claimant** (matching title + artist + has tracks): green `→ duplicate of {id}` for safe deletes, red `⚠ no canonical match` for review. Roll-up header shows `N safe duplicates · M need review` across the full cohort.

**Gap — not caught by Step 2**: `type='publisher'` rows with tracks (orphan query only targets `type='album'`). Clean up manually with `DELETE /api/feeds?id=<feedId>` if you spot any.

### Music-Show-Only Publishers (`/admin`)
Spam-control tool for publishers (typically Wavlake artist pages) whose albums shouldn't auto-import. `Feed.musicShowOnly: boolean` flag on publisher rows; nightly cron in `app/api/admin/publishers/import-albums/route.ts` skips children of flagged publishers.

**Two cleanup paths, both delete only feeds with zero `SystemPlaylistTrack`-linked tracks:**
- **Per-publisher** (`POST /api/admin/music-show-only-publishers` with `{id, action:'preview'|'cleanup'}`): walks `publisherId`-linked children of the publisher and deletes the unplayed ones. Surfaced via the **Load Publishers** list's one-click **Delete unplayed albums** button (PR #123).
- **By-IDs bulk** (`POST /api/admin/music-show-only-publishers/cleanup-by-ids` with `{ids[], dryRun?}`): flat list of feed IDs, same played/unplayed logic. Surfaced via the **Delete unplayed** banner above the artist-name search results — only appears when `importedCount > 0` in the visible results (PR #124).

**Search panel buttons are forward-looking, not retroactive.** **Add as music-show-only** / **Flag existing** call `POST .../music-show-only-publishers` with `action: 'import'` — they create or promote a publisher row with `musicShowOnly=true` to skip *future* nightly imports. They never delete existing albums by themselves. As of PR #125, **Flag existing** on an already-existing publisher (`alreadyExisted=true` in response) chains into `deleteUnplayedAlbums(publisherId, title)` so the same click handles both forward + backward cleanup.

**Common confusion**: spam albums often live under a *different* publisher row than the one PI surfaces in search. PI returns `medium=publisher` candidates and Wavlake `/feed/artist/<uuid>` URLs; the actual album feeds in the DB may be linked to a separate `0b982183-…`-style publisher imported earlier via a different path. The per-publisher cleanup only touches that one publisher's children — if no match, fall back to the by-IDs flow or run cleanup on the original publisher directly via curl.

**Migration gotcha (issue #122)**: Railway Dockerfile does **not** run `prisma migrate deploy` on deploy. After merging a PR with a new migration, run `railway run --service StableKraft --environment production npm run db:migrate` from the repo root or the new column will be missing in prod and every Prisma query that selects it returns 500. Local `.env` is *not* overridden by `railway run` for Prisma (it auto-loads `.env`), so verify with a direct `information_schema.columns` query if unsure.

### Search
- PostgreSQL trigram `similarity()`, flat 0.3 threshold. Do NOT lower below 0.3 — causes false positives.
- Artist search groups by `LOWER(artist)`. Exact mode: `?fuzzy=false`.
- Podcasts searchable by title/artist/description (queries `type: 'podcast'` feeds).

### Publisher Pages (`app/publisher/[id]/page.tsx`)
Matched by title slug, artist slug, or URL path. Multi-feed support with per-platform sections. Album resolution: (1) GUIDs/URLs from publisher feed XMLs → (2) `publisherId`-linked albums → (3) artist name matching. Do NOT re-add platform filters — they hide legitimate cross-platform albums.

**Section labels** use the publisher feed's URL for platform detection (not album URLs), so a self-hosted publisher feed referencing Wavlake-hosted albums shows "(henrikflyman.com)" not "(Wavlake)". **`linkAlbumsToPublisher`** only links albums with `publisherId: null` — already-linked albums are skipped. To re-link, use `PUT /api/feeds` with `{ id, publisherId }`.

**Phantom publisher IDs**: some albums have a `publisherId` that doesn't correspond to a feed record (e.g., Wavlake artist GUIDs auto-assigned during import). The publisher page creates synthetic feed info for these.

**Blacklist filtering** (`isNotBlacklistedFeed` in `page.tsx`, PR #156): the page queries the DB directly, so it must apply `isBlacklistedFeedId()`/`isBlacklistedFeedUrl()` itself — the middleware/import gates don't reach it. Filtered on all three feed sources (remoteItem/URL matches, `publisherId`-linked, and artist-name matches). Without this, blacklisted rows that still exist in the DB (e.g. Henrik Flyman's dead Wavlake mirrors) resurface here — most often under "More from Artist" via platform-blind artist-name matching — even though they're gone from the grid and search. This is a **targeted** reuse of the existing blacklist, NOT a platform filter (do not add a blanket "hide Wavlake" rule — see the cross-platform warning above). To hide a newly-surfaced mirror, add its URL to `BLACKLISTED_FEED_URLS`; it takes effect on the publisher page too.

**Henrik Flyman → hide all Wavlake** (page-scoped `keepFeed` + `isHenrikFlymanWavlakeMirror` in `lib/feed-exclusions.ts`): Wavlake keeps minting brand-new mirror feeds for Henrik (2026 releases like Unbreakable / Is This The End / The Writing's on the Wall / They Intend to Destroy Beauty) faster than their `/feed/music/<uuid>` URLs can be added to `BLACKLISTED_FEED_URLS`. He pulled **all** his music off Wavlake and self-hosts at henrikflyman.com, so on **his publisher page only** (`isHenrikFlymanPage`, matched by artist name or the `henrik-flyman` slug), `keepFeed` drops **every** `wavlake.com` feed regardless of its stored artist string — not just ones whose artist field exactly equals "Henrik Flyman" (mirrors sometimes carry a slightly different/empty artist). `isHenrikFlymanWavlakeMirror` (artist-scoped) still runs inside `isNotBlacklistedFeed` as a second layer. This is the **one sanctioned exception** to the no-platform-filter rule and it is **page-scoped to Henrik**; do NOT generalize it into a global "hide Wavlake" filter for other publishers.

### Track Ordering
`Track.trackOrder` drives album display (`orderBy trackOrder asc`; the API's `trackNumber` is positional, not the stored value). Order sources, best to worst:
1. Episode/season tags via `calculateTrackOrder` (`lib/rss-parser-db.ts`) = `season*1000 + episode`. The app's RSS parser reads both `itunes:` and `podcast:` namespace tags; **PI's episodes API only surfaces `itunes:episode` — `<podcast:episode>`-only feeds (e.g. Henrik Flyman's) come through PI with `episode: null`**.
2. Index fallback over the episodes array. `getEpisodesFromAPI` (`lib/feed-parsing.ts`) sorts PI episodes by `datePublished` ascending — do **not** remove the sort; PI returns newest-first and the raw order reversed every PI-imported album without itunes episode tags (PR #150).
3. Identical-timestamp items stay in PI's arbitrary tie order. Corrective: admin reparse, which uses RSS document order (also auto-runs nightly for newly imported feeds via Step 5c).

### Duration Filtering
Tracks over 2 hours filtered as non-music (silent, no warnings).

### Explicit Flag
Show-level `album.explicit` uses `feed.explicit ?? false` only (channel `<itunes:explicit>`). Do **not** aggregate from track-level explicit flags — that diverges from Apple Podcasts convention. Per-track `explicit` is unchanged; `AlbumDetailClient` renders per-row "E" badges on individual explicit episodes. Call sites: `app/api/albums/[slug]/route.ts`, `app/api/albums/route.ts`, `app/api/parsed-feeds/route.ts`.

### Podcasting 2.0 `<podcast:image>` Tag (since 2026-06-12)
The newer `<podcast:image>` tag ([spec](https://podcasting2.org/docs/podcast-namespace/tags/image), replaces deprecated `<podcast:images srcset>`) — multiple instances allowed at **channel and item** level, each with `href` (required) + `alt`/`aspect-ratio`/`width`/`height`/`type`/`purpose` (tokens: `artwork`, `canvas`, `circular`, `banner`, `social`, …). Stored as a `podcastImages Json?` array on **both** `Feed` and `Track` (migration `20260612000000_add_podcast_images_to_feed_and_track` — already applied to prod; remember the issue #122 Railway `db:migrate` gotcha for future columns).

- **Pure pickers live in `lib/podcast-images.ts`** (dependency-free on purpose — client components import it without pulling `rss-parser`/`fast-xml-parser` into the browser bundle). `lib/rss-parser-db.ts` re-exports them so existing server import sites keep resolving. Helpers: `pickSquareArtwork()` (1/1 → artwork/circular), `pickCanvasBackground(images, 'landscape'|'portrait')` (16/9 vs 9/16; prefers `purpose=canvas`, else any matching ratio, else `undefined` — never cross-stretch).
- **Parsing** (`lib/rss-parser-db.ts`): `parseChannel/ItemPodcastImagesFromXML` (regex over the channel block / per-item, reusing the generic `parsePersonAttrs`). Channel images ride on `ParsedFeed.podcastImages` (canonical source); item images on `ParsedItem.podcastImages`, applied by `applyParsedItemFields()`.
- **Write paths — there are three, keep them in sync** (the `persons`-style multi-path gotcha): (1) admin add `POST /api/feeds` writes `parsedFeed.podcastImages` at **all three** `feed.create`/`upsert` sites; (2) `app/api/admin/feeds/[id]/reparse` updates it (this is how an **already-existing** feed gets it — admin add's upsert `update` branch only touches `lastFetched`, like `image`/`v4v`); (3) `importFeedToDatabase` (`lib/feed-parsing.ts`, used by refresh-by-url / nightly) parses channel images from `xmlText`. **Prisma JSON typing**: assign with an `as any` cast (`PodcastImage[]` isn't a valid `InputJsonValue` — same trick `v4vValue` uses by being typed `any`).
- **Surfaced via API**: `albums-fast` (both dual selects + both mappings), `feeds/recent`, and `albums/[slug]` (both feed-backed album objects; `API_VERSION` bumped to `v15`).
- **Rendering — responsive canvas background** (`app/album/[id]/AlbumDetailClient.tsx`, shared by `/album/[id]` **and** `/podcast/[id]`): the full-bleed page background uses the 16:9 canvas on desktop / 9:16 on mobile via `pickCanvasBackground(album.podcastImages, isDesktop ? 'landscape' : 'portrait')`, falling back to `coverArt`. `isDesktop` is in the main effect's deps so it re-picks on a mobile↔desktop resize; the desktop preload effect preloads the landscape canvas. The square corner thumbnail always stays album art.
  - **Anti-flicker background cache**: the page passes `initialAlbum=null` and always fetches album data client-side, so each navigation remounts with `backgroundImage=null` → the default dark gradient flashed until the fetch resolved (worst when clicking through one artist's albums). Fixed with a **module-scoped** cache (`backgroundCacheById` + `lastShownBackground` in `AlbumDetailClient.tsx`, module scope survives client-side route remounts): the `backgroundImage` `useState` initializer seeds from this album's last-resolved art, else the previously-shown art as a hold-over. A sync effect writes `lastShownBackground` on every non-null background, but keys `backgroundCacheById[albumId]` **only once `album && !isLoading`** — otherwise a carried-over previous background would get cached under the new album's id. SSR renders `null` (empty cache on the server) and the client initializer also sees an empty cache on first load, so no hydration mismatch; the cache only kicks in on subsequent in-session navigations.
- **Legacy `image` fallback**: `importFeedToDatabase` backfills the single `Feed.image` from `pickSquareArtwork(...)` **only when** the feed otherwise has no image — so feeds shipping *only* `<podcast:image>` still get album art. Does not override an existing itunes/legacy image.
- Not yet wired: NowPlaying background and `circular`-as-avatar rendering (data is available, UI is a future task).

### NIP-46 Remote Signer (Amber / Primal / bunker)
Key files: `lib/nostr/nip46-client.ts`, `lib/nostr/signer.ts`, `components/Nostr/hooks/useNip46Connection.ts`, `lib/nostr/signer-nudge.ts`. iOS Safari kills WebSockets after ~30s backgrounded; reconnects on `visibilitychange`. **Primal is the best iOS signer** — auto-signs with Full trust, <1s response. Debug: `localStorage.setItem('nip46_debug', 'true')`.

Invariants (do not revert):
- **Signer nudge** (`withSignerNudge`): toast after 4s, hard-fail at 125s (outside NIP-46 client's 120s timeout so the client's richer error surfaces first). Throttled 8s. `NIP46Signer.signEvent`/`getPublicKey` route through automatically; direct `client.signEvent` callers in `LoginModal` wrap manually.
- **Reconnect ordering** (`ensureSignerAvailable` in `lib/nostr/signer-reconnect.ts`): try `verifyNIP46Connection()` on the live in-memory client *before* `restoreNIP46Connection()` rebuilds from localStorage. In-memory has session state localStorage can't reproduce; Safari ITP may have cleared storage entirely. `nip46-client.ts:authenticate()` also checks `WebSocket.readyState` and force-reconnects dead sockets.
- **Multi-relay bunker URIs**: subscribe *and* publish across all listed `relay=` params, not just the first — survives one-relay blocks (e.g. Firefox blocks `relay.primal.net`). Secretless bunker URIs (Aegis) have 25s fail-fast timeout.
- **Pre-sign ping is boost-scoped** (`BoostButton.tsx` → `pingSigner`, 5s timeout): relay socket alive ≠ signer subscription alive. Do **not** move the ping inside `signEvent` — scoping it to boost keeps the extra round-trip off non-boost callers. Ping failure fails boost fast with a `Reconnect` toast → `reconnectSignerManually()`.
- **`saveNIP46Connection` three-way pubkey fallback** (`signerAppPubkey || signerPubkey || actualSignerAppPubkey`): `LoginModal` invokes save twice during login; without the fallback the second save wipes the value and post-reload `sign_event` gets encrypted with the wrong pubkey → 120s hang on every Primal boost/favorite.
- **`NostrProvider` has its own `visibilitychange` handler** (`contexts/NostrContext.tsx`), in addition to `useNip46Connection`'s modal-scoped one. The provider-scoped handler keeps boost/favorite working on `/favorites`, NowPlaying, etc. while the modal is unmounted. Do **not** delete as "redundant".

### Nostr Login Modal (`components/Nostr/LoginModal.tsx`)
**Card-menu UI** — no tabs. Cards: Browser Extension (shown only if `window.nostr` detected), Bunker URI (paste `bunker://` / `nostrconnect://`), NIP-05 Address (read-only), Amber (Android), Primal (QR code). `view` state: `'menu' | 'bunker' | 'primal' | 'amber' | 'nip05'`. `nostr-login` is mounted with `noBanner: true` so `<nl-auth>` never shows; `NostrLoginInit.tsx` still mounts for session-restore of legacy nostr-login users.

- **Extension path is fast-path**: `handleExtensionLogin` calls `window.nostr.signEvent(eventTemplate)` **directly**, not through `UnifiedSigner`. Keep this direct path.
- **Bunker URI path**: `handlePastedUriConnect` uses a fresh `NIP46Client` + `signer.setNIP46Signer(client)` — bypasses nostr-login entirely. Most reliable iOS PWA path.
- **NIP-05 path is read-only** (`handleNip05Login`, since #148): for users with **no signer**. POSTs `{ identifier }` (`name@domain.com`) to `/api/nostr/auth/nip05-login`, which resolves the pubkey via `/.well-known/nostr.json`, loads the kind-0 profile, and migrates session favorites in the **DB** — no key-ownership proof, no signer. It signs in via `saveUserData(user, 'nip05')` + reload and **deliberately skips `markFavoritesSyncPending`** (publishing to Nostr needs a signer; favorites already migrated server-side). `UnifiedSigner` has a dedicated `nip05` branch (`signer.ts:363-375`): uses a NIP-07 extension if one is present, else stays read-only — signed actions (boost, publish) fail with the normal "connect a signer" prompt. `NostrContext` gates signer-reconnect to `nip46`/`nsecbunker`, so a `nip05` session triggers no signer machinery on reload/visibilitychange. Accepted tradeoff: anyone can read-only "log in" as any identifier (impersonation of DB favorites) — revisit only if it becomes a real problem.
- **nostr-login is lazy-init**: `NostrLoginInit.tsx` exports `ensureNostrLoginInitialized()` (called on demand) and `<NostrLoginAutoInit />` (mounts in `layout.tsx`, only runs `init()` if user is logged in AND `window.nostr` is absent). Extension and logged-out users pay zero cost. Do **not** reintroduce eager init.

### Post-Login Flow (`lib/nostr/auth-utils.ts`)
Login flows save user data, set `localStorage['nostr_pending_favorites_sync'] = user.id`, close the modal, and reload — no delay. `NostrContext`'s mount effect picks up the flag, runs `syncFavoritesToNostr`, clears it. When adding new login paths, call `markFavoritesSyncPending(userId)` instead of firing sync inline.

**Profile backfill**: the login route (`app/api/nostr/auth/login/route.ts`) returns `displayName`/`avatar`/`bio`/`lightningAddress` as null to skip a ~21s relay round-trip (login completes in ~20ms). `NostrContext` auto-calls `refreshUser()` on mount whenever `user.displayName` is falsy, fetching kind-0 in the background. Do **not** reintroduce synchronous profile lookup — 1000× perf delta was the point. Login route also only updates `nostrNpub` on returning users so a fresh login can't wipe previously-fetched profile fields.

### iOS PWA Background Audio (`contexts/AudioContext.tsx`)
Three-layer strategy: (1) preload at 15s before end, (2) proactive timer at 5s before end, (3) visibility change safety net. `trackEndProcessedRef` prevents double-advance. **Critical**: do not auto-resume if user explicitly paused.

### Android Background Audio — Ping-Pong Dual Element (`contexts/AudioContext.tsx`)
Android (Chrome / "add to home screen" PWA) drops `play()` when a track transition does `src=…; load(); play()` on the **same** `<audio>` element while the screen is locked — the `.load()` tears the element down and the follow-up `play()` counts as a fresh background autoplay, which Android blocks. Symptom: music stalls at every track boundary until the user wakes/foregrounds the phone (the visibility safety net was the only recovery). iOS is unaffected — it *relies* on the single-element seamless src-swap to keep its audio session warm.

Fix = **start the next track on a second `<audio>` element while the first is still playing**, then swap active + pause the old one — playback never fully stops, so Android doesn't block it. **Android-gated; iOS/desktop keep the single-element path untouched.**

- **Two audio elements**: `audioRef` (`#stablekraft-audio-player`) + `audioRefB` (`#stablekraft-audio-player-b`). `activeAudioRef` points at the current one; **it is only ever repointed inside the Android ping-pong branch**, so on iOS/desktop `getActiveAudioEl()` always === `audioRef.current`.
- **`getActiveAudioEl()` / `getIdleAudioEl()`** are the indirection. **Every "current playback element" access must go through `getActiveAudioEl()`** (never raw `audioRef.current`) — pause/resume/seek/stall-detection/media-session/NIP-38/visibility-safety-net all do. The media-session `seekto` handler and `stop()` were the easy-to-miss ones (`stop()` pauses **both** audio elements).
- **Listener guard**: media event listeners bind to **both** audio elements; each handler early-returns via `shouldProcess(e)` unless `e.currentTarget` is the true current element (`getActiveAudioEl()`, or the video el in video mode). Without this the idle element's preload events (`loadedmetadata`, etc.) would drive state — e.g. seek the active element to `startTime`.
- **Preload**: at 5s the cross-element preload targets `getIdleAudioEl()` on Android audio→audio (previously a no-op since `nextElement === currentElement`); `attemptPingPongPlayback` reuses it if `readyState >= 2`.
- **Transition path**: `attemptPingPongPlayback(track, album, sessionId)` runs **before** `attemptSeamlessPlayback` in both `playAlbum` and `playShuffledTrack`, gated `isAndroidRef.current && !isVideoMode`. Audio-only (returns false for video/HLS → falls through). On failure it falls through to the existing seamless/full path (no regression). A platform-neutral stopgap (reassert `playbackState='playing'` + one `NotAllowedError` retry, no second `load()`) also lives in `attemptSeamlessPlayback`.
- **Verification is device-only**: the locked-screen autoplay policy does not reproduce on desktop/emulator. Test on a physical Android phone + Bluetooth earbuds, screen locked, ≥3 auto boundaries untouched; watch logs for `✅ Ping-pong transition succeeded` and no background `NotAllowedError`.

### Android Locked-Screen Battery Hint (`components/AndroidBatteryHintModal.tsx`)
**Root cause of "audio dies ~5s after the screen locks" on GrapheneOS / aggressive OEM battery managers is NOT a code bug** — it's per-app battery optimization freezing the backgrounded browser tab. The fix is a **device setting** (set the browser to *Unrestricted* battery), which the app can't set for the user. So we surface it as a one-time hint. Do **not** re-attempt JS/PWA workarounds for this symptom (blob prefetch, gapless overlap, etc. were all chasing this freeze) — a PWA has no API to hold a foreground service or wake lock; the OS freeze is unbeatable from web code.

- **One-time modal**, shown on **first playback** only, gated `isAndroidDevice() && !window.Capacitor?.isNativePlatform?.() && !localStorage['android_battery_hint_dismissed']` (Android **browser** only — never iOS, desktop, or the native Capacitor app, which has its own foreground-service keep-alive). Fires at most once per session (a `useRef` guard) and once-ever (localStorage).
- **Pure, unit-tested helpers** in `lib/android-battery-hint.ts`: `shouldShowAndroidBatteryHint({ isAndroid, isNative, dismissed })` and `resolveBrowserName({ ua, isBrave })` (Brave→Firefox→Edge→Chrome→"your browser"; **Edge before Chrome** — Edge's UA contains both). Tests run via `npx tsx --test lib/android-battery-hint.test.ts` (repo has **no jest/vitest**; `node:test` + `tsx` is the pattern).
- **Event-driven wiring** (mirrors the Toast pattern): a guarded `useEffect` in `contexts/AudioContext.tsx` dispatches `window` CustomEvent `android-battery-hint` on first qualifying play (whole body in try/catch — must never throw into the audio pipeline); the modal, mounted once in `app/layout.tsx` after `<ToastContainer />`, listens and opens. The dispatch effect must sit **after** `isAndroidDevice`'s `useCallback` declaration (~line 971) or its dep array TDZ-crashes at render.
- **Shared key**: the localStorage key lives once as `ANDROID_BATTERY_HINT_DISMISSED_KEY` in `lib/android-battery-hint.ts` — imported by both the modal (write) and AudioContext (read). Keep it single-sourced; a drift silently breaks dismissal.

### Android Foreground-Service Keep-Alive — native, zapstore APK only (`android/app/src/main/java/app/stablekraft/`)
The **native** counterpart to the battery hint above: the zapstore app is a Capacitor WebView, and without a foreground service GrapheneOS/aggressive Android suspends the backgrounded WebView process within seconds of locking → audio dies. This pins the process. **Device-verified fix**; shipped in zapstore **v1.1 (`versionCode 2`)** — v1.0.0 had no service and died when locked.

- **Native:** `PlaybackKeepAliveService.java` (foreground `Service`, type `mediaPlayback`, ongoing low-priority "StableKraft — Playing" notification, `START_NOT_STICKY`) + `PlaybackKeepAlivePlugin.java` (`@CapacitorPlugin(name="PlaybackKeepAlive")`, methods `start`/`stop`) registered in `MainActivity.onCreate`; manifest gains `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_MEDIA_PLAYBACK`/`WAKE_LOCK`/`POST_NOTIFICATIONS` + the `<service>` decl.
- **Web bridge:** `playbackKeepAlive('start'|'stop')` in `contexts/AudioContext.tsx`, gated **native-Android-only** (`Capacitor.isNativePlatform() && getPlatform()==='android'`, try/catch swallow) + a `useEffect([isPlaying])`. Complete no-op on iOS/desktop/**browser PWA** (the PWA can't hold a FGS — that's why the battery hint exists there). The bridge is **live in the deployed web** but no-ops until the plugin exists in an installed APK — so shipping the fix required a new APK (native code doesn't reach users via the web deploy; everything else does).
- **Verify on device:** `adb shell dumpsys activity services app.stablekraft` → `PlaybackKeepAliveService … isForeground=true … types=0x00000002 (mediaPlayback)`. `POST_NOTIFICATIONS` isn't runtime-requested → grant via `adb shell pm grant … android.permission.POST_NOTIFICATIONS` for the notification to show (FGS holds the process regardless). Full context in `project_android_background_audio_limits.md`.

### Offline Downloads (`lib/downloads/*`, `contexts/DownloadsContext.tsx`)
Save tracks/albums for offline listening. Works in the PWA **and** the native Capacitor app (its WebView loads the live site) from one **web deploy** — no native plugin/APK. Cache API bytes + sibling IndexedDB metadata + a reference-counting `DownloadManager` (module singleton).

- **Storage split**: audio bytes in Cache API bucket `stablekraft-downloads-v1` (fetched via `getProxiedAudioUrl` to dodge CORS, keyed by `primaryPlaybackKey`); cover images in `stablekraft-downloads-art-v1` (fetched via `/api/proxy-image` so bytes are same-origin/readable → blob URL); metadata in a **separate** IndexedDB `StableKraftDownloadsDB` (isolated from the hot `StableKraftDB` to avoid version-bump risk). Storage backend is an injectable `DownloadsBackend` so `download-manager.ts` is unit-tested without a browser: **`npm run test:downloads`** (`tsx --test`, no jest/vitest in repo).
- **Reference counting**: a track saved via an album AND individually shares ONE cached copy; bytes (and the album cover) evict only when the LAST owner is removed. Owner = `'track'` or `` `album:${feedId ?? id}` ``. `downloadOne` dedups concurrent fetches — same-key callers join one fetch via the `inFlight` map (owner Set + shared `AbortController`); the fetch aborts only when the **last** waiting owner cancels. Do NOT collapse to a single-owner controller (strands a joined owner). The `AbortController` is created **before** `acquire()` so a cancel while `queued` is honored. `removeByKey` is an intentional force-delete for the /downloads manage-storage page (ignores ref owners — documented in-code).
- **Playback** (`contexts/AudioContext.tsx`): `getAudioUrlsToTry` prepends a same-origin `blob:` URL for a downloaded track; the network stream stays as fallback (self-heals if bytes were evicted via `forgetEvicted`). Purely additive to the Android ping-pong / gapless machinery — do not disturb.
- **UI — download is decoupled from the favorite heart** (`components/downloads/DownloadButton.tsx`): the heart is a pure two-state favorite; a separate `DownloadButton` mounts beside it on album detail (album + per-track), `AlbumCard`, `NowPlayingScreen`. Gated on a resolvable media URL **and** `DownloadsProvider` presence (`useDownloadsSafe` → renders null outside the provider), and excludes VTS/playlist/publisher targets. Do NOT re-merge download into the heart (a tri-state heart traps the favorite: no one-tap unfavorite, dead offline).
- **`/downloads` page** (`app/downloads/DownloadsClient.tsx`): collapsible albums (default collapsed — a large library stays a short list), **album-order** playback (`trackOrder` captured at download time since downloads finish in arbitrary order), now-playing highlight (matched by `primaryPlaybackKey`), per-album **owner-scoped** delete + confirm, storage-usage bar, back button.
- **Cover art offline**: `downloadManager.getCoverObjectUrl` → `getCoverUrl` (context) resolves a cached cover to a blob URL on the /downloads page AND in Now Playing, falling back to the network URL. Cached once per album, evicted with the album's last track. Blob object URLs are revoked on change/unmount — keep that lifecycle.
- **Manual Offline mode** (`DownloadsContext` + `AudioContext`): `isOnline` is driven **solely** by a persisted user toggle (`localStorage['sk_offline_mode']`) on the /downloads page — the app deliberately does NOT react to real `navigator.onLine` (connection loss must never force offline UI or redirect; playback prefers the downloaded blob regardless). Do not re-add `useOnlineStatus` reactivity. **It's a QoS switch** ("going into a poor-signal area"): when on, (1) new downloads are blocked, and (2) `AudioContext` refuses to *attempt* streaming a non-downloaded track — `blockNonDownloadedInOfflineMode()` (reads `sk_offline_mode` directly, awaits `downloadManager.init()`) gates all three play entry points (`playAlbum`/`playShuffledTrack`/`playTrack`) so a flaky connection can't hang playback; downloaded tracks play normally. It is NOT a hard network block (deliberately — see the declined "block all network" option; browsing still uses the network, falling back to the localStorage `cachedAlbums` + SW-cached shell on a poor connection).
- **Entry points**: `/downloads` linked from the account menu (`UserMenu`) and a home-header button (desktop + mobile); `/downloads` added to next-pwa precache (`additionalManifestEntries`) so the offline page's CTA reaches it offline.

### Home Grid Pagination (`app/page.tsx` `loadMoreAlbums`)
Infinite-scroll offset **must** be the count of items already loaded (`displayedAlbums.length`), NOT `(page-1)*ALBUMS_PER_PAGE`: the albums phase loads variable-size batches (up to `ALBUMS_PER_PAGE * 2`), so page arithmetic drifts behind the real count and re-fetches rows → **duplicate cards** (adjacent after the format-group sort). The publishers path uses `offset=currentCount` for the same reason. A dedup-by-id safety net on merge also halts paging when a fetch returns only duplicates.

### Sorting
`/api/albums-fast` accepts `sort` param (`added-desc`, `added-asc`, `year-desc`, `year-asc`, `name-asc`, `name-desc`, `tracks-desc`, `tracks-asc`). **Do NOT send `sort=name-asc` as default** — bypasses format grouping (Albums → EPs → Singles). Date fields: `Feed.oldestItemPubdate` = release date, `Feed.createdAt` = when added.

### "New" filter (`/api/feeds/recent`)
Music-only feeds ordered by `Feed.createdAt desc` — recently added to the app, **not** new releases. **Do not** revert the sort to `MAX(latest Track.createdAt, Feed.createdAt)` — re-using an old album whose tracks updated surfaces false-positives already in the catalog (PR #116 originally shipped with that ranking and was changed for exactly this reason).

Three exclusion layers, each catches what the others miss: `where: { type: 'album' }` drops correctly-typed podcasts; `isPlaylistSourceFeedUrl()` drops curated-playlist source podcasts (HGH, MMM, Two For Tunestr) still mis-typed as `'album'`; `isBowlAfterBowlPodcastEntry()` drops BAB while keeping Bowl Covers.

**Page size is 50** (`ALBUMS_PER_PAGE`), same as other filters. Was briefly 200 to push historical re-import noise (feeds deleted-and-re-imported, resetting `createdAt`) off page 1 faster, but rendering 200 `AlbumCard`s — each with its own `IntersectionObserver` for prefetch — made iOS Safari scrolling and filter-swap latency noticeably worse than other filters, so the perf parity won out over the dedup nicety. **No client sort**: `ControlsBar` is hidden on `'new'` and the render branch in `app/page.tsx` renders `filteredAlbums` directly — server controls rank order.

### `/api/albums-fast` track fields (critical gotchas)
Main-grid play button plays tracks straight from this endpoint — fields missing here don't show up on Now Playing.

- **Two Track `select` blocks** — general path (~line 163) and `case 'podcasts'` (~line 451). When adding a field, update **both** (different indentation — naive `replace_all` only hits one).
- **Must include `chaptersUrl`, `chapters`, `valueTimeSplits`** in both selects and both track-mapping blocks — otherwise chapter ticks/titles and VTS playback silently fail when playing from the grid.
- **`persons` and `podcastImages`** (the JSON fields parsed from XML) follow the same both-selects-both-mappings rule — feed-level and track-level. See [Podcasting 2.0 `<podcast:image>` Tag](#podcasting-20-podcastimage-tag-since-2026-06-12) for the full write/read path.
- **Bump `API_VERSION` in `app/page.tsx`** whenever the response shape changes — main page caches under `localStorage['cachedAlbums_${N}_${API_VERSION}']` and without a bump, stale field-missing data sticks indefinitely.
- **Read-path cache stack** (each layer needs its own bust when debugging "feed minted but not visible"):
  1. **Railway in-memory**, 15 min, in `albums-fast/route.ts`. State in `lib/caches/albums-fast-cache.ts`; auto-invalidates on `POST`/`PUT`/`DELETE /api/feeds` via `invalidateAlbumsFastCache()` (same hook busts the 5-min `searchCache` in `lib/caches/search-cache.ts`). Manual bust: `?refresh=true`.
  2. **Fastly CDN** (Railway edge, `x-railway-cdn-edge: fastly/…`). Respects `Cache-Control: public, s-maxage=60, stale-while-revalidate=120` — staleness caps at ~2 min. **Do not raise `s-maxage` back to 900** without a Fastly purge hook (issue #110 traced hours-long invisibility to the old 15+30 min window).
  3. **Client localStorage** `cachedAlbums_${N}_${API_VERSION}` in `app/page.tsx`. Server invalidation can't reach this — persists until hard-reload or `API_VERSION` bump. Expect a 1-app-load lag after a new feed mints.
  4. **PWA service worker** (`next-pwa`, `next.config.js`). `/api/*` is **excluded** so API responses are never SW-cached; HTML shells are NetworkFirst with 1-hour TTL and 3s network timeout.

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

- **NIP-01 tag validation**: `createFavoriteEventTemplate` (in `lib/nostr/favorites.ts`) throws if `itemId` is falsy so we never publish events with `["d", null]` tags — strict relays (nsec.app) reject them. Validate all required tag values at build time, not publish time.
- **Dead-socket filtering** (`RelayManager.publish`): write relays filtered by `relay.connected !== false` before publishing. Each `relay.publish()` wrapped in `Promise.resolve().then(...)` so sync throws flow through `Promise.allSettled`.
- **Stale-signer recovery** (`flushQueue`): routes through `ensureSignerAvailable()` from `signer-reconnect.ts` (same wrapper `BoostButton.tsx` uses). Do **not** revert to the manual `isAvailable() + NIP-55-only` branch — it silently dropped favorites on stale singleton signers.
- **Failure toasts** (`flushQueue`): signer failure, zero-relay connectivity, and per-item sign/publish errors emit `toast.error`/`toast.warning` instead of silent `resolve(null)`. Sign-failure toast has `Reconnect` action → `reconnectSignerManually()`. Do **not** remove — publish queue is the only place user-initiated Nostr writes can fail invisibly.

### Favorites Page (`/favorites`)
Optimistic unfavorite, auto-sync on page load. **Playlist favorites gotcha**: `isPlaylist()` and `playlistImageFallbacks` must use **lowercased feedId**, not the human name. `playlistSlugOverrides` handles ID-to-slug mismatches. Nostr playlist publishing: Kind 34139 addressable event (`d` tag = `stablekraft-favorites`).

**Three `Feed` `select` blocks gotcha** (`app/api/favorites/tracks/route.ts` GET): tracks are matched by id, then guid, then audioUrl — three separate `prisma.track.findMany` queries whose results are concatenated into one `tracks` array. When adding a `Feed` field, add it to **all three** selects or `tsc` rejects the `[...tracks, ...tracksByGuid]` concat (the arrays have incompatible `Feed` shapes) and the Railway build fails at the type-check step — not caught locally unless you run `npm run build`. Same family as the albums-fast dual-select gotcha above.

### Favorite Publishers Resolution (`app/api/favorites/albums/route.ts`)
Three feedId formats: synthetic artist IDs (`artist-adam-curry`), feed GUIDs, feed IDs. Image chain: DB → PI API → album feed image by artist name.

### BackButton (`components/BackButton.tsx`)
Uses `window.history.length`. Do NOT use `document.referrer` — doesn't update during SPA navigation.

### Lightning Wallet Detection
**Keysend capability** (`components/Lightning/BitcoinConnectProvider.tsx`): two signals combined with **OR**. Signal A = WebLN `GetInfoResponse.methods` (NWC wallets populate with `pay_keysend`/`multi_pay_keysend`, extensions with `keysend`). Signal B = provider-type whitelist (`alby`/`alby-hub`/`extension`/`coinos`) from `detectWalletProviderType()`. Either is sufficient.

OR (not methods-first) rescues Alby Hub users whose `get_info` lacks `pay_keysend` (older versions, partial NWC permissions, stale cache) while still correctly rejecting Primal (`nwc.primal` exposes `provider.keysend` via WebLN shim but relay doesn't implement `pay_keysend`). Eager `setKeysendSupported(...)` runs after `detectWalletProviderType` and before `provider.getInfo()` so the UI banner and lnaddress keysend-fallback don't flash `false` during 1–5s NWC cold-start. Do NOT probe with a real keysend — triggers payment popup in Alby extension. `detectWalletProviderType()` in `lib/lightning/wallet-detection.ts` also drives Lightning-address inference and avatar lookup. For `connectorType` values see `@getalby/bitcoin-connect/dist/connectors/index.d.ts`.

**Wallet/Nostr are independent**: Nostr logout does **not** disconnect the Lightning wallet. Prior behavior (wipe + set `wallet_manually_disconnected=true` on every Nostr logout) forced manual wallet re-pair every time a user logged out to reseat a broken NIP-46 signer. Remaining Nostr→wallet interactions (auto-pick-up Alby WebLN on NIP-07 login; `wallet_restore_after_login` Android fix) are *restorative*, not destructive — leave alone.

### BoostBox & Helipad (`lib/lightning/boostbox.ts`)
LNURL payments use [BoostBox](https://tardbox.com) for Podcasting 2.0 boost metadata. Keysend unaffected (uses Helipad TLV). Client-only — always uses `/api/lightning/boostbox` proxy (API key via `BOOSTBOX_API_KEY`). Value splits try keysend first; BoostBox called only for LNURL fallback. Fountain.fm addresses skip keysend by design (`isFountain` check).

- **Feed.guid gotcha**: `feed_guid` in BoostBox comes from `Feed.guid` in DB. If null, reparse the feed.
- **Helipad metadata**: built by `buildHelipadMetadata(amount, msg)` in `BoostButton.tsx`, BLIP-0010 spec. Single helper for all payment paths — do NOT duplicate. `name` field omitted from base; `value-splits.ts` sets it per-recipient.
- **BoostButton props**: `feedUrl`, `remoteFeedGuid` (must be real GUID, never feed slug/ID), `albumName`, `publisherGuid`, `episodeGuid` (omit for album-level). Do NOT fall back to `feedId` for `remoteFeedGuid` — it's a slug, not a GUID.

### VTS (Value Time Splits) Playback (`components/NowPlayingScreen.tsx`)
VTS podcasts embed `<podcast:valueTimeSplit>` segments mapping time ranges to different tracks/artists. Features: chapter tick marks on progress bar, per-song favoriting via `remoteItem`, V4V blending (`remotePercentage` splits between song and show recipients, deduped by address, `isHost` flag for grouping). GUID collision detection via `chapterTitle` param to `/api/lightning/value-splits`. When VTS blending produces both song and show recipients, BoostButton shows **Song/Show section headers** sorted track-first.

- **VTS extraction** (`lib/rss-parser-db.ts`): `applyParsedItemFields` applies chapters, VTS, and other parsed fields. **VTS remoteItem interface** (`lib/podcast-types.ts`): `feedGuid`, `itemGuid`, `medium`.
- **XML entity gotcha**: `parseItemV4VFromXML` matches titles against raw XML — titles with `&` (encoded as `&amp;`) need both decoded and XML-encoded matching.
- **Chapters fallback**: `fetchChapters()` fetches from `podcast:chapters` URL. If the `reflex.livewire.io` proxy returns 400, it extracts the direct URL from the proxy path (`.../chapters/https://actual-url.json`) and retries.

### AutoBoost (`contexts/AudioContext.tsx`)
Two paths gated by `autoBoostEnabled` setting and `autoBoostProcessingRef` mutex:
- **`triggerAutoBoost`** — track end for non-VTS tracks. Falls back from track-level to album-level V4V.
- **`triggerChapterAutoBoost`** — VTS segment transitions. Fetches remote V4V, scales by `remotePercentage`, blends show-host recipients. Non-music chapters use show-level V4V only. API fallback via `feedGuid` if `album.v4vValue` is empty.

**Gap tracking** (`inVtsGapRef`): boosts music segments on gap entry, talk chapters on gap exit. Pre-VTS gaps (intro) tracked on track start. Track-end in a gap boosts via `triggerChapterAutoBoostRef` in `handleEnded`. **Manual seek suppression** (`isManualSeekRef`): chapter skips/progress bar don't trigger autoboost, only natural playback. **iOS foreground recovery**: `visibilitychange`/`pageshow` detect and boost missed segments.

### Toast API (`components/Toast.tsx`)
Event-driven via `window.dispatchEvent(new CustomEvent('toast', ...))`. Helpers `toast.success/error/warning/info(message, { duration, action })` return the toast id (string). Use `toast.dismiss(id)` to programmatically remove a toast (used by `signer-nudge.ts` to clear the "Waiting on your signer…" toast the moment signing completes).

### Episode/Play Count Markers
`<podcast:txt purpose="episode">` or `<podcast:txt purpose="playcount">` in XML. Parser decodes XML entities via `decodeXmlEntities()` in `lib/playlist/parser.ts`. Original titles stored in `SystemPlaylistTrack.episodeTitle` — do NOT reverse-engineer from episode IDs (lossy). Refresh: `curl https://stablekraft.app/api/playlist/[id]?refresh`
