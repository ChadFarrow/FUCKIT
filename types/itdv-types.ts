// TypeScript types for ITDV playlist data

export interface ITDVTrack {
  feedGuid: string;
  itemGuid: string;
  title: string;
  artist: string;
  feedUrl: string;
  feedTitle: string;
  episodeId: number;
  feedId: number;
  audioUrl?: string;
  artworkUrl?: string;
  duration?: number;
}

export interface ITDVTrackWithUrls extends ITDVTrack {
  audioUrl: string;
  artworkUrl: string;
  duration: number;
}

export type ITDVAudioUrlMap = Record<string, string>;
export type ITDVArtworkUrlMap = Record<string, string>;