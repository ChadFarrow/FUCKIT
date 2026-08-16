# Publisher Feed Management

A **publisher feed** (`Feed.type = 'publisher'`) is an artist-level feed whose
`<podcast:remoteItem>` entries point at that artist's album feeds. Publisher pages
(`/publisher/[id]`) render those albums.

The recurring failure this guide addresses: a publisher page showing one album when the artist has
twelve, because the album feeds were never imported.

> **This is now database-driven.** Earlier versions of this guide described editing a `feeds.json`
> file and running `npm run ensure-publisher-feeds` / `auto-add-publishers` /
> `parse-and-add-publishers`. There is no `feeds.json` — all data is in PostgreSQL via Prisma — and
> those npm scripts point at files that no longer exist in `scripts/`. Use the admin routes below.

## The two operations

Publisher maintenance is two distinct things, and conflating them is why albums go missing:

**Link** — attach albums that are *already in the database* to their publisher.

```
POST /api/admin/publishers/link-albums
Body: { "publisherId": "<id>" }  or  { "all": true }
```

Parses the publisher's XML feed and sets `publisherId` on the matching album feeds. This fixes an
album that exists but doesn't appear on the publisher page.

**Import** — mint album feeds that are *not in the database at all*.

```
POST /api/admin/publishers/import-albums
Body: { "publisherId": "<id>" }   # optional; omit to sweep every publisher
```

Searches the Podcast Index API by artist name and mints feeds for albums found there
(`lib/album-import.ts` → `searchMusicFeedsByArtist`, `mintAlbumFromPiFeed`). This fixes an album
that is missing entirely.

Both routes are bearer-gated by `middleware.ts` (`ADMIN_SECRET`).

### Never fetch Wavlake directly

`import-albums` goes through the Podcast Index API for every lookup, deliberately. Fetching Wavlake
directly is the one thing feed import may not do — see the `feed-ingestion` skill.

### Music-show-only publishers are excluded from the sweep

`import-albums` skips publishers with `musicShowOnly: true`. Their albums must arrive through the
playlist resolver, and only when a curated music show actually references them — a PI-API sweep
over a music show's artist name pulls in the artist's whole catalog, which is not what a music show
implies. Manage that flag via `/api/admin/music-show-only-publishers` (with `/search` and
`/cleanup-by-ids`).

## Where this runs automatically

The nightly job does all of it — you rarely need to run these by hand:

| Step | Endpoint |
|---|---|
| 5 | `POST /api/parse-feeds?action=parse-publishers` — parse publisher feeds, link albums |
| 5b | `POST /api/admin/publishers/import-albums` — import albums missing locally |
| 5c | `POST /api/admin/feeds/{id}/reparse` — reparse each newly imported feed from its real RSS |
| 5d | `POST /api/admin/artists/import-new-albums` — artists with **no** publisher feed |

See [`PLAYLIST_REFRESH.md`](PLAYLIST_REFRESH.md).

**Step 5c is not optional.** A feed minted from the PI API is missing `podcast:episode` /
`podcast:season` track ordering, chapters, and value time splits — the PI API does not carry them.
Only a reparse against the feed's own XML fills those in. An album imported without it plays in the
wrong track order.

**Step 5d covers self-hosted artists** (e.g. `leuenbergmusic.com`) who have no publisher feed at
all. It PI-searches each known artist by name and imports a found album only when the host matches
one that artist already uses, which is what keeps it from pulling in same-named artists.

## Adding a new publisher by hand

1. Add the publisher feed through `/admin` (paste the URL). It lands as `Feed.type = 'publisher'`.
2. `POST /api/admin/publishers/link-albums` with its `publisherId` — links albums already present.
3. `POST /api/admin/publishers/import-albums` with the same id — mints the ones that aren't.
4. Reparse each newly imported feed (`POST /api/admin/feeds/{id}/reparse`) so ordering, chapters
   and VTS are correct.
5. Load `/publisher/<id>` and confirm the catalog is complete.

## Troubleshooting

**Albums missing from a publisher page.** Decide which of the two operations you need: query
whether the album feed exists at all. If it does, it's a link problem (`link-albums`); if it
doesn't, an import problem (`import-albums`).

**An artist's albums won't import.** Check `musicShowOnly` on the publisher — if it's set, the
sweep skips it by design.

**Imported album plays in the wrong track order.** It was minted from the PI API and never
reparsed. `POST /api/admin/feeds/{id}/reparse`.

**A publisher page 404s.** Publisher id resolution lives in `lib/url-utils.ts`; check the feed's
`status` is `active` and that it isn't `markedDead`.

**Spam albums appeared from a Wavlake artist page.** That's a curation problem, not an import one —
see the `feed-curation` skill for blacklists and `markedDead`.

## Related

- `feed-curation` skill — hiding/removing feeds, blacklists, orphan cleanup, music-show-only
- `feed-ingestion` skill — how feeds get in, the URL lookup ladder, the podping consumer
- `catalog-display` skill — how publisher pages resolve and render albums
