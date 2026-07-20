'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from 'react';
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
    offlineMode,
    setOfflineMode,
    isTrackDownloaded: (t) => downloadManager.isTrackDownloaded(t),
    getTrackState: (t) => downloadManager.getDownloadState(primaryKeyOf(t)),
    getAlbumState: (a) => downloadManager.getAlbumState(a),
    downloadTrack: (t) => downloadManager.downloadTrack(t),
    downloadAlbum: (a) => downloadManager.downloadAlbum(a),
    removeTrack: (t) => downloadManager.removeTrack(t),
    removeAlbum: (a) => downloadManager.removeAlbum(a),
    removeByKey: (k) => downloadManager.removeByKey(k),
    clearAllDownloads: () => downloadManager.clearAllDownloads(),
    listDownloads: () => downloadManager.listDownloads(),
    getStorageEstimate: () => downloadManager.getStorageEstimate(),
    getCoverUrl: (url) => downloadManager.getCoverObjectUrl(url),
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
