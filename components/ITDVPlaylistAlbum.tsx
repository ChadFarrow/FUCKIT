'use client';

import { useMemo } from 'react';
import PlaylistAlbum, { PlaylistConfig } from './PlaylistAlbum';
import { ITDV_AUDIO_URL_MAP } from '@/data/itdv-audio-urls';
import { ITDV_ARTWORK_URL_MAP } from '@/data/itdv-artwork-urls';
import resolvedSongsData from '@/data/itdv-resolved-songs.json';

const config: PlaylistConfig = {
  name: 'Into The Doerfel-Verse',
  description: 'Every music reference from Into The Doerfel-Verse podcast',
  coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
  resolveAudioUrls: false, // We already have resolved URLs in the data
  showResolutionStatus: false
};

export default function ITDVPlaylistAlbum() {
  // Use useMemo to prevent re-processing tracks on every render
  const enrichedTracks = useMemo(() => {
    console.log('🔄 Processing ITDV tracks...');
    
    return resolvedSongsData.map((song: any) => {
      // Get audio URL from the map using the song title
      const audioUrl = ITDV_AUDIO_URL_MAP[song.title] || '';
      
      // Get artwork URL from the map using the song title
      const artworkUrl = ITDV_ARTWORK_URL_MAP[song.title] || '';
      
      return {
        ...song,
        audioUrl: audioUrl,
        artworkUrl: artworkUrl
      };
    });
  }, []); // Empty dependency array means this only runs once

  // Pre-calculate counts for better performance
  const trackCounts = useMemo(() => {
    const withAudio = enrichedTracks.filter((t: any) => t.audioUrl).length;
    const withArtwork = enrichedTracks.filter((t: any) => t.artworkUrl).length;
    
    console.log(`✅ ITDV tracks processed: ${enrichedTracks.length} total, ${withAudio} with audio, ${withArtwork} with artwork`);
    
    return { total: enrichedTracks.length, withAudio, withArtwork };
  }, [enrichedTracks]);

  return (
    <>
      <PlaylistAlbum
        config={config}
        tracks={enrichedTracks}
      />
      <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">About This Playlist</h3>
        <p className="text-sm text-gray-300 mb-3">
          This playlist contains every music reference from the Into The Doerfel-Verse podcast, featuring {trackCounts.total} tracks with audio and artwork.
        </p>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">Total Tracks:</span>
            <span className="ml-2 text-white">{trackCounts.total} songs</span>
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
            <span className="ml-2 text-white">Episodes 31-56</span>
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