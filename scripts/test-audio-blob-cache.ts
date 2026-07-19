import { test } from 'node:test';
import assert from 'node:assert';
import { NextTrackBlobCache } from '../lib/audio-blob-prefetch.ts';

// Fakes that record create/revoke calls and mint deterministic URLs.
function makeCache() {
  const created: string[] = [];
  const revoked: string[] = [];
  let n = 0;
  const create = (_b: Blob) => { const u = `blob:fake/${++n}`; created.push(u); return u; };
  const revoke = (u: string) => { revoked.push(u); };
  const cache = new NextTrackBlobCache(create, revoke);
  return { cache, created, revoked };
}
const B = () => new Blob(['x']);

test('prepareNext stores a blob retrievable by key', () => {
  const { cache, created } = makeCache();
  cache.prepareNext('urlA', B());
  assert.equal(cache.hasPreparedNext('urlA'), true);
  assert.equal(cache.getPreparedNext('urlA'), created[0]);
  assert.equal(cache.getPreparedNext('other'), null);
});

test('preparing a new next revokes the previous unconsumed next', () => {
  const { cache, created, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.prepareNext('urlB', B());
  assert.deepStrictEqual(revoked, [created[0]]);
  assert.equal(cache.getPreparedNext('urlB'), created[1]);
  assert.equal(cache.hasPreparedNext('urlA'), false);
});

test('promoteToPlaying keeps the promoted blob and clears next (first playing blob not revoked)', () => {
  const { cache, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlA');
  assert.equal(cache.hasPreparedNext('urlA'), false);
  assert.deepStrictEqual(revoked, []);
});

test('a later promote revokes the previously-playing blob', () => {
  const { cache, created, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlA');
  cache.prepareNext('urlB', B());
  cache.promoteToPlaying('urlB');
  assert.deepStrictEqual(revoked, [created[0]]);
});

test('promoteToPlaying with a non-matching key is a no-op', () => {
  const { cache, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlZ');
  assert.equal(cache.hasPreparedNext('urlA'), true);
  assert.deepStrictEqual(revoked, []);
});

test('clearAll revokes both next and playing', () => {
  const { cache, created, revoked } = makeCache();
  cache.prepareNext('urlA', B());
  cache.promoteToPlaying('urlA');
  cache.prepareNext('urlB', B());
  cache.clearAll();
  assert.deepStrictEqual(revoked.slice().sort(), [created[0], created[1]].slice().sort());
});
