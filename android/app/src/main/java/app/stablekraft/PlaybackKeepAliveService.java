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
