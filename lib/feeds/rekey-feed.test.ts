import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Feed } from '@prisma/client';
import { buildRekeyedFeedData, REKEY_INTENTIONALLY_OMITTED } from './rekey-feed';

/**
 * Scalar field names of one model in schema.prisma.
 *
 * Relations are skipped by type: a field whose type resolves to another model
 * (capitalised, not a Prisma scalar) is not a column.
 */
function scalarFieldsOf(model: string): string[] {
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `model ${model} not found in schema.prisma`);

  const SCALARS = new Set([
    'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes',
  ]);

  const fields: string[] = [];
  for (const line of block[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
    const m = trimmed.match(/^(\w+)\s+(\w+)/);
    if (!m) continue;
    const [, name, type] = m;
    if (SCALARS.has(type)) fields.push(name);
  }
  return fields;
}

function fakeFeed(): Feed {
  return {
    id: 'old-id',
    title: 'An Album',
    description: 'desc',
    originalUrl: 'https://example.com/feed.xml',
    cdnUrl: null,
    type: 'album',
    artist: 'An Artist',
    image: 'https://example.com/art.jpg',
    language: 'en',
    category: 'Music',
    explicit: false,
    priority: 'normal',
    status: 'active',
    lastFetched: new Date('2026-01-01T00:00:00Z'),
    lastError: null,
    createdAt: new Date('2020-05-05T00:00:00Z'),
    updatedAt: new Date('2026-02-02T00:00:00Z'),
    guid: 'a-guid',
    publisherId: 'pub-1',
    v4vRecipient: 'chad@example.com',
    v4vValue: { recipients: [] },
    podcastCategories: ['Music'],
    oldestItemPubdate: new Date('2019-03-03T00:00:00Z'),
    persons: [{ name: 'Someone' }],
    podcastImages: [{ srcset: 'x' }],
    musicShowOnly: true,
    medium: 'music',
    lastNewTrackAt: new Date('2025-12-12T00:00:00Z'),
    markedDead: true,
  } as Feed;
}

/**
 * The regression test. Before this, the copy in refresh-by-url listed 22 of 29
 * scalar columns and carried a comment claiming it was complete.
 */
test('every scalar column of Feed is carried across a re-key', () => {
  const produced = new Set(Object.keys(buildRekeyedFeedData(fakeFeed(), { id: 'new-id' })));
  const missing = scalarFieldsOf('Feed').filter(
    (f) => !produced.has(f) && !REKEY_INTENTIONALLY_OMITTED.includes(f)
  );
  assert.deepEqual(
    missing,
    [],
    `these columns would be SILENTLY DROPPED by a re-key: ${missing.join(', ')}`
  );
});

test('the seven columns that used to be dropped keep their values', () => {
  const old = fakeFeed();
  const data = buildRekeyedFeedData(old, { id: 'new-id' });

  // markedDead is the worst of them: losing it un-hides a hidden feed.
  assert.equal(data.markedDead, true);
  assert.deepEqual(data.oldestItemPubdate, old.oldestItemPubdate);
  assert.deepEqual(data.lastNewTrackAt, old.lastNewTrackAt);
  assert.deepEqual(data.podcastImages, old.podcastImages);
  assert.deepEqual(data.persons, old.persons);
  assert.equal(data.musicShowOnly, true);
  assert.deepEqual(data.createdAt, old.createdAt, 'a reset reorders the home grid');
});

test('the id is replaced and everything else identifying is kept', () => {
  const old = fakeFeed();
  const data = buildRekeyedFeedData(old, { id: 'new-id' });
  assert.equal(data.id, 'new-id');
  assert.equal(data.guid, old.guid);
  assert.equal(data.originalUrl, old.originalUrl);
  assert.equal(data.publisherId, old.publisherId);
});

test('type can be overridden, and falls back to the old value', () => {
  const old = fakeFeed();
  assert.equal(buildRekeyedFeedData(old, { id: 'n', type: 'podcast' }).type, 'podcast');
  assert.equal(buildRekeyedFeedData(old, { id: 'n' }).type, 'album');
  assert.equal(buildRekeyedFeedData(old, { id: 'n', type: null }).type, 'album');
  assert.equal(buildRekeyedFeedData(old, { id: 'n', type: '' }).type, 'album');
});

test('updatedAt is refreshed, not carried', () => {
  const old = fakeFeed();
  const data = buildRekeyedFeedData(old, { id: 'new-id' });
  assert.notDeepEqual(data.updatedAt, old.updatedAt);
  assert.ok(data.updatedAt instanceof Date);
});

// `medium` is what the feed DECLARED. CLAUDE.md: nothing may default it, because
// only `medium` goes on the cross-app favorites list where a guess is sticky.
test('a null medium stays null — a re-key never invents one', () => {
  const old = { ...fakeFeed(), medium: null } as Feed;
  assert.equal(buildRekeyedFeedData(old, { id: 'n' }).medium, null);
});

test('null Json columns become undefined, which Prisma accepts', () => {
  const old = { ...fakeFeed(), v4vValue: null, persons: null, podcastImages: null } as Feed;
  const data = buildRekeyedFeedData(old, { id: 'n' });
  assert.equal(data.v4vValue, undefined);
  assert.equal(data.persons, undefined);
  assert.equal(data.podcastImages, undefined);
});
