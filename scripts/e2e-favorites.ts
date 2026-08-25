#!/usr/bin/env tsx
/**
 * The favorites sync loop, end to end, against the local relay — no account.
 *
 * WHY THIS EXISTS: every other guard on this subsystem is a pure function under
 * `node:test`, and the unit vectors all pass over the bugs that actually
 * shipped. `content` had eleven test vectors beside it and none of them touched
 * it; the republish-from-`groups` bug type-checked; the baseline defects needed
 * TWO cycles before anything looked wrong. The wiring between the pure pieces
 * is where the failures live, and this is the only thing that exercises it.
 *
 * It uses a THROWAWAY key and the local relay, so it publishes nothing under
 * anyone's real npub and touches no production data. Run `npm run relay` first.
 *
 *   npm run relay            # in one terminal
 *   npm run e2e:favorites    # in another
 *
 * What it drives is the real module, not a copy: `fetchSingleList`,
 * `mergeSingleList`, `tagsFromNodes` and `templateFromTags` are imported from
 * `lib/nostr/favorites-single-list.ts`. Only the two things that cannot exist
 * outside a browser are stood in for — the signer (a raw secret key here) and
 * `localStorage` (the published record, passed directly).
 */

import WebSocket from 'ws';
import { finalizeEvent, generateSecretKey, getPublicKey, type Event } from 'nostr-tools/pure';
import { installNodeWebSocket } from '../lib/nostr/node-websocket';
import {
  SINGLE_LIST_KIND,
  LIST_ALT,
  fetchSingleList,
  mergeSingleList,
  groupForSingleList,
  tagsFromNodes,
  templateFromTags,
  publishedRecordFrom,
} from '../lib/nostr/favorites-single-list';
import { itemId, showId, type FavoriteEntry } from '../lib/nostr/pc20-identifiers';

const RELAY = process.env.E2E_RELAY || `ws://127.0.0.1:${process.env.PORT || 7777}`;

let failures = 0;
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const bad = (msg: string) => {
  failures++;
  console.log(`  ❌ ${msg}`);
};
const check = (cond: boolean, msg: string) => (cond ? ok(msg) : bad(msg));

/**
 * An opaque `content`, standing in for another app's NIP-44 private half.
 *
 * Base64 because that is what a NIP-44 payload looks like, but the shape is not
 * the point: this app cannot read it, has no business reading it, and must
 * return it byte for byte regardless.
 */
const FOREIGN_CONTENT = 'AkQBc1lPZ0hlYVh1WkJqc0hRZmpOUFlZQXpQMkVmVkxRPT0/dGhpcw==';

// Real-shaped guids, matching the fixtures in favorites-single-list.test.ts.
const MUSIC_A = '9b024349-ccf0-5f69-a609-6b82873eab3c';
const PUBLISHER_B = 'c31ad2f6-1b7e-5b34-a2a4-6b06d5b0b4e2';

const album = (guid: string, medium?: string): FavoriteEntry => ({ id: showId(guid), medium });
const track = (guid: string, parent: string, medium?: string): FavoriteEntry => ({
  id: itemId(guid),
  feedRef: showId(parent),
  medium,
});

/** Publish a signed event and wait for the relay's OK. */
function publish(event: Event): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RELAY);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`no OK from ${RELAY} within 5s`));
    }, 5000);
    ws.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`cannot reach ${RELAY} — is \`npm run relay\` running? (${err.message})`));
    });
    ws.on('open', () => ws.send(JSON.stringify(['EVENT', event])));
    ws.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString());
      if (msg[0] !== 'OK') return;
      clearTimeout(timer);
      ws.close();
      msg[2] ? resolve() : reject(new Error(`relay refused: ${msg[3]}`));
    });
  });
}

async function main() {
  // Node 20 has no WebSocket global and nostr-tools captures it at module load.
  await installNodeWebSocket();

  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  const relays = [RELAY];

  console.log(`favorites e2e — throwaway key ${pubkey.slice(0, 12)}… against ${RELAY}\n`);

  // -------------------------------------------------------------------------
  console.log('① Another app publishes a list with a private half');
  // -------------------------------------------------------------------------
  // Two entries this app will also hold, one it never will, and a `content` it
  // cannot read. The foreign entry and the foreign content are the two things
  // a republish is most likely to quietly drop.
  const seeded = finalizeEvent(
    {
      kind: SINGLE_LIST_KIND,
      created_at: Math.floor(Date.now() / 1000) - 600,
      content: FOREIGN_CONTENT,
      tags: [
        ['alt', LIST_ALT],
        ['medium', 'music'],
        ['i', `podcast:guid:${MUSIC_A}`],
        ['i', `podcast:publisher:guid:${PUBLISHER_B}`], // a kind this app does not model
        ['k', 'podcast:guid'],
      ],
    },
    sk
  );
  await publish(seeded);
  ok(`seeded ${seeded.tags.length} tags and ${FOREIGN_CONTENT.length} bytes of content`);

  // -------------------------------------------------------------------------
  console.log('\n② This app reads it');
  // -------------------------------------------------------------------------
  const read = await fetchSingleList(pubkey, relays);
  check(read.trustworthy, 'the read is trustworthy — a real EOSE arrived');
  check(read.exists, 'the event was found');
  check(
    read.content === FOREIGN_CONTENT,
    `content captured verbatim (${read.content.length} bytes)`
  );
  if (!read.trustworthy) {
    // Everything below publishes on top of this read. Rule 1 of the spec: a
    // publish over a read that failed is the whole list, and it is the one
    // mistake this format makes unrecoverable.
    bad('read degraded — refusing to continue, exactly as the app would');
    return;
  }

  // -------------------------------------------------------------------------
  console.log('\n③ This app favorites something and republishes');
  // -------------------------------------------------------------------------
  const local: FavoriteEntry[] = [
    album(MUSIC_A, 'music'),
    track('a-favorited-track-guid', MUSIC_A, 'music'),
  ];
  const localGroups = groupForSingleList(local);
  const merged = mergeSingleList(read, localGroups, publishedRecordFrom(localGroups));
  const tags = tagsFromNodes(merged.nodes, merged.foreignTags, merged.foreignKinds);

  // From `read.content`, not `''`. This is the line the whole harness is for.
  const template = templateFromTags(tags, Math.floor(Date.now() / 1000), read.content);
  await publish(finalizeEvent(template, sk));
  ok(`republished ${tags.filter((t) => t[0] === 'i').length} entries`);

  // -------------------------------------------------------------------------
  console.log('\n④ The private half survived, and so did the entry we cannot model');
  // -------------------------------------------------------------------------
  const after = await fetchSingleList(pubkey, relays);
  check(after.trustworthy && after.exists, 'the republished event reads back');
  check(
    after.content === FOREIGN_CONTENT,
    after.content === FOREIGN_CONTENT
      ? 'content is byte-identical — the private half survived'
      : `content CHANGED: ${after.content.length} bytes, expected ${FOREIGN_CONTENT.length}`
  );
  check(after.updatedAt > read.updatedAt, 'created_at moved, so this really was a republish');
  check(
    after.nodes.some((n) => n.t === 'loose' && n.loose.tag[1]?.includes('podcast:publisher:guid')),
    'the publisher entry this app cannot model is still on the list'
  );

  // -------------------------------------------------------------------------
  console.log('\n⑤ A second cycle changes nothing');
  // -------------------------------------------------------------------------
  // Idempotence, and the reason it gets its own step: a merge that is not
  // idempotent makes two apps rewrite the event against each other forever,
  // each publish locally reasonable, the only symptom being that it never
  // stops. This is also where a ciphertext comparison would fail once the
  // private half is real — NIP-44 draws a fresh nonce every time.
  const merged2 = mergeSingleList(after, localGroups, publishedRecordFrom(localGroups));
  const tags2 = tagsFromNodes(merged2.nodes, merged2.foreignTags, merged2.foreignKinds);
  check(JSON.stringify(tags2) === JSON.stringify(tags), 'the tags are byte-identical, so nothing republishes');
  check(after.content === read.content, 'content is unchanged, so nothing rewrites it');

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\ne2e threw:', e.message);
  process.exit(1);
});
