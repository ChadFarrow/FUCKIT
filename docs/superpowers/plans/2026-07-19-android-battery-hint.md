# Android Battery-Optimization Hint Implementation Plan

> **Shipped — do not execute this plan.** The work described below is implemented and in
> production. This document is a historical record of the plan as written on 2026-07-19; the
> unchecked `- [ ]` boxes reflect its state at authoring, not work outstanding. Nobody ticked
> them as they went, so they were left as written rather than filled in retroactively.
>
> Current behaviour: the `android-native` skill; `lib/android-battery-hint.ts`.

**Goal:** Show Android browser users, exactly once on first playback, a modal explaining how to set their browser to Unrestricted battery so locked-screen audio survives.

**Architecture:** Two pure, unit-tested helpers (`lib/android-battery-hint.ts`) decide *whether* to show and *which browser name* to display. `contexts/AudioContext.tsx` evaluates the gate on first play and dispatches a `window` CustomEvent (matching the existing event-driven Toast pattern). A new global `components/AndroidBatteryHintModal.tsx`, mounted once in `app/layout.tsx`, listens for that event, resolves the browser name, renders the modal, and persists dismissal to `localStorage`.

**Tech Stack:** TypeScript, React 18, Next.js 15 App Router, Tailwind CSS, lucide-react icons. Tests: `node:test` run via `npx tsx --test`.

## Global Constraints

- **Trigger:** first successful playback start only; evaluated in the play path, not per-render.
- **Gate (all must hold):** `isAndroidDevice()` true; `!window.Capacitor?.isNativePlatform?.()` (never show in the native Capacitor app); `localStorage['android_battery_hint_dismissed']` unset.
- **Not** gated on installed-PWA/standalone — any Android browser user qualifies (native app excluded).
- **localStorage key:** exactly `android_battery_hint_dismissed`, value `'1'` when dismissed.
- **CustomEvent name:** exactly `android-battery-hint` (no payload).
- **Browser-name priority:** Brave (`navigator.brave.isBrave()`) → Firefox (UA `Firefox`) → Edge (UA `Edg`) → Chrome (UA `Chrome`) → `your browser`. Edge MUST be checked before Chrome (Edge UA contains both).
- **Never throw into the audio pipeline** — all new code in `AudioContext.tsx` is wrapped in try/catch that swallows.
- **Modal copy (verbatim):**
  - Title: `Keep audio playing when your screen locks`
  - Body: `On some Android phones (GrapheneOS, or phones with aggressive battery saving), locked-screen playback can cut out after a few seconds. To fix it, let your browser run unrestricted in the background:`
  - Steps: `1. Open Android **Settings → Apps → {Browser}**` / `2. Tap **Battery** (or "App battery usage")` / `3. Set it to **Unrestricted**` / `4. Fully close and reopen this app`
  - Button: `Got it`
- **Styling:** mirror `components/GlobalBoostModal.tsx` — overlay `fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4`, card `bg-gray-900 rounded-xl max-w-md w-full p-6 relative`, close button lucide `X` with `aria-label="Close"`.
- **Verification gate:** `npm run build` must pass before any commit that touches `.ts`/`.tsx` (repo boundary).

---

### Task 1: Pure helpers + unit tests

**Files:**
- Create: `lib/android-battery-hint.ts`
- Test: `lib/android-battery-hint.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2 & 3):
  - `shouldShowAndroidBatteryHint(input: { isAndroid: boolean; isNative: boolean; dismissed: boolean }): boolean`
  - `resolveBrowserName(input: { ua: string; isBrave: boolean }): string`
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `lib/android-battery-hint.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowAndroidBatteryHint, resolveBrowserName } from './android-battery-hint';

test('shouldShowAndroidBatteryHint: only android + non-native + not-dismissed shows', () => {
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: true, isNative: false, dismissed: false }), true);
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: false, isNative: false, dismissed: false }), false);
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: true, isNative: true, dismissed: false }), false);
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: true, isNative: false, dismissed: true }), false);
});

test('resolveBrowserName: brave > firefox > edge > chrome > generic', () => {
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Chrome/120', isBrave: true }), 'Brave');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Firefox/121', isBrave: false }), 'Firefox');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Chrome/120 Edg/120', isBrave: false }), 'Edge');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Chrome/120', isBrave: false }), 'Chrome');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Weird/1', isBrave: false }), 'your browser');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/android-battery-hint.test.ts`
Expected: FAIL — cannot find module `./android-battery-hint` (file does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/android-battery-hint.ts`:

```ts
/**
 * Pure decision helpers for the one-time Android battery-optimization hint.
 * No DOM / React dependencies so they are unit-testable in node:test.
 */

/**
 * Whether the first-play battery hint should be shown.
 * Shows only on an Android browser (not the native Capacitor app) that has
 * not already dismissed it.
 */
export function shouldShowAndroidBatteryHint(input: {
  isAndroid: boolean;
  isNative: boolean;
  dismissed: boolean;
}): boolean {
  return input.isAndroid && !input.isNative && !input.dismissed;
}

/**
 * Human-readable browser name for the hint steps. Edge must be checked
 * before Chrome because Edge's UA string contains both "Chrome" and "Edg".
 * `isBrave` is the awaited result of navigator.brave?.isBrave() (Brave hides
 * itself in the UA string, so it needs the dedicated API).
 */
export function resolveBrowserName(input: { ua: string; isBrave: boolean }): string {
  if (input.isBrave) return 'Brave';
  if (/Firefox/i.test(input.ua)) return 'Firefox';
  if (/Edg/i.test(input.ua)) return 'Edge';
  if (/Chrome/i.test(input.ua)) return 'Chrome';
  return 'your browser';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/android-battery-hint.test.ts`
Expected: PASS — `# pass 2`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/android-battery-hint.ts lib/android-battery-hint.test.ts
git commit -m "feat(android): pure helpers for battery-optimization hint gating"
```

---

### Task 2: The modal component

**Files:**
- Create: `components/AndroidBatteryHintModal.tsx`

**Interfaces:**
- Consumes (from Task 1): `resolveBrowserName({ ua, isBrave })`.
- Consumes (runtime, from Task 3): `window` CustomEvent `android-battery-hint`.
- Produces (consumed by Task 3): default-exported React component `AndroidBatteryHintModal`.

**Note:** No unit test — this is a React component whose behavior (event listener, async Brave probe, DOM render) is verified by `npm run build` (type-check) here and manually on-device in Task 3. The testable logic lives in Task 1's pure helpers.

- [ ] **Step 1: Write the component**

Create `components/AndroidBatteryHintModal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { resolveBrowserName } from '@/lib/android-battery-hint';

const DISMISSED_KEY = 'android_battery_hint_dismissed';

/**
 * One-time modal shown to Android browser users on first playback, explaining
 * how to set their browser to Unrestricted battery so locked-screen audio
 * survives GrapheneOS / aggressive battery managers. Opened by the
 * `android-battery-hint` CustomEvent dispatched from AudioContext (which owns
 * the gating decision). Dismissal persists in localStorage.
 */
export default function AndroidBatteryHintModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [browserName, setBrowserName] = useState('your browser');

  // Open on the gated event from AudioContext.
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('android-battery-hint', handleOpen as EventListener);
    return () => window.removeEventListener('android-battery-hint', handleOpen as EventListener);
  }, []);

  // Resolve the browser display name (Brave needs the async navigator.brave API).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let isBrave = false;
      try {
        const nav = navigator as any;
        if (nav.brave?.isBrave) isBrave = await nav.brave.isBrave();
      } catch {
        // ignore — fall through to UA-based detection
      }
      if (!cancelled) {
        setBrowserName(resolveBrowserName({ ua: navigator.userAgent, isBrave }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore — private mode etc.; worst case it shows again next session
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={dismiss}
    >
      <div
        className="bg-gray-900 rounded-xl max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-4">
          Keep audio playing when your screen locks
        </h2>

        <p className="text-gray-300 text-sm mb-4">
          On some Android phones (GrapheneOS, or phones with aggressive battery
          saving), locked-screen playback can cut out after a few seconds. To fix
          it, let your browser run unrestricted in the background:
        </p>

        <ol className="text-gray-200 text-sm space-y-2 mb-6 list-decimal list-inside">
          <li>Open Android <strong>Settings → Apps → {browserName}</strong></li>
          <li>Tap <strong>Battery</strong> (or &ldquo;App battery usage&rdquo;)</li>
          <li>Set it to <strong>Unrestricted</strong></li>
          <li>Fully close and reopen this app</li>
        </ol>

        <button
          onClick={dismiss}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build completes with no TypeScript errors. (The import of `resolveBrowserName` resolves against Task 1; the component is not yet mounted anywhere — that is Task 3.)

- [ ] **Step 3: Commit**

```bash
git add components/AndroidBatteryHintModal.tsx
git commit -m "feat(android): battery-optimization hint modal component"
```

---

### Task 3: Wire the dispatch (AudioContext) + mount (layout)

**Files:**
- Modify: `contexts/AudioContext.tsx` (add a first-play gate effect immediately after the existing keep-alive `useEffect` on `isPlaying`, ~line 237)
- Modify: `app/layout.tsx` (import + mount the modal next to `<ToastContainer />`, ~line 285)

**Interfaces:**
- Consumes (from Task 1): `shouldShowAndroidBatteryHint({ isAndroid, isNative, dismissed })`.
- Consumes (from Task 2): default export `AndroidBatteryHintModal`.
- Consumes (existing): `isAndroidDevice()` callback and `isPlaying` state, both already in `AudioProvider`.
- Produces: dispatches `window` CustomEvent `android-battery-hint` on first qualifying play.

- [ ] **Step 1: Import the gate helper in AudioContext**

At the top of `contexts/AudioContext.tsx`, add to the existing imports (place near other `@/lib` imports):

```ts
import { shouldShowAndroidBatteryHint } from '@/lib/android-battery-hint';
```

- [ ] **Step 2: Add the first-play dispatch effect**

In `contexts/AudioContext.tsx`, immediately AFTER this existing effect (~line 237):

```ts
  useEffect(() => {
    playbackKeepAlive(isPlaying ? 'start' : 'stop');
  }, [isPlaying]);
```

add a `useRef` (place beside the other refs, or directly above this new effect) and the new effect:

```ts
  // One-time Android battery-optimization hint: on the first time playback
  // starts, if this is an Android browser (not the native app) that hasn't
  // dismissed the hint, dispatch the event that opens AndroidBatteryHintModal.
  // Fires at most once per session; localStorage makes it once-ever. Never
  // throws into the audio pipeline.
  const androidHintDispatchedRef = useRef(false);
  useEffect(() => {
    if (!isPlaying || androidHintDispatchedRef.current) return;
    androidHintDispatchedRef.current = true;
    try {
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      const dismissed = localStorage.getItem('android_battery_hint_dismissed') === '1';
      if (shouldShowAndroidBatteryHint({ isAndroid: isAndroidDevice(), isNative, dismissed })) {
        window.dispatchEvent(new CustomEvent('android-battery-hint'));
      }
    } catch {
      // swallow — must never break playback
    }
  }, [isPlaying, isAndroidDevice]);
```

> Note: `useRef` and `useEffect` are already imported in this file (used throughout). `isAndroidDevice` is the existing `useCallback` (defined ~line 971); including it in the deps array is correct and stable.

- [ ] **Step 3: Mount the modal in layout**

In `app/layout.tsx`, add the import alongside the other component imports (near `import { ToastContainer } from '@/components/Toast'`, ~line 7):

```ts
import AndroidBatteryHintModal from '@/components/AndroidBatteryHintModal'
```

Then mount it immediately after the existing `<ToastContainer />` (~line 285):

```tsx
                          <ToastContainer />
                          <AndroidBatteryHintModal />
```

- [ ] **Step 4: Verify the whole thing builds**

Run: `npm run build`
Expected: build completes with no TypeScript errors. This confirms the dispatch site, the mount, and both new modules type-check together.

- [ ] **Step 5: Re-run the unit tests (guard against regressions)**

Run: `npx tsx --test lib/android-battery-hint.test.ts`
Expected: PASS — `# pass 2`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add contexts/AudioContext.tsx app/layout.tsx
git commit -m "feat(android): show battery-optimization hint on first Android play"
```

---

## Device Acceptance (manual — not a coding task)

Detection and localStorage behavior can't be exercised in the build. On a real Android phone with a browser:

1. In a browser where `localStorage['android_battery_hint_dismissed']` is unset, load the PWA and start playback → the modal appears once, naming the correct browser.
2. Tap **Got it** (or X, or the backdrop) → modal closes; reload and play again → it does NOT reappear.
3. On desktop and iOS → modal never appears (gate fails on `isAndroid`).
4. In the native Capacitor app (if installed) → modal never appears (gate fails on `isNative`).

## Self-Review

- **Spec coverage:** Trigger/gating → Task 3 Step 2 (+ Task 1 predicate). Wiring via CustomEvent → Task 3 Steps 2–3 + Task 2. Browser detection → Task 1 `resolveBrowserName` + Task 2 async probe. Content/copy → Task 2 Step 1 (verbatim from Global Constraints). Persistence/dismissal → Task 2 `dismiss()`. Files list → Tasks 1–3 match spec's Components/files. Testing → Task 1 unit tests + Device Acceptance. All spec sections mapped.
- **Placeholder scan:** none — every code block is complete and final.
- **Type/name consistency:** `shouldShowAndroidBatteryHint` and `resolveBrowserName` signatures identical across Tasks 1–3; localStorage key `android_battery_hint_dismissed`, event name `android-battery-hint`, and `DISMISSED_KEY` constant all consistent; component default-exported in Task 2 and default-imported in Task 3.
