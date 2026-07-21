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

        postForeground(NOTIFICATION_ID, buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

        // If the OS kills us, do not resurrect a silent zombie — the web layer
        // re-issues start() on the next play().
        return START_NOT_STICKY;
    }

    private void postForeground(int id, Notification n, int type) {
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
