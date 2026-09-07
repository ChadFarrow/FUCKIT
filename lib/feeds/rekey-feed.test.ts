import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The re-key in `app/api/feeds/refresh-by-url` changes a Feed's primary key.
 *
 * It used to do that by DELETE then CREATE, rebuilding the row field by field.
 * That copy dropped seven columns — markedDead, oldestItemPubdate,
 * lastNewTrackAt, podcastImages, persons, musicShowOnly and createdAt — so a
 * hidden feed un-hid itself, the album lost its release date and its place in
 * the "New" filter, and createdAt reset to now(), reordering the home grid.
 *
 * The sequence could not complete anyway: Track_feedId_fkey is immediate, so
 * repointing tracks at an id that does not exist yet raises 23503, and creating
 * the new row first collides with Feed.originalUrl @unique. Only a track-less
 * feed ever got through, which is why the dropped columns were never noticed.
 *
 * It is now one in-place UPDATE. Track_feedId_fkey is ON UPDATE CASCADE, so the
 * tracks follow the key in the same statement, and nothing is copied — which is
 * what makes the dropped-column bug unreachable rather than merely fixed.
 *
 * This test guards the shape, because a column copy is the tempting thing to
 * write here and it type-checks perfectly.
 */

const ROUTE = join(process.cwd(), 'app/api/feeds/refresh-by-url/route.ts');
const source = readFileSync(ROUTE, 'utf8');

test('the source this test scans is actually there', () => {
  assert.ok(source.length > 1000, 'refresh-by-url/route.ts did not load — the test would be vacuous');
  assert.match(source, /customFeedId !== feed\.id/, 'the re-key branch has moved or been renamed');
});

test('the re-key is an in-place UPDATE of the primary key', () => {
  assert.match(
    source,
    /UPDATE "Feed" SET "id" =/,
    'the re-key must update the key in place so Track_feedId_fkey cascades'
  );
});

test('the re-key never deletes the feed row', () => {
  assert.doesNotMatch(
    source,
    /prisma\.feed\.delete/,
    'delete-then-create loses columns and cannot satisfy originalUrl @unique'
  );
});

test('the re-key never repoints tracks by hand', () => {
  assert.doesNotMatch(
    source,
    /prisma\.track\.updateMany/,
    'ON UPDATE CASCADE moves the tracks; a manual updateMany raises 23503'
  );
});
