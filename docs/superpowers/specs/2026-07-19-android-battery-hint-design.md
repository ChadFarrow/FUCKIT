# Android Battery-Optimization Hint — Design Spec

**Date:** 2026-07-19
**Status:** Approved (design), pending implementation plan

## Problem

On aggressive Android builds (notably **GrapheneOS**, and phones with OEM battery managers like Samsung/Xiaomi), the OS freezes a backgrounded browser tab after a short grace period (~5s). For the StableKraft PWA this kills locked-screen audio a few seconds into any track that started while backgrounded — the exact symptom the user hit on GrapheneOS + Brave.

**Root cause (confirmed 2026-07-19):** it is **not** a code bug and **not** an immovable OS wall. It is per-app battery optimization. Setting the browser app to **Unrestricted** battery lifts it — verified by a full album playing straight through with the screen locked. See memory `project_android_background_audio_limits.md`.

Because the fix is a **device setting the app cannot set on the user's behalf**, affected users have no way to discover it. This feature surfaces the fix as a one-time in-app hint.

## Goal

Show affected Android users, exactly once, how to set their browser to Unrestricted battery so locked-screen playback survives. Do not nag users who aren't affected any more than necessary, and never show it in contexts where it doesn't apply (iOS, desktop, the native Capacitor app).

## Non-Goals (YAGNI)

- No settings/help re-access entry (chosen trigger is proactive-only; can be added later if dismissers regret it).
- No "remind me later" option.
- No deep-link into Android's per-app settings screen (not reliably possible from a web context across Android versions/browsers).
- No attempt to detect GrapheneOS specifically or read the current battery-optimization state (not exposed to web content).

## Behavior

### Trigger & gating

Show the modal **once**, on the **first successful playback start**, only when **all** of:

1. `isAndroidDevice()` is true (existing helper in `contexts/AudioContext.tsx` — `/Android/i` and not iOS).
2. **Not** the native Capacitor app: `!window.Capacitor?.isNativePlatform?.()`. The native app has its own foreground-service keep-alive and must never see this hint.
3. Not previously dismissed: `localStorage['android_battery_hint_dismissed']` is unset.

Gating is evaluated when playback actually starts (the play handler), not on every render.

**Not** gated on installed-PWA/standalone display mode: any Android *browser* user qualifies on first play (native app excluded per rule 2). A user in a normal browser tab still locks their screen to listen, so the hint applies.

### Wiring

Follows the existing event-driven `Toast` convention (`components/Toast.tsx` dispatches/consumes `window` CustomEvents):

- The "should we show it" predicate lives in `AudioContext`. On first play, if the gate passes, it dispatches a `window` CustomEvent named `android-battery-hint`. The event fires at most once per page load and only when warranted.
- A new global component `<AndroidBatteryHintModal />` is mounted once (in `app/layout.tsx`, alongside the existing global UI). It listens for `android-battery-hint`, opens, and owns its own open/close state. `AudioContext` stays JSX-free.

Extract the gate as a **pure function** so it is unit-testable without a DOM:

```ts
function shouldShowAndroidBatteryHint(input: {
  isAndroid: boolean;
  isNative: boolean;
  dismissed: boolean;
}): boolean {
  return input.isAndroid && !input.isNative && !input.dismissed;
}
```

The `AudioContext` play handler reads `isAndroidDevice()`, `window.Capacitor?.isNativePlatform?.()`, and the localStorage flag, passes them to `shouldShowAndroidBatteryHint`, and dispatches the event on `true`.

### Browser detection (in the modal, on mount)

Resolve a display name for the `{Browser}` slot, in priority order:

1. `navigator.brave?.isBrave?.()` resolves truthy → **"Brave"** (async API; await it).
2. UA contains `Firefox` → **"Firefox"**.
3. UA contains `Edg` → **"Edge"**.
4. UA contains `Chrome` (and none of the above) → **"Chrome"**.
5. Otherwise → **"your browser"**.

Expose as a pure resolver `resolveBrowserName({ ua, isBrave })` for unit testing; the async `navigator.brave` probe is done in the component and its boolean result fed into the pure resolver.

### Content

- **Title:** Keep audio playing when your screen locks
- **Body:** On some Android phones (GrapheneOS, or phones with aggressive battery saving), locked-screen playback can cut out after a few seconds. To fix it, let your browser run unrestricted in the background:
  1. Open Android **Settings → Apps → {Browser}**
  2. Tap **Battery** (or "App battery usage")
  3. Set it to **Unrestricted**
  4. Fully close and reopen this app
- **Primary action:** **Got it**

### Persistence / dismissal

"Got it", the close (X), and a backdrop click all set `localStorage['android_battery_hint_dismissed'] = '1'` and close the modal. Once set, the gate never passes again → truly one-time.

## Components / files

- **New:** `components/AndroidBatteryHintModal.tsx` — the modal UI + event listener + browser-name probe. Follows existing modal styling in the codebase.
- **New (pure helpers, unit-tested):** `lib/android-battery-hint.ts` exporting `shouldShowAndroidBatteryHint(...)` and `resolveBrowserName(...)`, so the modal and `AudioContext` share them and tests import them without React/DOM.
- **Modify:** `contexts/AudioContext.tsx` — on first successful play, evaluate the gate and dispatch `android-battery-hint`.
- **Modify:** `app/layout.tsx` — mount `<AndroidBatteryHintModal />` once, globally.

## Testing

- **Unit (pure functions):**
  - `shouldShowAndroidBatteryHint` — truth table across `isAndroid` × `isNative` × `dismissed` (only `true/false/false` shows).
  - `resolveBrowserName` — Brave, Firefox, Edge, Chrome, and unknown-UA fallback.
- **Manual (on device, consistent with the rest of the Android audio path):** first Android-browser play shows the modal once; dismiss persists across reloads; native app and desktop/iOS never show it; the named browser matches the device.

## References

- Memory: `project_android_background_audio_limits.md` (root cause + confirmation).
- Existing patterns: `components/Toast.tsx` (event-driven global UI), `contexts/AudioContext.tsx` (`isAndroidDevice`, native detection).
