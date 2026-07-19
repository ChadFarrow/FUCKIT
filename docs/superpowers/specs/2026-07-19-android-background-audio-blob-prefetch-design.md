# Android locked-screen track transitions — blob prefetch design

**Date:** 2026-07-19
**Area:** `contexts/AudioContext.tsx` (Android background audio)
**Supersedes the premise of:** commit `70ddded7` ("ping-pong" dual-element fix)

## Problem

On Android, when the PWA (tested in Vanadium; applies to Chromium PWAs generally) plays
with the **screen locked**, playback stalls at every track boundary until the user
foregrounds the phone. Commit `70ddded7` assumed Android *blocks the background `play()`*
of the next track (a "fresh autoplay" after `load()`), and added an Android-gated
dual-element "ping-pong" to keep an element playing across the swap. It did not fix the
stall.

## Root cause (device-verified via adb + Chrome DevTools Protocol)

The failure is **background suspension of the media element's network load**, not autoplay
blocking. Evidence gathered live from the locked device:

1. **`play()` is NOT blocked.** At the boundary the native AAudio output stream stopped and
   then *restarted and went active* (`AAudioStream_requestStart ... returned 0`, `setState → 4`).
   Android granted the audio.
2. **The next element had no source.** Live snapshot of the two `<audio>` elements while
   locked: the outgoing element was `readyState 4, error null` (played fine); the next
   element was `error: 4` (`MEDIA_ERR_SRC_NOT_SUPPORTED`), `networkState 3` (`NO_SOURCE`),
   `readyState 0`. Console: `NotSupportedError - Failed to load because no supported source
   was found`. **Chromium suspends media network-loading for a hidden tab's not-yet-playing
   `<audio>` element**, so the ping-pong's idle element could never fetch its source.
3. **Background timers are frozen.** `setTimeout(500)` did not fire within 12 s while locked,
   so the proactive-advance timer and any timer-based orchestration cannot run at the boundary.

The current track plays to its end because it was **already buffered** and, as the actively
playing element, keeps the tab alive. The moment it ends there is an audio gap, the tab loses
its "playing audio" keep-alive, and the next track's media-element load never completes.

The behavior is **intermittent** (the app's element occasionally does load the next track in
the background) precisely because it depends on a background media-load Chromium may or may
not suspend. That is the unreliability users experience.

## Spike results (device-verified)

- **Q1 — prefetch to blob while locked:** `fetch()` of the full next track (≈5 MB) completed
  in **~400–550 ms** while the screen was locked and the tab was alive (audio playing). The
  resulting `blob:` URL loaded into an `<audio>` element to `readyState 4` (`canplaythrough`).
- **Q2 — blob playback at the boundary while locked:** the playing element's `ended` event
  **fired while locked**; a handler called `play()` on a blob-fed element; the promise
  **resolved** and the element advanced (position 0 → 67 s) with no error, screen still locked.

Conclusion: `fetch()` works in the background, and a **blob source needs no network at the
boundary**, so the existing `ended`-triggered transition succeeds. **No track overlap and no
Web Audio are required.**

## Design

Stop relying on the media element's background network `.load()`. Instead, while the current
track is playing (tab alive), download the **next** track into an in-memory `blob:` URL and
hand that blob to the idle element at the boundary.

Builds **on** the existing dual-element machinery (`audioRef`/`audioRefB`, `getActiveAudioEl`/
`getIdleAudioEl`, `attemptPingPongPlayback`). Nothing is reverted. **Android-gated**
(`isAndroidRef.current`) so iOS/desktop paths are untouched.

### Component 1 — `prefetchNextTrackBlob()`

- **Purpose:** ensure the next track is available as an in-memory `blob:` URL before the
  current track ends.
- **When:** early in the current track's playback while the tab is alive — invoked from
  `playAlbum` / `playShuffledTrack` after the current track's `play()` succeeds (not from a
  timer, and not the 5 s window which is too late and would run under suspension).
- **What it does:**
  1. Resolve the next track (respecting shuffle order, `repeatMode`, and last-track). If none,
     do nothing.
  2. Compute its playback URL via the existing `getTrackPlaybackUrl` + `getAudioUrlsToTry`
     (first candidate; https-upgraded), matching current URL selection.
  3. `fetch()` the URL, `await res.blob()`, `URL.createObjectURL(blob)`.
  4. Store `{ trackId, blobUrl, sourceUrl }` in a ref (`nextBlobRef`).
- **Guards:** Android only; skip if no next track; skip if a blob for this next-track id is
  already prepared; abort/ignore on fetch failure (fall back to existing behavior). Wrap in
  try/catch; never throw into the caller.

### Component 2 — idle element consumes the blob

- `attemptPingPongPlayback(track, ...)` (and the seamless fallback it falls through to): if
  `nextBlobRef` holds a blob whose `trackId` matches the track being started, set the idle
  element's `src` to the **`blob:` URL** instead of the network URL, then `play()`.
- If no matching blob is present, behavior is exactly today's (network URL). This keeps a safe
  fallback and preserves iOS/desktop.

### Component 3 — blob lifecycle

- On successful advance, `URL.revokeObjectURL()` the blob that was just consumed (and any stale
  blob whose id no longer matches the upcoming track).
- On `stop()` / album change / track change to something other than the prepared next track,
  revoke and clear `nextBlobRef`.
- Invariant: at most ~1–2 live blob URLs at a time.

## Data flow

```
current track play() succeeds (tab alive)
  -> prefetchNextTrackBlob(): fetch(nextUrl) -> Blob -> blob:URL -> nextBlobRef{trackId,blobUrl}
... current track plays to end (screen may lock; tab stays alive on active audio) ...
current element 'ended' fires (fires while locked)
  -> playNextTrack -> attemptPingPongPlayback(nextTrack)
       if nextBlobRef.trackId === nextTrack.id: idle.src = nextBlobRef.blobUrl   // no network
       idle.play()  // resolves while locked (spike-verified)
       promote idle -> active; pause outgoing; revoke consumed blob
  -> prefetchNextTrackBlob() for the following track
```

## Error handling

- Prefetch fetch fails / times out → leave `nextBlobRef` empty; boundary uses today's network
  path (no regression vs. current behavior).
- Blob present but `play()` rejects → existing fall-through (seamless → full playback) runs.
- Track skipped manually (user Next/seek) before the boundary → prepared blob may not match;
  matching is by `trackId`, so a mismatch simply falls back to network and a fresh prefetch
  starts for the new "next".

## Testing / verification (device-only)

Locked-screen autoplay/suspension does **not** reproduce on desktop or emulator. Verify on a
physical Android phone via the established adb + CDP harness:

1. `adb forward tcp:9222 localabstract:chrome_devtools_remote`; connect to the page target.
2. Play an album, lock the screen, let ≥3 track boundaries pass untouched.
3. Success = audio continues across every boundary with the screen locked; CDP snapshot shows
   the newly active element sourced from a `blob:` URL with `readyState 4` and no `error`;
   no `MEDIA_ERR_SRC_NOT_SUPPORTED`.
4. Confirm blob count stays bounded (no `URL.createObjectURL` leak) across many boundaries.
5. Regression: iOS/desktop unaffected (blob path is Android-gated).

## Out of scope

- iOS/desktop transition logic (unchanged).
- Video/HLS transitions (blob prefetch is audio-only; `attemptPingPongPlayback` already returns
  false for video and falls through).
- Reverting the ping-pong dual-element machinery (kept; it is the substrate for feeding the blob).
- Whole-playlist prefetch or caching layer (only the immediate next track is prefetched).
