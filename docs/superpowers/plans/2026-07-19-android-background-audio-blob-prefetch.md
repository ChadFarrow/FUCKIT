# Android Locked-Screen Blob-Prefetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Android locked-screen track transitions reliable by prefetching the next track into an in-memory `blob:` URL during the current track's playback and feeding that blob to the idle audio element at the boundary.

**Architecture:** A small dependency-injected `NextTrackBlobCache` (pure, unit-tested) holds at most two object URLs (currently-playing + prepared-next). `AudioContext` prefetches the upcoming track via `fetch()` whenever the current track changes (Android-gated), and `attemptPingPongPlayback` prefers the prepared blob over a network URL. Because a `blob:` source needs no network, the transition survives Chromium's background media-load suspension. iOS/desktop paths are untouched.

**Tech Stack:** TypeScript, React (client context), Next.js. No new runtime dependencies. Unit tests via Node's built-in `node:test` + `--experimental-strip-types` (already verified working on Node v22.16).

## Global Constraints

- **Android-gated:** every new behavior guards on `isAndroidRef.current`. iOS/desktop must be byte-for-byte unaffected. (Existing ping-pong pattern.)
- **Audio-only:** skip video/HLS (`isVideoUrl(...)` returns true → do nothing; ping-pong already returns false for video).
- **Best-effort, no regressions:** any prefetch/fetch failure leaves the existing network path unchanged. Never throw out of prefetch.
- **Build gate:** run `npm run build` before committing (repo rule in CLAUDE.md). No app unit-test runner exists; the pure module is tested via `node --experimental-strip-types --test`.
- **No secrets, no JSON-file DBs, source under `app/`/`lib/`/`components/`/`contexts/`.** (CLAUDE.md boundaries.)
- **Blob lifecycle:** never hold more than the playing + next blob; always `revokeObjectURL` the one that is no longer needed.
- **Verification is device-only:** the locked-screen suspension does not reproduce on desktop/emulator. Final gate is the adb + CDP harness on a physical Android phone (see Task 4).

---

### Task 1: Pure `NextTrackBlobCache` module + unit tests

**Files:**
- Create: `lib/audio-blob-prefetch.ts`
- Create: `scripts/test-audio-blob-cache.ts`
- Modify: `package.json` (add test script)

**Interfaces:**
- Produces:
  - `class NextTrackBlobCache` with:
    - `constructor(createObjectURL?: (b: Blob) => string, revokeObjectURL?: (u: string) => void)`
    - `hasPreparedNext(key: string): boolean`
    - `getPreparedNext(key: string): string | null`
    - `prepareNext(key: string, blob: Blob): { key: string; blobUrl: string }`
    - `promoteToPlaying(key: string): void`
    - `clearAll(): void`
  - `interface NextTrackBlob { key: string; blobUrl: string }`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-audio-blob-cache.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert';
import { NextTrackBlobCache } from '../lib/audio-blob-prefetch.ts';

// Fakes that record create/revoke calls and mint deterministic URLs.
function makeCache() {
  const created: string[] = [];
  const revoked: string[] = [];
  let n = 0;
  const create = (_b: Blob) => { const u = `blob:fake/${++n}`; created.push(u); return u; };
  const revoke = (u: string) => { revoked.push(u); };
  const cache = new NextTrackBlobCache(create, revoke);
  return { cache, created, revoked };
}
const B = () => new Blob(['x']);

test('prepareNext stores a blob retrievable by key', () => {
  const { cache, created } = makeCache();
  cache.prepareNext('urlA', B());
  assert.equal(cache.hasPreparedNext('urlA'), true);
  assert.equal(cache.getPreparedNext('urlA'), created[0]);
  assert.equal(cache.getPreparedNext('other'), null);
});

test('preparing a new next revokes the previous unconsumed next', () => {
  const { cache, created, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.prepareNext('urlB', B());
  assert.deepEqual(revoked, [created[0]]);
  assert.equal(cache.getPreparedNext('urlB'), created[1]);
  assert.equal(cache.hasPreparedNext('urlA'), false);
});

test('promoteToPlaying keeps the promoted blob and clears next (first playing blob not revoked)', () => {
  const { cache, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlA');
  assert.equal(cache.hasPreparedNext('urlA'), false);
  assert.deepEqual(revoked, []);
});

test('a later promote revokes the previously-playing blob', () => {
  const { cache, created, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlA');
  cache.prepareNext('urlB', B());
  cache.promoteToPlaying('urlB');
  assert.deepEqual(revoked, [created[0]]);
});

test('promoteToPlaying with a non-matching key is a no-op', () => {
  const { cache, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlZ');
  assert.equal(cache.hasPreparedNext('urlA'), true);
  assert.deepEqual(revoked, []);
});

test('clearAll revokes both next and playing', () => {
  const { cache, created, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlA');
  cache.prepareNext('urlB', B());
  cache.clearAll();
  assert.deepEqual(revoked.slice().sort(), [created[0], created[1]].slice().sort());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test scripts/test-audio-blob-cache.ts`
Expected: FAIL — `Cannot find module '../lib/audio-blob-prefetch.ts'` (module not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `lib/audio-blob-prefetch.ts`:

```ts
/**
 * Next-track blob prefetch cache (Android locked-screen fix).
 *
 * On Android with the screen locked, Chromium suspends an <audio> element's own
 * network load() for a hidden, not-yet-playing element, so the ping-pong idle
 * element cannot fetch the next track and playback stalls at the boundary
 * (MEDIA_ERR_SRC_NOT_SUPPORTED). A page-level fetch() still works while the tab
 * is alive (current track playing), and a blob: URL needs no network at the
 * boundary. This cache holds the next track's bytes as a blob: URL so the
 * transition needs zero network.
 *
 * Holds at most two object URLs at once: the one currently playing and the next
 * prepared one. create/revoke are injectable for testability.
 */

export interface NextTrackBlob {
  /** Key = the resolved primary playback URL of the prepared track. */
  key: string;
  /** In-memory object URL for the fetched bytes. */
  blobUrl: string;
}

type CreateObjectURL = (blob: Blob) => string;
type RevokeObjectURL = (url: string) => void;

export class NextTrackBlobCache {
  private createObjectURL: CreateObjectURL;
  private revokeObjectURL: RevokeObjectURL;
  private next: NextTrackBlob | null = null;
  private playing: NextTrackBlob | null = null;

  constructor(createObjectURL?: CreateObjectURL, revokeObjectURL?: RevokeObjectURL) {
    this.createObjectURL = createObjectURL ?? ((b) => URL.createObjectURL(b));
    this.revokeObjectURL = revokeObjectURL ?? ((u) => URL.revokeObjectURL(u));
  }

  /** True if a prepared next blob for `key` is ready to use. */
  hasPreparedNext(key: string): boolean {
    return this.next !== null && this.next.key === key;
  }

  /** The prepared next blob URL for `key`, or null. */
  getPreparedNext(key: string): string | null {
    return this.next !== null && this.next.key === key ? this.next.blobUrl : null;
  }

  /**
   * Store freshly-fetched bytes for `key` as the prepared next blob. Revokes any
   * previous prepared-next that was never consumed (the upcoming track changed).
   */
  prepareNext(key: string, blob: Blob): NextTrackBlob {
    if (this.next !== null) {
      this.revokeObjectURL(this.next.blobUrl);
      this.next = null;
    }
    const blobUrl = this.createObjectURL(blob);
    this.next = { key, blobUrl };
    return this.next;
  }

  /**
   * Promote the prepared next blob (matching `key`) to "playing" — it has just
   * been attached to the active audio element. Revokes the previously-playing
   * blob (that track finished). No-op if the prepared next doesn't match `key`.
   */
  promoteToPlaying(key: string): void {
    if (this.next === null || this.next.key !== key) {
      return;
    }
    if (this.playing !== null) {
      this.revokeObjectURL(this.playing.blobUrl);
    }
    this.playing = this.next;
    this.next = null;
  }

  /** Revoke everything and reset (stop / album change). */
  clearAll(): void {
    if (this.next !== null) {
      this.revokeObjectURL(this.next.blobUrl);
      this.next = null;
    }
    if (this.playing !== null) {
      this.revokeObjectURL(this.playing.blobUrl);
      this.playing = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test scripts/test-audio-blob-cache.ts`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Add npm script**

In `package.json` `"scripts"`, add (next to the other `test-*` scripts):

```json
"test:blob-cache": "node --experimental-strip-types --test scripts/test-audio-blob-cache.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/audio-blob-prefetch.ts scripts/test-audio-blob-cache.ts package.json
git commit -m "feat: NextTrackBlobCache for Android background audio prefetch"
```

---

### Task 2: Wire blob prefetch into AudioContext

**Files:**
- Modify: `contexts/AudioContext.tsx` (import ~line 17; refs ~line 177; helpers + effect before `attemptPingPongPlayback` ~line 1895)

**Interfaces:**
- Consumes: `NextTrackBlobCache` from Task 1; existing `getTrackPlaybackUrl`, `getAudioUrlsToTry`, `isVideoUrl`, `isAndroidRef`, and state `currentPlayingAlbum`, `currentTrackIndex`, `isShuffleMode`, `currentShuffleIndex`, `shuffledPlaylist`, `repeatMode`.
- Produces (for Task 3): `getBlobCache(): NextTrackBlobCache`, `primaryPlaybackUrl(track): string | null`, and `nextBlobCacheRef`.

- [ ] **Step 1: Add the import**

In `contexts/AudioContext.tsx`, immediately after the existing prefetch import (line 17 `import { prefetchUpcomingTracks, prefetchAudio } from '@/lib/audio-prefetch';`), add:

```ts
import { NextTrackBlobCache } from '@/lib/audio-blob-prefetch';
```

- [ ] **Step 2: Add the cache ref + accessor**

In `contexts/AudioContext.tsx`, immediately after line 177 (`const preloadAudioRef = useRef<HTMLAudioElement | null>(null); // Hidden Audio element for preloading next track`), add:

```ts
  // Android locked-screen fix: holds the NEXT track's bytes as an in-memory
  // blob: URL so a backgrounded transition needs zero network. Lazily created
  // (client-only) so SSR never touches URL.createObjectURL. See
  // lib/audio-blob-prefetch.ts.
  const nextBlobCacheRef = useRef<NextTrackBlobCache | null>(null);
  const getBlobCache = (): NextTrackBlobCache => {
    if (!nextBlobCacheRef.current) {
      nextBlobCacheRef.current = new NextTrackBlobCache();
    }
    return nextBlobCacheRef.current;
  };
```

- [ ] **Step 3: Add URL helper, prefetch, upcoming-track resolver, and the prefetch effect**

In `contexts/AudioContext.tsx`, immediately BEFORE the `attemptPingPongPlayback` doc comment (line 1895, `  // Starts the next track on the IDLE audio element WHILE the current element is`), insert:

```ts
  // Resolve the single "primary" playback URL for a track — the same first
  // candidate the transition path uses — so the prefetch key and the ping-pong
  // lookup always agree.
  const primaryPlaybackUrl = (track: any): string | null => {
    const raw = getTrackPlaybackUrl(track);
    if (!raw) return null;
    let url = getAudioUrlsToTry(raw)[0] || raw;
    if (url.startsWith('http://')) url = url.replace(/^http:/, 'https:');
    return url || null;
  };

  // Android: while the current track plays (tab alive), fetch the NEXT track
  // fully into an in-memory blob: URL. At the boundary the idle element plays it
  // with zero network — surviving Chromium's background media-load suspension.
  // Best-effort: any failure leaves the existing network path unchanged.
  const prefetchBlobForTrack = async (track: any): Promise<void> => {
    if (!isAndroidRef.current) return;              // Android-only, like ping-pong
    if (!track) return;
    const rawUrl = getTrackPlaybackUrl(track);
    if (isVideoUrl(rawUrl, track.mediaType)) return; // audio-only
    const key = primaryPlaybackUrl(track);
    if (!key) return;
    const cache = getBlobCache();
    if (cache.hasPreparedNext(key)) return;         // already prepared
    try {
      const res = await fetch(key);
      if (!res.ok) {
        console.warn(`⚠️ Blob prefetch HTTP ${res.status} for ...${key.slice(-40)}`);
        return;
      }
      const blob = await res.blob();
      cache.prepareNext(key, blob);
      console.log(`📥 Prefetched next-track blob (${blob.size} bytes): ${track.title}`);
    } catch (e) {
      console.warn(`⚠️ Blob prefetch failed: ${e}`);
    }
  };

  // Compute the track that will play after the current one, mirroring
  // playNextTrack's common cases (sequential + shuffle-sequential). repeat-one
  // replays the current element (no fresh source needed) and repeat-all wrap at
  // the end is left to the network fallback — both return null here.
  const getUpcomingTrack = (): any | null => {
    if (repeatMode === 'one') return null;
    if (isShuffleMode) {
      const next = shuffledPlaylist[currentShuffleIndex + 1];
      return next ? next.track : null;
    }
    if (!currentPlayingAlbum || !currentPlayingAlbum.tracks) return null;
    const tracks = currentPlayingAlbum.tracks;
    let i = currentTrackIndex + 1;
    while (i < tracks.length) {
      const t = tracks[i];
      if (!t.status || t.status === 'active') return t;
      i++;
    }
    return null; // end of album
  };

  // Prefetch the upcoming track's blob whenever the current track changes.
  // Runs on the client after each transition while the new track plays (tab
  // alive), so the following track is always ready before its boundary.
  useEffect(() => {
    if (!isAndroidRef.current) return;
    const upcoming = getUpcomingTrack();
    if (upcoming) {
      prefetchBlobForTrack(upcoming);
    }
    // Intentionally depends only on playback-position state; the helper
    // closures are recreated each render and must not be deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayingAlbum, currentTrackIndex, isShuffleMode, currentShuffleIndex, shuffledPlaylist, repeatMode]);
```

- [ ] **Step 4: Typecheck / build**

Run: `npm run build`
Expected: build succeeds (TypeScript passes). No runtime behavior change yet at the boundary (blob is prepared but not consumed until Task 3).

- [ ] **Step 5: Commit**

```bash
git add contexts/AudioContext.tsx
git commit -m "feat: prefetch next track to blob on Android when current track changes"
```

---

### Task 3: Consume the blob in the transition + clean up on stop

**Files:**
- Modify: `contexts/AudioContext.tsx` (`attemptPingPongPlayback` ~lines 1915-1978; `stop()` ~line 3652)

**Interfaces:**
- Consumes: `getBlobCache()`, `primaryPlaybackUrl(track)` from Task 2; existing `getAudioUrlsToTry`, `activeAudioRef`, `playbackSessionRef`, `updateMediaSession`.

- [ ] **Step 1: Replace the URL loop in `attemptPingPongPlayback` to prefer the blob**

In `contexts/AudioContext.tsx`, replace the block that currently starts at
`const urlsToTry = getAudioUrlsToTry(rawUrl);` (line 1915) through the function's
final `return false;` **and its closing `};`** (lines 1977-1978) with the
following (which ends with its own closing `};` — do not leave the old one):

```ts
    const urlsToTry = getAudioUrlsToTry(rawUrl);
    const startTime = track.startTime && typeof track.startTime === 'number' ? track.startTime : 0;

    // Prefer the prefetched in-memory blob (survives backgrounded media-load
    // suspension); fall back to the network URLs on any miss/failure.
    const blobKey = primaryPlaybackUrl(track);
    const blobUrl = blobKey ? getBlobCache().getPreparedNext(blobKey) : null;
    const sources: Array<{ url: string; isBlob: boolean }> = [];
    if (blobUrl) sources.push({ url: blobUrl, isBlob: true });
    for (const u of urlsToTry) {
      let s = u;
      if (s.startsWith('http://')) s = s.replace(/^http:/, 'https:');
      sources.push({ url: s, isBlob: false });
    }

    for (let i = 0; i < sources.length; i++) {
      if (sessionId !== undefined && playbackSessionRef.current !== sessionId) {
        console.log(`⏭️ Ping-pong session ${sessionId} cancelled, newer session ${playbackSessionRef.current} active`);
        return false;
      }

      const { url: secureUrl, isBlob } = sources[i];

      try {
        // Reuse the idle element if it already holds this exact source loaded.
        const alreadyLoaded = idle.src === secureUrl && idle.readyState >= 2;
        if (!alreadyLoaded) {
          idle.src = secureUrl;
          idle.load();
        }
        idle.currentTime = startTime;
        idle.muted = false;
        idle.volume = 0.8;

        if ('mediaSession' in navigator && navigator.mediaSession) {
          navigator.mediaSession.playbackState = 'playing';
        }

        // Start the new element while the old one is still playing.
        await idle.play();

        // Success — promote idle to active, then quiesce the old element.
        activeAudioRef.current = idle;
        if (outgoing && outgoing !== idle) {
          try { outgoing.pause(); } catch { /* ignore */ }
        }
        // A consumed blob becomes the "playing" blob; the previously-playing
        // blob (now finished) is revoked inside promoteToPlaying.
        if (isBlob && blobKey) {
          getBlobCache().promoteToPlaying(blobKey);
        }

        // Reset advance/preload bookkeeping for the new current track.
        trackEndProcessedRef.current = false;
        pendingNextTrackUrlRef.current = null;
        if (iosAdvanceTimerRef.current) {
          clearTimeout(iosAdvanceTimerRef.current);
          iosAdvanceTimerRef.current = null;
        }

        setIsPlaying(true);
        if ('mediaSession' in navigator && navigator.mediaSession) {
          navigator.mediaSession.playbackState = 'playing';
        }
        updateMediaSession(album, track);
        setIsLoading(false);
        const isProxied = secureUrl.includes('proxy-audio');
        console.log(`✅ Ping-pong transition succeeded (${isBlob ? 'blob' : isProxied ? 'proxy' : 'direct'}): ${track.title}`);
        return true;
      } catch (err) {
        console.warn(`⚠️ Ping-pong attempt ${i + 1}/${sources.length} failed: ${err}`);
        // Try next source; on total failure, caller falls through to seamless/full.
      }
    }

    return false;
  };
```

- [ ] **Step 2: Revoke blobs on stop**

In `contexts/AudioContext.tsx` `stop()`, immediately after the `audioRefB.current` pause block (line 3661, right after its closing `}`), add:

```ts
    // Android blob prefetch: release any held object URLs (playing + prepared).
    nextBlobCacheRef.current?.clearAll();
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds (TypeScript passes).

- [ ] **Step 4: Run the blob-cache unit tests again (regression)**

Run: `node --experimental-strip-types --test scripts/test-audio-blob-cache.ts`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add contexts/AudioContext.tsx
git commit -m "feat: play next track from prefetched blob across Android locked-screen boundary"
```

---

### Task 4: On-device verification (the real gate)

**Files:** none (verification only). Requires a physical Android phone with the PWA, USB-connected, `adb` on PATH (`~/Library/Android/sdk/platform-tools/adb`).

**Interfaces:** consumes the deployed build. Note: the PWA loads from production, so this task runs after the branch is deployed (or against a local `npm run dev` opened on the phone). Confirm which target is under test before starting.

- [ ] **Step 1: Confirm the code under test**

The phone's PWA must be running the branch's JS. Either deploy the branch, or point the phone at a dev build. Verify by checking the served bundle contains the new log string:

Run (with the PWA open on the phone and USB debugging on):
```bash
~/Library/Android/sdk/platform-tools/adb forward tcp:9222 localabstract:chrome_devtools_remote
curl -s http://localhost:9222/json | python3 -c "import sys,json;[print(t['title'][:40],t['url'][:50],t.get('webSocketDebuggerUrl')) for t in json.load(sys.stdin)]"
```
Expected: a page target for `stablekraft.app` (or your dev URL) with a `ws://localhost:9222/devtools/page/<id>` URL. Note the `<id>`.

- [ ] **Step 2: Start playback, lock the screen, capture the boundary via CDP**

Write `verify.py` in a scratch dir (replace `<id>`):

```python
import asyncio, json, websockets
WS="ws://localhost:9222/devtools/page/<id>"
JS=r"""(function(){
  function info(el){ if(!el) return null;
    return {id:el.id, paused:el.paused, ended:el.ended, ct:+el.currentTime.toFixed(1),
      rs:el.readyState, err:(el.error&&el.error.code)||null, isBlob:(el.currentSrc||el.src||'').startsWith('blob:'),
      src:(el.currentSrc||el.src||'').slice(0,12)}; }
  var a=document.getElementById('stablekraft-audio-player');
  var b=document.getElementById('stablekraft-audio-player-b');
  var active=(b&&!b.paused)?b:((a&&!a.paused)?a:null);
  return JSON.stringify({vis:document.visibilityState, ms:(navigator.mediaSession||{}).playbackState||null,
    active: active?info(active):null, A:info(a), B:info(b)});
})()"""
async def main():
  async with websockets.connect(WS,max_size=None) as ws:
    await ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":JS,"returnByValue":True}}))
    while True:
      m=json.loads(await asyncio.wait_for(ws.recv(),8))
      if m.get("id")==1: print(json.dumps(json.loads(m["result"]["result"]["value"]),indent=2)); return
asyncio.run(main())
```

Procedure:
1. On the phone: play an album from track 1, then **lock the screen**.
2. Let **at least 3 track boundaries** pass untouched.
3. During a later track (screen still locked), run: `python3 verify.py`

Expected at a healthy steady state (screen locked, mid-track):
- `vis: "hidden"`, `ms: "playing"`.
- `active` element `paused:false`, `err:null`, and (for track ≥2) `isBlob:true` — the current track is playing from a prefetched blob.
- Audibly: music continues across every boundary with the screen never unlocked.

- [ ] **Step 3: Confirm no leak (bounded blob count)**

After ~5+ boundaries, evaluate the object-URL count is bounded (should be ≤2 live). Run a one-off via the same WS:

```python
# expression: "performance.getEntriesByType?('resource') && 'ok'"  (sanity)
# There is no direct API to count live object URLs; instead assert memory is
# stable across boundaries by checking the cache never accumulates: watch the
# console for repeated '📥 Prefetched next-track blob' WITHOUT growth in
# renderer memory (chrome://inspect > Memory), and that each boundary logs
# '✅ Ping-pong transition succeeded (blob: ...)'.
```
Expected: one prefetch log per boundary, one blob-sourced success log per boundary, renderer memory stable.

- [ ] **Step 4: Regression — iOS/desktop untouched**

On desktop Chrome (or note for an iOS check): play through a boundary normally. Expected: no `blob:` source (Android-gated), transitions behave exactly as before. `getUpcomingTrack`/prefetch effect early-return because `isAndroidRef.current` is false.

- [ ] **Step 5: Record the result**

If all pass, note in the PR description: device model, Android version, browser (Vanadium/Chrome), number of clean boundaries, and a sample `verify.py` snapshot showing `active.isBlob:true` while `vis:"hidden"`.

If a boundary still stalls, capture: the `verify.py` snapshot at the stall, plus a CDP console stream of the boundary (the `📥`/`✅`/`⚠️` logs), and return to systematic-debugging Phase 1 with that evidence — do not add speculative fixes.

---

## Notes for the implementer

- The existing dual-element ping-pong machinery (`audioRef`/`audioRefB`, `getActiveAudioEl`/`getIdleAudioEl`, `activeAudioRef`) is **kept** — the blob is fed into its idle element. Do not revert it.
- The prefetch runs from a React effect keyed on playback position, not from a timer (background timers are frozen while locked). The effect fires while the *current* track plays and the tab is alive, which is exactly when `fetch()` works.
- The prefetch `fetch(key)` hits the same URL the element would (often `/api/proxy-audio?...`, same-origin) — verified on-device to complete in ~400–550 ms for a ~5 MB track while locked.
- Keying by `primaryPlaybackUrl(track)` (not `track.id`) guarantees the prefetch key and the ping-pong lookup agree without depending on a track id field.
