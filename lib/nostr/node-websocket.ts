/**
 * Give `nostr-tools` a WebSocket when Node doesn't have one.
 *
 * NODE-ONLY. Nothing in `app/`, `components/` or `contexts/` may import this —
 * browsers have always had `WebSocket`, and pulling `ws` into the client bundle
 * would be pure dead weight. Its only callers are the two relay harnesses:
 * `shared-favorites.relay.test.ts` and `shared-favorites.relay-probe.ts`.
 *
 * WHY IT EXISTS
 * `globalThis.WebSocket` only landed as a default in **Node 21**. This repo
 * targets **Node 20** (`.nvmrc`, and the Dockerfile's `node:20-alpine`), where it
 * sits behind `--experimental-websocket`. `nostr-tools` reads the global once, at
 * module load:
 *
 *     var _WebSocket;
 *     try { _WebSocket = WebSocket; } catch {}      // lib/esm/pool.js
 *
 * so on Node 20 every relay connection fails with `WebSocket is not defined`.
 * That is invisible from the symptom: the relay test's seven "a relay answers"
 * cases fail while its degraded-read cases still pass (a failed connection is
 * indistinguishable from the degradation they assert), and the probe declares
 * every default relay dead — the exact inversion of what it exists to detect.
 * CI caught the first; the second had never been run on Node 20.
 *
 * WHY THREE LINES AND NOT ONE
 * This repo is CommonJS, so under `tsx` a **static** `import … from
 * 'nostr-tools/pool'` resolves the package's `require` condition (the CJS build)
 * while a **dynamic** `await import('nostr-tools/pool')` resolves its `import`
 * condition (the ESM build). Those are two separate module instances with two
 * separate `_WebSocket` variables, and our two callers use one each:
 * `fetchSharedFavorites` dynamic-imports the pool (ESM), while the probe builds
 * its own `SimplePool` from a static import (CJS). Patching one leaves the other
 * silently broken — measured, when this was written as the obvious one-liner.
 * So: set the global for any copy not yet loaded, then inject into both copies.
 */

// Static — reaches the CJS instance, whose `_WebSocket` was already captured
// (as undefined) when this module was imported. Aliased away from its `use…`
// name because eslint's `react-hooks/rules-of-hooks` reads any `useFoo()` call
// as a React hook and errors on it — an error, not a warning, so it fails
// `next lint` in CI.
import { useWebSocketImplementation as setCjsWebSocket } from 'nostr-tools/pool';

let installed = false;

/**
 * No-op in a browser and on Node >= 21. Safe to call more than once; call it
 * before constructing a `SimplePool` or reading from a relay.
 */
export async function installNodeWebSocket(): Promise<void> {
  if (installed) return;
  if (typeof (globalThis as any).WebSocket !== 'undefined') return;

  const { default: WS } = await import('ws');

  (globalThis as any).WebSocket = WS; // for any copy loaded from here on
  setCjsWebSocket(WS); // the CJS copy (the probe's own pool)
  const esm = await import('nostr-tools/pool');
  esm.useWebSocketImplementation(WS); // the ESM copy (fetchSharedFavorites')

  installed = true;
}
