#!/usr/bin/env tsx
/**
 * Run the PC20-Nostr favorites conformance suite against this app's merge.
 *
 *   npm run check:conformance
 *
 * The suite lives in the spec's repo, not here, on purpose: a copy would drift
 * from the document the same way a reimplemented check drifts from shipping
 * code. It is found at `../PC20-Nostr` beside this checkout, or wherever
 * `PC20_NOSTR_DIR` points. The adapter it drives is
 * `lib/nostr/favorites-conformance-adapter.ts`, loaded through tsx so the
 * extensionless imports resolve.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = process.env.PC20_NOSTR_DIR ?? path.resolve('..', 'PC20-Nostr');
const suite = path.join(dir, 'conformance', 'vectors.test.mjs');

if (!existsSync(suite)) {
  console.error(
    `conformance: ${suite} not found.\n` +
      'Clone github.com/ChadFarrow/PC20-Nostr beside this repo, or set PC20_NOSTR_DIR to a checkout.'
  );
  process.exit(2);
}

const r = spawnSync('npx', ['tsx', '--test', suite], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PC20_FAVORITES_ADAPTER: path.resolve('lib/nostr/favorites-conformance-adapter.ts'),
  },
});
process.exit(r.status ?? 1);
