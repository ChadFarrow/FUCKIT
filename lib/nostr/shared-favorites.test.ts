/**
 * npx tsx --test lib/nostr/shared-favorites.test.ts
 *
 * Pins the cross-app favorites merge — the function that decides what stays on
 * a Nostr list several apps write to. The same vectors are pinned on the Boost
 * Me Bitch side by `npm run check:favsync`; if you change one, change both, or
 * the two implementations drift apart on a list they share.
 *
 * Why this earns a test file: the shared list is ONE kind:30078 replaceable
 * event at a well-known address (github.com/ChadFarrow/PC20-Nostr, in
 * specs/pc20-favorites.md). A replaceable event has no partial update — every
 * publish replaces the whole thing — so a merge
 * bug doesn't degrade, it DELETES, silently, on someone else's device, with no
 * undo and no error anywhere. The three ways to get it wrong all type-check:
 *
 *   - Publish the local set → every entry another app added is erased.
 *   - Publish the union → unfavoriting stops working, permanently.
 *   - Interpret before merging → identifier kinds this app doesn't implement
 *     get dropped as "unrecognized" the first time this app publishes.
 *
 * The must-still-work half is the removal cases: a merge that never deletes
 * anything is trivially safe and completely useless, so `lastSynced` semantics
 * are pinned in both directions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  baselineFrom,
  SHARED_FAVORITES_KIND,
  identifierKind,
  itemId,
  itemsFromTags,
  mergeSharedFavorites,
  otherTagsFrom,
  partitionSharedFavorites,
  preferSharedFavoritesEvent,
  showId,
  tagsForSharedFavorites,
  SHARED_D_TAG,
  type SharedFavoriteItem,
} from './shared-favorites';

// Real-shaped identifiers. A is an album this app favorited, B a show another
// app added, C a track, D a second album, X an identifier kind this app doesn't
// implement.
//
// The merge vectors below append D, never C, and that is deliberate: C is an
// item identifier, and an item is never originated on THIS list — see "an item
// entry is never originated on the feeds list". Using a track to assert
// append ORDER would make the ordering vector fail for a reason that has
// nothing to do with ordering.
const A = showId('9b024349-ccf0-5f69-a609-6b82873eab3c');
const B = showId('c31ad2f6-1b7e-5b34-a2a4-6b06d5b0b4e2');
const C = itemId('https://example.com/ep/42');
const D = showId('4a7c1e58-2d93-5f04-b6e1-8c5a90d3f2b7');
const X = 'podcast:publisher:guid:0e8f6a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

const ids = (items: SharedFavoriteItem[]) => items.map((i) => i.id);

/**
 * Compare items field by field, in a fixed order, with absent keys and explicit
 * `undefined` treated the same. The wire draws no such distinction — a missing
 * hint is a missing hint — so an assertion about it shouldn't either.
 */
const fields = (items: SharedFavoriteItem[]) =>
  items.map((i) =>
    JSON.parse(
      JSON.stringify({
        id: i.id,
        feedUrl: i.feedUrl,
        feedRef: i.feedRef,
        medium: i.medium,
        raw: i.raw,
      })
    )
  );

test('the shared list is NIP-78 app data, not a NIP-51 bookmark set', () => {
  // Pinned because a drift here has no visible symptom other than "my favorites
  // didn't sync": both apps keep working, they just stop seeing each other.
  //
  // And specifically NOT 30003. Podcast favorites are not bookmarks, and a
  // generic bookmark client editing a set would rewrite this list without any
  // of the merge discipline below.
  assert.equal(SHARED_FAVORITES_KIND, 30078);
  assert.notEqual(SHARED_FAVORITES_KIND, 30003);
});

test('a first publish from a device with no baseline is a pure union', () => {
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [], lastSynced: [], local: [{ id: A }] })),
    [A]
  );
});

test('an entry another app added survives a republish from this app', () => {
  // THE clobber case. Boost Me Bitch added B while this app was closed: B is on
  // the relay but absent from both `local` and `lastSynced`. Publishing the
  // local set here is what wipes the other app's favorites.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: B }], lastSynced: [], local: [{ id: A }] })),
    [B, A]
  );
});

test('a local removal propagates — it was in the baseline and is now gone', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: A }, { id: B }],
        lastSynced: [A, B],
        local: [{ id: B }],
      })
    ),
    [B]
  );
});

test('a local add and a local removal apply on top of a concurrent foreign add', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: A }, { id: X }],
        lastSynced: [A],
        local: [{ id: D }],
      })
    ),
    [X, D]
  );
});

test('an empty local set with no baseline deletes nothing', () => {
  // The single most destructive input: a session that has hydrated nothing yet.
  // With no baseline there are no removals, so the relay's list must survive
  // untouched — an empty `local` must never read as "delete everything".
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: A }, { id: B }], lastSynced: [], local: [] })),
    [A, B]
  );
});

test('an empty local set with a full baseline is a real clear-all', () => {
  // ...but this one IS the user removing everything, and must be honoured, or
  // the list can never be emptied.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: A }, { id: B }], lastSynced: [A, B], local: [] })),
    []
  );
});

test('an identifier kind this app does not implement is never dropped', () => {
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: X }], lastSynced: [], local: [{ id: A }] })),
    [X, A]
  );
});

test('an entry another app removed is NOT resurrected by this app', () => {
  // THE RESURRECTION CASE. Boost Me Bitch unfavorited A and published without
  // it. This app still has A in its DB and A is in its baseline. Appending
  // every local item — the obvious way to write the second loop — puts A
  // straight back, so the user unfavorites there, opens this app, and it
  // returns. Only a genuine local ADD may be appended.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: B }], lastSynced: [A, B], local: [{ id: A }, { id: B }] })),
    [B]
  );
});

test('a never-published local add still goes up', () => {
  // ...and this is what distinguishes it from the case above.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: B }], lastSynced: [B], local: [{ id: A }, { id: B }] })),
    [B, A]
  );
});

test('a foreign id is never written into the baseline', () => {
  // `removes` is `baseline − local`, and `local` only holds what this app can
  // represent. A baseline built from the whole published list therefore makes
  // every foreign identifier a removal on the NEXT publish — this app would
  // delete Boost Me Bitch's episode favorites one toggle later.
  assert.deepEqual(baselineFrom([{ id: B }, { id: X }, { id: A }], [{ id: A }]), [A]);
});

test('so a foreign id survives the SECOND publish too, not just the first', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: X }, { id: A }],
        lastSynced: baselineFrom([{ id: X }, { id: A }], [{ id: A }]),
        local: [{ id: A }],
      })
    ),
    [X, A]
  );
});

test('an entry this app dropped locally leaves the baseline', () => {
  assert.deepEqual(baselineFrom([{ id: A }, { id: B }], [{ id: B }]), [B]);
});

test('surviving entries keep relay order; new local entries append', () => {
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: B }, { id: X }, { id: A }],
        lastSynced: [B, X, A],
        local: [{ id: A }, { id: B }, { id: X }, { id: D }],
      })
    ),
    [B, X, A, D]
  );
});

test('an item entry is never originated on the feeds list', () => {
  // PLACEMENT. This list is `podcast:favorites`; episodes and tracks belong at
  // `podcast:favorites:items`. A track favorited locally and never published
  // must not be appended here, baseline or no baseline — the spec's "writers
  // must never originate an item entry there".
  //
  // The live case this closes: Boost Me Bitch moved 223 track entries to the
  // items list, which drops them out of this app's baseline, and the very next
  // merge would otherwise read all 223 as genuine local adds and put them back
  // on the feeds list. The other app is forbidden to remove them again (not in
  // its baseline), so the entries end up on both lists at once.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: A }], lastSynced: [A], local: [{ id: A }, { id: C }] })),
    [A]
  );
  // ...and the baseline being empty doesn't make it a fresh publish's business
  // either. This is the first-run shape, where every local id looks new.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [], lastSynced: [], local: [{ id: C }, { id: A }] })),
    [A]
  );
});

test('an item entry already on the feeds list is still carried verbatim', () => {
  // The other half, and the one that costs data if it goes missing: refusing to
  // ORIGINATE an item entry here is not licence to drop the ones already
  // present. Every event on the wire written before the split has its tracks on
  // this list — including the four Boost Me Bitch left behind — and they are
  // the user's favorites, written correctly against the spec as it stood.
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: A }, { id: C }],
        lastSynced: [A],
        local: [{ id: A }],
      })
    ),
    [A, C]
  );
  // Even when it is one of ours, still in our baseline, and still favorited
  // locally — carried by the first loop, not re-added by the second.
  assert.deepEqual(
    ids(
      mergeSharedFavorites({
        latest: [{ id: C }],
        lastSynced: [C],
        local: [{ id: C }],
      })
    ),
    [C]
  );
});

test('an item entry in the baseline that the user unfavorited is still removed', () => {
  // The removal path is untouched by the placement guard. `removes` is
  // `baseline − local`, so a track this app put on the feeds list and the user
  // has now unfavorited must still come off it — otherwise the guard would
  // strand every legacy entry this app is responsible for.
  assert.deepEqual(
    ids(mergeSharedFavorites({ latest: [{ id: A }, { id: C }], lastSynced: [A, C], local: [{ id: A }] })),
    [A]
  );
});

test('a local hint upgrades a relay entry that has none', () => {
  assert.deepEqual(
    fields(
      mergeSharedFavorites({
        latest: [{ id: A }],
        lastSynced: [A],
        local: [{ id: A, feedUrl: 'https://example.com/feed.xml', medium: 'music' }],
      })
    ),
    [{ id: A, feedUrl: 'https://example.com/feed.xml', medium: 'music' }]
  );
});

test('a relay hint is never blanked by a local entry that lacks one', () => {
  assert.deepEqual(
    fields(
      mergeSharedFavorites({
        latest: [{ id: A, feedUrl: 'https://example.com/feed.xml', medium: 'music' }],
        lastSynced: [A],
        local: [{ id: A }],
      })
    ),
    [{ id: A, feedUrl: 'https://example.com/feed.xml', medium: 'music' }]
  );
});

test("a hint this app didn't write is not replaced by one it resolved itself", () => {
  // THE STICKINESS CASE, and the one that looks most like a bug when you read
  // it. This app knows the feed says `podcast`; the wire says `music`; the wire
  // wins anyway.
  //
  // "Prefer my own resolved value" is what makes two apps rewrite the event
  // against each other on every publish, forever — neither is wrong, and
  // neither converges. Stickiness terminates. A medium has no evidence channel
  // (unlike a URL, which can be shown to 404), so it is strictly sticky, and a
  // disagreement is a stale hint rather than an error: render your own value,
  // don't republish to correct the wire.
  assert.deepEqual(
    fields(
      mergeSharedFavorites({
        latest: [{ id: A, medium: 'music' }],
        lastSynced: [A],
        local: [{ id: A, medium: 'podcast' }],
      })
    ),
    [{ id: A, medium: 'music' }]
  );
});

test('a medium this app has never heard of survives contact with it', () => {
  // Not overwritten, not dropped, not case-normalized. The Podcasting 2.0
  // medium vocabulary is not a closed set — a value you don't recognize is one
  // a newer app does, and "I don't recognize this, so it's junk" is a judgement
  // only the user gets to make.
  assert.deepEqual(
    fields(
      mergeSharedFavorites({
        latest: [{ id: A, medium: 'somethingL' }],
        lastSynced: [A],
        local: [{ id: A, medium: 'music' }],
      })
    ),
    [{ id: A, medium: 'somethingL' }]
  );
});

// --- wire round trip -------------------------------------------------------

const WIRE_ITEMS: SharedFavoriteItem[] = [
  { id: A, feedUrl: 'https://example.com/feed.xml' },
  { id: C, feedUrl: 'https://example.com/feed.xml', feedRef: A },
  { id: X },
];

test('the d tag is the shared, app-neutral address', () => {
  assert.deepEqual(tagsForSharedFavorites(WIRE_ITEMS)[0], ['d', SHARED_D_TAG]);
});

test("another writer's tag is replayed verbatim", () => {
  const tags = tagsForSharedFavorites(WIRE_ITEMS, [['alt', 'from another client']]);
  assert.deepEqual(
    tags.filter((t) => t[0] === 'alt'),
    [['alt', 'from another client']]
  );
});

test('an album is a NIP-73 i tag with the feed URL as the position-2 hint', () => {
  assert.deepEqual(tagsForSharedFavorites(WIRE_ITEMS).find((t) => t[1] === A), [
    'i',
    A,
    'https://example.com/feed.xml',
  ]);
});

test('a track carries its parent feed in position 3', () => {
  assert.deepEqual(tagsForSharedFavorites(WIRE_ITEMS).find((t) => t[1] === C), [
    'i',
    C,
    'https://example.com/feed.xml',
    A,
  ]);
});

test('k tags are one per distinct identifier kind, not one per favorite', () => {
  assert.deepEqual(
    tagsForSharedFavorites(WIRE_ITEMS).filter((t) => t[0] === 'k'),
    [['k', 'podcast:guid'], ['k', 'podcast:item:guid'], ['k', 'podcast:publisher:guid']]
  );
});

test('a URL-shaped item guid does not corrupt its k tag', () => {
  // Track.guid is very often a permalink URL. Deriving the kind by scanning for
  // a colon yields `podcast:item:guid:https` — a k tag no relay filter matches,
  // and nothing on screen looks wrong.
  assert.equal(identifierKind(itemId('https://example.com/ep/42')), 'podcast:item:guid');
});

test('an unrecognized identifier kind gets no invented k tag', () => {
  assert.equal(identifierKind('some:other:scheme:value'), null);
});

test("but another app's k tag for that kind is preserved, not stripped", () => {
  assert.deepEqual(
    otherTagsFrom([
      ['k', 'some:other:scheme'],
      ['k', 'podcast:guid'],
      ['d', SHARED_D_TAG],
    ]),
    [['k', 'some:other:scheme']]
  );
});

test('tags → items → tags is lossless', () => {
  // What this app writes, a second app must be able to read back identically.
  //
  // NOTE what this test cannot do on its own: its fixture is built from the
  // fields this file knows about, so it is vacuously true about every position
  // past them. It passed for months while the code deleted position 4 and
  // beyond on every publish. The tail-preservation vector below is the one that
  // can actually fail.
  const roundTripped = itemsFromTags(tagsForSharedFavorites(WIRE_ITEMS));
  assert.deepEqual(
    fields(roundTripped).map(({ raw: _raw, ...rest }) => rest),
    fields(WIRE_ITEMS)
  );
  // And the tags themselves must survive a second pass unchanged, which is the
  // property another app actually depends on.
  assert.deepEqual(tagsForSharedFavorites(roundTripped), tagsForSharedFavorites(WIRE_ITEMS));
});

test('a feed ref with no URL hint holds position 2 open', () => {
  assert.deepEqual(tagsForSharedFavorites([{ id: C, feedRef: A }]).find((t) => t[1] === C), [
    'i',
    C,
    '',
    A,
  ]);
  assert.deepEqual(fields(itemsFromTags([['i', C, '', A]])), [
    { id: C, feedRef: A, raw: ['i', C, '', A] },
  ]);
});

// --- position 4: the medium hint -------------------------------------------

test('a medium rides at position 4, holding the positions before it open', () => {
  // Shifting `music` up into position 3 would claim it as a parent feed guid,
  // and every reader would hand it to Podcast Index as `podcastguid`.
  assert.deepEqual(tagsForSharedFavorites([{ id: A, medium: 'music' }])[2], [
    'i',
    A,
    '',
    '',
    'music',
  ]);
  assert.deepEqual(
    tagsForSharedFavorites([{ id: C, feedUrl: 'https://example.com/feed.xml', feedRef: A, medium: 'podcast' }])[2],
    ['i', C, 'https://example.com/feed.xml', A, 'podcast']
  );
});

test('no k tag is ever minted from a medium', () => {
  // Position 4 is a medium, not an identifier kind. A ["k","music"] pollutes
  // the #k discovery filter every app on this list relies on, and an entry
  // hinted `publisher` is still whatever its position-1 identifier says.
  const tags = tagsForSharedFavorites([
    { id: A, medium: 'music' },
    { id: C, feedRef: A, medium: 'podcast' },
    { id: B, medium: 'publisher' },
  ]);
  assert.deepEqual(
    tags.filter((t) => t[0] === 'k'),
    [['k', 'podcast:guid'], ['k', 'podcast:item:guid']]
  );
});

test('a position this parser has no field for survives a republish', () => {
  // TAIL PRESERVATION — the vector that catches what the round-trip test above
  // structurally cannot. The fixture has to contain something no field here can
  // hold, or it pins nothing: a round trip built from your own struct passes
  // while the code truncates everything past it, which is exactly what this
  // file did before.
  //
  // Position 5 belongs to an app newer than this one. Rebuilding the tag from
  // {id, feedUrl, feedRef, medium} deletes it, on every entry, on every
  // publish, with no error and nothing on screen.
  const fromTheWire = [
    ['i', A, 'https://example.com/feed.xml', A, 'music', 'something-new'],
    ['d', SHARED_D_TAG],
  ];
  const republished = tagsForSharedFavorites(
    itemsFromTags(fromTheWire),
    otherTagsFrom(fromTheWire)
  );
  assert.deepEqual(republished.find((t) => t[1] === A), [
    'i',
    A,
    'https://example.com/feed.xml',
    A,
    'music',
    'something-new',
  ]);
});

test('the same inputs twice produce the same event', () => {
  // IDEMPOTENCE. A hint that flip-flops is invisible to any single-pass
  // assertion: each publish looks locally reasonable, and the only symptom is
  // that it never stops. Two apps running "prefer my own value" pass every
  // other test in this file and rewrite the event against each other forever.
  const local = [{ id: A, medium: 'podcast' }];
  const onTheWire = [['i', A, '', '', 'music', 'something-new']];

  const first = tagsForSharedFavorites(
    mergeSharedFavorites({ latest: itemsFromTags(onTheWire), lastSynced: [A], local })
  );
  const second = tagsForSharedFavorites(
    mergeSharedFavorites({
      latest: itemsFromTags(first.filter((t) => t[0] === 'i')),
      lastSynced: [A],
      local,
    })
  );
  assert.deepEqual(second, first);
  assert.deepEqual(first.find((t) => t[1] === A), ['i', A, '', '', 'music', 'something-new']);
});

test('an entry with no medium stays without one', () => {
  // Absent means "not told", not a default. This app defaulting to `music`
  // would be wrong about exactly the half of the list the hint exists to
  // separate — the list carries podcasts and music at once by design.
  assert.deepEqual(tagsForSharedFavorites([{ id: A }])[2], ['i', A]);
  assert.equal(itemsFromTags([['i', A]])[0].medium, undefined);
});

// --- resolution ------------------------------------------------------------

test('partition splits shows from tracks and drops what it cannot look up', () => {
  const { shows, tracks } = partitionSharedFavorites([
    { id: A, feedUrl: 'https://example.com/feed.xml' },
    { id: C, feedUrl: 'https://example.com/feed.xml', feedRef: A },
    { id: X },
    { id: showId('not-a-uuid') },
  ]);
  assert.deepEqual(shows, [
    {
      feedGuid: '9b024349-ccf0-5f69-a609-6b82873eab3c',
      feedUrl: 'https://example.com/feed.xml',
      medium: undefined,
    },
  ]);
  assert.deepEqual(tracks, [
    {
      itemGuid: 'https://example.com/ep/42',
      feedGuid: '9b024349-ccf0-5f69-a609-6b82873eab3c',
      feedUrl: 'https://example.com/feed.xml',
      medium: undefined,
    },
  ]);
});

test('a parent feed guid resolves whether or not it carries the prefix', () => {
  // This app writes the prefixed form and Boost Me Bitch requires it, so that
  // is what it keeps writing (see the header of shared-favorites.ts). But the
  // current spec asks writers to move to a bare uuid, so both forms will be on
  // the wire. Handing a prefixed value to Podcast Index as `podcastguid`
  // matches nothing — the entry silently resolves to nothing while this app
  // republishes it faithfully.
  const bare = '9b024349-ccf0-5f69-a609-6b82873eab3c';
  const { tracks } = partitionSharedFavorites([
    { id: C, feedRef: A },
    { id: itemId('https://example.com/ep/43'), feedRef: bare },
  ]);
  assert.deepEqual(
    tracks.map((t) => t.feedGuid),
    [bare, bare]
  );
});

test('the medium reaches the resolver, on shows and on items alike', () => {
  const { shows, tracks } = partitionSharedFavorites([
    { id: A, medium: 'music' },
    // On an item entry the medium describes the PARENT feed; Podcasting 2.0
    // has no per-item medium.
    { id: C, feedRef: A, medium: 'podcast' },
  ]);
  assert.equal(shows[0].medium, 'music');
  assert.equal(tracks[0].medium, 'podcast');
});

test('what partition drops, the merge still carries', () => {
  // Partitioning is lossy on purpose; the wire is not. The publisher entry and
  // the malformed guid must survive a republish from this app even though it
  // has no way to display either.
  const items = [{ id: A }, { id: X }, { id: showId('not-a-uuid') }];
  assert.equal(ids(mergeSharedFavorites({ latest: items, lastSynced: [], local: [] })).length, 3);
});

test('a show identifier is never read as a track', () => {
  const { tracks } = partitionSharedFavorites([{ id: A }, { id: X }]);
  assert.deepEqual(tracks, []);
});

// --- which event the read trusts -------------------------------------------
//
// `preferSharedFavoritesEvent` is the whole trust decision of the relay read,
// extracted from the subscription closure so it can be exercised without a
// relay. What it CANNOT cover is signature verification — nostr-tools does
// that inside SimplePool before our handler runs — so these events are shaped,
// not signed, and "the user really signed this" is the library's guarantee,
// not one pinned here.

const MINE = 'a'.repeat(64);
const THEIRS = 'b'.repeat(64);
const ev = (pubkey: string, created_at: number) =>
  ({ pubkey, created_at, kind: 30078, tags: [], content: '', id: '', sig: '' }) as any;

test('the first event from the user is taken', () => {
  assert.equal(preferSharedFavoritesEvent(null, ev(MINE, 100), MINE)?.created_at, 100);
});

test('a newer event from the user wins, a stale one does not', () => {
  // A relay merely BEHIND — serving a real but older version — looks exactly
  // as reachable as a current one, so "first answer wins" would quietly read
  // an out-of-date list and then publish a merge on top of it.
  const best = ev(MINE, 100);
  assert.equal(preferSharedFavoritesEvent(best, ev(MINE, 200), MINE)?.created_at, 200);
  assert.equal(preferSharedFavoritesEvent(best, ev(MINE, 50), MINE)?.created_at, 100);
});

test("an event authored by someone else is never taken", () => {
  assert.equal(preferSharedFavoritesEvent(null, ev(THEIRS, 100), MINE), null);
});

test("a foreign event does NOT displace the user's, however new it claims to be", () => {
  // The reason the author check runs at intake instead of on the winner. With
  // the order reversed, this foreign event takes the `best` slot on its
  // created_at, and rejecting it at the end discards the genuine list with it
  // — a good read reported as an empty one, which is precisely the state
  // `trustworthy` exists to keep apart from a real empty list.
  const best = ev(MINE, 100);
  const kept = preferSharedFavoritesEvent(best, ev(THEIRS, 999_999), MINE);
  assert.equal(kept?.pubkey, MINE);
  assert.equal(kept?.created_at, 100);
});
