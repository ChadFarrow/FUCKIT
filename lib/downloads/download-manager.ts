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
import { monitoring } from '../monitoring';

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
  downloadImage: typeof cache.downloadImage;
  getImageObjectUrl: typeof cache.getImageObjectUrl;
  deleteImage: typeof cache.deleteImage;
  clearAllImages: typeof cache.clearAllImages;
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
  downloadImage: cache.downloadImage,
  getImageObjectUrl: cache.getImageObjectUrl,
  deleteImage: cache.deleteImage,
  clearAllImages: cache.clearAllImages,
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
function trackKey(track: DownloadableTrack): string {
  return primaryPlaybackKey(track.url);
}
/**
 * Whether the manager will actually save this track. The DownloadButton MUST
 * gate on this too — it used to check only `!!track.url`, so an album of video
 * or HLS tracks rendered a download arrow that filtered to zero tracks and left
 * the button idle forever with no feedback.
 */
export function isDownloadable(track: DownloadableTrack): boolean {
  return Boolean(track.url) && track.mediaType !== 'video' && !isNonDownloadableUrl(track.url);
}
function hostOf(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
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
  // Keyed by track key: a fetch that is queued or downloading. Concurrent
  // owners of the same track join this instead of starting a second fetch.
  // `owners` is the set of owners still waiting; the shared fetch is aborted
  // only when the LAST waiting owner drops out (so cancelling one owner never
  // strands another that joined the same fetch).
  private inFlight = new Map<
    string,
    { promise: Promise<boolean>; owners: Set<DownloadOwner>; controller: AbortController }
  >();
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

  /** Add `owner` to an already-persisted record's ref list (idempotent). */
  private async addOwnerToRecord(key: string, owner: DownloadOwner): Promise<void> {
    const rec = this.records.get(key);
    if (!rec) return;
    if (!rec.refs.includes(owner)) {
      rec.refs = [...rec.refs, owner];
      await this.backend.putRecord(rec);
      this.records.set(key, rec);
    }
  }

  /** Download one track for `owner`; dedups + reference-counts shared tracks. */
  private async downloadOne(
    track: DownloadableTrack,
    owner: DownloadOwner,
    meta: {
      albumId?: string | null;
      albumTitle?: string | null;
      coverArt?: string | null;
      trackOrder?: number | null;
    }
  ): Promise<boolean> {
    if (!isDownloadable(track)) return false;
    const key = trackKey(track);
    if (!key) return false;

    // Already downloaded — just add this owner to the ref list.
    const existing = this.records.get(key);
    if (existing) {
      // Backfill album position if this owner (an album) knows it and the
      // record — saved individually first — didn't.
      if (existing.trackOrder == null && meta.trackOrder != null) {
        existing.trackOrder = meta.trackOrder;
        await this.backend.putRecord(existing);
        this.records.set(key, existing);
      }
      await this.addOwnerToRecord(key, owner);
      this.downloaded.add(key);
      this.setState(key, { status: 'downloaded', fraction: 1 });
      return true;
    }

    // A download for this key is already queued/in-flight — join it (add this
    // owner to the pending set) instead of starting a second fetch, then ensure
    // this owner is on the finished record.
    const flight = this.inFlight.get(key);
    if (flight) {
      flight.owners.add(owner);
      const ok = await flight.promise;
      if (ok) await this.addOwnerToRecord(key, owner);
      return ok;
    }

    // Fresh download — register it as in-flight (owner set + shared controller)
    // so concurrent owners join one fetch.
    const owners = new Set<DownloadOwner>([owner]);
    const controller = new AbortController();
    this.controllers.set(key, controller);
    const promise = this.runDownload(key, track, owners, controller, meta);
    this.inFlight.set(key, { promise, owners, controller });
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** The actual fetch-and-persist for a fresh download of `key`. */
  private async runDownload(
    key: string,
    track: DownloadableTrack,
    owners: Set<DownloadOwner>,
    controller: AbortController,
    meta: {
      albumId?: string | null;
      albumTitle?: string | null;
      coverArt?: string | null;
      trackOrder?: number | null;
    }
  ): Promise<boolean> {
    this.setState(key, { status: 'queued', fraction: null });
    // The controller was created + registered by the caller BEFORE this runs, so
    // a cancel that arrives while this download is still queued is honored.
    await this.acquire();

    // Cancelled while waiting in the queue — bail without ever fetching.
    if (controller.signal.aborted) {
      this.controllers.delete(key);
      this.setState(key, { status: 'idle', fraction: null });
      this.release();
      return false;
    }

    this.setState(key, { status: 'downloading', fraction: 0 });

    try {
      // Throttle re-renders: only surface progress on ~5% steps (or unknown-size
      // ticks, which report null and just keep the spinner alive).
      let lastEmitted = -1;
      const sizeBytes = await this.backend.downloadBytes(key, {
        signal: controller.signal,
        sourceUrl: track.url ?? undefined,
        onProgress: (p) => {
          const bucket = p.fraction == null ? -2 : Math.floor(p.fraction * 20);
          if (bucket !== lastEmitted) {
            lastEmitted = bucket;
            this.setState(key, { status: 'downloading', fraction: p.fraction });
          }
        },
      });

      // All owners cancelled while the fetch was finishing (rare race) — discard.
      if (owners.size === 0) {
        await this.backend.deleteBytes(key).catch(() => {});
        this.setState(key, { status: 'idle', fraction: null });
        return false;
      }

      const record: DownloadRecord = {
        key,
        trackId: track.id ?? undefined,
        trackGuid: track.guid ?? undefined,
        title: track.title ?? 'Unknown',
        artist: track.artist ?? undefined,
        albumId: meta.albumId ?? undefined,
        albumTitle: meta.albumTitle ?? undefined,
        coverArt: meta.coverArt ?? undefined,
        sizeBytes,
        durationSecs: parseDuration(track.duration),
        trackOrder: meta.trackOrder ?? undefined,
        createdAt: Date.now(),
        refs: [...owners],
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
      const aborted =
        (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError';
      const message = err instanceof Error ? err.message : String(err);
      this.setState(key, {
        status: aborted ? 'idle' : 'error',
        fraction: null,
        error: aborted ? undefined : message,
      });
      if (!aborted) {
        // Report it. A failed download used to be silent everywhere — no toast,
        // no client log, and the button rendered the plain idle arrow — so the
        // only way it ever surfaced was a listener saying "it won't download",
        // with no way to learn which host. The message string is deliberately
        // CONSTANT: monitoring throttles on the message, so interpolating the
        // host would blow the throttle key. Host goes in the metadata.
        monitoring.error('downloads', 'Track download failed', {
          host: hostOf(track.url),
          title: track.title ?? undefined,
          albumId: meta.albumId ?? undefined,
          message,
        });
      }
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
    // Pass each track's album position so the Downloads page can restore order.
    const results = await Promise.all(
      tracks.map((t, i) => this.downloadOne(t, owner, { ...meta, trackOrder: i }))
    );
    // Cache the cover once so the album shows art offline — only if at least one
    // track actually persisted, so a fully-failed album never orphans a cover.
    // Best-effort: a failed art fetch must never fail the album download.
    if (album.coverArt && results.some(Boolean)) {
      await this.backend.downloadImage(album.coverArt).catch(() => {});
    }
    return this.getAlbumState(album);
  }

  /** Resolve a cached cover to an object URL, or null if it isn't downloaded. */
  getCoverObjectUrl(coverArtUrl: string): Promise<string | null> {
    return this.backend.getImageObjectUrl(coverArtUrl);
  }

  // ---- removal ---------------------------------------------------------

  /** Evict a cached cover once no remaining record references it. */
  private async maybeEvictCover(coverArtUrl?: string): Promise<void> {
    if (!coverArtUrl) return;
    const stillUsed = Array.from(this.records.values()).some((r) => r.coverArt === coverArtUrl);
    if (!stillUsed) await this.backend.deleteImage(coverArtUrl).catch(() => {});
  }

  /** Remove one owner's claim on a track; evict bytes when no owners remain. */
  private async removeOne(key: string, owner: DownloadOwner): Promise<void> {
    // Still in flight (no record yet): drop this owner from the pending set and
    // abort the shared fetch only if no owner still wants it. The record built
    // on completion reflects the remaining owners.
    const flight = this.inFlight.get(key);
    if (flight && !this.records.get(key)) {
      flight.owners.delete(owner);
      if (flight.owners.size === 0) flight.controller.abort();
      return;
    }

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
    const coverArt = record.coverArt;
    await this.backend.deleteBytes(key);
    await this.backend.deleteRecord(key);
    this.records.delete(key);
    this.downloaded.delete(key);
    this.states.delete(key);
    await this.maybeEvictCover(coverArt);
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

  /**
   * Remove a single stored track by its key regardless of owner (Downloads page).
   * This is an intentional force-delete for the storage-management UI: unlike
   * `removeOne`, it does NOT decrement ref-counts, so it evicts the bytes even if
   * an album still lists this track as an owner (that album then reads as
   * partially-downloaded until re-downloaded). Use `removeTrack`/`removeAlbum`
   * for owner-scoped removal.
   */
  async removeByKey(key: string): Promise<void> {
    await this.init();
    const controller = this.controllers.get(key);
    if (controller) controller.abort();
    const coverArt = this.records.get(key)?.coverArt;
    await this.backend.deleteBytes(key);
    await this.backend.deleteRecord(key);
    this.records.delete(key);
    this.downloaded.delete(key);
    this.states.delete(key);
    await this.maybeEvictCover(coverArt);
    this.emitChange();
  }

  async clearAllDownloads(): Promise<void> {
    await this.init();
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    await this.backend.clearAllBytes();
    await this.backend.clearAllImages();
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
