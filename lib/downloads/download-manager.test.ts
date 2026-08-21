import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DownloadManager, type DownloadsBackend } from './download-manager';
import type { DownloadRecord } from './downloads-db';

/** In-memory backend that counts fetches per key so we can assert dedup. */
function makeFakeBackend() {
  const bytes = new Map<string, number>();
  const records = new Map<string, DownloadRecord>();
  const fetchCounts = new Map<string, number>();
  const images = new Map<string, number>();

  const backend: DownloadsBackend = {
    async downloadBytes(key) {
      fetchCounts.set(key, (fetchCounts.get(key) ?? 0) + 1);
      bytes.set(key, 1000);
      return 1000;
    },
    async deleteBytes(key) {
      bytes.delete(key);
    },
    async getObjectUrl(key) {
      return bytes.has(key) ? `blob:${key}` : null;
    },
    async clearAllBytes() {
      bytes.clear();
    },
    async downloadImage(url) {
      images.set(url, (images.get(url) ?? 0) + 1);
    },
    async getImageObjectUrl(url) {
      return images.has(url) ? `blob:img:${url}` : null;
    },
    async deleteImage(url) {
      images.delete(url);
    },
    async clearAllImages() {
      images.clear();
    },
    async estimateUsage() {
      return { usage: 0, quota: 0 };
    },
    async requestPersistence() {
      return true;
    },
    async putRecord(rec) {
      records.set(rec.key, { ...rec });
    },
    async getAllRecords() {
      return Array.from(records.values());
    },
    async deleteRecord(key) {
      records.delete(key);
    },
    async clearAllRecords() {
      records.clear();
    },
  };

  return { backend, bytes, records, fetchCounts, images };
}

/** Yield to the event loop so parked async work settles. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Fake backend whose `downloadBytes` parks until `releaseAll()` is called, so
 * tests can create genuinely overlapping in-flight downloads and a saturated
 * queue. Wraps makeFakeBackend for storage + fetch counting.
 */
function makeControllableBackend() {
  const base = makeFakeBackend();
  const origDownload = base.backend.downloadBytes;
  const releases: Array<() => void> = [];
  base.backend.downloadBytes = async (key, opts) => {
    await new Promise<void>((resolve) => releases.push(resolve));
    return origDownload(key, opts);
  };
  return {
    ...base,
    releaseAll() {
      while (releases.length) releases.shift()!();
    },
  };
}

const trackA = { url: 'https://cdn.example.com/a.mp3', title: 'A', guid: 'a' };
const trackB = { url: 'https://cdn.example.com/b.mp3', title: 'B', guid: 'b' };
const album = {
  feedId: 'album-1',
  title: 'Album One',
  coverArt: 'https://img/x.jpg',
  tracks: [trackA, trackB],
};

test('downloadTrack marks the track downloaded', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadTrack(trackA);
  assert.equal(mgr.isTrackDownloaded(trackA), true);
  assert.equal(mgr.getDownloadState('https://cdn.example.com/a.mp3').status, 'downloaded');
});

test('a track downloaded individually AND via album shares one cached copy', async () => {
  const { backend, fetchCounts, records } = makeFakeBackend();
  const mgr = new DownloadManager(backend);

  await mgr.downloadTrack(trackA); // owner 'track'
  await mgr.downloadAlbum(album); // owner 'album:album-1' (also covers A)

  // A fetched exactly once despite two owners.
  assert.equal(fetchCounts.get('https://cdn.example.com/a.mp3'), 1);
  const recA = records.get('https://cdn.example.com/a.mp3')!;
  assert.deepEqual(recA.refs.sort(), ['album:album-1', 'track']);
  // B fetched via the album.
  assert.equal(fetchCounts.get('https://cdn.example.com/b.mp3'), 1);
});

test('removing one owner keeps bytes while another owner remains', async () => {
  const { backend, bytes } = makeFakeBackend();
  const mgr = new DownloadManager(backend);

  await mgr.downloadTrack(trackA);
  await mgr.downloadAlbum(album);

  await mgr.removeTrack(trackA); // drop the 'track' owner; album still owns A
  assert.equal(bytes.has('https://cdn.example.com/a.mp3'), true, 'bytes survive');
  assert.equal(mgr.isTrackDownloaded(trackA), true);
});

test('removing the last owner evicts bytes and record', async () => {
  const { backend, bytes, records } = makeFakeBackend();
  const mgr = new DownloadManager(backend);

  await mgr.downloadAlbum(album);
  await mgr.removeAlbum(album);

  assert.equal(bytes.has('https://cdn.example.com/a.mp3'), false);
  assert.equal(bytes.has('https://cdn.example.com/b.mp3'), false);
  assert.equal(records.size, 0);
  assert.equal(mgr.isTrackDownloaded(trackA), false);
});

test('album cover is cached on download once, and evicted with the last track', async () => {
  const { backend, images } = makeFakeBackend();
  const mgr = new DownloadManager(backend);

  await mgr.downloadAlbum(album); // cover 'https://img/x.jpg'
  assert.equal(images.get('https://img/x.jpg'), 1, 'cover fetched exactly once');
  assert.equal(await mgr.getCoverObjectUrl('https://img/x.jpg'), 'blob:img:https://img/x.jpg');

  // Removing all but the last track keeps the cover; the last removal evicts it.
  await mgr.removeTrack(trackA, 'album:album-1');
  assert.equal(images.has('https://img/x.jpg'), true, 'cover kept while a track remains');
  await mgr.removeTrack(trackB, 'album:album-1');
  assert.equal(images.has('https://img/x.jpg'), false, 'cover evicted with the last track');
});

test('album state aggregates per-track progress', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);
  const state = mgr.getAlbumState(album);
  assert.equal(state.status, 'downloaded');
  assert.equal(state.done, 2);
  assert.equal(state.total, 2);
});

test('HLS / video tracks are skipped, not downloaded', async () => {
  const { backend, fetchCounts } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  const hls = { url: 'https://x.com/live.m3u8', title: 'Live' };
  const video = { url: 'https://x.com/clip.mp4', title: 'Clip', mediaType: 'video' };
  await mgr.downloadTrack(hls);
  await mgr.downloadTrack(video);
  assert.equal(fetchCounts.size, 0);
  assert.equal(mgr.isTrackDownloaded(hls), false);
  assert.equal(mgr.isTrackDownloaded(video), false);
});

test('init hydrates downloaded state from persisted records', async () => {
  const { backend, records } = makeFakeBackend();
  records.set('https://cdn.example.com/a.mp3', {
    key: 'https://cdn.example.com/a.mp3',
    title: 'A',
    sizeBytes: 1000,
    createdAt: 1,
    refs: ['track'],
    mediaType: 'audio',
  });
  const mgr = new DownloadManager(backend);
  await mgr.init();
  assert.equal(mgr.isDownloaded('https://cdn.example.com/a.mp3'), true);
  assert.equal(mgr.listDownloads().length, 1);
});

test('clearAllDownloads wipes everything', async () => {
  const { backend, bytes, records } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);
  await mgr.clearAllDownloads();
  assert.equal(bytes.size, 0);
  assert.equal(records.size, 0);
  assert.equal(mgr.listDownloads().length, 0);
});

test('concurrent downloads of the same track dedupe to one fetch and keep every owner', async () => {
  const { backend, bytes, fetchCounts, records, releaseAll } = makeControllableBackend();
  const mgr = new DownloadManager(backend);
  await mgr.init();

  // Start an individual download of A; it parks inside downloadBytes (in-flight).
  const p1 = mgr.downloadTrack(trackA, 'track');
  await tick();
  // Start the album download (which also owns A) while A is still in-flight.
  const p2 = mgr.downloadAlbum(album);
  await tick();

  releaseAll();
  await Promise.all([p1, p2]);

  // A fetched exactly once despite two concurrent owners.
  assert.equal(fetchCounts.get('https://cdn.example.com/a.mp3'), 1, 'A fetched once');
  const recA = records.get('https://cdn.example.com/a.mp3')!;
  assert.deepEqual(recA.refs.sort(), ['album:album-1', 'track'], 'both owners retained');

  // Dropping one owner keeps the shared bytes.
  await mgr.removeTrack(trackA, 'track');
  assert.equal(bytes.has('https://cdn.example.com/a.mp3'), true, 'bytes survive one owner removal');
  assert.equal(mgr.isTrackDownloaded(trackA), true);
});

test('cancelling a queued download prevents it from ever fetching', async () => {
  const { backend, fetchCounts, records, releaseAll } = makeControllableBackend();
  const mgr = new DownloadManager(backend);
  await mgr.init();

  // Saturate the pool (MAX_CONCURRENT = 3) with three parked downloads.
  const busyTracks = [
    { url: 'https://cdn.example.com/p1.mp3', title: 'P1', guid: 'p1' },
    { url: 'https://cdn.example.com/p2.mp3', title: 'P2', guid: 'p2' },
    { url: 'https://cdn.example.com/p3.mp3', title: 'P3', guid: 'p3' },
  ];
  const busy = busyTracks.map((t) => mgr.downloadTrack(t, 'track'));
  await tick();

  // A fourth download must queue behind the saturated pool.
  const queuedTrack = { url: 'https://cdn.example.com/queued.mp3', title: 'Q', guid: 'q' };
  const p4 = mgr.downloadTrack(queuedTrack, 'track');
  await tick();
  assert.equal(
    mgr.getDownloadState('https://cdn.example.com/queued.mp3').status,
    'queued',
    'fourth download is queued'
  );

  // Cancel it while still queued.
  await mgr.removeTrack(queuedTrack, 'track');

  // Drain the pool; the queued task acquires a slot, sees the abort, and bails.
  releaseAll();
  await Promise.all([...busy, p4]);

  assert.equal(
    fetchCounts.has('https://cdn.example.com/queued.mp3'),
    false,
    'queued+cancelled never fetched'
  );
  assert.equal(
    records.has('https://cdn.example.com/queued.mp3'),
    false,
    'no record written for the cancelled queued download'
  );
});

test('cancelling one owner of a shared in-flight download keeps it for the other owner', async () => {
  const { backend, bytes, fetchCounts, records, releaseAll } = makeControllableBackend();
  const mgr = new DownloadManager(backend);
  await mgr.init();

  // Individual download of A starts and parks in-flight (owner 'track').
  const p1 = mgr.downloadTrack(trackA, 'track');
  await tick();
  // The album (which also owns A) joins the SAME in-flight fetch; B is fresh.
  const p2 = mgr.downloadAlbum(album);
  await tick();

  // Cancel the individual download while the shared fetch is still in flight.
  await mgr.removeTrack(trackA, 'track');

  releaseAll();
  await Promise.all([p1, p2]);

  // The shared fetch was NOT aborted — the album still wanted A.
  assert.equal(fetchCounts.get('https://cdn.example.com/a.mp3'), 1, 'A fetched once, not aborted');
  assert.equal(bytes.has('https://cdn.example.com/a.mp3'), true, 'A bytes kept for the album');
  const recA = records.get('https://cdn.example.com/a.mp3')!;
  assert.deepEqual(recA.refs, ['album:album-1'], 'only the album owns A after the cancel');
});

// --- reading an album's state WITHOUT its track list -------------------------
//
// `AlbumCard` renders on listing pages and asks for this on every render. Making
// it need the tracks is what forced those endpoints to ship a track list per
// album — 593 KB of a 1.27 MB /favorites payload for data nothing displayed.
// The manager already knows the answer, because every record names its owners.

test('an album downloaded earlier reads back from its feed id alone', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);

  const state = mgr.getAlbumStateByOwner('album-1');
  assert.equal(state.status, 'downloaded');
  assert.equal(state.done, 2);
  assert.equal(state.total, 2);
});

test('the by-feed-id answer matches the by-track-list answer', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);

  assert.deepEqual(mgr.getAlbumStateByOwner('album-1'), mgr.getAlbumState(album));
});

test('an album nobody downloaded is idle, and reports the hinted total', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.init();

  const state = mgr.getAlbumStateByOwner('album-never-touched', 9);
  assert.equal(state.status, 'idle');
  assert.equal(state.done, 0);
  assert.equal(state.total, 9, 'so a card can say 0 of 9 rather than 0 of 0');
});

test('an INTERRUPTED album does not claim to be complete', async () => {
  // The failure this exists to prevent: 3 records for a 10-track album are all
  // downloaded, so counting records alone reads as "album downloaded". The size
  // the album had when it was saved is recorded, so it reads as partial.
  const { backend, records } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);

  // Drop one of the two, as an interrupted download or a manage-storage delete
  // would leave things.
  const [firstKey] = [...records.keys()];
  records.delete(firstKey);

  const fresh = new DownloadManager(backend);
  await fresh.init();
  const state = fresh.getAlbumStateByOwner('album-1');
  assert.equal(state.total, 2, 'albumTotal survived on the remaining record');
  assert.equal(state.done, 1);
  assert.notEqual(state.status, 'downloaded');
});

test('records written before albumTotal existed still read sensibly', async () => {
  const { backend, records } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);
  for (const [key, rec] of records) {
    records.set(key, { ...rec, albumTotal: undefined });
  }

  const fresh = new DownloadManager(backend);
  await fresh.init();
  const state = fresh.getAlbumStateByOwner('album-1');
  assert.equal(state.status, 'downloaded', 'a complete album still reads complete');
  assert.equal(state.total, 2);
});

test('a track saved individually is not mistaken for its album', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadTrack(trackA); // owner 'track', not 'album:album-1'

  const state = mgr.getAlbumStateByOwner('album-1', 2);
  assert.equal(state.status, 'idle');
  assert.equal(state.done, 0);
});

test('an album being downloaded reports progress, not idle', async () => {
  // Tracks in flight have no record yet, so records alone would read as idle
  // until the first one finished.
  const ctl = makeControllableBackend();
  const mgr = new DownloadManager(ctl.backend);
  const pending = mgr.downloadAlbum(album);
  await tick();

  const mid = mgr.getAlbumStateByOwner('album-1');
  assert.equal(mid.total, 2, 'both tracks are known, including the unstarted one');
  assert.notEqual(mid.status, 'idle');

  ctl.releaseAll();
  await pending;
  assert.equal(mgr.getAlbumStateByOwner('album-1').status, 'downloaded');
});

test('removing an album returns it to idle', async () => {
  const { backend } = makeFakeBackend();
  const mgr = new DownloadManager(backend);
  await mgr.downloadAlbum(album);
  await mgr.removeAlbum({ feedId: 'album-1' });

  assert.equal(mgr.getAlbumStateByOwner('album-1').status, 'idle');
});
