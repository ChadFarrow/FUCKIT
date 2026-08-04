import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedUrlLooseVariants,
  buildFeedUrlVariants,
  extractUuidFromUrl,
  generateAlbumHref,
  normalizeUrl,
} from './url-utils';

test('returns a single variant when the url is already normalized', () => {
  const url = 'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml';
  assert.deepEqual(buildFeedUrlVariants(url), [url]);
});

test('puts the normalized form first, raw form second', () => {
  const raw = 'https://headstarts.uk/msp/nat-hills-music/';
  const variants = buildFeedUrlVariants(raw);
  assert.equal(variants[0], normalizeUrl(raw));
  assert.equal(variants[0], 'https://headstarts.uk/msp/nat-hills-music');
  assert.equal(variants[1], raw);
  assert.equal(variants.length, 2);
});

test('normalizes unencoded spaces to %20 and keeps the raw form as a fallback', () => {
  // headstarts.uk ships feeds with literal spaces in the path; older rows may store
  // either form, so both need to be tried.
  const raw = 'https://headstarts.uk/msp/Nathan Abbott/sweet_sunshine/sweet_sunshine.xml';
  const variants = buildFeedUrlVariants(raw);
  assert.equal(variants[0], 'https://headstarts.uk/msp/Nathan%20Abbott/sweet_sunshine/sweet_sunshine.xml');
  assert.equal(variants[1], raw);
});

test('dedupes the normalized form across inputs but keeps each distinct raw form', () => {
  // refresh-by-url passes both resolvedUrl and originalUrl; they usually normalize to the
  // same thing. The shared normalized form appears once, while a raw form that differs
  // stays as a fallback (a row may have been stored pre-normalization).
  const variants = buildFeedUrlVariants(
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml',
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml/'
  );
  assert.deepEqual(variants, [
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml',
    'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml/',
  ]);
});

test('emits exactly one variant when both inputs are identical', () => {
  const url = 'https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml';
  assert.deepEqual(buildFeedUrlVariants(url, url), [url]);
});

test('skips null/undefined/empty inputs', () => {
  const url = 'https://example.com/feed.xml';
  assert.deepEqual(buildFeedUrlVariants(null, url, undefined, ''), [url]);
  assert.deepEqual(buildFeedUrlVariants(null, undefined), []);
});

test('lowercases the host but does NOT collapse path case', () => {
  // Path casing is the case-insensitive DB rung's job (lib/feed-lookup.ts), not the
  // variant builder's — asserting it here so a future "simplification" that lowercases
  // the whole URL in normalizeUrl trips a test instead of silently changing storage.
  const variants = buildFeedUrlVariants('https://HeadStarts.UK/msp/Nat_Hills_Music.xml');
  assert.equal(variants[0], 'https://headstarts.uk/msp/Nat_Hills_Music.xml');
  assert.ok(variants.every(v => v.includes('Nat_Hills_Music.xml')));
});

test('preserves an unparseable url as-is rather than dropping it', () => {
  assert.deepEqual(buildFeedUrlVariants('not-a-url'), ['not-a-url']);
});

test('loose variants add the decoded form for a %20-encoded url', () => {
  // 69 prod rows store literal spaces in originalUrl (written by paths off the ladder),
  // while podpings broadcast the %20 form — without the decoded variant those rows are
  // invisible and the consumer mints a duplicate.
  const encoded = 'https://headstarts.uk/msp/Nathan%20Abbott/oh-my/oh-my_on-the-shelf.xml';
  const variants = buildFeedUrlLooseVariants(encoded);
  assert.equal(variants[0], encoded, 'exact form stays first');
  assert.ok(
    variants.includes('https://headstarts.uk/msp/Nathan Abbott/oh-my/oh-my_on-the-shelf.xml'),
    'literal-space form is offered'
  );
});

test('loose variants cover both directions from either input form', () => {
  const encoded = 'https://headstarts.uk/msp/fable%20music/the%20raven/the%20raven.xml';
  const spaced = 'https://headstarts.uk/msp/fable music/the raven/the raven.xml';

  assert.ok(buildFeedUrlLooseVariants(encoded).includes(spaced));
  // The encode direction already worked via normalizeUrl; assert it still does.
  assert.ok(buildFeedUrlLooseVariants(spaced).includes(encoded));
});

test('loose variants decode reserved characters back to the stored form', () => {
  const encoded = 'https://music.behindthesch3m3s.com/wp-content/uploads/2023/07/Tempest%20%5B4-Tracks%5D.xml';
  assert.ok(
    buildFeedUrlLooseVariants(encoded).includes(
      'https://music.behindthesch3m3s.com/wp-content/uploads/2023/07/Tempest [4-Tracks].xml'
    )
  );
});

test('loose variants handle an apostrophe in the path', () => {
  const encoded = "https://jimmiebratcher.s3.us-west-1.amazonaws.com/I'm%20Hungry%20Album/im-hungry.xml";
  assert.ok(
    buildFeedUrlLooseVariants(encoded).includes(
      "https://jimmiebratcher.s3.us-west-1.amazonaws.com/I'm Hungry Album/im-hungry.xml"
    )
  );
});

test('loose variants survive a malformed percent escape instead of throwing', () => {
  // decodeURIComponent raises URIError on "%zz"; the undecoded variant must still be offered.
  const url = 'https://example.com/feeds/bad%zz.xml';
  assert.deepEqual(buildFeedUrlLooseVariants(url), [url]);
});

test('loose variants never decode the origin', () => {
  // A blanket decodeURIComponent over the whole string would turn %2F into a slash and
  // could rewrite what reads as the host — decoding is scoped to path/query/hash.
  const url = 'https://example.com/feed%2Fnested.xml';
  const variants = buildFeedUrlLooseVariants(url);
  assert.ok(variants.every(v => v.startsWith('https://example.com/')));
  assert.ok(variants.includes('https://example.com/feed/nested.xml'));
});

test('loose variants preserve an unparseable url as-is', () => {
  assert.deepEqual(buildFeedUrlLooseVariants('not-a-url'), ['not-a-url']);
});

test('loose variants skip null/undefined/empty inputs like the exact builder', () => {
  assert.deepEqual(buildFeedUrlLooseVariants(null, undefined), []);
});

test('extractUuidFromUrl finds a Podhome-style uuid and lowercases it', () => {
  assert.equal(
    extractUuidFromUrl('https://serve.podhome.fm/rss/3AEBB7A8-5942-5EE7-A148-8BDC14F1F3D4'),
    '3aebb7a8-5942-5ee7-a148-8bdc14f1f3d4'
  );
});

test('extractUuidFromUrl returns null for self-hosted urls with no uuid', () => {
  // This is why the case-insensitive rung exists: for these feeds the uuid fallback
  // can never fire, so exact-string matching is otherwise the only signal.
  assert.equal(
    extractUuidFromUrl('https://headstarts.uk/msp/nat-hills-music/Nat_Hills_Music.xml'),
    null
  );
});

// --- generateAlbumHref (issue #183) ---

test('same-titled albums get distinct hrefs', () => {
  // Four active feeds are titled exactly "Singles". Under the old title-slug hrefs they
  // all pointed at /album/singles, which resolved to whichever had the most tracks.
  assert.equal(
    generateAlbumHref({ feedId: 'the-horse-heads-singles', title: 'Singles' }),
    '/album/the-horse-heads-singles'
  );
  assert.equal(
    generateAlbumHref({ feedId: 'frankie-peroni-singles', title: 'Singles' }),
    '/album/frankie-peroni-singles'
  );
});

test('prefers feedId over id, because /api/albums mints a synthetic id', () => {
  // app/api/albums/route.ts returns id = `${generateAlbumSlug(title)}-${feed.id.split('-')[0]}`
  // next to the real feedId. Preferring id here would produce /album/singles-the, which
  // resolves to nothing — a regression from "wrong album" to "404".
  assert.equal(
    generateAlbumHref({ id: 'singles-the', feedId: 'the-horse-heads-singles', title: 'Singles' }),
    '/album/the-horse-heads-singles'
  );
});

test('falls back to id when feedId is absent', () => {
  // /api/search and the publisher server page set only `id`.
  assert.equal(
    generateAlbumHref({ id: 'nathan-abbott-singles', title: 'Singles' }),
    '/album/nathan-abbott-singles'
  );
});

test('falls back to the title slug when there is no identifier', () => {
  assert.equal(
    generateAlbumHref({ title: 'Bloodshot Lies - The Album' }),
    '/album/bloodshot-lies'
  );
});

test('treats empty and whitespace-only identifiers as absent', () => {
  assert.equal(
    generateAlbumHref({ feedId: '', id: '   ', title: 'Stay Awhile' }),
    '/album/stay-awhile'
  );
});

test('passes uuid feed ids through unchanged', () => {
  assert.equal(
    generateAlbumHref({ feedId: 'e19d84d9-5916-5095-bc7c-a8ed7bd82f14' }),
    '/album/e19d84d9-5916-5095-bc7c-a8ed7bd82f14'
  );
});
