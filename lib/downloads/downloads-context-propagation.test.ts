/**
 * npx tsx --test lib/downloads/downloads-context-propagation.test.ts
 *
 * Pins the one thing that makes download progress visible: the context value
 * must change identity when the manager changes.
 *
 * `DownloadsProvider` is the ONLY subscriber to `downloadManager`. The two
 * components that show download state read it DURING RENDER and subscribe to
 * nothing — `DownloadButton` calls `getTrackState`/`getAlbumState` inline, and
 * `DownloadsClient` calls `listDownloads()`. So a new context value is the only
 * signal React has to re-render either of them.
 *
 * #231 memoized that value on `[ready, isOnline, offlineMode, setOfflineMode]`
 * and threw the `useSyncExternalStore` result away. None of those four changes
 * when a download progresses, so the value stayed `Object.is`-equal across
 * every version bump. The provider re-rendered, `{children}` kept its element
 * identity, and React notified nobody: the spinner never advanced, never became
 * a tick, and a removed row stayed on the /downloads page. `tsc --noEmit` was
 * clean throughout, and `react-hooks/exhaustive-deps` says nothing — the array
 * was not missing a dependency it could see, it was missing the subscription.
 *
 * SOURCE-SCANNED, for the same reason as `boost-item-guid.test.ts`:
 * `npm run test:all` globs `lib/` and one level below, so nothing under
 * `contexts/` is reachable any other way. There is also no jsdom and no React
 * test renderer in this repo, so the render itself cannot be exercised.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILE = 'contexts/DownloadsContext.tsx';
const src = readFileSync(FILE, 'utf8');

/** Vacuity guard: if the provider is renamed or restructured, FAIL rather than
 *  pass by finding nothing. Every assertion below keys off these two anchors. */
test('the file still has the shape this test reasons about', () => {
  assert.match(
    src,
    /export function DownloadsProvider\(/,
    `${FILE}: DownloadsProvider is gone. This test's premises no longer hold — re-derive them before editing it.`
  );
  assert.equal(
    (src.match(/useSyncExternalStore\(/g) || []).length,
    1,
    `${FILE}: expected exactly one useSyncExternalStore. A second subscription changes what propagates and to whom.`
  );
});

test('the manager subscription is captured, not discarded', () => {
  const m = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useSyncExternalStore\(/.exec(src);
  assert.ok(
    m,
    `${FILE}: useSyncExternalStore's result is thrown away. It is the ONLY thing that changes when a download progresses — discard it and the context value can never move.`
  );
});

test('the context value memo depends on the manager version', () => {
  const start = src.indexOf('const value: DownloadsContextType = useMemo(');
  assert.notEqual(
    start,
    -1,
    `${FILE}: could not find the context value memo. If it is no longer a useMemo, the propagation argument changes — update this test deliberately.`
  );

  const sub = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useSyncExternalStore\(/.exec(src);
  assert.ok(sub, 'expected the subscription to be captured (see the test above)');
  const versionVar = sub[1];

  const deps = /\}\),\s*\[([^\]]*)\]\s*\)\s*;/.exec(src.slice(start));
  assert.ok(deps, `${FILE}: could not read the value memo's dependency array.`);

  const names = deps[1]
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  assert.ok(
    names.includes(versionVar),
    `${FILE}: the context value memo does not depend on \`${versionVar}\` (deps: ${names.join(', ') || 'none'}).\n` +
      'Without it the value is Object.is-equal across every downloadManager bump, so no consumer re-renders and download progress is invisible. This was live on main after #231.'
  );
});
