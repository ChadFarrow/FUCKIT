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

  const resolveTrackInfo = async (tracksToResolve: Track[]) => {
    // Only resolve tracks that have feedGuid and itemGuid
    const tracksThatNeedResolving = tracksToResolve.filter(track => 
      track.feedGuid && track.itemGuid && !track.resolved
    );

    console.log(`Resolving ${tracksThatNeedResolving.length} tracks with V4V metadata...`);

    // Process tracks in batches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < tracksThatNeedResolving.length; i += batchSize) {
      const batch = tracksThatNeedResolving.slice(i, i + batchSize);
      
      await Promise.all(batch.map(track => resolveIndividualTrack(track)));
      
      // Small delay between batches
      if (i + batchSize < tracksThatNeedResolving.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const resolveIndividualTrack = async (track: Track) => {
    if (!track.feedGuid || !track.itemGuid) return;

    // Mark as loading
    setTracks(prev => prev.map(t => 
      t.id === track.id ? { ...t, loading: true } : t
    ));

    try {
      const response = await fetch(
        `/api/resolve-music-track?feedGuid=${track.feedGuid}&itemGuid=${track.itemGuid}`
      );
      const data = await response.json();

      if (data.success && data.track) {
        setTracks(prev => prev.map(t => 
          t.id === track.id 
            ? {
                ...t,
                title: data.track.title || t.title,
                artist: data.track.artist || t.artist,
                image: data.track.image || t.image,
                resolved: true,
                loading: false
              }
            : t
        ));
        console.log(`✅ Resolved: ${data.track.title} by ${data.track.artist}`);
      } else {
        // Mark as failed to resolve but not loading, update title to be more descriptive
        setTracks(prev => prev.map(t => 
          t.id === track.id 
            ? { 
                ...t, 
                loading: false,
                title: t.title.replace('External Music Track at', 'Music Track at'),
                artist: 'V4V Reference (not in Podcast Index)'
              } 
            : t
        ));
        console.log(`❌ V4V track not in Podcast Index: ${track.title} (feedGuid: ${track.feedGuid})`);
      }
    } catch (error) {
      console.error(`Error resolving track ${track.id}:`, error);
      setTracks(prev => prev.map(t => 
        t.id === track.id ? { ...t, loading: false } : t
      ));
    }
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
          endTime: track.endTime || track.startTime + track.duration,
          duration: track.duration,
          feedGuid: track.valueForValue?.feedGuid,
          itemGuid: track.valueForValue?.itemGuid,
          resolved: false,
          loading: false
        }));
        
        // Sort by episode number (1 to latest)
        const sortedTracks = formattedTracks.sort((a: Track, b: Track) => {
          const aEpisode = extractEpisodeNumber(a.episodeTitle);
          const bEpisode = extractEpisodeNumber(b.episodeTitle);
          return aEpisode - bEpisode;
        });
        
        setTracks(sortedTracks);
        
        // Start resolving tracks with feedGuid/itemGuid
        resolveTrackInfo(sortedTracks);
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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading playlist...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-800 to-black p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Music className="w-12 h-12 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">PLAYLIST</p>
              <h1 className="text-4xl font-bold mb-2">Into The Doerfel Verse</h1>
              <p className="text-gray-400">
                The Doerfels • {tracks.length} songs • 
                {Math.round(tracks.reduce((sum, track) => sum + (track.duration || (track.endTime - track.startTime)), 0) / 60)} min
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="w-12 h-12 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center transition-colors">
                <Play className="w-6 h-6 text-black ml-1" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <select className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm">
                <option>Sort by Name</option>
                <option>Sort by Episode</option>
                <option>Sort by Duration</option>
              </select>
              <span className="text-sm text-gray-400">{tracks.length} tracks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="max-w-6xl mx-auto px-8">
        <div className="py-4">
          <h2 className="text-xl font-semibold mb-4">Tracks</h2>
          
          <div className="space-y-1">
            {tracks.map((track, index) => (
              <div 
                key={track.id} 
                className="group hover:bg-gray-800/50 p-2 rounded-lg transition-colors cursor-pointer"
                onClick={() => currentTrack === track.id ? stopTrack() : playTrack(track)}
              >
                <div className="flex items-center gap-4">
                  {/* Track Number / Play Button */}
                  <div className="w-10 text-center">
                    {currentTrack === track.id ? (
                      <Pause className="w-4 h-4 text-green-400 mx-auto" />
                    ) : (
                      <div className="group-hover:hidden text-gray-400 text-sm">
                        {index + 1}
                      </div>
                    )}
                    {currentTrack !== track.id && (
                      <Play className="w-4 h-4 text-white mx-auto hidden group-hover:block" />
                    )}
                  </div>

                  {/* Album Art */}
                  <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                    {track.image ? (
                      <img 
                        src={track.image} 
                        alt={track.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Music className="w-6 h-6 text-gray-500" />
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium truncate ${currentTrack === track.id ? 'text-green-400' : 'text-white'}`}>
                        {track.loading ? 'Loading track info...' : track.title}
                      </h3>
                      {(track.feedGuid && track.itemGuid) && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          track.resolved 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {track.resolved ? 'V4V ✓' : 'V4V'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate">
                      {track.loading ? 'Resolving artist...' : track.artist}
                    </p>
                  </div>

                  {/* Episode Info */}
                  <div className="flex-1 min-w-0 hidden md:block">
                    <p className="text-gray-400 text-sm truncate">{track.episodeTitle}</p>
                  </div>

                  {/* Duration */}
                  <div className="w-16 text-right">
                    <span className="text-gray-400 text-sm">
                      {formatDuration(track.duration || (track.endTime - track.startTime))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}