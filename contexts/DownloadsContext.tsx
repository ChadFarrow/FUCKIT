'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import {
  downloadManager,
  type DownloadableTrack,
  type DownloadableAlbum,
  type DownloadablePlaylist,
  type DownloadState,
  type AggregateState,
} from '@/lib/downloads/download-manager';
import type { DownloadRecord } from '@/lib/downloads/downloads-db';
import { primaryPlaybackKey } from '@/lib/downloads/playback-key';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface DownloadsContextType {
  ready: boolean;
  isOnline: boolean;
  isTrackDownloaded: (track: DownloadableTrack) => boolean;
  getTrackState: (track: DownloadableTrack) => DownloadState;
  getAlbumState: (album: DownloadableAlbum) => AggregateState;
  getPlaylistState: (playlist: DownloadablePlaylist) => AggregateState;
  downloadTrack: (track: DownloadableTrack) => Promise<boolean>;
  downloadAlbum: (album: DownloadableAlbum) => Promise<AggregateState>;
  downloadPlaylist: (playlist: DownloadablePlaylist) => Promise<AggregateState>;
  removeTrack: (track: DownloadableTrack) => Promise<void>;
  removeAlbum: (album: DownloadableAlbum) => Promise<void>;
  removePlaylist: (playlist: DownloadablePlaylist) => Promise<void>;
  removeByKey: (key: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  listDownloads: () => DownloadRecord[];
  getStorageEstimate: () => Promise<{ usage: number; quota: number } | null>;
}

const DownloadsContext = createContext<DownloadsContextType | null>(null);

/**
 * `primaryPlaybackKey` for the single-track heart is derived inside the manager;
 * these helpers just wrap the module singleton in a React-observable shell. The
 * manager emits `change` events which we surface via useSyncExternalStore so any
 * component reading download state re-renders on progress/completion/removal.
 */
export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const [ready, setReady] = useState(false);

  // Re-render on any manager change (progress, completion, removal).
  useSyncExternalStore(
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

  const value: DownloadsContextType = {
    ready,
    isOnline,
    isTrackDownloaded: (t) => downloadManager.isTrackDownloaded(t),
    getTrackState: (t) => downloadManager.getDownloadState(primaryKeyOf(t)),
    getAlbumState: (a) => downloadManager.getAlbumState(a),
    getPlaylistState: (p) => downloadManager.getPlaylistState(p),
    downloadTrack: (t) => downloadManager.downloadTrack(t),
    downloadAlbum: (a) => downloadManager.downloadAlbum(a),
    downloadPlaylist: (p) => downloadManager.downloadPlaylist(p),
    removeTrack: (t) => downloadManager.removeTrack(t),
    removeAlbum: (a) => downloadManager.removeAlbum(a),
    removePlaylist: (p) => downloadManager.removePlaylist(p),
    removeByKey: (k) => downloadManager.removeByKey(k),
    clearAllDownloads: () => downloadManager.clearAllDownloads(),
    listDownloads: () => downloadManager.listDownloads(),
    getStorageEstimate: () => downloadManager.getStorageEstimate(),
  };

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

function primaryKeyOf(track: DownloadableTrack): string {
  return primaryPlaybackKey(track.url);
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
