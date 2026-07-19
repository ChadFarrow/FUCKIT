# Android foreground-service keep-alive — design

**Date:** 2026-07-19
**Area:** `android/` (native Capacitor 8 app) + a thin guarded hook in `contexts/AudioContext.tsx`
**Follows from:** [[project_android_background_audio_limits]] — the deployed blob-prefetch + gapless-overlap web fixes cannot beat GrapheneOS's background-media output suspension from the web layer. This spec addresses only the **native zapstore app**.

## Problem

On the user's Pixel running **GrapheneOS**, the native zapstore app (a Capacitor 8 WebView loading the live site via `server.url`) loses audio **within a few seconds of the first track** when the screen is locked — *worse* than the browser PWA, which at least plays track 1 fully. The app has **no foreground service** and only the `INTERNET` permission, so GrapheneOS suspends the backgrounded app process. That process suspension — not the deeper Chromium browser-tab output-mute policy — is the native app's failure mode, and it is the one thing we fully control.

## Goal

Give the native app a **minimal foreground media service** so GrapheneOS keeps the app process alive while audio plays, letting the WebView's existing audio pipeline (blob prefetch, gapless overlap, VTS, chapters, per-segment auto-boost, HLS, seek, MediaSession) keep running with the screen locked. Test-first and minimal: prove the foreground service defeats the suspension before investing in lock-screen controls.

## Non-goals (v1, explicit)

- Lock-screen media controls / MediaStyle notification with play/pause/next/prev.
- Native ExoPlayer playback or any migration of audio off the WebView `<audio>` element.
- Any iOS, desktop, or browser-PWA change. All web behavior on non-native platforms is byte-for-byte unchanged.
- Bridging MediaSession metadata (title/artist/artwork) into the native notification.

## Architecture

Three native pieces plus one guarded web hook. The web layer already knows exactly when audio starts and stops; it tells native, and native holds a foreground service for the duration.

```
web audio play() ──► window.Capacitor.Plugins.PlaybackKeepAlive.start()
                        └─► PlaybackKeepAlivePlugin.start()  (native)
                              └─► startForegroundService(PlaybackKeepAliveService)
                                    └─► startForeground(notification, mediaPlayback)
                                          └─► OS keeps process at FGS importance
                                                └─► WebView audio survives screen lock

web audio pause/stop/end-of-queue ──► PlaybackKeepAlive.stop()
                        └─► PlaybackKeepAlivePlugin.stop()  (native)
                              └─► stopForeground(REMOVE) + stopSelf()
                                    └─► notification clears
```

### Component 1 — `PlaybackKeepAliveService` (Android `Service`)

- **File:** `android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java`
- **Purpose:** hold the app at foreground-service importance while audio plays.
- **Behavior:**
  - `onStartCommand`: create a notification channel (once, low importance, no sound/vibration), build an **ongoing, non-dismissable** notification ("StableKraft" / "Playing"), and call `startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)` (the typed overload on API 29+; plain `startForeground` below that). Return `START_STICKY`? **No — `START_NOT_STICKY`**: if the OS kills it we do not want a zombie relaunch without audio; the web layer re-issues `start()` on the next `play()`.
  - `onDestroy` / stop path: `stopForeground(STOP_FOREGROUND_REMOVE)`.
  - Not bound (`onBind` returns `null`); started/stopped via `startService`/`stopService`.
- **Constants:** a single notification channel id (e.g. `stablekraft_playback`) and a fixed notification id.

### Component 2 — `PlaybackKeepAlivePlugin` (Capacitor plugin)

- **File:** `android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java`
- **Purpose:** the JS↔native bridge. Exposes exactly two methods; each resolves its `PluginCall`.
  - `@PluginMethod start(PluginCall call)` → `ContextCompat.startForegroundService(context, intent)` for `PlaybackKeepAliveService`; `call.resolve()`.
  - `@PluginMethod stop(PluginCall call)` → `context.stopService(intent)`; `call.resolve()`.
- **Annotation:** `@CapacitorPlugin(name = "PlaybackKeepAlive")` → exposed to JS as `window.Capacitor.Plugins.PlaybackKeepAlive`.
- **Idempotency:** `start` while already running is a no-op at the OS level (re-delivers `onStartCommand`); `stop` while not running is harmless. No internal running-state flag needed.

### Component 3 — Registration + manifest

- **`MainActivity.java`:** register the plugin. Capacitor 8 auto-discovers annotated plugins in the app package, but register explicitly in `onCreate` via `registerPlugin(PlaybackKeepAlivePlugin.class)` before `super.onCreate(...)` to be safe and readable.
- **`AndroidManifest.xml`:** add permissions
  - `android.permission.FOREGROUND_SERVICE`
  - `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  - `android.permission.WAKE_LOCK`
  - `android.permission.POST_NOTIFICATIONS` (Android 13+; notification may be silently suppressed if the user denies it, but the FGS still holds the process)
  - and the `<service android:name=".PlaybackKeepAliveService" android:exported="false" android:foregroundServiceType="mediaPlayback" />` declaration inside `<application>`.

### Component 4 — Web hook (`contexts/AudioContext.tsx`)

- **Purpose:** call `start()`/`stop()` at the right moments, **only** in the native Android app.
- **Guard helper** (module-scope or a small ref-free function):
  ```ts
  function playbackKeepAlive(action: 'start' | 'stop') {
    try {
      const cap = (window as any)?.Capacitor;
      if (!cap?.isNativePlatform?.()) return;              // browser PWA / iOS / desktop → no-op
      if (cap.getPlatform?.() !== 'android') return;        // Android native only
      cap.Plugins?.PlaybackKeepAlive?.[action]?.();
    } catch { /* never throw into the audio pipeline */ }
  }
  ```
- **Call sites (additive, never replace existing logic):**
  - **start** when playback actually begins — the same place the code confirms a successful `play()` (e.g. `handlePlay`, and/or right after the active element's `play()` promise resolves in `playAlbum`/`playShuffledTrack`). Calling `start` again mid-session is safe (idempotent).
  - **stop** on real pause (`handlePause` from an explicit user pause, not a transition), on `stop()`, and at end-of-queue (last track ended, nothing to advance to). Do **not** stop during a track-to-track transition — playback continues, so the service should stay up.
- **No changes to any non-native path.** On iOS/desktop/PWA the helper returns before touching anything. No new refs feed state, no listeners rebind.

## Why this targets the actual failure

The native app dies in **seconds** (process suspension), not the browser's ~5s output-grace-then-mute. A foreground media service is the standard, OS-sanctioned signal for "I am actively playing media — keep me alive," and it is precisely what the current app lacks. High-confidence match to the observed failure. If a device test still shows output-mute *after* the process is confirmed alive, that is new evidence that escalates to the native-ExoPlayer approach (out of scope here) — but we do not pre-build for it.

## Error handling

- Plugin methods wrap their body defensively and always `call.resolve()` (never leave a JS promise hanging); a native failure to start the service must not reject into the web audio pipeline.
- The web helper swallows all errors (`try/catch`) — a missing plugin, older native shell, or any bridge hiccup degrades to today's behavior (no FGS), never a playback break.
- `POST_NOTIFICATIONS` denied → notification hidden by the OS, but `startForeground` still succeeds and holds the process; acceptable for v1.

## Testing / verification (device-only — this is the acceptance gate)

The suspension does not reproduce on desktop or emulator. Verify on the physical Pixel/GrapheneOS:

1. Build via the JDK 21 flow: `npm run android:sync` then `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release`.
2. Install the built APK on the device (adb install, or publish to zapstore per the normal flow).
3. Confirm the "StableKraft — Playing" notification appears when playback starts and clears on stop.
4. Play an album, **lock the screen**, let ≥3 track boundaries pass untouched. Success = audio continues across every boundary with the screen locked (the failure being fixed is "died within seconds of track 1").
5. Optional adb evidence: `adb shell dumpsys activity services app.stablekraft` shows the foreground service running while locked; process importance stays FOREGROUND_SERVICE.
6. Regression: install/run the **browser PWA** and iOS build — behavior unchanged (the web hook no-ops off-native).

## Out of scope (recap)

- Lock-screen controls / MediaStyle notification (fast follow-up if v1 works).
- Native ExoPlayer / MediaSessionService playback (escalation only if v1 fails on device).
- iOS, desktop, browser-PWA behavior (untouched by design).
- Bridging track metadata into the native notification.

## Build / release notes

- Keystore at `~/keystores/stablekraft-release.jks`, creds in `~/.stablekraft-android.env` — never commit either.
- `zsp publish --skip-certificate-linking` for zapstore (see [[project_zapstore_distribution.md]]).
- The native shell version bumps, but the WebView still loads the live `server.url` site, so the deployed web fixes remain in effect regardless.
