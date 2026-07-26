// Pure helpers behind the Community tab.
// Repo has NO jest/vitest — node:test + tsx is the pattern.
//   npx tsx --test lib/nostr/community-favorites.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Event } from 'nostr-tools';

import {
  parseFavoriteEvent,
  dedupeReplaceable,
  collectDeletions,
  applyDeletions,
  chunkAuthors,
  buildFavoriteFilters,
  buildCommunityRelays,
  pickLatestProfiles,
  rankRelaysByPopularity,
  isExcludedCommunityPubkey,
} from './community-favorites';

const PK_A = 'a'.repeat(64);
const PK_B = 'b'.repeat(64);

function ev(partial: Partial<Event> & { kind: number }): Event {
  return {
    id: partial.id ?? 'id-' + Math.abs(partial.created_at ?? 0),
    pubkey: partial.pubkey ?? PK_A,
    created_at: partial.created_at ?? 1000,
    kind: partial.kind,
    tags: partial.tags ?? [],
    content: partial.content ?? '',
    sig: 'sig',
  } as Event;
}

// ── parseFavoriteEvent ────────────────────────────────────────────────────

test('parses a current-format track favorite', () => {
  const parsed = parseFavoriteEvent(
    ev({ kind: 30001, tags: [['d', 'track-123'], ['t', 'track'], ['title', 'Song']] })
  );
  assert.equal(parsed?.type, 'track');
  assert.equal(parsed?.itemId, 'track-123');
  assert.equal(parsed?.title, 'Song');
});

test('parses a current-format album favorite', () => {
  const parsed = parseFavoriteEvent(ev({ kind: 30001, tags: [['d', 'feed-9'], ['t', 'album']] }));
  assert.equal(parsed?.type, 'album');
  assert.equal(parsed?.itemId, 'feed-9');
});

test('parses legacy trackId and feedId events', () => {
  assert.equal(parseFavoriteEvent(ev({ kind: 30001, tags: [['trackId', 't1']] }))?.type, 'track');
  assert.equal(parseFavoriteEvent(ev({ kind: 30002, tags: [['feedId', 'f1']] }))?.type, 'album');
});

// This is the regression that made the tab pull in every other app's NIP-51 list:
// the old parser defaulted any untyped kind-30001 to 'track'.
test('rejects a foreign NIP-51 list with no type signal', () => {
  assert.equal(parseFavoriteEvent(ev({ kind: 30001, tags: [['d', 'bookmark']] })), null);
  assert.equal(parseFavoriteEvent(ev({ kind: 30002, tags: [['d', 'grasp-servers']] })), null);
  assert.equal(
    parseFavoriteEvent(ev({ kind: 30001, tags: [['d', 'Edufeed/calendar']], content: '{"name":"x"}' })),
    null
  );
});

test('rejects content JSON that is not our shape', () => {
  assert.equal(
    parseFavoriteEvent(ev({ kind: 30001, tags: [['d', 'pdf']], content: '{"id":"whatever"}' })),
    null
  );
});

test('accepts our own content-only shape', () => {
  const parsed = parseFavoriteEvent(
    ev({ kind: 30001, content: JSON.stringify({ type: 'album', id: 'feed-7' }) })
  );
  assert.equal(parsed?.type, 'album');
  assert.equal(parsed?.itemId, 'feed-7');
});

test('rejects a typed event with no item id', () => {
  assert.equal(parseFavoriteEvent(ev({ kind: 30001, tags: [['t', 'track']] })), null);
  assert.equal(parseFavoriteEvent(ev({ kind: 30001, tags: [['d', ''], ['t', 'track']] })), null);
});

test('rejects unrelated kinds', () => {
  assert.equal(parseFavoriteEvent(ev({ kind: 1, tags: [['d', 'x'], ['t', 'track']] })), null);
});

// ── dedupeReplaceable ─────────────────────────────────────────────────────

test('keeps the newest version of a replaceable coordinate', () => {
  const out = dedupeReplaceable([
    ev({ kind: 30001, id: 'old', created_at: 100, tags: [['d', 'x'], ['t', 'track']] }),
    ev({ kind: 30001, id: 'new', created_at: 200, tags: [['d', 'x'], ['t', 'track']] }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'new');
});

test('breaks created_at ties deterministically', () => {
  const a = ev({ kind: 30001, id: 'aaa', created_at: 100, tags: [['d', 'x']] });
  const b = ev({ kind: 30001, id: 'bbb', created_at: 100, tags: [['d', 'x']] });
  assert.equal(dedupeReplaceable([a, b])[0].id, dedupeReplaceable([b, a])[0].id);
});

test('keeps the same d-tag from different pubkeys apart', () => {
  const out = dedupeReplaceable([
    ev({ kind: 30001, id: '1', pubkey: PK_A, tags: [['d', 'x']] }),
    ev({ kind: 30001, id: '2', pubkey: PK_B, tags: [['d', 'x']] }),
  ]);
  assert.equal(out.length, 2);
});

test('ignores events with no d tag', () => {
  assert.equal(dedupeReplaceable([ev({ kind: 30001, tags: [['t', 'track']] })]).length, 0);
});

// ── deletions ─────────────────────────────────────────────────────────────

test('an author can delete their own favorite', () => {
  const fav = ev({ kind: 30001, id: 'fav1', pubkey: PK_A, tags: [['d', 'x'], ['t', 'track']] });
  const del = ev({ kind: 5, pubkey: PK_A, tags: [['e', 'fav1']] });
  assert.equal(applyDeletions([fav], collectDeletions([del])).length, 0);
});

test('a deletion signed by someone else is ignored', () => {
  const fav = ev({ kind: 30001, id: 'fav1', pubkey: PK_A, tags: [['d', 'x'], ['t', 'track']] });
  const del = ev({ kind: 5, pubkey: PK_B, tags: [['e', 'fav1']] });
  assert.equal(applyDeletions([fav], collectDeletions([del])).length, 1);
});

test('a coordinate deletion does not kill a later re-favorite', () => {
  const del = ev({ kind: 5, pubkey: PK_A, created_at: 500, tags: [['a', `30001:${PK_A}:x`]] });
  const older = ev({ kind: 30001, id: 'o', pubkey: PK_A, created_at: 400, tags: [['d', 'x']] });
  const newer = ev({ kind: 30001, id: 'n', pubkey: PK_A, created_at: 600, tags: [['d', 'x']] });
  const deletions = collectDeletions([del]);
  assert.equal(applyDeletions([older], deletions).length, 0);
  assert.equal(applyDeletions([newer], deletions).length, 1);
});

test('a coordinate deletion for another pubkey is ignored', () => {
  const del = ev({ kind: 5, pubkey: PK_B, created_at: 500, tags: [['a', `30001:${PK_A}:x`]] });
  const fav = ev({ kind: 30001, id: 'o', pubkey: PK_A, created_at: 400, tags: [['d', 'x']] });
  assert.equal(applyDeletions([fav], collectDeletions([del])).length, 1);
});

// ── chunking and filters ──────────────────────────────────────────────────

test('chunkAuthors splits at the boundary', () => {
  assert.deepEqual(chunkAuthors([], 50), []);
  assert.equal(chunkAuthors(new Array(44).fill('k'), 50).length, 1);
  assert.deepEqual(
    chunkAuthors(new Array(120).fill('k'), 50).map((c) => c.length),
    [50, 50, 20]
  );
});

// Freezes the requirement that made the tab work at all: the query MUST be scoped by
// authors, and MUST filter by type at the relay.
test('every favorite filter is author-scoped', () => {
  const filters = buildFavoriteFilters([PK_A, PK_B]);
  assert.ok(filters.length >= 3);
  for (const f of filters) {
    assert.deepEqual((f as any).authors, [PK_A, PK_B]);
  }
  const typed = filters.find((f) => (f as any)['#t']);
  assert.deepEqual((typed as any)['#t'], ['track', 'album']);
  assert.deepEqual((typed as any).kinds, [30001, 30002]);
  assert.ok(filters.some((f) => (f as any).kinds?.[0] === 5), 'must request deletions');
});

// ── relays and profiles ───────────────────────────────────────────────────

test('buildCommunityRelays dedupes, orders and caps', () => {
  const out = buildCommunityRelays(['wss://a', 'wss://b'], ['wss://b', 'wss://c']);
  assert.deepEqual(out, ['wss://a', 'wss://b', 'wss://c']);
  assert.equal(buildCommunityRelays(new Array(50).fill(0).map((_, i) => `wss://r${i}`), []).length, 20);
});

// Regression: user relays used to come first, and since site users declare ~97 relays
// between them the cap evicted every default. The sweep then ran against 20 arbitrary
// mostly-dead hosts — 14.7s instead of 1.7s, and the top contributor's profile came back
// missing because it lives on the defaults we never queried.
test('primary relays survive the cap, secondary ones are what get dropped', () => {
  const defaults = ['wss://nos.lol', 'wss://relay.primal.net'];
  const many = new Array(97).fill(0).map((_, i) => `wss://user${i}.example`);
  const out = buildCommunityRelays(defaults, many);
  assert.equal(out.length, 20);
  assert.deepEqual(out.slice(0, 2), defaults);
  for (const d of defaults) assert.ok(out.includes(d), `${d} must survive the cap`);
});

test('buildCommunityRelays strips unreachable hosts', () => {
  const out = buildCommunityRelays(['wss://nos.lol'], ['wss://127.0.0.1:8081', 'wss://x.local']);
  assert.deepEqual(out, ['wss://nos.lol']);
});

test('rankRelaysByPopularity orders by how many users list each relay', () => {
  const ranked = rankRelaysByPopularity([
    ['wss://shared', 'wss://solo-a'],
    ['wss://shared', 'wss://solo-b'],
    ['wss://shared'],
    null,
  ]);
  assert.equal(ranked[0], 'wss://shared');
  assert.equal(ranked.length, 3);
});

test('excluded test accounts are recognised, case-insensitively', () => {
  const clave = '35aeede13e32b41845dcc8888224b4d0c1bad5de38e894788f26ffa50e8cac78';
  const schilling = '2d24a6c8be568547a14884eec5f78bca8452b536cf5ceb2d1ccbc1ce49ecb316';
  assert.equal(isExcludedCommunityPubkey(clave), true);
  assert.equal(isExcludedCommunityPubkey(clave.toUpperCase()), true);
  assert.equal(isExcludedCommunityPubkey(schilling), true);
  assert.equal(isExcludedCommunityPubkey(PK_A), false);
});

test('rankRelaysByPopularity does not let one user double-count a relay', () => {
  const ranked = rankRelaysByPopularity([['wss://dup', 'wss://dup', 'wss://dup'], ['wss://other', 'wss://other']]);
  assert.equal(ranked.length, 2);
});

test('pickLatestProfiles keeps the newest kind-0 and survives bad JSON', () => {
  const profiles = pickLatestProfiles([
    ev({ kind: 0, pubkey: PK_A, created_at: 1, content: '{"name":"old"}' }),
    ev({ kind: 0, pubkey: PK_A, created_at: 2, content: '{"display_name":"new","picture":"p"}' }),
    ev({ kind: 0, pubkey: PK_B, created_at: 1, content: 'not json' }),
  ]);
  assert.equal(profiles.get(PK_A)?.displayName, 'new');
  assert.equal(profiles.get(PK_A)?.avatar, 'p');
  assert.equal(profiles.get(PK_B), undefined);
});
