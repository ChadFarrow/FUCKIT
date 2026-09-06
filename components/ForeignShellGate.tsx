'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { checkNativeShell, type ShellDecision } from '@/lib/native-app-identity';
import { monitoring } from '@/lib/monitoring';

/**
 * Stops a forked Android shell from running the app on our Railway backend.
 *
 * The APK is a WebView pointed at https://stablekraft.app (capacitor.config.ts),
 * so a fork that leaves `server.url` alone serves every byte off our instance.
 * lib/native-app-identity.ts explains why the Android applicationId is the only
 * honest way to tell such a shell from ours, and why every uncertain branch of
 * that check allows rather than blocks.
 *
 * Children render while the check is in flight, so first paint is UNCHANGED for
 * every real user — no added latency, no flash, no waiting on a bridge promise.
 * A foreign shell therefore renders the app for a few hundred milliseconds before
 * the notice replaces it. That is deliberate: delaying everyone to shave a second
 * off the fork's start-up would be the wrong trade.
 *
 * Placed outside ClientErrorBoundary and the provider tree in app/layout.tsx, so
 * blocking unmounts the providers too — audio included. That is the point: a
 * running AudioContext is exactly the bandwidth we are declining to serve.
 */
export default function ForeignShellGate({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<ShellDecision>('allow');
  const [appId, setAppId] = useState<string | null>(null);

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
        // migration. The appId is the throttle key's payload, not the message,
        // because monitoring throttles on the message string.
        monitoring.warn('foreign-shell', 'Unrecognised native shell loaded the app', {
          appId: result.appId,
          decision: result.decision,
        });

        // 'report' is log mode: say so, render the app anyway.
        if (result.decision === 'block') {
          setAppId(result.appId);
          setDecision('block');
        }
      } catch {
        // Fail open. A broken gate must never be what takes the site down.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (decision !== 'block') return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-gray-950 text-gray-100"
      style={{
        paddingTop: 'calc(2rem + var(--sk-safe-top))',
        paddingBottom: 'calc(2rem + var(--sk-safe-bottom))',
        paddingLeft: 'calc(1.5rem + var(--sk-safe-left))',
        paddingRight: 'calc(1.5rem + var(--sk-safe-right))',
      }}
    >
      <div className="mx-auto max-w-md space-y-5">
        <h1 className="text-2xl font-bold">This app is not StableKraft</h1>

        <p className="text-gray-300">
          You are running a third party&apos;s build. It is not published by StableKraft, but it is
          loading its content from StableKraft&apos;s servers, so it has been stopped here.
        </p>

        {appId && (
          <p className="text-sm text-gray-400">
            Android package: <code className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-200">{appId}</code>
          </p>
        )}

        <div className="rounded-lg bg-gray-900 p-4 space-y-2">
          <p className="font-semibold">Get the real app</p>
          <p className="text-sm text-gray-300">
            StableKraft is free and open source. Install the official build, or open the site in your
            browser.
          </p>
          <p className="text-sm">
            <a className="text-blue-400 underline" href="https://zapstore.dev/apps/app.stablekraft">
              StableKraft on Zapstore
            </a>
          </p>
          <p className="text-sm">
            <a className="text-blue-400 underline" href="https://stablekraft.app">
              stablekraft.app
            </a>
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 p-4 space-y-2">
          <p className="font-semibold">If this is your build</p>
          <p className="text-sm text-gray-300">
            Forks are welcome — the code is MIT licensed. Point{' '}
            <code className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-200">server.url</code> in{' '}
            <code className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-200">capacitor.config.ts</code>{' '}
            at your own deployment, and add your package id to{' '}
            <code className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-200">
              NEXT_PUBLIC_ALLOWED_APP_IDS
            </code>{' '}
            there. Please do not run your app on someone else&apos;s hosting bill.
          </p>
          <p className="text-sm">
            <a className="text-blue-400 underline" href="https://github.com/ChadFarrow/stablekraft-app">
              github.com/ChadFarrow/stablekraft-app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
