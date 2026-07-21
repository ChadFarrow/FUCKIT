package app.stablekraft;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
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
