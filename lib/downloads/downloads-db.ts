/**
 * Metadata index for offline downloads.
 *
 * A dedicated sibling IndexedDB (NOT the hot `StableKraftDB.keyValueStore` in
 * lib/indexed-db-storage.ts) so we never risk a version bump on the settings/
 * favorites store. Audio BYTES live in the Cache API (downloads-cache.ts); this
 * store only holds small records describing what's downloaded, keyed by the
 * canonical `primaryPlaybackKey`.
 */

// PERSISTENCE INVARIANT — do not break for limited-bandwidth users.
// DB_NAME and STORE_NAME are load-bearing: renaming either orphans every
// existing download and forces a full re-download over the user's data plan.
// DB_VERSION may be bumped ONLY with an additive `onupgradeneeded` migration
// (create new stores/indexes; never deleteObjectStore or recreate `downloads`).
// The current handler below is already migration-safe — keep it that way.
const DB_NAME = 'StableKraftDownloadsDB';
const DB_VERSION = 1;
const STORE_NAME = 'downloads';

export type DownloadOwner = 'track' | `album:${string}`;

export interface DownloadRecord {
  /** Canonical primaryPlaybackKey — also the Cache API key for the bytes. */
  key: string;
  trackId?: string;
  trackGuid?: string;
  title: string;
  artist?: string;
  albumId?: string;
  albumTitle?: string;
  coverArt?: string;
  sizeBytes: number;
  durationSecs?: number;
  /** Position within its album (0-based), captured at download time so the
   *  Downloads page can list/play an album in real track order rather than the
   *  order downloads happened to finish. Absent for individually-saved tracks. */
  trackOrder?: number;
  createdAt: number;
  /** Owners that requested this track — reference counting for shared tracks. */
  refs: DownloadOwner[];
  mediaType: 'audio';
}

interface DBHandle {
  db: IDBDatabase | null;
  opening: Promise<IDBDatabase> | null;
}

const handle: DBHandle = { db: null, opening: null };

function openDB(): Promise<IDBDatabase> {
  if (handle.db) return Promise.resolve(handle.db);
  if (handle.opening) return handle.opening;

  handle.opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      handle.opening = null;
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      handle.opening = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      handle.db = request.result;
      handle.opening = null;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Additive only — see the PERSISTENCE INVARIANT note above. Never drop or
      // recreate `downloads`; that would wipe users' offline library on update.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('albumId', 'albumId', { unique: false });
      }
    };
  });

  return handle.opening;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(record: DownloadRecord): Promise<void> {
  const store = await tx('readwrite');
  await promisify(store.put(record));
}

export async function getRecord(key: string): Promise<DownloadRecord | null> {
  const store = await tx('readonly');
  const result = await promisify(store.get(key));
  return (result as DownloadRecord) ?? null;
}

export async function getAllRecords(): Promise<DownloadRecord[]> {
  const store = await tx('readonly');
  const result = await promisify(store.getAll());
  return (result as DownloadRecord[]) ?? [];
}

export async function deleteRecord(key: string): Promise<void> {
  const store = await tx('readwrite');
  await promisify(store.delete(key));
}

export async function clearAllRecords(): Promise<void> {
  const store = await tx('readwrite');
  await promisify(store.clear());
}
