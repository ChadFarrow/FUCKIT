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

// Generate realistic duration based on song characteristics
function generateRealisticDuration(song: ITDVTrack, index: number): number {
  const seed = (song.feedGuid?.charCodeAt(0) || 0) + 
               (song.itemGuid?.charCodeAt(0) || 0) + 
               (index * 7);
  
  const title = song.title?.toLowerCase() || '';
  const artist = song.artist?.toLowerCase() || '';
  const feedTitle = song.feedTitle?.toLowerCase() || '';
  
  let baseRange = [180, 300]; // 3-5 minutes default
  
  if (title.includes('demo') || title.includes('reprise') || title.includes('(demo)')) {
    baseRange = [120, 240]; // 2-4 minutes for demos
  } else if (title.includes('live') || title.includes('[live') || feedTitle.includes('live')) {
    baseRange = [240, 420]; // 4-7 minutes for live performances
  } else if (title.includes('lofi') || artist.includes('lofi') || feedTitle.includes('lofi')) {
    baseRange = [150, 270]; // 2.5-4.5 minutes for lofi
  } else if (artist.includes('bluegrass') || feedTitle.includes('bluegrass')) {
    baseRange = [180, 360]; // 3-6 minutes for bluegrass
  } else if (title.length > 30 || feedTitle.includes('experience')) {
    baseRange = [210, 330]; // 3.5-5.5 minutes for longer titles/albums
  }
  
  // Generate duration using seed for consistency
  const range = baseRange[1] - baseRange[0];
  const random = ((seed * 9301 + 49297) % 233280) / 233280; // Simple PRNG
  const duration = Math.floor(baseRange[0] + (random * range));
  
  return duration;
}

export default function ITDVPlaylistAlbum() {
  // Add static audio URLs and artwork to tracks
  const tracksWithAudio = RESOLVED_SONGS.map((song, index) => {
    const audioUrl = getStaticAudioUrl(song.title);
    const artworkUrl = getArtworkUrl(song.title);
    
    // Debug the first few tracks
    if (index < 5) {
      console.log(`Track ${index + 1}: "${song.title}"`);
      console.log(`  Audio: ${audioUrl ? 'YES' : 'NO'}`);
      console.log(`  Artwork: ${artworkUrl}`);
    }
    
    return {
      ...song,
      audioUrl,
      artworkUrl,
      duration: generateRealisticDuration(song, index)
    };
  });

  const config: PlaylistConfig = {
    name: 'Into The Doerfel-Verse',
    description: 'Music playlist from Into The Doerfel-Verse podcast',
    coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
    // Disable resolution since we have static URLs
    resolveAudioUrls: false,
    showResolutionStatus: false
  };

  const handleTrackResolved = (track: PlaylistTrack) => {
    console.log(`✅ ITDV track resolved: ${track.title} by ${track.artist}`);
  };

  return (
    <>
      <PlaylistAlbum 
        tracks={tracksWithAudio} 
        config={config} 
        onTrackResolved={handleTrackResolved}
      />
      
      {/* ITDV-specific footer */}
      <div className="mt-4 p-4 bg-gray-800/20 rounded-lg">
        <p className="text-sm text-gray-400">
          Into The Doerfel-Verse playlist powered by Podcasting 2.0 and Value for Value. 
          <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
            Visit Doerfel-Verse →
          </a>
        </p>
      </div>
    </>
  );
}