'use client';

import { useMemo } from 'react';
import PlaylistAlbum, { PlaylistConfig } from './PlaylistAlbum';
import { HGH_AUDIO_URL_MAP } from '@/data/hgh-audio-urls';
import { HGH_ARTWORK_URL_MAP } from '@/data/hgh-artwork-urls';
// HGH resolved songs data was moved to music-tracks.json database
// import resolvedSongsData from '@/data/hgh-resolved-songs.json';

const config: PlaylistConfig = {
  name: 'Homegrown Hits',
  description: 'Every music reference from Homegrown Hits podcast',
  coverArt: 'https://raw.githubusercontent.com/ChadFarrow/ITDV-music-playlist/refs/heads/main/docs/HGH-playlist-art.webp',
  resolveAudioUrls: false, // We already have resolved URLs in the data
  showResolutionStatus: false
};

export default function HGHPlaylistAlbum() {
  // HGH data is now integrated into the main music tracks database
  // This component is deprecated but kept for compatibility
  const enrichedTracks: any[] = [];
  const trackCounts = { total: 0, withAudio: 0, withArtwork: 0 };

  return (
    <>
      <PlaylistAlbum
        config={config}
        tracks={enrichedTracks}
      />
      <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">About This Playlist</h3>
        <p className="text-sm text-gray-300 mb-3">
          This playlist contains every music reference from the Homegrown Hits podcast, featuring {trackCounts.total} remote items from various independent music feeds.
        </p>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">Total Remote Items:</span>
            <span className="ml-2 text-white">{trackCounts.total} references</span>
          </div>
          <div>
            <span className="text-gray-400">Tracks with Audio:</span>
            <span className="ml-2 text-green-400">{trackCounts.withAudio} playable</span>
          </div>
          <div>
            <span className="text-gray-400">Tracks with Artwork:</span>
            <span className="ml-2 text-blue-400">{trackCounts.withArtwork} with covers</span>
          </div>
          <div>
            <span className="text-gray-400">Source:</span>
            <span className="ml-2 text-white">Homegrown Hits Podcast</span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Homegrown Hits playlist powered by Podcasting 2.0 and Value for Value.
          <a href="https://homegrownhits.xyz" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
            Visit Homegrown Hits →
          </a>
        </p>
      </div>
    </>
  );
}