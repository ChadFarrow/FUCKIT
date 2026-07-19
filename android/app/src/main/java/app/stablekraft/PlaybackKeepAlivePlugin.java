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
