package app.stablekraft;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

/**
 * Minimal foreground service. It pins the app process at foreground-service
 * importance AND holds a partial wake lock while audio is playing, so
 * GrapheneOS (and other aggressive Android builds) do not suspend the
 * backgrounded WebView. Foreground importance alone stops the process from
 * being killed, but it does NOT stop the CPU from entering deep sleep during
 * Doze — which freezes the WebView's audio decode and the JS timers that drive
 * the ping-pong track transitions. The partial wake lock keeps the CPU awake
 * (screen/keyboard still turn off) so playback survives a locked screen.
 * All actual playback and lock-screen controls remain in the WebView's
 * MediaSession — this service posts a plain ongoing notification and nothing
 * more. Started/stopped by PlaybackKeepAlivePlugin.
 */
public class PlaybackKeepAliveService extends Service {

    private static final String CHANNEL_ID = "stablekraft_playback";
    private static final int NOTIFICATION_ID = 4271;
    private static final String WAKE_LOCK_TAG = "StableKraft::PlaybackKeepAlive";

    @Nullable
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannel();
        acquireWakeLock();

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
            // Never let wake-lock issues crash the service — degrade to
            // foreground-importance-only (today's behavior).
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            // Ignore — releasing an unheld lock is harmless.
        }
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
        releaseWakeLock();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
