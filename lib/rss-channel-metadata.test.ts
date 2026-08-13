/**
 * npx tsx --test lib/rss-channel-metadata.test.ts
 *
 * Pins that channel-level tags are found wherever they sit inside `<channel>`.
 *
 * Element order inside `<channel>` is unconstrained by RSS, and real feeds use
 * both layouts. Every reader here used to take "everything before the first
 * `<item>`", which returns nothing at all for a feed that puts its channel
 * metadata after the items — the layout the MSP-generated music feeds use
 * (measured on a live feed: `<podcast:guid>` at byte 17041, first `<item>` at
 * 664).
 *
 * Why this earns a test rather than a comment: it fails SILENTLY and looks like
 * the feed's fault. The parse succeeds, the feed simply appears to declare no
 * guid, no medium and no categories. Consequences seen in production:
 *
 *   - 7 feeds sat with a null `Feed.guid` that no amount of reparsing could
 *     fill, so their tracks couldn't carry the parent-feed hint on the shared
 *     cross-app favorites list (spec position 3).
 *   - `<podcast:medium>` decides album-vs-podcast typing, so those same feeds
 *     read as declaring nothing at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePodcastGuidFromXML, parsePodcastMediumFromXML } from './rss-parser-db';

const GUID = 'c989830b-49a1-572f-9f0e-0fec994a6d5a';

const ITEMS = `
    <item>
      <title>Track one</title>
      <guid isPermaLink="false">item-guid-1</guid>
    </item>
    <item>
      <title>Track two</title>
      <guid isPermaLink="false">item-guid-2</guid>
    </item>`;

const META = `
    <podcast:guid>${GUID}</podcast:guid>
    <podcast:medium>music</podcast:medium>`;

const wrap = (inner: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>A feed</title>${inner}</channel></rss>`;

test('channel metadata BEFORE the items is found (the layout that always worked)', () => {
  const xml = wrap(`${META}${ITEMS}`);
  assert.equal(parsePodcastGuidFromXML(xml), GUID);
  assert.equal(parsePodcastMediumFromXML(xml), 'music');
});

test('channel metadata AFTER the items is found too — this is the regression', () => {
  // Legal RSS, and what the MSP music feeds actually emit. The old
  // "everything before the first <item>" slice returned null here.
  const xml = wrap(`${ITEMS}${META}`);
  assert.equal(parsePodcastGuidFromXML(xml), GUID);
  assert.equal(parsePodcastMediumFromXML(xml), 'music');
});

test('metadata interleaved between items is found', () => {
  const xml = wrap(`
    <item><title>One</title><guid>a</guid></item>
    ${META}
    <item><title>Two</title><guid>b</guid></item>`);
  assert.equal(parsePodcastGuidFromXML(xml), GUID);
  assert.equal(parsePodcastMediumFromXML(xml), 'music');
});

test('a tag inside an ITEM is never read as channel metadata', () => {
  // The whole reason the original code sliced at the first item. Stripping the
  // item blocks has to preserve that property, or an item-level medium would
  // retype the feed.
  const xml = wrap(`
    <item>
      <title>One</title>
      <podcast:guid>11111111-1111-5111-8111-111111111111</podcast:guid>
      <podcast:medium>podcast</podcast:medium>
    </item>`);
  assert.equal(parsePodcastGuidFromXML(xml), null);
  assert.equal(parsePodcastMediumFromXML(xml), null);
});

test('an unclosed <item> falls back to the pre-item slice rather than reading item content', () => {
  // Malformed feed: the strip can't match, so the reader must not start
  // treating item bodies as channel metadata. Narrower, but never wrong.
  const xml = wrap(`
    ${META}
    <item><title>Broken</title>
      <podcast:guid>22222222-2222-5222-8222-222222222222</podcast:guid>`);
  assert.equal(parsePodcastGuidFromXML(xml), GUID, 'the real channel guid still wins');
});

test('no channel element yields null rather than throwing', () => {
  assert.equal(parsePodcastGuidFromXML('<rss></rss>'), null);
  assert.equal(parsePodcastMediumFromXML('<rss></rss>'), null);
});

test('a feed with no such tags yields null', () => {
  const xml = wrap(ITEMS);
  assert.equal(parsePodcastGuidFromXML(xml), null);
  assert.equal(parsePodcastMediumFromXML(xml), null);
});
