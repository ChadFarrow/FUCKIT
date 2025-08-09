// TypeScript types for HGH playlist data

export interface HGHTrack {
  feedGuid: string;
  itemGuid: string;
  title?: string;
  artist?: string;
  feedUrl?: string;
  feedTitle?: string;
  episodeId?: number;
  feedId?: number;
  audioUrl?: string;
  artworkUrl?: string;
  duration?: number;
}

export interface HGHTrackWithUrls extends HGHTrack {
  audioUrl: string;
  artworkUrl: string;
  duration: number;
}

export type HGHAudioUrlMap = Record<string, string>;
export type HGHArtworkUrlMap = Record<string, string>;