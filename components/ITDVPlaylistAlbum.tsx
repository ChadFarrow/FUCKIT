'use client';

import PlaylistAlbum, { PlaylistConfig } from './PlaylistAlbum';
import resolvedSongsData from '@/data/itdv-resolved-songs.json';

const config: PlaylistConfig = {
  name: 'Into The Doerfel-Verse',
  description: 'Every music reference from Into The Doerfel-Verse podcast',
  coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
  resolveAudioUrls: false, // We already have resolved URLs in the data
  showResolutionStatus: false
};

export default function ITDVPlaylistAlbum() {
  // Pass the raw resolved songs data directly to PlaylistAlbum
  // The PlaylistAlbum component will handle the transformation
  return (
    <>
      <PlaylistAlbum
        config={config}
        tracks={resolvedSongsData}
      />
      <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">About This Playlist</h3>
        <p className="text-sm text-gray-300 mb-3">
          This playlist contains every music reference from the Into The Doerfel-Verse podcast, featuring {resolvedSongsData.length} tracks.
        </p>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">Total Tracks:</span>
            <span className="ml-2 text-white">{resolvedSongsData.length} songs</span>
          </div>
          <div>
            <span className="text-gray-400">Source:</span>
            <span className="ml-2 text-white">Episodes 31-56</span>
          </div>
          <div>
            <span className="text-gray-400">Resolution:</span>
            <span className="ml-2 text-green-400">✓ All tracks resolved</span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Into The Doerfel-Verse playlist powered by Podcasting 2.0 and Value for Value. 
          <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
            Visit Doerfel-Verse →
          </a>
        </p>
      </div>
    </>
  );
}