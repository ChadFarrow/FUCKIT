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
  image?: string;
  feedGuid?: string;
  itemGuid?: string;
  resolved?: boolean;
  loading?: boolean;
  source?: string;
}

export default function ITDVPlaylistPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'main' | 'complete'>('main');

  useEffect(() => {
    loadTracks();
  }, [viewMode]);

  const extractEpisodeNumber = (episodeTitle: string): number => {
    const match = episodeTitle.match(/Episode (\d+)/i);
    return match ? parseInt(match[1], 10) : 999;
  };

  const loadTracks = async () => {
    try {
      if (viewMode === 'main') {
        await loadMainFeedTracks();
      } else {
        await loadCompleteCatalog();
      }
    } catch (error) {
      console.error('Failed to load tracks:', error);
      setLoading(false);
    }
  };

  const loadMainFeedTracks = async () => {
    const feedUrl = encodeURIComponent('https://www.doerfelverse.com/feeds/intothedoerfelverse.xml');
    const response = await fetch(`/api/music-tracks?feedUrl=${feedUrl}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data.tracks) {
      const musicTracks = data.data.tracks.filter((track: any) => {
        if (!track.title || track.title === '') {
          return false;
        }
        return true;
      });
      
      const formattedTracks = musicTracks.map((track: any) => {
        const v4v = track.valueForValue;
        const isResolved = track.artist !== 'Unknown Artist' && !track.title.includes('Featured Track');
        
        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          episodeTitle: track.episodeTitle,
          audioUrl: track.audioUrl,
          startTime: track.startTime || 0,
          endTime: track.endTime || track.startTime + track.duration,
          duration: track.duration,
          image: track.image,
          feedGuid: v4v?.feedGuid,
          itemGuid: v4v?.itemGuid,
          resolved: isResolved,
          loading: false,
          source: track.source
        };
      });

      const sortedTracks = formattedTracks.sort((a: Track, b: Track) => {
        const episodeA = extractEpisodeNumber(a.episodeTitle);
        const episodeB = extractEpisodeNumber(b.episodeTitle);
        
        if (episodeA !== episodeB) {
          return episodeB - episodeA;
        }
        
        return a.startTime - b.startTime;
      });

      setTracks(sortedTracks);
      setStats({
        totalTracks: sortedTracks.length,
        uniqueArtists: Array.from(new Set(sortedTracks.map((t: Track) => t.artist))).length,
        feeds: 1
      });
      setLoading(false);
    }
  };

  const loadCompleteCatalog = async () => {
    const feeds = [
      'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
      'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
      'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml'
    ];

    const allTracks: Track[] = [];
    let totalTracks = 0;

    for (const feedUrl of feeds) {
      try {
        const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(feedUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.tracks) {
            const feedTracks = data.data.tracks.map((track: any) => ({
              id: track.id,
              title: track.title,
              artist: track.artist,
              episodeTitle: track.episodeTitle,
              audioUrl: track.audioUrl,
              startTime: track.startTime || 0,
              endTime: track.endTime || track.startTime + track.duration,
              duration: track.duration,
              image: track.image,
              feedGuid: track.valueForValue?.feedGuid,
              itemGuid: track.valueForValue?.itemGuid,
              resolved: track.artist !== 'Unknown Artist',
              loading: false,
              source: track.source
            }));
            allTracks.push(...feedTracks);
            totalTracks += feedTracks.length;
          }
        }
      } catch (error) {
        console.error(`Failed to load tracks from ${feedUrl}:`, error);
      }
    }

    const sortedTracks = allTracks.sort((a: Track, b: Track) => {
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.title.localeCompare(b.title);
    });

    setTracks(sortedTracks);
    setStats({
      totalTracks,
      uniqueArtists: Array.from(new Set(sortedTracks.map((t: Track) => t.artist))).length,
      feeds: feeds.length
    });
    setLoading(false);
  };

  const playTrack = (track: Track) => {
    if (currentTrack === track.id) {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setCurrentTrack(null);
      setAudio(null);
    } else {
      if (audio) {
        audio.pause();
      }
      
      const newAudio = new Audio(track.audioUrl);
      newAudio.currentTime = track.startTime;
      
      newAudio.addEventListener('ended', () => {
        setCurrentTrack(null);
        setAudio(null);
      });
      
      newAudio.play().catch(error => {
        console.error('Failed to play track:', error);
        alert('Failed to play track. The audio URL might not be accessible.');
      });
      
      setCurrentTrack(track.id);
      setAudio(newAudio);
    }
  };

  const stopTrack = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTrack(null);
    setAudio(null);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Music className="w-12 h-12 text-green-400 mx-auto mb-4 animate-pulse" />
              <p className="text-xl">
                {viewMode === 'main' ? 'Loading main feed tracks...' : 'Loading complete catalog...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {viewMode === 'main' ? 'Into The Doerfel-Verse' : 'Doerfel-Verse Complete Catalog'}
              </h1>
              <p className="text-gray-400">
                {viewMode === 'main' 
                  ? 'Music tracks from the main podcast feed' 
                  : 'All music tracks from the Doerfel-Verse ecosystem'
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select 
                className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'main' | 'complete')}
              >
                <option value="main">Main Feed Only</option>
                <option value="complete">Complete Catalog</option>
              </select>
              <button
                onClick={stopTrack}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Stop All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-gray-800/30 border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.totalTracks}</div>
                <div className="text-gray-400">Total Tracks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.uniqueArtists}</div>
                <div className="text-gray-400">Unique Artists</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">{stats.feeds}</div>
                <div className="text-gray-400">Music Feeds</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Music Tracks</h2>
          <span className="text-sm text-gray-400">{tracks.length} tracks</span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors cursor-pointer ${
                currentTrack === track.id
                  ? 'bg-green-600/20 border border-green-500/50'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
              onClick={() => playTrack(track)}
            >
              <button className="flex-shrink-0 w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors">
                {currentTrack === track.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{track.title}</div>
                <div className="text-sm text-gray-400 truncate">
                  {track.artist} • {track.episodeTitle}
                </div>
              </div>

              <div className="flex-shrink-0 text-sm text-gray-400">
                {track.duration ? formatDuration(track.duration) : '--:--'}
              </div>

              {track.source && (
                <div className="flex-shrink-0">
                  <span className={`px-2 py-1 rounded text-xs ${
                    track.source === 'value-split' ? 'bg-blue-600/20 text-blue-400' :
                    track.source === 'chapters' ? 'bg-green-600/20 text-green-400' :
                    track.source === 'description' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-gray-600/20 text-gray-400'
                  }`}>
                    {track.source}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {tracks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Music className="w-12 h-12 mx-auto mb-4" />
            <p>No music tracks found</p>
          </div>
        )}
      </div>
    </div>
  );
}