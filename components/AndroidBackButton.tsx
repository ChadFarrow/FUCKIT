'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAudio } from '@/contexts/AudioContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { isNativeAndroid } from '@/lib/native-app-identity';

/**
 * Hardware / gesture back button for the native Android app (issue #167).
 *
 * Capacitor 8's BridgeActivity ships with NO back handling whatsoever — no
 * onBackPressed, no OnBackPressedDispatcher callback — so back fell through to
 * the default Activity behaviour and quit the app from any screen. Installing
 * @capacitor/app is what supplies the callback: its AppPlugin.load() registers
 * an OnBackPressedCallback and, once a JS 'backButton' listener exists, hands
 * the decision to us instead of blindly calling webView.goBack().
 *
 * Renders nothing. On iOS, desktop, and the browser PWA the effect returns
 * before touching anything, so this is a complete no-op there. Every bridge
 * call is wrapped — a missing plugin (i.e. an older installed APK loading this
 * same web build) degrades silently to the previous behaviour.
 */
export default function AndroidBackButton() {
  const router = useRouter();
  const { isFullscreenMode, setFullscreenMode, isPlaying } = useAudio();
  const { isSidebarOpen, closeSidebar } = useSidebar();

  // The native listener is registered once, so it would otherwise close over
  // stale state. Mirror the live values into a ref it can read on each press.
  const latest = useRef({
    isFullscreenMode,
    setFullscreenMode,
    isSidebarOpen,
    closeSidebar,
    isPlaying,
    router
  });
  latest.current = {
    isFullscreenMode,
    setFullscreenMode,
    isSidebarOpen,
    closeSidebar,
    isPlaying,
    router
  };

  useEffect(() => {
    if (!isNativeAndroid()) return;

    let handle: { remove?: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const App = (window as any).Capacitor?.Plugins?.App;
        if (!App?.addListener) return;

        // `canGoBack` comes from the native side (bridge.getWebView().canGoBack())
        // and is the real WebView history state. Do NOT substitute
        // window.history.length — that counts total entries and never shrinks,
        // so after stepping back to the first page it still reads > 1 and we
        // would keep trying to navigate past the start of the stack.
        handle = await App.addListener('backButton', ({ canGoBack }: { canGoBack?: boolean }) => {
          const s = latest.current;

          // Dismiss overlays first, outermost on top.
          if (s.isSidebarOpen) {
            s.closeSidebar();
            return;
          }
          if (s.isFullscreenMode) {
            s.setFullscreenMode(false);
            return;
          }

          if (canGoBack) {
            s.router.back();
            return;
          }

          // At the root of the stack. Never finish() the activity while audio
          // is playing — that would tear down the WebView and kill playback,
          // undoing the whole foreground-service/wake-lock effort. Minimising
          // backgrounds the app like the Home button and keeps music going.
          try {
            if (s.isPlaying) {
              App.minimizeApp?.();
            } else {
              App.exitApp?.();
            }
          } catch {
            /* ignore — worst case back does nothing at the root */
          }
        });

        // Effect was torn down while addListener was still awaiting.
        if (cancelled) {
          try { handle?.remove?.(); } catch { /* ignore */ }
        }
      } catch {
        // Plugin missing or bridge unavailable — leave back on its default path.
      }
    })();

    return () => {
      cancelled = true;
      try { handle?.remove?.(); } catch { /* ignore */ }
    };
    // Registered once for the lifetime of the app; state is read through `latest`.
  }, []);

  return null;
}
