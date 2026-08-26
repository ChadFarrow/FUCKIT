/**
 * npx tsx --test lib/nostr/boost-item-guid.test.ts
 *
 * Pins the SOURCES of a boost's item guid (#242). `boost-note.test.ts` pins
 * what `podcastIdentifierTags` does with a guid; nothing pinned what it is
 * handed. Five call sites fell back to a StableKraft row id when the RSS
 * `<item>` guid was null, so a public boost note carried
 * `["i", "podcast:item:guid:<stablekraft-slug>"]` — an identifier no other app
 * can resolve, colliding with nothing because it is ours alone. Two more built
 * the same value into the Helipad `remote_item_guid`/`episode_guid` TLV, where
 * an artist reads it.
 *
 * That was near-harmless while the notes were unfindable. #237 added the `k`
 * tags that make them discoverable, so an indexer now actually tries to
 * resolve these and gets nothing.
 *
 * SOURCE-SCANNED rather than unit-tested because every one of these sites is a
 * component, a hook or a route handler, and `npm run test:all` globs `lib/`
 * and one level below — nothing under `components/`, `app/`, `contexts/` or
 * `hooks/` is reachable any other way. Same technique, and the same reason, as
 * `admin-route-policy.test.ts` parsing `middleware.ts`.
 *
 * The rule is a WHITELIST, not a blacklist: a fallback on one of these lines
 * must be `null`, `undefined`, or another guid. A blacklist of id-shaped names
 * would pass the moment someone introduced a name it had not heard of, which
 * is precisely how this defect spread to seven files.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Every file that decides what becomes `podcast:item:guid` on a note or
 * `remote_item_guid`/`episode_guid` in a TLV. The catalog mapper is here
 * because its `guid`/`episodeGuid` fields are what `AlbumCard` later hands to
 * `BoostButton` — the fallback used to be applied twice over, once in the
 * route and again in the component.
 *
 * `lib/catalog/album-shape.ts` replaced the two route entries this list used
 * to carry (`app/api/albums-fast/route.ts` and `app/api/feeds/recent/route.ts`),
 * which held three copies of that object literal between them. Neither route
 * names an item guid any more; both call `feedToAlbum`. That is the whole
 * point of the shared mapper, and it is why the vacuity test below matters:
 * it is what noticed the move.
 */
const SITES = [
  'components/AlbumCard.tsx',
  'app/favorites/page.tsx',
  'lib/catalog/album-shape.ts',
  'components/Lightning/BoostButton.tsx',
  'contexts/AudioContext.tsx',
  'hooks/useAutoBoost.ts',
];

/**
 * A line that carries an item guid. Deliberately matches a MENTION, not only
 * an assignment: `if (episodeGuid || trackId)` is a guard, not an assignment,
 * and it is where BoostButton's own copy of the defect lived.
 *
 * `\bguid:` does not match `feedGuid:` or `remoteFeedGuid:` — those are the
 * feed's `<podcast:guid>`, a different identifier with its own honest
 * `|| null`, and they were never the bug.
 */
const MENTIONS_ITEM_GUID = /remote_item_guid|episode_guid|episodeGuid|\bguid:\s/;

/**
 * `null`, `undefined`, or another guid. Nothing else may back an item guid.
 *
 * The value expression may contain parentheses and braces — `(album as any).guid`
 * is a real one — but never a comma or a semicolon: those end the expression,
 * and letting the scan cross one would allow `|| album.id, // real guid below`
 * to validate itself against a word from the next field or a comment.
 */
const ALLOWED_FALLBACK = /^(?:null\b|undefined\b|[^,;\n]*[Gg]uid\b)/;

/**
 * The two Helipad TLV fields, and what is assigned to them. Unlike the loose
 * scan above this reads the WHOLE right-hand side, which is what catches a
 * direct `metadata.remote_item_guid = trackId;` — no `||` anywhere, and
 * therefore invisible to a fallback scan. Safe to be this strict only because
 * these two snake_case names appear nowhere except their own assignment: no
 * type declaration, no prop, no destructuring.
 */
const TLV_ASSIGNMENT = /\b(?:remote_item_guid|episode_guid)\s*=\s*([^;]+);/;

/** The exact fallbacks #242 removed. Named so a revert has to argue with a test. */
const REMOVED = [
  'guid || album.id',
  'track.guid || track.id',
  'feed.Track?.[0]?.guid || feed.id',
  'episodeGuid || trackId',
];

const read = (file: string) =>
  readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').split('\n');

/** The `||` right-hand sides on one line, in order. */
function fallbacks(line: string): string[] {
  // Split on `||` only. A lone `|` is a union type (`string | null`) or a
  // bitwise op, and neither is a fallback.
  return line.split('||').slice(1).map((s) => s.trim());
}

test('no item guid falls back to an internal StableKraft id', () => {
  for (const file of SITES) {
    read(file).forEach((line, n) => {
      if (!MENTIONS_ITEM_GUID.test(line)) return;
      for (const rhs of fallbacks(line)) {
        assert.ok(
          ALLOWED_FALLBACK.test(rhs),
          `${file}:${n + 1} backs an item guid with \`${rhs}\` — if that is a ` +
            `StableKraft row id it is published as podcast:item:guid and ` +
            `resolves nowhere (#242). Use null/undefined and let the tag be ` +
            `omitted.\n    ${line.trim()}`
        );
      }
    });
  }
});

test('the scan is not vacuous — every site still carries an item guid', () => {
  // Without this, renaming the field past MENTIONS_ITEM_GUID would make the
  // test above pass by checking nothing at all.
  for (const file of SITES) {
    assert.ok(
      read(file).some((line) => MENTIONS_ITEM_GUID.test(line)),
      `${file} no longer mentions an item guid — either it moved, and this ` +
        `list needs updating, or MENTIONS_ITEM_GUID has stopped matching it`
    );
  }
});

test('the Helipad item-guid TLV is assigned a guid or not at all', () => {
  for (const file of SITES) {
    read(file).forEach((line, n) => {
      const m = TLV_ASSIGNMENT.exec(line);
      if (!m) return;
      assert.ok(
        ALLOWED_FALLBACK.test(m[1].trim()),
        `${file}:${n + 1} sets a Helipad item-guid TLV to \`${m[1].trim()}\` — ` +
          `an artist reads that field expecting an RSS <item> guid (#242).\n    ${line.trim()}`
      );
    });
  }
});

test('none of the fallbacks #242 removed has come back anywhere', () => {
  // Belt to the scans' braces, and the more legible failure of the two: these
  // are the literal expressions from the issue's own table.
  for (const file of SITES) {
    const source = read(file).join('\n');
    for (const gone of REMOVED) {
      assert.ok(
        !source.includes(gone),
        `${file} contains \`${gone}\` again — an internal id published as ` +
          `podcast:item:guid (#242)`
      );
    }
  }
});

test('the whitelist accepts what it should and refuses what it should not', () => {
  // The regex is the whole test above, so it gets its own assertions.
  for (const ok of ['null', 'null,', 'undefined', 'undefined}', 'track.guid', 'feed.Track?.[0]?.guid || null',
                    "track.valueForValue?.itemGuid", '(album as any).guid']) {
    assert.ok(ALLOWED_FALLBACK.test(ok), `should accept: ${ok}`);
  }
  for (const bad of ['album.id', 'track.id', 'trackId', 'feed.id,', 'feed.id, // Episode GUID for Helipad TLV',
                     'trackId;', '`${feed.id}-${track.title}`']) {
    assert.ok(!ALLOWED_FALLBACK.test(bad), `should refuse: ${bad}`);
  }
});
