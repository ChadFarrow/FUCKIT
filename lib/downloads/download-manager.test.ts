import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DownloadManager, type DownloadsBackend } from './download-manager';
import type { DownloadRecord } from './downloads-db';

/** In-memory backend that counts fetches per key so we can assert dedup. */
function makeFakeBackend() {
  const bytes = new Map<string, number>();
  const records = new Map<string, DownloadRecord>();
  const fetchCounts = new Map<string, number>();

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

  return { backend, bytes, records, fetchCounts };
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
