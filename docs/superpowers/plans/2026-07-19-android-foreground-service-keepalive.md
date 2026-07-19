# Android Foreground-Service Keep-Alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the native zapstore (Capacitor 8 WebView) app a minimal foreground media service so GrapheneOS keeps the app process alive and locked-screen audio survives, without touching any web audio logic.

**Architecture:** A native Android foreground `Service` (`mediaPlayback` type, minimal ongoing notification) started/stopped through a two-method Capacitor plugin (`PlaybackKeepAlive.start()/.stop()`). A single guarded `useEffect` in `contexts/AudioContext.tsx` calls those methods off the existing `isPlaying` state — a complete no-op on iOS, desktop, and the browser PWA.

**Tech Stack:** Java (Android, Capacitor 8), androidx.core compat helpers (`ServiceCompat`, `NotificationCompat`, `NotificationManagerCompat`), TypeScript/React (existing `AudioContext.tsx`).

## Global Constraints

- **Native-Android-only effect.** No behavior change on iOS, desktop, or the browser PWA. The web hook must return before any side effect unless `Capacitor.isNativePlatform()` is true AND `Capacitor.getPlatform() === 'android'`.
- **Additive only.** Do not modify, reorder, or remove any existing audio logic, refs, listeners, or the blob-prefetch / gapless-overlap paths. Only add the new helper, the new `useEffect`, and the new native files/permissions.
- **Package:** `app.stablekraft`. Native files go under `android/app/src/main/java/app/stablekraft/`.
- **Plugin JS name:** exactly `PlaybackKeepAlive` (so it surfaces as `window.Capacitor.Plugins.PlaybackKeepAlive`). Methods: exactly `start` and `stop`, each resolving its `PluginCall`.
- **SDK:** minSdk 24, compileSdk/targetSdk 36. Use androidx.core compat helpers for version-safe FGS/notification calls — no hand-rolled `Build.VERSION.SDK_INT` branching.
- **Foreground service type:** `mediaPlayback` in both the manifest `<service>` and the `startForeground` call.
- **Never throw into the audio pipeline.** The web helper wraps everything in try/catch and swallows errors; the native plugin methods always `call.resolve()`.
- **Secrets:** never commit `~/keystores/stablekraft-release.jks` or `~/.stablekraft-android.env`. This plan does not add or reference secret material.
- Build/verify commands that invoke Gradle must set `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` (JDK 21 required by this Capacitor/AGP setup).

---

## File Structure

- **Create** `android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java` — the foreground `Service` (notification channel + `startForeground`/`stopForeground`).
- **Create** `android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java` — the Capacitor plugin bridge (`start`/`stop`).
- **Modify** `android/app/src/main/java/app/stablekraft/MainActivity.java` — register the plugin.
- **Modify** `android/app/src/main/AndroidManifest.xml` — permissions + `<service>` declaration.
- **Modify** `contexts/AudioContext.tsx` — guarded helper + one `useEffect` on `isPlaying`.

Task 1 delivers the complete native side (compiles standalone). Task 2 delivers the web hook (type-checks standalone). Device verification is the final manual acceptance gate (§ Device Acceptance) — not a coding task.

---

### Task 1: Native foreground service, plugin, registration, and manifest

**Files:**
- Create: `android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java`
- Create: `android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java`
- Modify: `android/app/src/main/java/app/stablekraft/MainActivity.java`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces (consumed by Task 2, via the Capacitor bridge at runtime): JS calls `window.Capacitor.Plugins.PlaybackKeepAlive.start()` and `.stop()` — both return a resolved promise (no payload).
- Consumes: Capacitor 8 `com.getcapacitor.Plugin` / `BridgeActivity`; androidx.core `ServiceCompat`, `NotificationCompat`, `NotificationManagerCompat`, `NotificationChannelCompat` (already on the classpath via `capacitor-android` / `appcompat`).

- [ ] **Step 1: Create the foreground service**

Create `android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java`:

```java
package app.stablekraft;

import android.app.Notification;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

/**
 * Minimal foreground service. Its only job is to pin the app process at
 * foreground-service importance while audio is playing so GrapheneOS (and
 * other aggressive Android builds) do not suspend the backgrounded WebView.
 * All actual playback and lock-screen controls remain in the WebView's
 * MediaSession — this service posts a plain ongoing notification and nothing
 * more. Started/stopped by PlaybackKeepAlivePlugin.
 */
public class PlaybackKeepAliveService extends Service {

    private static final String CHANNEL_ID = "stablekraft_playback";
    private static final int NOTIFICATION_ID = 4271;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannel();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StableKraft")
            .setContentText("Playing")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .build();

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        );

        // If the OS kills us, do not resurrect a silent zombie — the web layer
        // re-issues start() on the next play().
        return START_NOT_STICKY;
    }

    private void ensureChannel() {
        NotificationChannelCompat channel = new NotificationChannelCompat.Builder(
            CHANNEL_ID,
            NotificationManagerCompat.IMPORTANCE_LOW
        )
            .setName("Playback")
            .setDescription("Keeps audio playing when the screen is locked")
            .setShowBadge(false)
            .build();
        NotificationManagerCompat.from(this).createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
```

- [ ] **Step 2: Create the Capacitor plugin bridge**

Create `android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java`:

```java
package app.stablekraft;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS <-> native bridge for the playback keep-alive foreground service.
 * Exposed to the WebView (including the remote server.url site) as
 * window.Capacitor.Plugins.PlaybackKeepAlive. Two methods, no payloads.
 */
@CapacitorPlugin(name = "PlaybackKeepAlive")
public class PlaybackKeepAlivePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), PlaybackKeepAliveService.class);
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            // Never reject into the audio pipeline; degrade to no-FGS behavior.
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), PlaybackKeepAliveService.class);
            getContext().stopService(intent);
        } catch (Exception e) {
            // Ignore — stopping an already-stopped service is harmless.
        }
        call.resolve();
    }
}
```

- [ ] **Step 3: Register the plugin in MainActivity**

Replace the contents of `android/app/src/main/java/app/stablekraft/MainActivity.java` with:

```java
package app.stablekraft;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlaybackKeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

- [ ] **Step 4: Add permissions and the service declaration to the manifest**

In `android/app/src/main/AndroidManifest.xml`:

a) Add the `<service>` element inside `<application>`, immediately after the existing `<provider>` block:

```xml
        <service
            android:name=".PlaybackKeepAliveService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
```

b) Replace the existing permissions block:

```xml
    <!-- Permissions -->

    <uses-permission android:name="android.permission.INTERNET" />
```

with:

```xml
    <!-- Permissions -->

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- [ ] **Step 5: Verify the native code compiles**

Run from the repo root:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  android/gradlew -p android :app:compileDebugJavaWithJavac
```

Expected: `BUILD SUCCESSFUL`. This confirms the two new classes, the `MainActivity` change, and the manifest merge all compile against compileSdk 36 with the androidx.core compat helpers. (No unit-test harness exists for native here; functional behavior is validated on-device in § Device Acceptance.)

If the Gradle daemon needs an Android SDK path it is already configured via `android/local.properties`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java \
        android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java \
        android/app/src/main/java/app/stablekraft/MainActivity.java \
        android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): foreground-service keep-alive for locked-screen audio"
```

---

### Task 2: Guarded web hook in AudioContext

**Files:**
- Modify: `contexts/AudioContext.tsx`

**Interfaces:**
- Consumes (at runtime, native only): `window.Capacitor.Plugins.PlaybackKeepAlive.start()` / `.stop()` produced by Task 1.
- Consumes (existing): the `isPlaying` state variable already declared in the `AudioProvider` component (used throughout the file, e.g. `setIsPlaying` at lines ~2098/2129/3809). No new state.
- Produces: nothing consumed by other tasks.

**Context:** `isPlaying` is the single source of truth for "audio is currently playing." It is set `true` in `handlePlay` and stays `true` across track-to-track transitions (`handlePause` early-returns on an `ended` element). It goes `false` on genuine user pause (`handlePause`), on `stop()`, and at true end-of-queue when `repeatMode === 'none'`. Driving keep-alive off this one flag covers every start/stop case with a single hook.

- [ ] **Step 1: Add the guarded helper**

Add this module-scope function near the top of `contexts/AudioContext.tsx`, after the imports and before the `AudioProvider` component definition (place it beside other top-of-file helpers; it depends on nothing in the component):

```ts
/**
 * Native-Android-only bridge to the PlaybackKeepAlive foreground service.
 * On iOS, desktop, and the browser PWA this is a complete no-op (returns
 * before any side effect). Never throws — a missing plugin or older native
 * shell degrades silently to today's no-foreground-service behavior.
 */
function playbackKeepAlive(action: 'start' | 'stop'): void {
  try {
    const cap = (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
    if (!cap?.isNativePlatform?.()) return;      // browser PWA / SSR / iOS Safari
    if (cap.getPlatform?.() !== 'android') return; // native, Android only
    cap.Plugins?.PlaybackKeepAlive?.[action]?.();
  } catch {
    // swallow — must never break the audio pipeline
  }
}
```

- [ ] **Step 2: Add the `useEffect` that drives it off `isPlaying`**

Inside the `AudioProvider` component, after the `isPlaying` state is declared and near the other `useEffect`s that depend on `isPlaying`, add:

```ts
  // Native Android: hold a foreground service while audio is playing so the OS
  // does not suspend the backgrounded WebView (locked-screen playback). No-op on
  // every non-native platform. Keyed on isPlaying, which stays true across track
  // transitions and only flips false on pause / stop / end-of-queue.
  useEffect(() => {
    playbackKeepAlive(isPlaying ? 'start' : 'stop');
  }, [isPlaying]);
```

- [ ] **Step 3: Verify the type-check / build passes**

Run:

```bash
npm run build
```

Expected: build completes with no TypeScript errors (per repo boundary "Run `npm run build` before committing"). The new helper and effect are additive; nothing else in the file changes.

- [ ] **Step 4: Commit**

```bash
git add contexts/AudioContext.tsx
git commit -m "feat(android): start/stop foreground keep-alive from isPlaying (native-only)"
```

---

## Device Acceptance (manual — the real gate, not a coding task)

Per the spec, the GrapheneOS suspension does not reproduce on desktop or emulator. After both tasks land:

1. Sync + build the signed release (JDK 21):
   ```bash
   npm run android:sync
   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release
   ```
2. Install on the Pixel (adb install of the release APK, or publish via `zsp publish --skip-certificate-linking`).
3. Start playback → confirm the "StableKraft — Playing" notification appears; stop → it clears.
4. Play an album, **lock the screen**, let ≥3 boundaries pass untouched. **Success = audio continues across every boundary locked** (the fix target is "died within seconds of track 1").
5. Optional evidence while locked: `adb shell dumpsys activity services app.stablekraft` shows `PlaybackKeepAliveService` running as a foreground service.
6. Regression: browser PWA + iOS build behave exactly as before (the web hook no-ops off-native).

If audio is confirmed to still mute *after* the process is verified alive, that is new evidence escalating to the native-ExoPlayer approach (out of scope here) — do not pre-build for it.

---

## Self-Review

- **Spec coverage:** Component 1 (service) → Task 1 Step 1; Component 2 (plugin) → Step 2; Component 3 (registration + manifest) → Steps 3–4; Component 4 (web hook) → Task 2. Non-goals (controls, ExoPlayer, iOS/desktop/PWA changes, metadata bridging) are all excluded. Device verification → § Device Acceptance. All spec sections mapped.
- **Placeholder scan:** none — every code block is complete and final.
- **Type/name consistency:** plugin name `PlaybackKeepAlive`, methods `start`/`stop`, class names `PlaybackKeepAliveService` / `PlaybackKeepAlivePlugin`, channel id `stablekraft_playback`, notification id `4271` — used identically across all steps and matched by the web helper's `PlaybackKeepAlive?.[action]`.
