# Android Native Lock-Screen Media Controls (MediaSession) — Design

**Date:** 2026-07-21
**Status:** Shipped
**Target release:** zapstore native app, versionCode 4 / versionName 1.3
**Scope:** native Capacitor Android app only. iOS, desktop, and the browser PWA are untouched.

> **Shipped.** The design below was implemented and is in production. This document is a
> historical record of the design as approved — it is not a description of current
> behaviour, which has moved on. For that, see the `android-native` skill; the MediaSession classes under `android/app/src/main/java/app/stablekraft/`.

## Context / Problem

The zapstore native app is a Capacitor WebView that loads the live `stablekraft.app`.
Chromium (the WebView) *does* create a MediaSession and post a lock-screen media
notification — but it is **bound to whichever `HTMLMediaElement` is currently
playing**. This app's Android playback uses a **ping-pong dual-element**
transition (start the next track on a second `<audio>` element, then swap) plus a
brief inter-track gap. Each swap/teardown drops the element Chromium bound the
session to, so the lock-screen player **flickers away at every track boundary and
disappears when playback stops**.

Device evidence (Pixel 6, v1.2 test build, 2026-07-21): while playing, **two**
`app.stablekraft` notifications are posted — our foreground-service keep-alive
notification (id 4271) **plus** Chromium's own media notification — and both
vanish the instant playback stops. `dumpsys media_session` "Sessions Stack" reads
`0 sessions` in the inter-track gaps.

**Goal:** a stable lock-screen player (art, title/artist/album, Prev / Play-Pause
/ Next, draggable seek bar) that persists across ping-pong track transitions and
while paused.

**Why a native MediaSession fixes it:** a MediaSession owned by our foreground
service is decoupled from which `HTMLMediaElement` is active. The service stays up
for the whole listening session, so the session/notification persist across every
element swap and inter-track gap — something we cannot achieve by fighting
Chromium's element-bound session from JS.

## Chosen Approach

**Extend the existing `PlaybackKeepAliveService` into a MediaSession host.**

Rejected alternatives:
- **Community plugin** (`@jofr/capacitor-media-session`): posts its own
  notification (collides with our FGS notification → doubles), no coordination
  with our wake lock, new dependency to vet.
- **Second dedicated MediaSession service**: two services + two notifications to
  keep in sync — needless complexity.
- **Stabilize Chromium's web session from JS**: unwinnable on Android — the
  session is element-bound and the ping-pong swap inherently tears it down.

The existing service already runs exactly when audio plays (started/stopped by the
`isPlaying` effect via `playbackKeepAlive`), which is precisely when the
MediaSession should be active. Additive, one notification, one lifecycle, reuses
the verified wake lock.

## Architecture — three layers (mirrors the existing `playbackKeepAlive` bridge)

### 1. Native — `PlaybackKeepAliveService` gains a `MediaSessionCompat`
- Create a `MediaSessionCompat` in `onCreate`; `setActive(true)` while playing.
- **Replace** the current plain `PRIORITY_LOW` / `CATEGORY_TRANSPORT` notification
  with a `androidx.media.app.NotificationCompat.MediaStyle` notification bound to
  the session token: large-icon artwork, title/artist/album, and three actions
  (Prev / Play-Pause / Next). The **seek bar renders automatically** because we
  publish `PlaybackStateCompat` with `position` + `duration` and the `ACTION_SEEK_TO`
  capability.
- A `MediaSessionCompat.Callback` receives `onPlay` / `onPause` / `onSkipToNext` /
  `onSkipToPrevious` / `onSeekTo` (covers lock-screen buttons **and** Bluetooth /
  wired headset transport keys for free) and forwards each to the plugin.
- Handle new intent actions in `onStartCommand`: existing start behavior,
  `ACTION_UPDATE_METADATA` (extras: title, artist, album, artworkUrl, durationMs),
  `ACTION_UPDATE_STATE` (extras: isPlaying, positionMs). Route media-button
  intents via `MediaButtonReceiver.handleIntent(session, intent)`.
- **Artwork**: fetch + decode to `Bitmap` on a background thread (single-thread
  executor), cache by last URL to avoid refetch, then update metadata large icon
  and re-post the notification. Never block the main thread; failures degrade to
  no-art.
- Wake-lock acquire/release lifecycle from PR #161 is **unchanged**.
- Release the session in `onDestroy` (`setActive(false)` + `release()`).
- **Build deps / manifest**: add `androidx.media:media` dependency; add a
  `MediaButtonReceiver` `<receiver>` with the `MEDIA_BUTTON` intent filter and a
  matching `<service>` intent filter so transport keys resolve.

### 2. Plugin — `PlaybackKeepAlivePlugin` gains two methods + one event
- Keep `start` / `stop`.
- Add `updateMetadata({title, artist, album, artworkUrl, duration})` and
  `setPlaybackState({isPlaying, position})` — each fires an intent (action +
  extras) at the running service.
- Emit `mediaSessionAction` to JS via `notifyListeners`, payload
  `{action: 'play'|'pause'|'next'|'previous'|'seekto', seekTo?: number}`.
  Service→plugin hop uses a static weak reference to the plugin instance set in
  `load()` and cleared in `handleOnDestroy()`.

### 3. Web — `contexts/AudioContext.tsx`, additive + native-Android-gated
- Two new bridge helpers beside `playbackKeepAlive`, both try/catch no-ops off
  native-Android: `nativeMediaUpdateMetadata(...)` and `nativeMediaSetState(...)`.
- Push metadata from inside the existing `updateMediaSession(album, track)` — it
  already computes title/artist/album and an absolute artwork URL (~line 2827).
- Push play-state from the existing `isPlaying` sync effect (~line 1178) and from
  position updates.
- On mount (native-Android only), subscribe to `mediaSessionAction` and route to
  the existing refs: `resumeRef` / `pauseRef` / `playNextTrackRef` /
  `playPreviousTrackRef`, and seek via `getActiveAudioEl().currentTime`.
- **Suppress the double notification**: on **native Android only**, skip
  registering `navigator.mediaSession` metadata/handlers so Chromium does not post
  its competing notification. **iOS and the browser PWA keep the full existing
  `navigator.mediaSession` path unchanged.**

## Data flow

Track change → `updateMediaSession` → (web `navigator.mediaSession` for iOS/PWA)
**or** (native plugin → service updates MediaSession + MediaStyle notification, on
Android). Lock-screen / Bluetooth button → service `Callback` → plugin
`mediaSessionAction` event → AudioContext ref → the same play/pause/skip/seek
functions the app already uses.

## Error handling

- Every native path is try/catch-wrapped; failure degrades to the current
  keep-alive-only behavior (never crash the service or reject into the audio
  pipeline), consistent with existing code.
- Artwork load failure → notification without art, not a crash.
- Web bridge helpers swallow all errors and no-op off native-Android.

## Testing / verification

1. **Local device test before deploy** (the WebView loads live `stablekraft.app`,
   so the web bridge must be reachable): run `npm run dev`, `adb reverse
   tcp:3000 tcp:3000`, temporarily point `capacitor.config.ts` `server.url` at
   `http://localhost:3000`, `android:sync`, build + install, test, then **revert
   the config**.
2. **Persistence across transitions** (the core bug): play an album, lock the
   screen, confirm the lock-screen player **stays put across ≥3 automatic track
   boundaries** and while paused — no flicker/disappear.
3. **Controls**: Prev / Play-Pause / Next and drag-seek each drive playback
   correctly; Bluetooth transport keys work.
4. **No double notification** (top risk — verify explicitly): exactly **one**
   `app.stablekraft` media notification while playing —
   `adb shell dumpsys notification --noredact | grep -c "pkg=app.stablekraft"`
   should show one media notification (plus none from Chromium).
5. **Regression**: wake-lock locked-screen survival from PR #161 still holds;
   iOS/PWA lock-screen controls unchanged.

## Risks / open items

- **Residual Chromium notification**: suppressing the web `navigator.mediaSession`
  *should* stop Chromium posting its own, but Chromium can sometimes show a bare
  "site is playing media" notification with no page metadata. **Verify on device
  (test #4).** If one persists: investigate WebView media flags, or accept the
  native session as primary. Resolve during implementation, not design.
- **Version bump**: PR #161 set versionCode 3 / 1.2 but has not shipped; this work
  rolls into **versionCode 4 / versionName 1.3** for a single combined release.
- **Native code reaches users only via a new APK** — the web-layer bridge no-ops
  until the plugin exists in an installed build (same property as the existing
  keep-alive bridge).
