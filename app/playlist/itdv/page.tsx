'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Music } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration?: number;
}

export default function ITDVPlaylistPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadTracks();
  }, []);

  // Helper function to extract episode number from title
  const extractEpisodeNumber = (episodeTitle: string): number => {
    const match = episodeTitle.match(/Episode (\d+)/i);
    return match ? parseInt(match[1], 10) : 999; // Put unknown episodes at the end
  };

  const loadTracks = async () => {
    try {
      // Try to get fresh extraction first to capture V4V value splits
      const extractResponse = await fetch('/api/music-tracks?feedUrl=https://www.doerfelverse.com/feeds/intothedoerfelverse.xml');
      const extractData = await extractResponse.json();
      
      if (extractData.success && extractData.data.tracks) {
        // First, let's see all available tracks and filter more loosely
        const musicTracks = extractData.data.tracks.filter((track: any) => {
          const title = track.title.toLowerCase();
          
          // Exclude obvious non-music
          if (title.includes('verse!') || title === 'verse' || track.duration === 0) {
            return false;
          }
          
          // Include anything that might be music
          return (
            track.source === 'value-split' || // V4V value splits (the real music!)
            track.duration > 0 || // Has some duration
            track.artist !== 'Unknown Artist' || // Has a real artist
            title.includes('song') ||
            title.includes('music') ||
            title.includes('remix') ||
            title.includes('feat') ||
            title.includes('live') ||
            title.includes('mix')
          );
        });
        
        // Convert to our Track interface
        const formattedTracks = musicTracks.map((track: any) => ({
          id: track.id,
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          episodeTitle: track.episodeTitle,
          audioUrl: track.url || track.audioUrl,
          startTime: track.startTime || 0,
          endTime: track.endTime || track.startTime + track.duration
        }));
        
        // Sort by episode number (1 to latest)
        const sortedTracks = formattedTracks.sort((a: Track, b: Track) => {
          const aEpisode = extractEpisodeNumber(a.episodeTitle);
          const bEpisode = extractEpisodeNumber(b.episodeTitle);
          return aEpisode - bEpisode;
        });
        
        setTracks(sortedTracks);
      } else {
        // Fallback to database
        const response = await fetch('/api/music-tracks/database?feedId=https://www.doerfelverse.com/feeds/intothedoerfelverse.xml&pageSize=100');
        const data = await response.json();
        
        if (data.success) {
          const realMusicTracks = data.data.tracks.filter((track: any) => {
            const title = track.title.toLowerCase();
            return (
              track.duration > 0 && 
              !title.includes('verse!') &&
              title !== 'verse' &&
              (track.artist !== 'Unknown Artist' || 
               title.includes('song') || 
               title.includes('music') || 
               title.includes('remix') || 
               title.includes('feat') || 
               title.includes('live'))
            );
          });
          
          // Convert to Track interface
          const formattedTracks: Track[] = realMusicTracks.map((track: any) => ({
            id: track.id,
            title: track.title,
            artist: track.artist || 'Unknown Artist',
            episodeTitle: track.episodeTitle,
            audioUrl: track.url || track.audioUrl,
            startTime: track.startTime || 0,
            endTime: track.endTime || track.startTime + track.duration,
            duration: track.duration
          }));
          
          // Sort by episode number (1 to latest)
          const sortedTracks = formattedTracks.sort((a: Track, b: Track) => {
            const aEpisode = extractEpisodeNumber(a.episodeTitle);
            const bEpisode = extractEpisodeNumber(b.episodeTitle);
            return aEpisode - bEpisode;
          });
          
          setTracks(sortedTracks);
        }
      }
    } catch (error) {
      console.error('Failed to load tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const playTrack = (track: Track) => {
    if (audio) {
      audio.pause();
    }

    const newAudio = new Audio(track.audioUrl);
    newAudio.currentTime = track.startTime;
    
    newAudio.addEventListener('timeupdate', () => {
      if (newAudio.currentTime >= track.endTime) {
        newAudio.pause();
        setCurrentTrack(null);
      }
    });

    newAudio.play();
    setAudio(newAudio);
    setCurrentTrack(track.id);
  };

  const stopTrack = () => {
    if (audio) {
      audio.pause();
      setCurrentTrack(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading playlist...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Music className="w-8 h-8 text-green-400" />
          <h1 className="text-3xl font-bold">Into The Doerfel Verse - Music Playlist</h1>
        </div>
        
        <p className="text-gray-400 mb-6">
          {tracks.length} music tracks from ITDV episodes
        </p>

        <div className="space-y-2">
          {tracks.map((track) => (
            <div key={track.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition-colors">
              <div className="flex-1">
                <h3 className="font-semibold">{track.title}</h3>
                <p className="text-gray-400 text-sm">{track.artist}</p>
                <p className="text-gray-500 text-xs">{track.episodeTitle}</p>
              </div>
              
              <button
                onClick={() => currentTrack === track.id ? stopTrack() : playTrack(track)}
                className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
              >
                {currentTrack === track.id ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}