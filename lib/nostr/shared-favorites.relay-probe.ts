/**
 * npx tsx lib/nostr/shared-favorites.relay-probe.ts [npub|hex]
 *
 * Real-relay smoke check for the cross-app favorites read. Complements
 * `shared-favorites.relay.test.ts`, which scripts LOCAL relays — the two cover
 * different things and neither replaces the other:
 *
 *   - The test file covers what a correct relay will never do on request: hang,
 *     serve another user's event, serve a tampered one, refuse to connect. That
 *     is where both `trustworthy` bugs were found, and it needs fake relays.
 *   - This probe covers what fake relays can't tell you: whether the relays the
 *     app actually ships still work, today, from this machine.
 *
 * The second is the failure that has now bitten twice — `relay.nsec.app`
 * returning 502 for months, then `nostr.oxtr.dev` blackholing connections —
 * because nothing prunes a dead default automatically (`filterReachableRelays`
 * only pattern-matches localhost-style URLs). Neither showed up as an error;
 * both just made every read slower until someone measured.
 *
 * READ-ONLY. It never signs and never publishes — there is deliberately no
 * import of the sync/publish path here, so running it against a real key
 * cannot alter that key's list.
 *
 * Not part of `npx tsx --test` runs: it needs the network, and a relay having a
 * bad afternoon should not fail an unrelated test suite. Run it when touching
 * relay code, or when a read seems slow.
 *
 * Exits non-zero if a check fails, so it can gate a deploy if you ever want it to.
 */

import { nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import { getDefaultRelays } from './relay';
import {
  fetchSharedFavorites,
  identifierKind,
  partitionSharedFavorites,
  SHARED_D_TAG,
  SHARED_FAVORITES_KIND,
} from './shared-favorites';

// Chad's key — the account trialling the sync. Override with an argument.
const DEFAULT_NPUB = 'npub177fz5zkm87jdmf0we2nz7mm7uc2e7l64uzqrv6rvdrsg8qkrg7yqx0aaq7';

const CONNECT_BUDGET_MS = 8_000;

let failures = 0;
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const bad = (msg: string) => {
  failures += 1;
  console.log(`  ❌ ${msg}`);
};

function toPubkey(input: string): string {
  if (input.startsWith('npub1')) return nip19.decode(input).data as string;
  return input.toLowerCase();
}

/** Per-relay: does it connect, and does it send a REAL eose? */
async function healthCheck(relays: string[]) {
  console.log(`\n① Relay health — ${relays.length} defaults from getDefaultRelays()`);
  const pool = new SimplePool();
  // A key with certainly no list, so every relay's honest answer is "nothing".
  const nobody = getPublicKey(generateSecretKey());
  let live = 0;

  for (const url of relays) {
    const started = Date.now();
    try {
      const relay: any = await (pool as any).ensureRelay(url, {
        connectionTimeout: CONNECT_BUDGET_MS,
      });
      const connectedMs = Date.now() - started;
      const eosed = await new Promise<boolean>((resolve) => {
        const sub = relay.subscribe(
          [{ kinds: [SHARED_FAVORITES_KIND], authors: [nobody], '#d': [SHARED_D_TAG] }],
          {
            // Disable the library's synthetic EOSE: only a real one counts here,
            // for the same reason it doesn't count in fetchSharedFavorites.
            eoseTimeout: CONNECT_BUDGET_MS * 10,
            oneose() {
              sub.close();
              resolve(true);
            },
          }
        );
        setTimeout(() => {
          try {
            sub.close();
          } catch {
            /* already closed */
          }
          resolve(false);
        }, CONNECT_BUDGET_MS);
      });
      if (eosed) {
        live += 1;
        ok(`${url} — connect ${connectedMs}ms, eose ${Date.now() - started}ms`);
      } else {
        bad(`${url} — connected but sent NO eose in ${CONNECT_BUDGET_MS}ms (hung; reads degrade)`);
      }
    } catch (e: any) {
      bad(`${url} — no connection: ${e?.message || e}`);
    }
  }

  try {
    pool.close(relays);
  } catch {
    /* nothing open */
  }
  if (live === 0) bad('NO default relay answered — every read will be degraded');
  return live;
}

/** A key with no list must read as trustworthy-empty, or a first publish never happens. */
async function emptyRead(relays: string[]) {
  console.log('\n② A key with no list — must be a TRUSTED empty read');
  const started = Date.now();
  const r = await fetchSharedFavorites(getPublicKey(generateSecretKey()), relays);
  const ms = Date.now() - started;

  if (r.exists) bad(`a fresh key somehow has a list (${r.items.length} items)`);
  else if (!r.trustworthy) {
    bad(`trustworthy=false in ${ms}ms — a genuine empty list reads as a failure, so this app could never make its FIRST publish`);
  } else ok(`trustworthy empty in ${ms}ms`);
}

/** The real account: reads, parses, and looks like the format says it should. */
async function realRead(relays: string[], pubkey: string) {
  console.log(`\n③ The live list for ${pubkey.slice(0, 12)}…`);
  const started = Date.now();
  const r = await fetchSharedFavorites(pubkey, relays);
  const ms = Date.now() - started;

  if (!r.trustworthy) {
    bad(`degraded read in ${ms}ms — nothing reachable answered`);
    return;
  }
  if (!r.exists) {
    console.log(`  ℹ️  no list published for this key yet (trusted empty, ${ms}ms)`);
    return;
  }

  ok(`read ${r.items.length} items in ${ms}ms (updated ${new Date(r.updatedAt * 1000).toISOString()})`);

  const { shows, tracks } = partitionSharedFavorites(r.items);
  const carried = r.items.length - shows.length - tracks.length;
  console.log(`     shows ${shows.length} · tracks ${tracks.length} · carried-but-unresolvable ${carried}`);

  // Wire-format sanity. A drift here has no visible symptom other than another
  // app quietly failing to see these favorites.
  const unknown = r.items.filter((i) => !identifierKind(i.id));
  if (unknown.length) {
    console.log(`     ⚠️  ${unknown.length} identifier(s) of a kind this app doesn't recognize — carried verbatim, which is correct; listed in case it's a typo on our side:`);
    for (const u of unknown.slice(0, 3)) console.log(`        ${u.id}`);
  }

  // Position 3 is a SHOULD in the spec: without the parent feed guid, another
  // app can't resolve the item through PI's /episodes/byguid.
  const missingParent = tracks.filter((t) => !t.feedGuid).length;
  if (missingParent) {
    console.log(`     ℹ️  ${missingParent}/${tracks.length} tracks lack the position-3 parent feed guid (their Feed.guid is null in the DB — fix is an admin reparse, not a code change)`);
  }
}

async function main() {
  const arg = process.argv[2];
  const pubkey = toPubkey(arg || DEFAULT_NPUB);
  const relays = getDefaultRelays();

  console.log('Cross-app favorites — real-relay smoke check (read-only, never publishes)');

  await healthCheck(relays);
  await emptyRead(relays);
  await realRead(relays, pubkey);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('probe threw:', e);
  process.exit(1);
});
