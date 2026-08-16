# Scripts

255 files accumulated over the life of the project. Most are one-off fixes that have already been
applied. Read this before running anything here.

## Two warnings

> Sixteen `npm run` entries used to point at files that were never committed (`dev-setup`,
> `fix-all`, `check-artwork`, `ensure-publisher-feeds`, …). They were removed from `package.json`
> rather than restored — no commit ever added the scripts, so there was nothing to restore. If you
> find a reference to one in an old doc or issue, that is why it is gone. **Every `npm run` entry
> now points at a file that exists**, and the check that enforces it is in the next section.

**1. Many scripts still target the JSON database.** They read `data/music-tracks.json` and
`data/enhanced-music-tracks.json`, which stopped being the source of truth when the app moved to
PostgreSQL. **Neither file is in the repo**, so these scripts now fail outright with `ENOENT`
rather than quietly acting on stale data — which is the better failure, but means they are dead
code either way. See [`DEPRECATED_SCRIPTS.md`](DEPRECATED_SCRIPTS.md).

**2. Almost none of this is the maintenance path anymore.** Feed import, publisher album import,
reparse, dead-feed sweeps and playlist refresh are all **admin API routes** driven by the nightly
GitHub Action. Reach for those first — see [`../docs/PLAYLIST_REFRESH.md`](../docs/PLAYLIST_REFRESH.md)
and [`../docs/PUBLISHER_FEED_MANAGEMENT.md`](../docs/PUBLISHER_FEED_MANAGEMENT.md).

## Keeping the manifest honest

Every `npm run` entry should point at a file that exists. This catches it:

```bash
node -e "
const p=require('./package.json'), fs=require('fs');
const bad=Object.entries(p.scripts).filter(([,v])=>{const m=v.match(/(scripts\/[A-Za-z0-9_.-]+)/);return m&&!fs.existsSync(m[1]);});
console.log(bad.length ? 'BROKEN: '+bad.map(([k])=>k).join(' ') : 'all script paths resolve');
"
```

## What still works, by job

### Environment

| Script | Purpose |
|---|---|
| `check-env.js` | Validate required env vars. Runs on `postinstall`. |

### Performance measurement

Run via npm; all four exist and are current:

```bash
npm run perf:db          # scripts/perf-db.ts
npm run perf:api         # scripts/perf-api.ts
npm run perf:memory      # scripts/perf-memory.ts
npm run perf:lighthouse  # scripts/perf-lighthouse.ts
npm run perf:all         # db + api + memory
```

### Favorites backup

The only safe way to snapshot favorites before enabling `SHARED_FAVORITES_APPLY_DELETES`:

```bash
railway run --service StableKraft --environment production \
  npx tsx scripts/backup-favorites.ts dump > favorites-$(date +%F).json

npx tsx scripts/backup-favorites.ts restore favorites-2026-08-16.json   # additive, idempotent
```

### Discovery & import

| Script | Purpose |
|---|---|
| `comprehensive-music-discovery.js` | Discover new music feeds via the Podcast Index API |
| `properly-resolve-iam-tracks.js` | Resolve imported IAM tracks |
| `parse-publisher-remote-items.js` | Extract `<podcast:remoteItem>` entries from publisher feeds |

### Metadata repair

| Script | Purpose |
|---|---|
| `assign-default-durations.js` | Smart default durations for tracks missing one |
| `update-duration-to-9999.js` | Placeholder 99:99 duration, for spotting gaps |
| `update-artwork-to-main-bg.js` | Site background as placeholder artwork |

### Deploy

| Script | Purpose |
|---|---|
| `deploy.sh` | `npm run deploy` — build a deployment package locally |
| `auto-deploy.sh` | `npm run auto-deploy` — version bump then deploy |
| `auto-version-update.js` | `npm run update-version` |

Note that none of these are how production deploys. **`git push origin main` is the deploy** —
Railway builds the Dockerfile. These are local packaging helpers.

### Android

```bash
npm run android:sync      # npx cap sync android
npm run android:icons     # regenerate icons/splash
npm run android:debug     # assembleDebug
npm run android:release   # assembleRelease
```

See the `android-native` skill for keystore, versionCode and zapstore publishing.

## Subdirectories

| Directory | Contents |
|---|---|
| `tests/` | Standalone feed/parser test scripts (`test-album-pages.js`, `test-music-parser.js`, `test-publisher-feed.js`, …). Not the app's test suite — that is `npm run test:all`. |
| `utils/` | One-off lookups and fixes, mostly named after the specific feed or episode they were written for (`lookup-ep54-feeds.js`, `fix-dane-ray-coleman.js`). |
| `root-scripts/` | Older scripts moved out of the repo root. |
| `archived-migration-scripts/` | Completed migrations. Historical only. |

## Before writing a new script

Check whether an admin route already does it. The nightly workflow calls fourteen of them, and a
route gets the connection pooling, the SSRF guard and the admin gate for free — a script gets none
of that and needs a `DATABASE_URL` in the environment you run it from.

If you do add one, put it in the right subdirectory and add a row above. A script whose purpose
isn't written down becomes one of the 256.
