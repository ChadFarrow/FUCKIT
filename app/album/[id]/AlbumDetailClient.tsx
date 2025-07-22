'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Pause, Heart, Share2, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { RSSAlbum } from '@/lib/rss-parser';
import { getAlbumArtworkUrl, getTrackArtworkUrl } from '@/lib/cdn-utils';
import { RSSParser } from '@/lib/rss-parser';

interface AlbumDetailClientProps {
  albumTitle: string;
  initialAlbum: RSSAlbum | null;
}

export default function AlbumDetailClient({ albumTitle, initialAlbum }: AlbumDetailClientProps) {
  const [album, setAlbum] = useState<RSSAlbum | null>(initialAlbum);
  const [isLoading, setIsLoading] = useState(!initialAlbum);
  const [error, setError] = useState<string | null>(null);
  const [podrollAlbums, setPodrollAlbums] = useState<RSSAlbum[]>([]);
  
  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatDuration = (duration: string): string => {
    if (!duration) return '0:00';
    
    // If already formatted with colon, return as is
    if (duration.includes(':')) return duration;
    
    // If it's just seconds, convert to MM:SS format
    const seconds = parseInt(duration);
    if (!isNaN(seconds)) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Try to parse other formats and ensure colon format
    return duration;
  };

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio player functions
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playTrack = (index: number) => {
    if (album && album.tracks[index] && album.tracks[index].url) {
      setCurrentTrackIndex(index);
      if (audioRef.current) {
        audioRef.current.src = album.tracks[index].url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const playAlbum = () => {
    if (album && album.tracks.length > 0) {
      playTrack(0);
    }
  };

  const nextTrack = () => {
    if (album && currentTrackIndex < album.tracks.length - 1) {
      playTrack(currentTrackIndex + 1);
    }
  };

  const prevTrack = () => {
    if (album && currentTrackIndex > 0) {
      playTrack(currentTrackIndex - 1);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    nextTrack();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Load album data if not provided initially
  useEffect(() => {
    if (!initialAlbum) {
      const loadAlbum = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Smart feed selection based on album title
          const decodedAlbumTitle = decodeURIComponent(albumTitle);
          let feedUrls: string[] = [];
          
          // Map album titles to their specific feeds
          const titleToFeedMap: { [key: string]: string } = {
            'into the doerfel-verse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
            'into the doerfelverse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
            'music from the doerfel-verse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
            'music from the doerfelverse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
            'bloodshot lies': 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
            'wrath of banjo': 'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
            'ben doerfel': 'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
            'nostalgic': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
            'citybeach': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
            'kurtisdrums v1': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
            'ring that bell': 'https://www.thisisjdog.com/media/ring-that-bell.xml',
          };
          
          // Try to find a specific feed first
          const normalizedTitle = decodedAlbumTitle.toLowerCase();
          const specificFeed = titleToFeedMap[normalizedTitle];
          
          if (specificFeed) {
            feedUrls = [specificFeed];
          } else {
            // Fallback to main feeds
            feedUrls = [
              'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
              'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
              'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
              'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
              'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
            ];
          }
          
          // Map to proxy URLs
          const proxiedFeedUrls = feedUrls.map(url => `/api/fetch-rss?url=${encodeURIComponent(url)}`);
          
          // Parse feeds
          const albumsData = await RSSParser.parseMultipleFeeds(proxiedFeedUrls);
          
          // Debug: Log all available albums
          console.log('🔍 Available albums:', albumsData.map(a => ({ title: a.title, artist: a.artist })));
          console.log('🎯 Searching for album:', decodedAlbumTitle);
          
          // Find the matching album with more flexible matching
          const foundAlbum = albumsData.find(a => {
            const albumTitleLower = a.title.toLowerCase();
            const searchTitleLower = decodedAlbumTitle.toLowerCase();
            
            // Exact match
            if (a.title === decodedAlbumTitle || a.title === albumTitle) {
              console.log('✅ Exact match found:', a.title);
              return true;
            }
            
            // Case-insensitive match
            if (albumTitleLower === searchTitleLower) {
              console.log('✅ Case-insensitive match found:', a.title);
              return true;
            }
            
            // Contains match (search title contains album title or vice versa)
            if (albumTitleLower.includes(searchTitleLower) || searchTitleLower.includes(albumTitleLower)) {
              console.log('✅ Contains match found:', a.title);
              return true;
            }
            
            // Normalized match (remove special characters)
            const normalizedAlbum = albumTitleLower.replace(/[^a-z0-9]/g, '');
            const normalizedSearch = searchTitleLower.replace(/[^a-z0-9]/g, '');
            if (normalizedAlbum === normalizedSearch) {
              console.log('✅ Normalized match found:', a.title);
              return true;
            }
            
            // Partial normalized match
            if (normalizedAlbum.includes(normalizedSearch) || normalizedSearch.includes(normalizedAlbum)) {
              console.log('✅ Partial normalized match found:', a.title);
              return true;
            }
            
            return false;
          });
          
          if (foundAlbum) {
            setAlbum(foundAlbum);
            // Load PodRoll albums if they exist
            if (foundAlbum.podroll && foundAlbum.podroll.length > 0) {
              loadPodrollAlbums(foundAlbum.podroll);
            }
          } else {
            setError('Album not found');
          }
        } catch (err) {
          console.error('Error loading album:', err);
          setError('Error loading album data');
        } finally {
          setIsLoading(false);
        }
      };

      loadAlbum();
    } else {
      // Load PodRoll albums if they exist
      if (initialAlbum.podroll && initialAlbum.podroll.length > 0) {
        loadPodrollAlbums(initialAlbum.podroll);
      }
    }
  }, [albumTitle, initialAlbum]);

  const loadPodrollAlbums = async (podrollItems: { url: string; title?: string; description?: string }[]) => {
    try {
      const podrollUrls = podrollItems.map(item => item.url);
      const proxiedPodrollUrls = podrollUrls.map(url => `/api/fetch-rss?url=${encodeURIComponent(url)}`);
      const podrollAlbumsData = await RSSParser.parseMultipleFeeds(proxiedPodrollUrls);
      setPodrollAlbums(podrollAlbumsData);
    } catch (err) {
      console.error('Error loading PodRoll albums:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold">Loading Album...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{error || 'Album Not Found'}</h1>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              ← Back to Albums
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-white relative"
      style={{
        background: album?.coverArt 
          ? `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('${album.coverArt}') center/cover fixed`
          : 'linear-gradient(to br, rgb(17, 24, 39), rgb(31, 41, 55), rgb(17, 24, 39))'
      }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="container mx-auto px-6 py-8 pb-32">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Albums
        </Link>

        {/* Album Header */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-shrink-0">
            {album.coverArt ? (
              <Image 
                src={getAlbumArtworkUrl(album.coverArt, 'large')} 
                alt={album.title}
                width={320}
                height={320}
                className="rounded-lg object-cover shadow-2xl"
              />
            ) : (
              <div className="w-80 h-80 bg-gradient-to-br from-red-700 to-red-900 rounded-lg relative overflow-hidden flex items-center justify-center">
                <div className="text-white text-2xl font-bold text-center px-4">
                  {album.title}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{album.title}</h1>
            <p className="text-xl text-gray-400 mb-4">{album.artist}</p>
            
            {album.subtitle && (
              <p className="text-lg text-gray-300 mb-4 italic">{album.subtitle}</p>
            )}
            
            {(album.summary || album.description) && (
              <p className="text-gray-300 mb-6">{album.summary || album.description}</p>
            )}
            
            <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
              <span>{new Date(album.releaseDate).getFullYear()}</span>
              <span>{album.tracks.length} tracks</span>
              {album.explicit && <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">EXPLICIT</span>}
            </div>
            
            <div className="flex gap-4 flex-wrap">
              <button 
                onClick={playAlbum}
                className="bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors flex items-center"
              >
                {isPlaying && currentTrackIndex === 0 ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isPlaying && currentTrackIndex === 0 ? 'Pause' : 'Play Album'}
              </button>
              <button className="border border-gray-600 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center">
                <Heart className="h-4 w-4 mr-2" />
                Save
              </button>
              <button className="border border-gray-600 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </button>
            </div>

            {/* Funding Information */}
            {album.funding && album.funding.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-white">Support This Artist</h3>
                <div className="flex flex-wrap gap-3">
                  {album.funding.map((funding, index) => (
                    <a
                      key={index}
                      href={funding.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                      💝 {funding.message || 'Support'}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Track List */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Tracks</h2>
          <div className="space-y-2">
            {album.tracks.map((track, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-3 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer ${
                  currentTrackIndex === index ? 'bg-white/20' : ''
                }`}
                onClick={() => playTrack(index)}
              >
                <div className="flex items-center gap-4">
                  {track.image ? (
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <Image 
                        src={track.image} 
                        alt={track.title}
                        width={48}
                        height={48}
                        className="rounded object-cover"
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm w-8 text-center">{track.trackNumber || index + 1}</span>
                  )}
                  <div>
                    <p className="font-medium">{track.title}</p>
                    {track.subtitle && (
                      <p className="text-sm text-gray-400 italic">{track.subtitle}</p>
                    )}
                    <p className="text-sm text-gray-400">{album.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {track.explicit && (
                    <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                      E
                    </span>
                  )}
                  <span className="text-sm text-gray-400">
                    {formatDuration(track.duration)}
                  </span>
                  <button 
                    className="text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      playTrack(index);
                    }}
                  >
                    {currentTrackIndex === index && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PodRoll Recommendations */}
        {podrollAlbums.length > 0 && (
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 mt-8">
            <h2 className="text-xl font-semibold mb-4">You Might Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {podrollAlbums.map((podrollAlbum, index) => (
                <Link
                  key={index}
                  href={`/album/${encodeURIComponent(podrollAlbum.title)}`}
                  className="group block"
                >
                  <div className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all duration-200 hover:scale-105">
                    <div className="aspect-square relative mb-3">
                      {podrollAlbum.coverArt ? (
                        <Image 
                          src={getAlbumArtworkUrl(podrollAlbum.coverArt, 'thumbnail')} 
                          alt={podrollAlbum.title}
                          width={150}
                          height={150}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 rounded-md flex items-center justify-center">
                          <div className="text-white text-sm font-bold text-center px-2">
                            {podrollAlbum.title}
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-md transition-all duration-200 flex items-center justify-center">
                        <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {podrollAlbum.title}
                    </h3>
                    <p className="text-gray-400 text-xs">
                      {podrollAlbum.artist}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Audio Player Bar */}
      {album.tracks.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-gray-700 p-4">
          <div className="container mx-auto flex items-center gap-4">
            {/* Current Track Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {album.coverArt && (
                <Image 
                  src={getAlbumArtworkUrl(album.coverArt, 'thumbnail')} 
                  alt={album.title}
                  width={48}
                  height={48}
                  className="rounded object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {album.tracks[currentTrackIndex]?.title || 'No track selected'}
                </p>
                <p className="text-sm text-gray-400 truncate">{album.artist}</p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-4">
              <button 
                onClick={prevTrack}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={currentTrackIndex === 0}
              >
                <SkipBack className="h-5 w-5" />
              </button>
              
              <button 
                onClick={togglePlay}
                className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              
              <button 
                onClick={nextTrack}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={currentTrackIndex === album.tracks.length - 1}
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 