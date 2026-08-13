---
name: android-native
description: "Use when working on the native Android / zapstore app (android/app/src/main/java/app/stablekraft/): audio dying seconds after the screen locks, battery optimization, the foreground service and partial wake lock, the lock-screen MediaSession and Bluetooth transport keys, the hardware back button quitting the app, @capacitor/app, building or publishing an APK, versionCode, the keystore, or anything that needs a new APK rather than a web deploy."
---

# android-native

The Capacitor/zapstore Android app. Native code does NOT reach users via a web deploy — it needs a new APK.

## Tests for this subsystem

```
npx tsx --test lib/android-battery-hint.test.ts

# Android / zapstore build (requires JDK 21 + ~/.stablekraft-android.env)
npm run android:sync                                                                  # Copy web assets into android/
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release
zsp publish --skip-certificate-linking                                                # Publish to zapstore
```

---

## Android Locked-Screen Battery Hint (`components/AndroidBatteryHintModal.tsx`)
**Root cause of "audio dies ~5s after the screen locks" on GrapheneOS / aggressive OEM battery managers is NOT a code bug** — it's per-app battery optimization freezing the backgrounded browser tab. The fix is a **device setting** (set the browser to *Unrestricted* battery), which the app can't set for the user. So we surface it as a one-time hint. Do **not** re-attempt JS/PWA workarounds for this symptom (blob prefetch, gapless overlap, etc. were all chasing this freeze) — a PWA has no API to hold a foreground service or wake lock; the OS freeze is unbeatable from web code.

- **One-time modal**, shown on **first playback** only, gated `isAndroidDevice() && !window.Capacitor?.isNativePlatform?.() && !localStorage['android_battery_hint_dismissed']` (Android **browser** only — never iOS, desktop, or the native Capacitor app, which has its own foreground-service keep-alive). Fires at most once per session (a `useRef` guard) and once-ever (localStorage).
- **Pure, unit-tested helpers** in `lib/android-battery-hint.ts`: `shouldShowAndroidBatteryHint({ isAndroid, isNative, dismissed })` and `resolveBrowserName({ ua, isBrave })` (Brave→Firefox→Edge→Chrome→"your browser"; **Edge before Chrome** — Edge's UA contains both). Tests run via `npx tsx --test lib/android-battery-hint.test.ts` (repo has **no jest/vitest**; `node:test` + `tsx` is the pattern).
- **Event-driven wiring** (mirrors the Toast pattern): a guarded `useEffect` in `contexts/AudioContext.tsx` dispatches `window` CustomEvent `android-battery-hint` on first qualifying play (whole body in try/catch — must never throw into the audio pipeline); the modal, mounted once in `app/layout.tsx` after `<ToastContainer />`, listens and opens. The dispatch effect must sit **after** `isAndroidDevice`'s `useCallback` declaration (~line 971) or its dep array TDZ-crashes at render.
- **Shared key**: the localStorage key lives once as `ANDROID_BATTERY_HINT_DISMISSED_KEY` in `lib/android-battery-hint.ts` — imported by both the modal (write) and AudioContext (read). Keep it single-sourced; a drift silently breaks dismissal.

---

## Android Foreground-Service Keep-Alive — native, zapstore APK only (`android/app/src/main/java/app/stablekraft/`)
The **native** counterpart to the battery hint above: the zapstore app is a Capacitor WebView, and without a foreground service GrapheneOS/aggressive Android suspends the backgrounded WebView process within seconds of locking → audio dies. This pins the process **and holds a partial wake lock**. Shipped in zapstore **v1.1 (`versionCode 2`)** with the FGS; the wake lock landed in **v1.3 (`versionCode 4`)** — it was developed as the standalone #161 build (tagged v1.2 / `versionCode 3`) which **never shipped on its own**; it was folded into v1.3 together with the lock-screen MediaSession below (so `versionCode 3` was skipped in the store). v1.0.0 had no service and died when locked.

- **Wake lock is not optional (v1.3 fix, from the unreleased #161/v1.2 build):** a foreground service only stops the process from being *killed* — it does **not** stop the CPU from entering deep sleep during Doze, which freezes the WebView's audio decode AND the JS timers that drive the ping-pong track transitions. v1.1 shipped FGS-only and still died on GrapheneOS with the screen locked. `PlaybackKeepAliveService` acquires a `PARTIAL_WAKE_LOCK` (tag `StableKraft::PlaybackKeepAlive`, `setReferenceCounted(false)`) and ties it to **play state**: `onStartCommand`'s plain-start branch acquires it, the `ACTION_UPDATE_STATE` branch acquires on `isPlaying`/releases on pause, and `onDestroy` releases (all wrapped in try/catch — wake-lock failure degrades to FGS-only, never crashes the service). Screen/keyboard still turn off; only the CPU stays awake. The `WAKE_LOCK` permission was declared in the manifest since v1.1 but unused until v1.3. Do **not** add a timeout to the lock — playback is long-lived; it's released deterministically on pause and on teardown. Note the FGS + MediaSession notification themselves **persist through pause** (see the lock-screen MediaSession note below) — only the wake lock drops on pause.
- **Native:** `PlaybackKeepAliveService.java` (foreground `Service`, type `mediaPlayback`, ongoing low-priority "StableKraft — Playing" notification, `START_NOT_STICKY`, **+ partial wake lock**) + `PlaybackKeepAlivePlugin.java` (`@CapacitorPlugin(name="PlaybackKeepAlive")`, methods `start`/`stop`) registered in `MainActivity.onCreate`; manifest gains `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_MEDIA_PLAYBACK`/`WAKE_LOCK`/`POST_NOTIFICATIONS` + the `<service>` decl.
- **Web bridge:** `playbackKeepAlive('start'|'stop')` in `contexts/AudioContext.tsx`, gated **native-Android-only** (`Capacitor.isNativePlatform() && getPlatform()==='android'`, try/catch swallow) + a `useEffect([isPlaying])`. Complete no-op on iOS/desktop/**browser PWA** (the PWA can't hold a FGS — that's why the battery hint exists there). The bridge is **live in the deployed web** but no-ops until the plugin exists in an installed APK — so shipping the fix required a new APK (native code doesn't reach users via the web deploy; everything else does).
- **Verify on device:** `adb shell dumpsys activity services app.stablekraft` → `PlaybackKeepAliveService … isForeground=true … types=0x00000002 (mediaPlayback)`. Confirm the wake lock with `adb shell dumpsys power | grep -i StableKraft` while playing → a `PARTIAL_WAKE_LOCK 'StableKraft::PlaybackKeepAlive'` entry that disappears on pause/stop. `POST_NOTIFICATIONS` isn't runtime-requested → grant via `adb shell pm grant … android.permission.POST_NOTIFICATIONS` for the notification to show (FGS holds the process regardless). Full context in `project_android_background_audio_limits.md`.

**Native lock-screen MediaSession (v1.3 fix):** `PlaybackKeepAliveService` now also owns a `MediaSessionCompat` — art, title/artist/album, and Prev/Play-Pause/Next + seek bar on the lock screen, with Bluetooth transport keys wired through. It replaces Chromium's own WebView media session, which is bound to the active `HTMLMediaElement` and flickered away on every Android ping-pong track transition (the whole point of the ping-pong dual-element trick is a *new* element per track); the native session is decoupled from the audio element so it persists across transitions and while paused. On pause the FGS + notification stay up (Play button remains available) — only the wake lock releases. Plugin methods `updateMetadata`/`setPlaybackState` plus a `mediaSessionAction` event bridge route lock-screen/Bluetooth button presses back to the app's play/pause/skip functions in `AudioContext.tsx`. **Native-Android-only**: `navigator.mediaSession` in `AudioContext.tsx` is suppressed behind `isNativeAndroid()` guards to avoid a duplicate notification; iOS/desktop/browser-PWA keep the existing web MediaSession untouched. Ships in **v1.3 (`versionCode 4`)** — same native-code-needs-a-new-APK caveat as the FGS/wake-lock above.

---

## Android Hardware Back Button — native, zapstore APK only (`components/AndroidBackButton.tsx`, v1.4)
**Capacitor 8's `BridgeActivity` has NO back handling of any kind** — no `onBackPressed`, no `OnBackPressedDispatcher` callback (grep `capacitor-android`'s Java for "Back": nothing). So back fell through to the default Activity behaviour and **quit the app from any screen** (issue #167). Installing **`@capacitor/app`** is what supplies it: `AppPlugin.load()` registers an `OnBackPressedCallback`, and once a JS `backButton` listener exists it hands the decision to JS instead of blindly calling `webView.goBack()`.

- **Priority chain** in `AndroidBackButton` (mounted once in `app/layout.tsx` beside the other global singletons, renders null): sidebar open → close it; fullscreen `NowPlayingScreen` → close it; `canGoBack` → `router.back()`; at the root → `minimizeApp()` **while audio is playing**, else `exitApp()`.
- **Use the native `canGoBack` payload, never `window.history.length`.** `history.length` counts *total* entries and never shrinks, so after stepping back to the first page it still reads `> 1` and the handler would keep trying to navigate past the start of the stack.
- **Never `exitApp()` while playing.** It calls `finish()`, tearing down the WebView and killing playback — that would undo the whole v1.1/v1.3 foreground-service + wake-lock effort. `minimizeApp()` backgrounds the app like the Home button and keeps music going.
- **`@capacitor/app` is a native-only dependency** — no web code imports it (the bridge is reached via `window.Capacitor.Plugins.App`, same idiom as `playbackKeepAlive`), so the browser bundle is unchanged. It must stay in `dependencies` (not `devDependencies`) or `npx cap sync` won't pick it up.
- **Deploy ordering matters**: ship the web change *first*. An older installed APK has no `App` plugin → the guarded bridge call no-ops → back behaves exactly as before (no regression). The reverse order leaves back swallowed at the root until the web catches up.
- Ships in **v1.4 (`versionCode 5`)** — same native-code-needs-a-new-APK caveat as the FGS/wake-lock/MediaSession above.

---

## Android Distribution (zapstore)
See `project_zapstore_distribution.md` memory for appId, keystore path, cert fingerprint, JDK 21 requirement, `zsp` CLI binary source, per-release flow, and gotchas (Bubblewrap/TWA banned, `--skip-certificate-linking` always, etc.).

## Key Behaviors
