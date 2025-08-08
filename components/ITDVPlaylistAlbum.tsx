'use client';

import PlaylistAlbum, { PlaylistConfig, PlaylistTrack } from './PlaylistAlbum';
import { ITDV_AUDIO_URL_MAP } from '@/data/itdv-audio-urls';
import { ITDV_ARTWORK_URL_MAP } from '@/data/itdv-artwork-urls';
import type { ITDVTrack, ITDVTrackWithUrls } from '@/types/itdv-types';
import resolvedSongsData from '@/data/itdv-resolved-songs.json';

// Static resolved songs data - served directly from component (111 songs)
// This is the complete ITDV playlist with all resolved song metadata
const RESOLVED_SONGS: ITDVTrack[] = resolvedSongsData as ITDVTrack[];

// Utility functions for getting URLs from external data files
function getStaticAudioUrl(title: string): string {
  return ITDV_AUDIO_URL_MAP[title] || '';
}

function getArtworkUrl(title: string): string {
  return ITDV_ARTWORK_URL_MAP[title] || '';
}

// Transform resolved songs to playlist tracks with all necessary data
const transformToPlaylistTracks = (): PlaylistTrack[] => {
  return RESOLVED_SONGS.map((song, index) => {
    const audioUrl = getStaticAudioUrl(song.title);
    const artworkUrl = getArtworkUrl(song.title) || song.artworkUrl || '';
    
    return {
      id: `itdv-${index + 1}`,
      title: song.title,
      artist: song.artist,
      episodeTitle: song.feedTitle || 'Into The Doerfel-Verse',
      duration: 180, // Default 3 minutes
      audioUrl: audioUrl,
      artworkUrl: artworkUrl,
      valueForValue: {
        feedGuid: song.feedGuid,
        itemGuid: song.itemGuid,
        resolved: true,
        resolvedTitle: song.title,
        resolvedArtist: song.artist,
        resolvedImage: artworkUrl,
        resolvedAudioUrl: audioUrl
      }
    } as PlaylistTrack;
  });
};

const config: PlaylistConfig = {
  name: 'Into The Doerfel-Verse',
  description: 'Every music reference from Into The Doerfel-Verse podcast',
  coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
  resolveAudioUrls: false, // We already have resolved URLs
  showResolutionStatus: true
};

export default function ITDVPlaylistAlbum() {
  // Transform resolved songs into playlist tracks
  const tracks = transformToPlaylistTracks();
  
  // Filter to only include tracks with audio URLs (all 111 tracks have URLs)
  const playableTracks = tracks.filter(track => track.audioUrl);

  return (
    <>
      <PlaylistAlbum
        config={config}
        tracks={playableTracks}
      />
      <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">About This Playlist</h3>
        <p className="text-sm text-gray-300 mb-3">
          This playlist contains every music reference from the Into The Doerfel-Verse podcast, featuring {playableTracks.length} resolved tracks with direct audio URLs.
        </p>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">Total Tracks:</span>
            <span className="ml-2 text-white">{playableTracks.length} songs</span>
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