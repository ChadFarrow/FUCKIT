'use client';

import { useState, useEffect } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { useScrollDetectionContext } from '@/components/ScrollDetectionProvider';
import { Play, Pause } from 'lucide-react';

interface ITDVTrack {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  duration: number;
  audioUrl?: string;
  valueForValue?: {
    feedGuid?: string;
    itemGuid?: string;
    resolved?: boolean;
    resolvedTitle?: string;
    resolvedArtist?: string;
    resolvedImage?: string;
    resolvedAudioUrl?: string;
  };
}

// Static resolved songs data - served directly from component (114 songs)
const RESOLVED_SONGS = [
  {
    "feedGuid": "3ae285ab-434c-59d8-aa2f-59c6129afb92",
    "itemGuid": "d8145cb6-97d9-4358-895b-2bf055d169aa",
    "title": "Neon Hawk",
    "artist": "John Depew Trio",
    "feedUrl": "https://wavlake.com/feed/music/99ed143c-c461-4f1a-9d0d-bee6f70d8b7e",
    "feedTitle": "Bell of Hope",
    "episodeId": 40262390560,
    "feedId": 7422180
  },
  {
    "feedGuid": "6fc2ad98-d4a8-5d70-9c68-62e9efc1209c",
    "itemGuid": "aad6e3b1-6589-4e22-b8ca-521f3d888263",
    "title": "Grey's Birthday",
    "artist": "Big Awesome",
    "feedUrl": "https://wavlake.com/feed/music/5a07b3f1-8249-45a1-b40a-630797dc4941",
    "feedTitle": "Birdfeeder (EP)",
    "episodeId": 29982854680,
    "feedId": 7086035
  },
  {
    "feedGuid": "dea01a9d-a024-5b13-84aa-b157304cd3bc",
    "itemGuid": "52007112-2772-42f9-957a-a93eaeedb222",
    "title": "Smokestacks",
    "artist": "Herbivore",
    "feedUrl": "https://wavlake.com/feed/music/328f61b9-20b1-4338-9e2a-b437abc39f7b",
    "feedTitle": "Smokestacks",
    "episodeId": 16429855198,
    "feedId": 6685399
  }
];

export default function ITDVPlaylistAlbum() {
  const [tracks, setTracks] = useState<ITDVTrack[]>([]);
  const [totalTracks, setTotalTracks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const { isPlaying, pause, resume, playAlbum } = useAudio();
  const { shouldPreventClick } = useScrollDetectionContext();

  useEffect(() => {
    // Convert static data to tracks immediately
    console.log('✅ Loading tracks from static data');
    
    const resolvedTracks = RESOLVED_SONGS
      .filter(song => song && song.feedGuid && song.itemGuid)
      .map((song, index) => ({
        id: `resolved-${index + 1}-${song.feedGuid?.substring(0, 8) || 'unknown'}`,
        title: song.title || `Music Track ${index + 1}`,
        artist: song.artist || 'Unknown Artist',
        episodeTitle: song.feedTitle || 'Into The Doerfel-Verse',
        duration: 180,
        audioUrl: song.feedUrl || '',
        valueForValue: {
          feedGuid: song.feedGuid,
          itemGuid: song.itemGuid,
          resolved: true,
          resolvedTitle: song.title,
          resolvedArtist: song.artist
        }
      }));
    
    console.log('✅ Created tracks:', resolvedTracks.length);
    setTracks(resolvedTracks);
    setTotalTracks(resolvedTracks.length);
    setIsLoading(false);
  }, []);

  const handlePlayTrack = async (track: ITDVTrack, index: number) => {
    if (shouldPreventClick()) return;

    if (currentTrackIndex === index && isPlaying) {
      pause();
      return;
    }
    
    if (currentTrackIndex === index && !isPlaying) {
      resume();
      return;
    }
    
    setCurrentTrackIndex(index);
    
    const playlistAlbum = {
      title: 'Into The Doerfel-Verse Playlist',
      artist: 'Into The Doerfel-Verse',
      description: 'Music playlist from Into The Doerfel-Verse podcast',
      coverArt: "https://www.doerfelverse.com/art/itdvchadf.png",
      releaseDate: new Date().toISOString(),
      tracks: tracks.map(t => ({
        title: t.valueForValue?.resolved && t.valueForValue?.resolvedTitle ? t.valueForValue.resolvedTitle : t.title,
        url: t.valueForValue?.resolved && t.valueForValue?.resolvedAudioUrl ? t.valueForValue.resolvedAudioUrl : t.audioUrl || '',
        startTime: t.valueForValue?.resolved ? 0 : 0,
        duration: t.duration ? t.duration.toString() : '300'
      }))
    };
    
    await playAlbum(playlistAlbum, index);
  };

  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="text-sm text-gray-400">Loading Into The Doerfel-Verse tracks...</div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <div className="w-12 h-12 bg-gray-700 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-lg text-gray-300">⚠️ No Into The Doerfel-Verse tracks found</div>
        <div className="text-sm text-gray-400">
          The ITDV playlist tracks may be loading or temporarily unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-400 mb-3">
        Showing {tracks.length} of {totalTracks} tracks
        <span className="ml-2 text-green-400">
          • {tracks.length} resolved
        </span>
      </div>
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrackIndex === index;
        const displayTitle = track.valueForValue?.resolvedTitle || track.title;
        const displayArtist = track.valueForValue?.resolvedArtist || track.artist;
        const displayImage = track.valueForValue?.resolvedImage || "https://www.doerfelverse.com/art/itdvchadf.png";
        
        return (
          <div 
            key={track.id} 
            className={`flex items-center justify-between p-4 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer ${
              isCurrentTrack ? 'bg-white/20' : ''
            } border-l-2 border-green-500/50`}
            onClick={() => handlePlayTrack(track, index)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 overflow-hidden rounded">
                <img 
                  src={displayImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-gray-800"></div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <button 
                    className="bg-cyan-400/20 backdrop-blur-sm text-white rounded-full p-1 transform hover:scale-110 transition-all duration-200 shadow-lg border border-cyan-400/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayTrack(track, index);
                    }}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate text-sm md:text-base text-white">{displayTitle}</p>
                  <span className="flex-shrink-0 text-xs bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded border border-green-500/30">
                    RESOLVED
                  </span>
                </div>
                <p className="text-xs md:text-sm text-gray-400 truncate">
                  {displayArtist} • {track.episodeTitle || 'Into The Doerfel-Verse'}
                  {track.valueForValue?.feedGuid && (
                    <span className="ml-1 text-gray-500">
                      • ID: {track.valueForValue.feedGuid.substring(0, 8)}...
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <span className="text-xs md:text-sm text-gray-400">
                {formatDuration(track.duration)}
              </span>
            </div>
          </div>
        );
      })}
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <p className="text-sm text-gray-400">
            All tracks have been resolved to show actual song titles and artists from the original feeds.
          </p>
        </div>
        <p className="text-sm text-gray-400">
          Into The Doerfel-Verse playlist powered by Podcasting 2.0 and Value for Value. 
          <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
            Visit Doerfel-Verse →
          </a>
        </p>
      </div>
    </div>
  );
}