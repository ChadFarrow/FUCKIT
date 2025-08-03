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

  // OLD RESOLUTION CODE REMOVED - Now using cached pre-resolved data
  // Individual track resolution is no longer needed since we batch resolve during API call

  const loadTracks = async () => {
    try {
      console.log('🎵 Starting to load tracks...');
      
      // Try to get fresh extraction with V4V resolution
      const extractResponse = await fetch('/api/music-tracks?feedUrl=https://www.doerfelverse.com/feeds/intothedoerfelverse.xml&resolveV4V=true');
      console.log('📡 Extract response status:', extractResponse.status);
      
      if (!extractResponse.ok) {
        throw new Error(`HTTP error! status: ${extractResponse.status}`);
      }
      
      const extractData = await extractResponse.json();
      console.log('📊 Extract data received:', extractData.success, extractData.data?.tracks?.length, 'tracks');
      
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
        
        // Convert to our Track interface, using resolved V4V data if available
        const formattedTracks = musicTracks.map((track: any) => {
          const v4v = track.valueForValue;
          const isResolved = v4v?.resolved && v4v?.resolvedTitle;
          
          return {
            id: track.id,
            title: isResolved ? v4v.resolvedTitle : track.title,
            artist: isResolved ? v4v.resolvedArtist : (track.artist || 'Unknown Artist'),
            episodeTitle: track.episodeTitle,
            audioUrl: isResolved ? v4v.resolvedAudioUrl : (track.url || track.audioUrl),
            startTime: track.startTime || 0,
            endTime: track.endTime || track.startTime + track.duration,
            duration: isResolved ? v4v.resolvedDuration : track.duration,
            image: isResolved ? v4v.resolvedImage : track.image,
            feedGuid: v4v?.feedGuid,
            itemGuid: v4v?.itemGuid,
            resolved: isResolved,
            loading: false
          };
        });
        
        // Sort by episode number (1 to latest)
        const sortedTracks = formattedTracks.sort((a: Track, b: Track) => {
          const aEpisode = extractEpisodeNumber(a.episodeTitle);
          const bEpisode = extractEpisodeNumber(b.episodeTitle);
          return aEpisode - bEpisode;
        });
        
        console.log('✅ Setting tracks in state:', sortedTracks.length);
        console.log('📝 V4V tracks count:', sortedTracks.filter((t: Track) => t.feedGuid && t.itemGuid).length);
        console.log('🎯 Pre-resolved V4V tracks:', sortedTracks.filter((t: Track) => t.resolved).length);
        setTracks(sortedTracks);
        
        // No need to resolve individual tracks anymore - they're pre-resolved!
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

    // Use the resolved audio URL if available (actual song file), otherwise fallback to episode segment
    const audioUrl = track.resolved && track.audioUrl ? 
      track.audioUrl : // Direct song file for V4V tracks
      track.audioUrl;  // Episode segment for other tracks

    console.log(`🎵 Playing ${track.resolved ? 'direct song file' : 'episode segment'}: ${track.title}`);
    console.log(`🔗 Audio URL: ${audioUrl}`);

    const newAudio = new Audio(audioUrl);
    
    // For resolved V4V tracks, play the entire song. For episode segments, use time bounds.
    if (!track.resolved) {
      newAudio.currentTime = track.startTime;
      
      newAudio.addEventListener('timeupdate', () => {
        if (newAudio.currentTime >= track.endTime) {
          newAudio.pause();
          setCurrentTrack(null);
        }
      });
    } else {
      // For direct song files, play the entire track
      newAudio.addEventListener('ended', () => {
        setCurrentTrack(null);
      });
    }

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Tracks</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                V4V Tracks: {tracks.filter(t => t.feedGuid && t.itemGuid).length}
              </span>
              <span className="text-green-400">
                Resolved: {tracks.filter(t => t.resolved).length}
              </span>
              <span className="text-blue-400">
                References: {tracks.filter(t => t.feedGuid && t.itemGuid && !t.resolved && !t.loading).length}
              </span>
            </div>
          </div>
          
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
                        {track.title}
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
                      {track.artist}
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