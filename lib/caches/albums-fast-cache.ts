import type { Feed, Track } from '@prisma/client';

export interface FeedWithTracks extends Feed {
  Track: Track[];
  _count: {
    Track: number;
  };
}

export interface CachedData {
  feeds: FeedWithTracks[];
  publisherStats: Array<{ name: string; albumCount: number }>;
}

export const CACHE_DURATION = 15 * 60 * 1000;
export const PLAYLIST_CACHE_DURATION = 15 * 60 * 1000;

interface AlbumsFastCacheState {
  data: CachedData | null;
  timestamp: number;
  playlistData: any[] | null;
  playlistTimestamp: number;
}

const state: AlbumsFastCacheState = {
  data: null,
  timestamp: 0,
  playlistData: null,
  playlistTimestamp: 0,
};

export function getAlbumsFastCache(): AlbumsFastCacheState {
  return state;
}

export function invalidateAlbumsFastCache(): void {
  state.data = null;
  state.timestamp = 0;
  state.playlistData = null;
  state.playlistTimestamp = 0;
}
