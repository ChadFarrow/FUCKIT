/**
 * Audio-bytes layer for offline downloads, built on the Cache API.
 *
 * Distinct from the small disposable LRU prefetch cache in lib/audio-prefetch.ts
 * (`stablekraft-audio-cache-v1`, 3 items). This cache holds user-requested
 * downloads and is only ever emptied by explicit removal / clear-all.
 *
 * Entries are keyed by the canonical `primaryPlaybackKey` (the original secure
 * media URL) but FETCHED via `getProxiedAudioUrl` so CORS-problematic hosts
 * still work — the same decoupling lib/audio-prefetch.ts uses. At play time the
 * bytes are handed back as a same-origin `blob:` URL, so playback needs zero
 * network and never hits CORS.
 */
import { getProxiedAudioUrl } from '../audio-url-utils';

export const DOWNLOADS_CACHE = 'stablekraft-downloads-v1';

function cacheApiAvailable(): boolean {
  return typeof caches !== 'undefined';
}

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  fraction: number | null;
}

/**
 * Fetch a track's bytes and store them under `key`. Reports streaming progress
 * when the server sends Content-Length. Returns the stored byte size.
 * Cancellable via `signal`; a cancelled/failed download leaves nothing behind
 * (Cache.put is atomic — a partial response is never committed).
 */
export async function downloadBytes(
  key: string,
  opts: { onProgress?: (p: DownloadProgress) => void; signal?: AbortSignal } = {}
): Promise<number> {
  if (!cacheApiAvailable()) {
    throw new Error('Cache API unavailable — downloads not supported here');
  }
  if (!key) throw new Error('downloadBytes: empty key');

  const fetchUrl = getProxiedAudioUrl(key);
  const response = await fetch(fetchUrl, {
    mode: 'cors',
    credentials: 'omit',
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`downloadBytes: HTTP ${response.status} for ${key.slice(-60)}`);
  }

  const totalBytes = Number(response.headers.get('Content-Length')) || null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.length;
      opts.onProgress?.({
        receivedBytes,
        totalBytes,
        fraction: totalBytes ? Math.min(1, receivedBytes / totalBytes) : null,
      });
    }
  }

  // Reassemble into one Blob, preserving the original content type.
  const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
  const blob = new Blob(chunks as BlobPart[], { type: contentType });

  const cache = await caches.open(DOWNLOADS_CACHE);
  // Store under the canonical key (a Response with a fixed Content-Length so a
  // later `.blob()` round-trips cleanly).
  await cache.put(
    key,
    new Response(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
      },
    })
  );

  return blob.size;
}

/** Whether bytes for `key` are already stored. */
export async function hasBytes(key: string): Promise<boolean> {
  if (!cacheApiAvailable() || !key) return false;
  const cache = await caches.open(DOWNLOADS_CACHE);
  const match = await cache.match(key);
  return Boolean(match);
}

/**
 * Resolve stored bytes to a fresh same-origin object URL, or null if the entry
 * is missing (e.g. evicted by the browser). Caller owns revoking the URL.
 */
export async function getObjectUrl(key: string): Promise<string | null> {
  if (!cacheApiAvailable() || !key) return null;
  const cache = await caches.open(DOWNLOADS_CACHE);
  const match = await cache.match(key);
  if (!match) return null;
  const blob = await match.blob();
  return URL.createObjectURL(blob);
}

/** Delete stored bytes for `key`. */
export async function deleteBytes(key: string): Promise<void> {
  if (!cacheApiAvailable() || !key) return;
  const cache = await caches.open(DOWNLOADS_CACHE);
  await cache.delete(key);
}

/** Drop the entire downloads byte cache. */
export async function clearAllBytes(): Promise<void> {
  if (!cacheApiAvailable()) return;
  await caches.delete(DOWNLOADS_CACHE);
}

// ---- cover art ------------------------------------------------------------
// Cover images live in a sibling cache, keyed by their original URL, fetched
// through the same-origin image proxy so the bytes are readable (cross-origin
// art hosts otherwise give opaque responses we can't turn into a blob: URL).

export const DOWNLOADS_ART_CACHE = 'stablekraft-downloads-art-v1';

/** Fetch a cover image via the same-origin proxy and store it under `url`.
 *  Best-effort: throws on failure so the caller can swallow it. */
export async function downloadImage(url: string): Promise<void> {
  if (!cacheApiAvailable() || !url) return;
  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`, {
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`downloadImage: HTTP ${res.status}`);
  const blob = await res.blob();
  const cache = await caches.open(DOWNLOADS_ART_CACHE);
  await cache.put(
    url,
    new Response(blob, {
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'Content-Length': String(blob.size),
      },
    })
  );
}

/** Resolve a stored cover to a fresh object URL, or null if not cached. */
export async function getImageObjectUrl(url: string): Promise<string | null> {
  if (!cacheApiAvailable() || !url) return null;
  const cache = await caches.open(DOWNLOADS_ART_CACHE);
  const match = await cache.match(url);
  if (!match) return null;
  const blob = await match.blob();
  return URL.createObjectURL(blob);
}

/** Delete a stored cover by its URL. */
export async function deleteImage(url: string): Promise<void> {
  if (!cacheApiAvailable() || !url) return;
  const cache = await caches.open(DOWNLOADS_ART_CACHE);
  await cache.delete(url);
}

/** Drop the entire cover-art cache. */
export async function clearAllImages(): Promise<void> {
  if (!cacheApiAvailable()) return;
  await caches.delete(DOWNLOADS_ART_CACHE);
}

/** Browser-reported storage usage/quota (bytes), if the API exists. */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage ?? 0, quota: quota ?? 0 };
  } catch {
    return null;
  }
}

/** Request durable storage so the browser is less likely to evict downloads. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
