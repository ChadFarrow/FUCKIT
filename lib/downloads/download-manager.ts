/**
 * Offline downloads orchestrator (module singleton).
 *
 * Coordinates the Cache API byte store (downloads-cache.ts) and the IndexedDB
 * metadata index (downloads-db.ts): a concurrency-limited download queue,
 * per-track reference counting so an album + an individual download of the same
 * track share ONE cached copy, cancellation, and a synchronous `isDownloaded`
 * for the UI. All storage access goes through an injectable backend so the
 * ref-counting logic is unit-testable without a browser.
 */
import { primaryPlaybackKey, isNonDownloadableUrl } from './playback-key';
import type { DownloadRecord, DownloadOwner } from './downloads-db';
import * as cache from './downloads-cache';
import * as db from './downloads-db';

// Fields accept `| null` so RSS types (whose coverArt/etc. can be null) are
// assignable without casts at call sites.
export interface DownloadableTrack {
  url?: string | null;
  title?: string | null;
  artist?: string | null;
  guid?: string | null;
  id?: string | null;
  mediaType?: string | null;
  duration?: number | string | null;
}

export interface DownloadableAlbum {
  feedId?: string | null;
  id?: string | null;
  title?: string | null;
  artist?: string | null;
  coverArt?: string | null;
  tracks?: DownloadableTrack[];
}

export interface DownloadablePlaylist {
  id?: string | null;
  title?: string | null;
  coverArt?: string | null;
  tracks?: DownloadableTrack[];
}

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'downloaded' | 'error';

export interface DownloadState {
  status: DownloadStatus;
  /** 0..1 while downloading, when a Content-Length is known. */
  fraction: number | null;
  error?: string;
}

export interface AggregateState {
  status: DownloadStatus;
  done: number;
  total: number;
  fraction: number;
}

/** Storage surface — the real backend by default; a fake in tests. */
export interface DownloadsBackend {
  downloadBytes: typeof cache.downloadBytes;
  deleteBytes: typeof cache.deleteBytes;
  getObjectUrl: typeof cache.getObjectUrl;
  clearAllBytes: typeof cache.clearAllBytes;
  estimateUsage: typeof cache.estimateUsage;
  requestPersistence: typeof cache.requestPersistence;
  putRecord: typeof db.putRecord;
  getAllRecords: typeof db.getAllRecords;
  deleteRecord: typeof db.deleteRecord;
  clearAllRecords: typeof db.clearAllRecords;
}

const realBackend: DownloadsBackend = {
  downloadBytes: cache.downloadBytes,
  deleteBytes: cache.deleteBytes,
  getObjectUrl: cache.getObjectUrl,
  clearAllBytes: cache.clearAllBytes,
  estimateUsage: cache.estimateUsage,
  requestPersistence: cache.requestPersistence,
  putRecord: db.putRecord,
  getAllRecords: db.getAllRecords,
  deleteRecord: db.deleteRecord,
  clearAllRecords: db.clearAllRecords,
};

const MAX_CONCURRENT = 3;

function albumOwner(album: DownloadableAlbum): DownloadOwner {
  return `album:${album.feedId ?? album.id ?? 'unknown'}`;
}
function playlistOwner(playlist: DownloadablePlaylist): DownloadOwner {
  return `playlist:${playlist.id ?? 'unknown'}`;
}
function trackKey(track: DownloadableTrack): string {
  return primaryPlaybackKey(track.url);
}
function isDownloadable(track: DownloadableTrack): boolean {
  return Boolean(track.url) && track.mediaType !== 'video' && !isNonDownloadableUrl(track.url);
}
function parseDuration(d: number | string | null | undefined): number | undefined {
  if (typeof d === 'number') return d;
  if (typeof d === 'string' && d) {
    const n = Number(d);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export class DownloadManager {
  private backend: DownloadsBackend;
  private records = new Map<string, DownloadRecord>();
  private states = new Map<string, DownloadState>();
  private downloaded = new Set<string>();
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private persistenceRequested = false;
  private version = 0;

  // Concurrency pool
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(backend: DownloadsBackend = realBackend) {
    this.backend = backend;
  }

  // ---- lifecycle -------------------------------------------------------

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      try {
        const records = await this.backend.getAllRecords();
        for (const rec of records) {
          this.records.set(rec.key, rec);
          this.downloaded.add(rec.key);
          this.states.set(rec.key, { status: 'downloaded', fraction: 1 });
        }
      } catch (err) {
        console.warn('DownloadManager.init failed:', err);
      } finally {
        this.initialized = true;
        this.emitChange();
      }
    })();
    return this.initializing;
  }

  // ---- subscriptions ---------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Monotonic version — a stable snapshot source for useSyncExternalStore. */
  getVersion(): number {
    return this.version;
  }

  private emitChange(): void {
    this.version++;
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        /* listener errors must not break the manager */
      }
    }
  }

  private setState(key: string, state: DownloadState): void {
    this.states.set(key, state);
    this.emitChange();
  }

  // ---- queries (synchronous) ------------------------------------------

  isDownloaded(key: string): boolean {
    return this.downloaded.has(key);
  }

  isTrackDownloaded(track: DownloadableTrack): boolean {
    return this.downloaded.has(trackKey(track));
  }

  getDownloadState(key: string): DownloadState {
    return this.states.get(key) ?? { status: 'idle', fraction: null };
  }

  /** Aggregate state across an album/playlist's downloadable tracks. */
  private aggregate(tracks: DownloadableTrack[]): AggregateState {
    const downloadable = tracks.filter(isDownloadable);
    const total = downloadable.length;
    if (total === 0) return { status: 'idle', done: 0, total: 0, fraction: 0 };

    let done = 0;
    let downloading = false;
    let queued = false;
    let error = false;
    let fractionSum = 0;

    for (const t of downloadable) {
      const st = this.getDownloadState(trackKey(t));
      if (st.status === 'downloaded') {
        done++;
        fractionSum += 1;
      } else if (st.status === 'downloading') {
        downloading = true;
        fractionSum += st.fraction ?? 0;
      } else if (st.status === 'queued') {
        queued = true;
      } else if (st.status === 'error') {
        error = true;
      }
    }

    let status: DownloadStatus;
    if (done === total) status = 'downloaded';
    else if (downloading || queued) status = downloading ? 'downloading' : 'queued';
    else if (error) status = 'error';
    else status = 'idle';

    return { status, done, total, fraction: fractionSum / total };
  }

  getAlbumState(album: DownloadableAlbum): AggregateState {
    return this.aggregate(album.tracks ?? []);
  }
  getPlaylistState(playlist: DownloadablePlaylist): AggregateState {
    return this.aggregate(playlist.tracks ?? []);
  }

  listDownloads(): DownloadRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getStorageEstimate() {
    return this.backend.estimateUsage();
  }

  // ---- concurrency pool ------------------------------------------------

  private acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }

  // ---- downloading -----------------------------------------------------

  /** Download one track for `owner`; dedups + reference-counts shared tracks. */
  private async downloadOne(
    track: DownloadableTrack,
    owner: DownloadOwner,
    meta: {
      albumId?: string | null;
      albumTitle?: string | null;
      coverArt?: string | null;
      playlistId?: string | null;
    }
  ): Promise<boolean> {
    if (!isDownloadable(track)) return false;
    const key = trackKey(track);
    if (!key) return false;

    // Already downloaded — just add this owner to the ref list.
    const existing = this.records.get(key);
    if (existing) {
      if (!existing.refs.includes(owner)) {
        existing.refs = [...existing.refs, owner];
        await this.backend.putRecord(existing);
        this.records.set(key, existing);
      }
      this.downloaded.add(key);
      this.setState(key, { status: 'downloaded', fraction: 1 });
      return true;
    }

    // Fresh download.
    this.setState(key, { status: 'queued', fraction: null });
    await this.acquire();
    const controller = new AbortController();
    this.controllers.set(key, controller);
    this.setState(key, { status: 'downloading', fraction: 0 });

    try {
      // Throttle re-renders: only surface progress on ~5% steps (or unknown-size
      // ticks, which report null and just keep the spinner alive).
      let lastEmitted = -1;
      const sizeBytes = await this.backend.downloadBytes(key, {
        signal: controller.signal,
        onProgress: (p) => {
          const bucket = p.fraction == null ? -2 : Math.floor(p.fraction * 20);
          if (bucket !== lastEmitted) {
            lastEmitted = bucket;
            this.setState(key, { status: 'downloading', fraction: p.fraction });
          }
        },
      });

      const record: DownloadRecord = {
        key,
        trackId: track.id ?? undefined,
        trackGuid: track.guid ?? undefined,
        title: track.title ?? 'Unknown',
        artist: track.artist ?? undefined,
        albumId: meta.albumId ?? undefined,
        albumTitle: meta.albumTitle ?? undefined,
        coverArt: meta.coverArt ?? undefined,
        playlistId: meta.playlistId ?? undefined,
        sizeBytes,
        durationSecs: parseDuration(track.duration),
        createdAt: Date.now(),
        refs: [owner],
        mediaType: 'audio',
      };
      await this.backend.putRecord(record);
      this.records.set(key, record);
      this.downloaded.add(key);
      this.setState(key, { status: 'downloaded', fraction: 1 });

      if (!this.persistenceRequested) {
        this.persistenceRequested = true;
        this.backend.requestPersistence().catch(() => {});
      }
      return true;
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      this.setState(key, {
        status: aborted ? 'idle' : 'error',
        fraction: null,
        error: aborted ? undefined : err instanceof Error ? err.message : String(err),
      });
      return false;
    } finally {
      this.controllers.delete(key);
      this.release();
    }
  }

  async downloadTrack(track: DownloadableTrack, owner: DownloadOwner = 'track'): Promise<boolean> {
    await this.init();
    return this.downloadOne(track, owner, {});
  }

  async downloadAlbum(album: DownloadableAlbum): Promise<AggregateState> {
    await this.init();
    const owner = albumOwner(album);
    const meta = {
      albumId: album.feedId ?? album.id,
      albumTitle: album.title,
      coverArt: album.coverArt,
    };
    const tracks = (album.tracks ?? []).filter(isDownloadable);
    // Kick them all off; the pool caps real concurrency. Tolerate partials.
    await Promise.all(tracks.map((t) => this.downloadOne(t, owner, meta)));
    return this.getAlbumState(album);
  }

  async downloadPlaylist(playlist: DownloadablePlaylist): Promise<AggregateState> {
    await this.init();
    const owner = playlistOwner(playlist);
    const meta = {
      playlistId: playlist.id,
      albumTitle: playlist.title,
      coverArt: playlist.coverArt,
    };
    const tracks = (playlist.tracks ?? []).filter(isDownloadable);
    await Promise.all(tracks.map((t) => this.downloadOne(t, owner, meta)));
    return this.getPlaylistState(playlist);
  }

  // ---- removal ---------------------------------------------------------

  /** Remove one owner's claim on a track; evict bytes when no owners remain. */
  private async removeOne(key: string, owner: DownloadOwner): Promise<void> {
    // Cancel an in-flight download first.
    const controller = this.controllers.get(key);
    if (controller) controller.abort();

    const record = this.records.get(key);
    if (!record) {
      this.downloaded.delete(key);
      this.states.delete(key);
      return;
    }

    const refs = record.refs.filter((r) => r !== owner);
    if (refs.length > 0) {
      record.refs = refs;
      await this.backend.putRecord(record);
      this.records.set(key, record);
      return;
    }

    // Last owner gone — evict bytes + record.
    await this.backend.deleteBytes(key);
    await this.backend.deleteRecord(key);
    this.records.delete(key);
    this.downloaded.delete(key);
    this.states.delete(key);
  }

  async removeTrack(track: DownloadableTrack, owner: DownloadOwner = 'track'): Promise<void> {
    await this.init();
    await this.removeOne(trackKey(track), owner);
    this.emitChange();
  }

  /** Remove every track claimed by `owner` (album/playlist teardown). */
  private async removeByOwner(owner: DownloadOwner): Promise<void> {
    const keys = Array.from(this.records.values())
      .filter((r) => r.refs.includes(owner))
      .map((r) => r.key);
    for (const key of keys) {
      await this.removeOne(key, owner);
    }
    this.emitChange();
  }

  async removeAlbum(album: DownloadableAlbum): Promise<void> {
    await this.init();
    await this.removeByOwner(albumOwner(album));
  }
  async removePlaylist(playlist: DownloadablePlaylist): Promise<void> {
    await this.init();
    await this.removeByOwner(playlistOwner(playlist));
  }

  /** Remove a single stored track by its key regardless of owner (Downloads page). */
  async removeByKey(key: string): Promise<void> {
    await this.init();
    const controller = this.controllers.get(key);
    if (controller) controller.abort();
    await this.backend.deleteBytes(key);
    await this.backend.deleteRecord(key);
    this.records.delete(key);
    this.downloaded.delete(key);
    this.states.delete(key);
    this.emitChange();
  }

  async clearAllDownloads(): Promise<void> {
    await this.init();
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    await this.backend.clearAllBytes();
    await this.backend.clearAllRecords();
    this.records.clear();
    this.downloaded.clear();
    this.states.clear();
    this.emitChange();
  }

  /**
   * Self-heal a record whose bytes vanished (iOS eviction). Called by the
   * playback layer when `getObjectUrl` returns null despite `isDownloaded`.
   */
  async forgetEvicted(key: string): Promise<void> {
    await this.backend.deleteRecord(key).catch(() => {});
    this.records.delete(key);
    this.downloaded.delete(key);
    this.states.delete(key);
    this.emitChange();
  }
}

export const downloadManager = new DownloadManager();
