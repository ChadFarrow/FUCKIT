'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore, useMemo } from 'react';
import {
  downloadManager,
  type DownloadableTrack,
  type DownloadableAlbum,
  type DownloadState,
  type AggregateState,
} from '@/lib/downloads/download-manager';
import type { DownloadRecord } from '@/lib/downloads/downloads-db';
import { primaryPlaybackKey } from '@/lib/downloads/playback-key';

interface DownloadsContextType {
  ready: boolean;
  /** Effective connectivity: false when the device is offline OR the user
   *  turned on manual Offline mode. Everything downloads-related keys off this. */
  isOnline: boolean;
  /** User-controlled "act as if offline" switch (persisted). */
  offlineMode: boolean;
  setOfflineMode: (value: boolean) => void;
  isTrackDownloaded: (track: DownloadableTrack) => boolean;
  getTrackState: (track: DownloadableTrack) => DownloadState;
  getAlbumState: (album: DownloadableAlbum) => AggregateState;
  /**
   * An album's state from its feed id, for callers that do not hold its tracks.
   *
   * `AlbumCard` renders on listing pages, and needing the track list here is
   * what forced those endpoints to ship one per album — 593 KB of a 1.27 MB
   * `/favorites` payload that nothing displayed. Pass `totalTracks` when known
   * (the card has it); it only affects an album with nothing downloaded.
   */
  getAlbumStateByFeedId: (feedId: string, totalTracks?: number) => AggregateState;
  downloadTrack: (track: DownloadableTrack) => Promise<boolean>;
  downloadAlbum: (album: DownloadableAlbum) => Promise<AggregateState>;
  removeTrack: (track: DownloadableTrack) => Promise<void>;
  removeAlbum: (album: DownloadableAlbum) => Promise<void>;
  removeByKey: (key: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  listDownloads: () => DownloadRecord[];
  getStorageEstimate: () => Promise<{ usage: number; quota: number } | null>;
  /** Resolve a downloaded cover to an object URL, or null if not cached. */
  getCoverUrl: (coverArtUrl: string) => Promise<string | null>;
}

const DownloadsContext = createContext<DownloadsContextType | null>(null);

/**
 * `primaryPlaybackKey` for the single-track heart is derived inside the manager;
 * these helpers just wrap the module singleton in a React-observable shell. The
 * manager emits `change` events which we surface via useSyncExternalStore so any
 * component reading download state re-renders on progress/completion/removal.
 */
const OFFLINE_MODE_KEY = 'sk_offline_mode';

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [offlineMode, setOfflineModeState] = useState(false);

  // Restore the persisted manual Offline-mode preference (SSR-safe: off first).
  useEffect(() => {
    try {
      setOfflineModeState(localStorage.getItem(OFFLINE_MODE_KEY) === '1');
    } catch {
      /* private mode / unavailable — stay online */
    }
  }, []);

  const setOfflineMode = useCallback((value: boolean) => {
    setOfflineModeState(value);
    try {
      localStorage.setItem(OFFLINE_MODE_KEY, value ? '1' : '0');
    } catch {
      /* ignore persistence failure */
    }
  }, []);

  // Offline mode is a MANUAL, user-controlled switch only. The app intentionally
  // does NOT react to real navigator.onLine changes — losing connection doesn't
  // flip any offline UI or redirect; the user chooses "offline" here explicitly.
  const isOnline = !offlineMode;

  // The manager's version counter: every progress tick, completion and removal
  // bumps it. This is how a manager change reaches the tree, and it MUST stay
  // in the value memo's dependency list below — see the comment there.
  const version = useSyncExternalStore(
    useCallback((cb) => downloadManager.subscribe(cb), []),
    () => downloadManager.getVersion(),
    () => 0
  );

  useEffect(() => {
    let cancelled = false;
    downloadManager.init().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Memoized so a re-render that is NOT a manager bump — a parent re-rendering,
  // or the Offline switch moving — stops handing all thirteen methods to every
  // DownloadButton as brand-new closures.
  //
  // `version` is in the dependency list, and it has to be. This provider is the
  // ONLY subscriber to `downloadManager`, so a NEW context value is the only
  // thing that re-renders the two components which read download state DURING
  // RENDER: `DownloadButton` calls `getTrackState`/`getAlbumState` inline, and
  // `DownloadsClient` calls `listDownloads()`. Neither subscribes on its own.
  //
  // Memoizing on the three state values alone (#231) left the value
  // `Object.is`-equal across every bump. The provider re-rendered, `{children}`
  // kept its element identity, and React therefore notified nobody: a download
  // spinner never advanced and never became a tick, and a removed row stayed on
  // the /downloads page. That silently broke the contract stated at the top of
  // this file. The methods are cheap arrow closures over a module singleton;
  // rebuilding them on a bump is the cost of the propagation, not waste.
  const value: DownloadsContextType = useMemo(() => ({
    ready,
    isOnline,
    offlineMode,
    setOfflineMode,
    isTrackDownloaded: (t) => downloadManager.isTrackDownloaded(t),
    getTrackState: (t) => downloadManager.getDownloadState(primaryKeyOf(t)),
    getAlbumState: (a) => downloadManager.getAlbumState(a),
    getAlbumStateByFeedId: (feedId, totalTracks) =>
      downloadManager.getAlbumStateByOwner(feedId, totalTracks),
    downloadTrack: (t) => downloadManager.downloadTrack(t),
    downloadAlbum: async (a) => downloadManager.downloadAlbum(await withResolvedTracks(a)),
    removeTrack: (t) => downloadManager.removeTrack(t),
    removeAlbum: (a) => downloadManager.removeAlbum(a),
    removeByKey: (k) => downloadManager.removeByKey(k),
    clearAllDownloads: () => downloadManager.clearAllDownloads(),
    listDownloads: () => downloadManager.listDownloads(),
    getStorageEstimate: () => downloadManager.getStorageEstimate(),
    getCoverUrl: (url) => downloadManager.getCoverObjectUrl(url),
  }), [version, ready, isOnline, offlineMode, setOfflineMode]);

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

function primaryKeyOf(track: DownloadableTrack): string {
  return primaryPlaybackKey(track.url);
}

/**
 * Fill in an album's tracks at DOWNLOAD time, if the caller did not carry them.
 *
 * Listing pages hand `AlbumCard` an album with no track list on purpose — see
 * `getAlbumStateByFeedId`. Downloading still needs the real tracks, with their
 * titles and durations, or the Downloads page lists rows called "Unknown".
 * Fetching them here costs one request on the click that starts a download,
 * instead of one track list per album on every page load.
 *
 * A caller that already has tracks is passed straight through, so album detail
 * and Now Playing are unchanged.
 */
async function withResolvedTracks(album: DownloadableAlbum): Promise<DownloadableAlbum> {
  if (album.tracks && album.tracks.length > 0) return album;
  const feedId = album.feedId ?? album.id;
  if (!feedId) return album;

  try {
    const params = new URLSearchParams({
      feedId,
      limit: '500',
      sortBy: 'trackOrder',
      sortOrder: 'asc',
    });
    const res = await fetch(`/api/tracks?${params}`);
    if (!res.ok) return album;
    const { tracks } = await res.json();
    if (!Array.isArray(tracks) || tracks.length === 0) return album;

    return {
      ...album,
      tracks: tracks.map((t: any) => ({
        url: t.audioUrl ?? null,
        title: t.title ?? null,
        artist: t.artist ?? album.artist ?? null,
        guid: t.guid ?? null,
        id: t.id ?? null,
        mediaType: t.mediaType ?? null,
        duration: t.duration ?? null,
      })),
    };
  } catch {
    // Offline, or the lookup failed. Returning the album unchanged lets
    // `downloadAlbum` report an empty result rather than throwing at the click.
    return album;
  }
}

export function useDownloads(): DownloadsContextType {
  const ctx = useContext(DownloadsContext);
  if (!ctx) {
    throw new Error('useDownloads must be used within a DownloadsProvider');
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider. */
export function useDownloadsSafe(): DownloadsContextType | null {
  return useContext(DownloadsContext);
}
