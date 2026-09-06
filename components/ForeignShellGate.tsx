'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { checkNativeShell } from '@/lib/native-app-identity';
import { monitoring } from '@/lib/monitoring';

/**
 * Stops a forked Android shell from running the app on our Railway backend.
 *
 * The APK is a WebView pointed at https://stablekraft.app (capacitor.config.ts),
 * so a fork that leaves `server.url` alone serves every byte off our instance.
 * lib/native-app-identity.ts explains why the Android applicationId is the only
 * honest way to tell such a shell from ours, why every uncertain branch of that
 * check allows rather than blocks, and why it fires only on our own deployments.
 *
 * A blocked shell renders NOTHING — no message, no explanation, by choice. The
 * cost of that choice, which is real: a blank screen looks like OUR app is
 * broken, so its users may report the bug to us rather than to whoever shipped
 * their build. The report below is what tells us that is what happened.
 *
 * Children render while the check is in flight, so first paint is UNCHANGED for
 * every real user — no added latency, no flash, no waiting on a bridge promise.
 * A foreign shell therefore renders the app for a few hundred milliseconds before
 * it goes blank. That is deliberate: delaying everyone to shave a second off the
 * fork's start-up would be the wrong trade.
 *
 * Placed outside ClientErrorBoundary and the provider tree in app/layout.tsx, so
 * blocking unmounts the providers too — audio included. That is the point: a
 * running AudioContext is exactly the bandwidth we are declining to serve.
 */
export default function ForeignShellGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // checkNativeShell never rejects; the catch is belt-and-braces so that a
      // future change here can never take the whole app down with it.
      try {
        const result = await checkNativeShell();
        if (cancelled || result.decision === 'allow') return;

        // console.warn, never console.log — next.config.js strips console.log
        // from production builds, which is the one place worth reading.
        console.warn('[foreign-shell] unrecognised native shell', result.appId, result.decision);

        // Reported once per mount through the existing client-log pipeline, so
        // it lands in the admin diagnostics panel with no new route, table or
        // migration. Since the user is told nothing, this report is the ONLY
        // signal that the gate fired at all — it is not optional. The appId
        // rides in the payload, not the message, because monitoring throttles
        // on the message string.
        monitoring.warn('foreign-shell', 'Unrecognised native shell loaded the app', {
          appId: result.appId,
          decision: result.decision,
        });

        // 'report' is log mode: record it, render the app anyway.
        if (result.decision === 'block') setBlocked(true);
      } catch {
        // Fail open. A broken gate must never be what takes the site down.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return blocked ? null : <>{children}</>;
}
