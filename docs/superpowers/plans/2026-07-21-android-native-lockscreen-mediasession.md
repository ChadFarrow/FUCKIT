# Android Native Lock-Screen Media Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the native zapstore Android app a stable lock-screen media player (art, title/artist/album, Prev / Play-Pause / Next, draggable seek bar) that persists across the app's ping-pong track transitions and while paused.

**Architecture:** Extend the existing `PlaybackKeepAliveService` (from PR #161) into a `MediaSessionCompat` host that owns a `MediaStyle` notification. The plugin gains methods to push metadata/state from JS and emits an event when a lock-screen button is pressed. `AudioContext.tsx` pushes now-playing data to the native plugin and routes button events back to its existing play/pause/skip refs — and, on native Android only, stops driving `navigator.mediaSession` so Chromium doesn't post a competing (flaky) notification. iOS/desktop/PWA are completely untouched.

**Tech Stack:** Java (Capacitor plugin + Android foreground service), `androidx.media:media` (MediaSessionCompat / MediaStyle / MediaButtonReceiver), TypeScript/React (`contexts/AudioContext.tsx`), Capacitor 8.

## Global Constraints

- Native changes reach users **only via a new APK** — the web bridge no-ops until the plugin exists in an installed build.
- **Native-Android-only**: every new native call path must be gated `Capacitor.isNativePlatform() && getPlatform() === 'android'` and wrapped in try/catch that swallows — never reject into the audio pipeline. iOS, desktop, and the browser PWA keep the existing `navigator.mediaSession` path unchanged.
- Preserve PR #161's wake-lock acquire (`onStartCommand`) / release (`onDestroy`) lifecycle exactly.
- Version for the combined release: **versionCode 4 / versionName 1.3**.
- JDK 21 for all Android builds: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.
- Release builds need the keystore env: `source ~/.stablekraft-android.env` first.
- Native verification is **device-only** (per CLAUDE.md) — the locked-screen / MediaSession behavior does not reproduce on emulator/desktop. Per-task gates for Java are "compiles"; full behavior is verified end-to-end in Task 4.
- Seek units: MediaSession/PlaybackState use **milliseconds**; HTML `audio.currentTime` uses **seconds**. Convert at the boundary.
- **Pause lifecycle** (decided during planning): the lock-screen player **persists while paused** (Play button shown) so the user can resume from the lock screen — standard media-app behavior. The **wake lock is released on pause** (no battery cost); the foreground service + notification stay up. The notification is non-ongoing (`setOngoing(isPlaying)`) while paused, so it is dismissible, and is replaced on the next play. The service is not auto-stopped on pause.

---

### Task 1: Add `androidx.media` dependency + MediaButton manifest wiring

**Files:**
- Modify: `android/variables.gradle`
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: `androidx.media:media` on the classpath (`MediaSessionCompat`, `androidx.media.app.NotificationCompat.MediaStyle`, `androidx.media.session.MediaButtonReceiver`) and a manifest-registered `MediaButtonReceiver` so transport-key / notification-action `PendingIntent`s resolve. Consumed by Task 2.

- [ ] **Step 1: Add the media library version variable**

In `android/variables.gradle`, add one line inside the `ext { ... }` block (after `androidxWebkitVersion`):

```gradle
    androidxWebkitVersion = '1.14.0'
    androidxMediaVersion = '1.7.0'
```

- [ ] **Step 2: Add the dependency**

In `android/app/build.gradle`, inside `dependencies { ... }`, add after the `androidx.core:core-splashscreen` line:

```gradle
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    implementation "androidx.media:media:$androidxMediaVersion"
```

- [ ] **Step 3: Register MediaButtonReceiver + add MEDIA_BUTTON intent-filter to the service**

In `android/app/src/main/AndroidManifest.xml`, replace the existing `<service>` block with the block below (adds a `MEDIA_BUTTON` intent-filter to the service and declares the `MediaButtonReceiver`):

```xml
        <service
            android:name=".PlaybackKeepAliveService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="android.intent.action.MEDIA_BUTTON" />
            </intent-filter>
        </service>

        <receiver
            android:name="androidx.media.session.MediaButtonReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MEDIA_BUTTON" />
            </intent-filter>
        </receiver>
```

- [ ] **Step 4: Verify it compiles**

Run:
```bash
cd /Users/chad-mini/Vibe/stablekraft-app && JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home android/gradlew -p android assembleDebug
```
Expected: `BUILD SUCCESSFUL` (the new dependency resolves; manifest merges).

- [ ] **Step 5: Commit**

```bash
git add android/variables.gradle android/app/build.gradle android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): add androidx.media dep + MediaButtonReceiver for lock-screen controls"
```

---

### Task 2: Turn `PlaybackKeepAliveService` into a MediaSession host

**Files:**
- Modify (full rewrite): `android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java`

**Interfaces:**
- Consumes: `androidx.media:media` from Task 1.
- Consumes (forward-declared, implemented in Task 3): `PlaybackKeepAlivePlugin.emitAction(String action, long seekToMs)` — static, safe to call when no plugin is attached.
- Produces: two intent action strings other components target this service with —
  `PlaybackKeepAliveService.ACTION_UPDATE_METADATA` (extras: `title`, `artist`, `album` `String`; `duration` `long` ms) and
  `PlaybackKeepAliveService.ACTION_UPDATE_STATE` (extras: `isPlaying` `boolean`; `position` `long` ms). A plain start Intent (no action) keeps the original keep-alive behavior. Consumed by Task 3.

- [ ] **Step 1: Rewrite the service**

Replace the entire contents of `android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java` with:

```java
package app.stablekraft;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.session.MediaButtonReceiver;

import java.io.InputStream;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground service that (a) pins the process + holds a partial wake lock so
 * locked-screen audio survives Doze (PR #161), and (b) owns a MediaSessionCompat
 * that drives a MediaStyle lock-screen player. The session is decoupled from any
 * HTMLMediaElement, so it stays stable across the WebView's ping-pong track
 * transitions — unlike Chromium's element-bound session, which flickers away at
 * every boundary. Metadata/state are pushed from JS via PlaybackKeepAlivePlugin;
 * lock-screen/Bluetooth button presses are forwarded back to JS via
 * PlaybackKeepAlivePlugin.emitAction(...).
 */
public class PlaybackKeepAliveService extends Service {

    public static final String ACTION_UPDATE_METADATA = "app.stablekraft.UPDATE_METADATA";
    public static final String ACTION_UPDATE_STATE = "app.stablekraft.UPDATE_STATE";

    private static final String CHANNEL_ID = "stablekraft_playback";
    private static final int NOTIFICATION_ID = 4271;
    private static final String WAKE_LOCK_TAG = "StableKraft::PlaybackKeepAlive";

    @Nullable
    private PowerManager.WakeLock wakeLock;
    @Nullable
    private MediaSessionCompat mediaSession;

    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

    // Current now-playing state (defaults keep the notification non-empty on first start)
    private String title = "StableKraft";
    private String artist = "";
    private String album = "";
    private long durationMs = 0L;
    private boolean isPlaying = true;
    private long positionMs = 0L;
    @Nullable
    private Bitmap artwork;
    @Nullable
    private String artworkUrl;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
        mediaSession = new MediaSessionCompat(this, "StableKraft");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { PlaybackKeepAlivePlugin.emitAction("play", 0); }
            @Override public void onPause() { PlaybackKeepAlivePlugin.emitAction("pause", 0); }
            @Override public void onSkipToNext() { PlaybackKeepAlivePlugin.emitAction("next", 0); }
            @Override public void onSkipToPrevious() { PlaybackKeepAlivePlugin.emitAction("previous", 0); }
            @Override public void onSeekTo(long pos) { PlaybackKeepAlivePlugin.emitAction("seekto", pos); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = (intent == null) ? null : intent.getAction();

        if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
            // Route hardware/Bluetooth media-button intents into the session.
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        } else if (ACTION_UPDATE_METADATA.equals(action)) {
            title = orDefault(intent.getStringExtra("title"), title);
            artist = orDefault(intent.getStringExtra("artist"), artist);
            album = orDefault(intent.getStringExtra("album"), album);
            durationMs = intent.getLongExtra("duration", durationMs);
            String url = intent.getStringExtra("artworkUrl");
            applyMetadata();
            maybeLoadArtwork(url);
        } else if (ACTION_UPDATE_STATE.equals(action)) {
            isPlaying = intent.getBooleanExtra("isPlaying", isPlaying);
            positionMs = intent.getLongExtra("position", positionMs);
            // Wake lock tracks play state: held while playing, released while
            // paused (battery). The FGS + notification stay up while paused so
            // the lock-screen player persists and the user can resume.
            if (isPlaying) acquireWakeLock(); else releaseWakeLock();
            applyPlaybackState();
        } else {
            // Plain start (PlaybackKeepAlivePlugin.start(), fired on play).
            acquireWakeLock();
        }

        startForeground(NOTIFICATION_ID, buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

        // If the OS kills us, do not resurrect a silent zombie — the web layer
        // re-issues start() on the next play().
        return START_NOT_STICKY;
    }

    private void startForeground(int id, Notification n, int type) {
        ServiceCompat.startForeground(this, id, n, type);
    }

    private void applyMetadata() {
        if (mediaSession == null) return;
        MediaMetadataCompat.Builder b = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) {
            b.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
        }
        mediaSession.setMetadata(b.build());
    }

    private void applyPlaybackState() {
        if (mediaSession == null) return;
        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO;
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat ps = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, 1.0f)
            .build();
        mediaSession.setPlaybackState(ps);
        // Re-post so the notification's play/pause icon + scrubber track state.
        NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseTitle = isPlaying ? "Pause" : "Play";
        long playPauseAction = isPlaying ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist.isEmpty() ? album : artist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(isPlaying)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .addAction(new NotificationCompat.Action(android.R.drawable.ic_media_previous, "Previous",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)))
            .addAction(new NotificationCompat.Action(playPauseIcon, playPauseTitle,
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, playPauseAction)))
            .addAction(new NotificationCompat.Action(android.R.drawable.ic_media_next, "Next",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)));

        if (artwork != null) {
            builder.setLargeIcon(artwork);
        }

        if (mediaSession != null) {
            builder.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        }

        return builder.build();
    }

    private void maybeLoadArtwork(@Nullable String url) {
        if (url == null || url.isEmpty()) return;
        if (url.equals(artworkUrl)) return; // already loaded / loading this one
        artworkUrl = url;
        final String requested = url;
        artworkExecutor.execute(() -> {
            try {
                InputStream in = new URL(requested).openStream();
                Bitmap bmp = BitmapFactory.decodeStream(in);
                in.close();
                if (bmp == null) return;
                // Ignore if a newer artwork was requested meanwhile.
                if (!requested.equals(artworkUrl)) return;
                artwork = bmp;
                applyMetadata();
                NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildNotification());
            } catch (Exception e) {
                // No art is fine — never crash the service on a bad image.
            }
        });
    }

    private static String orDefault(@Nullable String v, String fallback) {
        return (v == null) ? fallback : v;
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm == null) return;
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
                wakeLock.setReferenceCounted(false);
            }
            if (!wakeLock.isHeld()) {
                wakeLock.acquire();
            }
        } catch (Exception e) {
            // Degrade to foreground-importance-only.
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            // Releasing an unheld lock is harmless.
        }
    }

    private void ensureChannel() {
        NotificationChannelCompat channel = new NotificationChannelCompat.Builder(
            CHANNEL_ID,
            NotificationManagerCompat.IMPORTANCE_LOW
        )
            .setName("Playback")
            .setDescription("Lock-screen playback controls")
            .setShowBadge(false)
            .build();
        NotificationManagerCompat.from(this).createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        artworkExecutor.shutdownNow();
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

- [ ] **Step 2: Verify it compiles** (Task 3's `emitAction` doesn't exist yet, so this step is expected to fail — proceed to Task 3, then compile)

Run:
```bash
cd /Users/chad-mini/Vibe/stablekraft-app && JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home android/gradlew -p android assembleDebug
```
Expected: FAIL with `cannot find symbol ... emitAction` (resolved in Task 3). This confirms the only missing symbol is the plugin bridge.

- [ ] **Step 3: Commit** (compiles fully after Task 3; commit the pair together at the end of Task 3)

No commit here — this task and Task 3 are mutually dependent Java and are committed together in Task 3, Step 3.

---

### Task 3: Add plugin methods + the button-event bridge

**Files:**
- Modify (full rewrite): `android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java`

**Interfaces:**
- Consumes: `PlaybackKeepAliveService.ACTION_UPDATE_METADATA` / `ACTION_UPDATE_STATE` from Task 2.
- Produces (JS-facing, consumed in Task 4):
  - `PlaybackKeepAlive.updateMetadata({ title, artist, album, artworkUrl, duration })` — `duration` in ms.
  - `PlaybackKeepAlive.setPlaybackState({ isPlaying, position })` — `position` in ms.
  - event `mediaSessionAction` with payload `{ action: 'play'|'pause'|'next'|'previous'|'seekto', seekTo?: number }` (`seekTo` in ms, present only for `seekto`).
  - existing `start()` / `stop()` unchanged.
- Produces (native, consumed by Task 2): `static void emitAction(String action, long seekToMs)`.

- [ ] **Step 1: Rewrite the plugin**

Replace the entire contents of `android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java` with:

```java
package app.stablekraft;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

/**
 * JS <-> native bridge for the playback keep-alive foreground service and its
 * lock-screen MediaSession. Exposed to the WebView (including the remote
 * server.url site) as window.Capacitor.Plugins.PlaybackKeepAlive.
 */
@CapacitorPlugin(name = "PlaybackKeepAlive")
public class PlaybackKeepAlivePlugin extends Plugin {

    @Nullable
    private static WeakReference<PlaybackKeepAlivePlugin> INSTANCE;

    @Override
    public void load() {
        INSTANCE = new WeakReference<>(this);
    }

    @Override
    protected void handleOnDestroy() {
        INSTANCE = null;
        super.handleOnDestroy();
    }

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
            // Stopping an already-stopped service is harmless.
        }
        call.resolve();
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), PlaybackKeepAliveService.class);
            intent.setAction(PlaybackKeepAliveService.ACTION_UPDATE_METADATA);
            intent.putExtra("title", call.getString("title", ""));
            intent.putExtra("artist", call.getString("artist", ""));
            intent.putExtra("album", call.getString("album", ""));
            intent.putExtra("artworkUrl", call.getString("artworkUrl", ""));
            Double duration = call.getDouble("duration");
            intent.putExtra("duration", duration == null ? 0L : duration.longValue());
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            // Ignore — metadata is best-effort.
        }
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackState(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), PlaybackKeepAliveService.class);
            intent.setAction(PlaybackKeepAliveService.ACTION_UPDATE_STATE);
            Boolean playing = call.getBoolean("isPlaying", true);
            intent.putExtra("isPlaying", playing != null && playing);
            Double position = call.getDouble("position");
            intent.putExtra("position", position == null ? 0L : position.longValue());
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            // Ignore — state is best-effort.
        }
        call.resolve();
    }

    /** Called from the service's MediaSession callback (any thread). */
    public static void emitAction(String action, long seekToMs) {
        final PlaybackKeepAlivePlugin plugin = (INSTANCE == null) ? null : INSTANCE.get();
        if (plugin == null) return;
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                JSObject data = new JSObject();
                data.put("action", action);
                if ("seekto".equals(action)) {
                    data.put("seekTo", seekToMs);
                }
                plugin.notifyListeners("mediaSessionAction", data);
            } catch (Exception e) {
                // Ignore — a dropped button event is non-fatal.
            }
        });
    }
}
```

- [ ] **Step 2: Add the missing import**

The rewrite uses `@Nullable`. Add its import near the top of the same file, with the other imports:

```java
import androidx.annotation.Nullable;
```

- [ ] **Step 3: Verify the whole native side compiles, then commit Tasks 2 + 3**

Run:
```bash
cd /Users/chad-mini/Vibe/stablekraft-app && JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home android/gradlew -p android assembleDebug
```
Expected: `BUILD SUCCESSFUL`.

```bash
git add android/app/src/main/java/app/stablekraft/PlaybackKeepAliveService.java android/app/src/main/java/app/stablekraft/PlaybackKeepAlivePlugin.java
git commit -m "feat(android): native MediaSession lock-screen player in keep-alive service"
```

---

### Task 4: Wire the web layer + suppress Chromium's session on native Android

**Files:**
- Modify: `contexts/AudioContext.tsx` (bridge helpers near line 51; early media-session init ~1124; `isPlaying` sync effect ~1178; `updateMediaSession` ~2827; new listener effect)

**Interfaces:**
- Consumes: `PlaybackKeepAlive.updateMetadata(...)`, `setPlaybackState(...)`, and the `mediaSessionAction` event from Task 3; existing refs `resumeRef`, `pauseRef`, `playNextTrackRef`, `playPreviousTrackRef`, and `getActiveAudioEl()`.
- Produces: end-to-end lock-screen controls; this is the task where the feature becomes device-verifiable.

- [ ] **Step 1: Add native bridge helpers**

In `contexts/AudioContext.tsx`, immediately after the existing `playbackKeepAlive` function (ends ~line 57), add:

```ts
/** True only inside the native Capacitor Android app (not iOS/PWA/SSR). */
function isNativeAndroid(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}

/** Push now-playing data to the native lock-screen MediaSession. No-op off native Android. */
function nativeMedia(method: 'updateMetadata' | 'setPlaybackState', data: Record<string, unknown>): void {
  try {
    if (!isNativeAndroid()) return;
    (window as any).Capacitor?.Plugins?.PlaybackKeepAlive?.[method]?.(data);
  } catch {
    // Best-effort — never break the audio pipeline.
  }
}
```

- [ ] **Step 2: Suppress Chromium's session + register the native listener on native Android**

In the early media-session init `useEffect` (~line 1124), change the guard so the whole `navigator.mediaSession` handler registration is skipped on native Android. Replace:

```ts
    if ('mediaSession' in navigator && navigator.mediaSession) {
      try {
        // Register action handlers immediately on mount (before any playback)
```
with:
```ts
    if ('mediaSession' in navigator && navigator.mediaSession && !isNativeAndroid()) {
      try {
        // Register action handlers immediately on mount (before any playback)
```

Then add a **new** `useEffect` right after that one (it must appear after `resumeRef`/`pauseRef`/`playNextTrackRef`/`playPreviousTrackRef` and `getActiveAudioEl` are in scope — they are, since the early-init effect already uses them):

```ts
  // Native Android lock-screen controls: route MediaSession button presses back
  // into the app's existing playback functions. iOS/PWA use navigator.mediaSession.
  useEffect(() => {
    if (!isNativeAndroid()) return;
    const plugin = (window as any).Capacitor?.Plugins?.PlaybackKeepAlive;
    if (!plugin?.addListener) return;
    let handle: any;
    Promise.resolve(
      plugin.addListener('mediaSessionAction', (ev: { action: string; seekTo?: number }) => {
        switch (ev.action) {
          case 'play': resumeRef.current?.(); break;
          case 'pause': pauseRef.current?.(); break;
          case 'next': playNextTrackRef.current?.(); break;
          case 'previous': playPreviousTrackRef.current?.(); break;
          case 'seekto': {
            const el = getActiveAudioEl();
            if (el && ev.seekTo != null) el.currentTime = ev.seekTo / 1000; // ms → s
            break;
          }
        }
      })
    ).then((h) => { handle = h; }).catch(() => {});
    return () => { try { handle?.remove?.(); } catch {} };
  }, []);
```

- [ ] **Step 3a: Keep the foreground service alive while paused**

The keep-alive effect currently stops the FGS on pause, which would remove the lock-screen player. Change it to only *start* on play; pause is handled by the state push in Step 3b (releases the wake lock, keeps the notification). Replace the effect at `contexts/AudioContext.tsx:277-279`:

```ts
  useEffect(() => {
    playbackKeepAlive(isPlaying ? 'start' : 'stop');
  }, [isPlaying]);
```
with:
```ts
  useEffect(() => {
    // Start the FGS on play. Do NOT stop on pause: the native MediaSession
    // notification must persist while paused so the user can resume from the
    // lock screen (the wake lock is released on pause in the state-sync effect
    // below). No-op on every non-native platform.
    if (isPlaying) playbackKeepAlive('start');
  }, [isPlaying]);
```

- [ ] **Step 3b: Push play-state from the isPlaying sync effect**

Replace the `isPlaying` sync effect (~line 1178):

```ts
  // Sync playbackState with isPlaying — single source of truth for lock screen controls
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);
```
with:
```ts
  // Sync playbackState with isPlaying — single source of truth for lock screen controls
  useEffect(() => {
    if ('mediaSession' in navigator && !isNativeAndroid()) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
    const el = getActiveAudioEl();
    const position = el && !isNaN(el.currentTime) ? Math.round(el.currentTime * 1000) : 0;
    nativeMedia('setPlaybackState', { isPlaying, position });
  }, [isPlaying]);
```

- [ ] **Step 4: Push metadata from updateMediaSession + guard the web assignment**

In `updateMediaSession` (~line 2827), wrap the web-only work and add the native push. Change the outer guard:

```ts
  const updateMediaSession = (album: RSSAlbum, track: any) => {
    if ('mediaSession' in navigator && navigator.mediaSession) {
      try {
```
to:
```ts
  const updateMediaSession = (album: RSSAlbum, track: any) => {
    if ('mediaSession' in navigator && navigator.mediaSession && !isNativeAndroid()) {
      try {
```

Then, still inside `updateMediaSession` but **after** the closing `}` of that `if (... && !isNativeAndroid())` block (i.e. just before the function's final `};`), add the native push (recomputes the same title/artist/album/artwork the web block uses, so it runs even when the web block is skipped):

```ts
    // Native Android: push the same now-playing data to the lock-screen MediaSession.
    if (isNativeAndroid()) {
      try {
        const originalArtworkUrl = track.image || album.coverArt || '/stablekraft-rocket.png';
        let artworkUrl = getProxiedMediaImageUrl(originalArtworkUrl);
        if (artworkUrl.startsWith('/')) {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://stablekraft.app';
          artworkUrl = `${baseUrl}${artworkUrl}`;
        }
        const el = isVideoMode ? videoRef.current : getActiveAudioEl();
        const duration = el && el.duration && !isNaN(el.duration) ? Math.round(el.duration * 1000) : 0;
        nativeMedia('updateMetadata', {
          title: track.title || 'Unknown Track',
          artist: track.artist || album.artist || 'Unknown Artist',
          album: album.title || 'Unknown Album',
          artworkUrl: originalArtworkUrl.startsWith('https://') ? originalArtworkUrl : artworkUrl,
          duration,
        });
      } catch {
        // Best-effort.
      }
    }
  };
```

- [ ] **Step 5: Type-check the web change**

Run:
```bash
cd /Users/chad-mini/Vibe/stablekraft-app && npx tsc --noEmit 2>&1 | grep -i "AudioContext" || echo "no AudioContext type errors"
```
Expected: `no AudioContext type errors`.

- [ ] **Step 6: Commit the web layer**

```bash
git add contexts/AudioContext.tsx
git commit -m "feat(audio): drive native Android lock-screen MediaSession; suppress web session on native"
```

- [ ] **Step 7: Device end-to-end test against a local dev server**

The WebView loads live `stablekraft.app`, so to exercise the un-deployed web bridge, point it at your local dev server temporarily.

1. Start the dev server (background): `npm run dev`
2. `adb reverse tcp:3000 tcp:3000`
3. Temporarily edit `capacitor.config.ts` `server` block to:
   ```ts
   server: {
     url: 'http://localhost:3000',
     cleartext: true,
     androidScheme: 'https'
   },
   ```
4. `npm run android:sync`
5. Build + install (release, installs over existing without data loss):
   ```bash
   source ~/.stablekraft-android.env
   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```
6. **Test on device** (screen locked):
   - Lock-screen player shows art + title/artist/album.
   - **Persists across ≥3 automatic track boundaries and while paused** (the core bug).
   - Prev / Play-Pause / Next and drag-seek each drive playback; Bluetooth transport keys work.
7. **No double notification** (top risk):
   ```bash
   adb shell dumpsys notification --noredact | grep -c "pkg=app.stablekraft"
   ```
   Expect **1** while playing. If 2, Chromium is still posting one despite suppression — capture `adb shell dumpsys media_session` + the notification templates and resolve (investigate WebView media flags) before shipping.
8. **Revert the temp config:** `git checkout capacitor.config.ts && npm run android:sync`

---

### Task 5: Version bump + final release verification

**Files:**
- Modify: `android/app/build.gradle` (versionCode/versionName)
- Modify: `CLAUDE.md` (document the feature under the Android section)

**Interfaces:**
- Consumes: everything above.
- Produces: a shippable versionCode 4 / 1.3 build.

- [ ] **Step 1: Bump the version**

In `android/app/build.gradle`, change:
```gradle
        versionCode 3
        versionName "1.1"
```
(if the branch still reads `versionName "1.1"`, it is the pre-#161 value; set both regardless) to:
```gradle
        versionCode 4
        versionName "1.3"
```

- [ ] **Step 2: Document the feature**

In `CLAUDE.md`, under "Android Foreground-Service Keep-Alive", add a short subsection noting the native MediaSession lock-screen player (owned by `PlaybackKeepAliveService`), that `navigator.mediaSession` is suppressed on native Android to avoid a double notification, that iOS/PWA are unchanged, and that it ships in v1.3 / versionCode 4.

- [ ] **Step 3: Full release build + install over existing**

```bash
cd /Users/chad-mini/Vibe/stablekraft-app
source ~/.stablekraft-android.env
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run android:release
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell dumpsys package app.stablekraft | grep -E "versionCode|versionName" | head -2
```
Expected: `versionCode=4 ... versionName=1.3`.

- [ ] **Step 4: Final device sanity pass** (now against **live** stablekraft.app — note the web bridge only works once the web changes are deployed to production; until then the native player shows but receives no metadata). Confirm: after deploying the web changes, lock-screen player is stable across transitions and shows exactly one notification.

- [ ] **Step 5: Commit**

```bash
git add android/app/build.gradle CLAUDE.md
git commit -m "chore(android): bump to versionCode 4 / versionName 1.3; document lock-screen MediaSession"
```

---

## Verification summary

- **Native compiles**: Task 1 & Task 3 gradle `assembleDebug` → `BUILD SUCCESSFUL`.
- **Web type-checks**: Task 4 `tsc --noEmit`.
- **Core behavior** (device, screen locked): lock-screen player persists across ≥3 track boundaries and while paused — the bug this fixes.
- **Controls**: prev/play-pause/next/seek + Bluetooth keys drive playback.
- **No double notification**: exactly one `app.stablekraft` media notification while playing.
- **Regression**: PR #161 wake-lock survival intact; iOS/PWA `navigator.mediaSession` unchanged.
- **Deploy note**: the native player only receives metadata once the `AudioContext.tsx` changes are live on `stablekraft.app` (production) OR the WebView is pointed at a local dev server (Task 4, Step 7).
