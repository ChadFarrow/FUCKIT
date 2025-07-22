'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { RSSParser, RSSAlbum, RSSTrack } from '@/lib/rss-parser';
import { extractDominantColors, DominantColors, getContrastColor, adjustColorBrightness } from '@/lib/color-extractor';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [album, setAlbum] = useState<RSSAlbum | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<RSSTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantColors, setDominantColors] = useState<DominantColors | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadAlbumData();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrack]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (duration: string): string => {
    // If already formatted with colon, return as is
    if (duration.includes(':')) return duration;
    // If it's just seconds, convert to MM:SS format
    const seconds = parseInt(duration);
    if (!isNaN(seconds)) {
      return formatTime(seconds);
    }
    return duration;
  };

  const playTrack = (track: RSSTrack) => {
    if (!track.url) return;
    
    setCurrentTrack(track);
    const audio = audioRef.current;
    if (audio) {
      audio.src = track.url;
      audio.play();
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
  };

  const loadAlbumData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading RSS feed...');
      const albumData = await RSSParser.parseAlbumFeed('https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml');
      
      if (albumData) {
        setAlbum(albumData);
        console.log('Album loaded successfully:', {
          title: albumData.title,
          artist: albumData.artist,
          tracks: albumData.tracks.length,
          coverArt: albumData.coverArt
        });
        
        // Extract dominant colors from album artwork
        if (albumData.coverArt) {
          try {
            const colors = await extractDominantColors(albumData.coverArt);
            setDominantColors(colors);
            console.log('🎨 Extracted dominant colors:', colors);
            console.log('🎨 Album cover URL:', albumData.coverArt);
          } catch (colorError) {
            console.error('Error extracting colors:', colorError);
          }
        }
      } else {
        setError('Failed to load album data from RSS feed');
        console.log('RSS Parser returned null');
      }
    } catch (err) {
      console.error('Error loading album:', err);
      setError(`Error loading album data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen text-white transition-all duration-1000"
      style={{
        background: dominantColors 
          ? `linear-gradient(135deg, ${dominantColors.primary}05, ${dominantColors.secondary}05, ${dominantColors.tertiary}05)`
          : 'rgb(3, 7, 18)'
      }}
    >
      {/* Header */}
      <header 
        className="border-b transition-all duration-1000"
        style={{
          background: dominantColors 
            ? `linear-gradient(90deg, ${dominantColors.primary}15, ${dominantColors.secondary}15)`
            : 'rgb(17, 24, 39)',
          borderColor: dominantColors 
            ? `${dominantColors.tertiary}30`
            : 'rgb(31, 41, 55)'
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 relative border border-gray-700 rounded-lg overflow-hidden">
              <Image 
                src="/logo.webp" 
                alt="VALUE Logo" 
                width={40} 
                height={40}
                className="object-cover"
              />
            </div>
            <h1 className="text-4xl font-bold">Into the ValueVerse</h1>
          </div>
          <p className="text-gray-400 text-lg mb-4">
            A collection of albums and music from The Doerfels fanbase and beyond.
          </p>
          <div className="flex items-center gap-2 text-sm">
            {isLoading ? (
              <>
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                <span className="text-yellow-400">Loading RSS feed...</span>
              </>
            ) : error ? (
              <>
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <span className="text-red-400">{error}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-green-400">RSS feed loaded successfully</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 pb-24">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4 text-red-400">Error Loading Album</h2>
            <p className="text-gray-400">{error}</p>
            <button 
              onClick={loadAlbumData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : album ? (
          <div className="max-w-4xl mx-auto">
            {/* Album Header */}
            <div 
              className="flex flex-col md:flex-row gap-8 mb-8 p-6 rounded-lg"
              style={{
                background: dominantColors 
                  ? `linear-gradient(135deg, ${dominantColors.primary}20, ${dominantColors.secondary}20, ${dominantColors.tertiary}20)`
                  : 'rgba(31, 41, 55, 0.5)'
              }}
            >
              <div className="flex-shrink-0">
                {album.coverArt ? (
                  <Image 
                    src={album.coverArt} 
                    alt={album.title}
                    width={300}
                    height={300}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-[300px] h-[300px] bg-gradient-to-br from-red-700 to-red-900 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xl font-bold text-center px-4">
                      {album.title}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{album.title}</h1>
                <p className="text-xl text-gray-400 mb-4">{album.artist}</p>
                {album.subtitle && (
                  <p className="text-xl text-gray-300 mb-4 italic">{album.subtitle}</p>
                )}
                {(album.summary || album.description) && (
                  <p className="text-gray-300 mb-6">{album.summary || album.description}</p>
                )}
                
                                  {/* Dominant Colors */}
                  {dominantColors && (
                    <div className="mb-6">
                      <span className="text-sm text-gray-400 mr-2">Album Colors:</span>
                      <div className="inline-flex gap-2 mt-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-600"
                            style={{ backgroundColor: dominantColors.primary }}
                            title={`Primary: ${dominantColors.primary}`}
                          />
                          <span className="text-xs text-gray-300">{dominantColors.primary}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-600"
                            style={{ backgroundColor: dominantColors.secondary }}
                            title={`Secondary: ${dominantColors.secondary}`}
                          />
                          <span className="text-xs text-gray-300">{dominantColors.secondary}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-600"
                            style={{ backgroundColor: dominantColors.tertiary }}
                            title={`Tertiary: ${dominantColors.tertiary}`}
                          />
                          <span className="text-xs text-gray-300">{dominantColors.tertiary}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Categories and Keywords */}
                  {(album.categories || album.keywords) && (
                  <div className="mb-6">
                    {album.categories && album.categories.length > 0 && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-400 mr-2">Categories:</span>
                        <div className="inline-flex flex-wrap gap-2">
                          {album.categories.map((category, index) => (
                            <span key={index} className="bg-gray-800 text-gray-300 px-2 py-1 rounded-full text-xs">
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {album.keywords && album.keywords.length > 0 && (
                      <div>
                        <span className="text-sm text-gray-400 mr-2">Tags:</span>
                        <div className="inline-flex flex-wrap gap-2">
                                                      {album.keywords.map((keyword: string, index: number) => (
                            <span key={index} className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-xs">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
                  <span>{album.tracks.length} tracks</span>
                  <span>{new Date(album.releaseDate).getFullYear()}</span>
                </div>
                
                {/* Funding Information */}
                {album.funding && album.funding.length > 0 && (
                  <div className="mb-6">
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
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V16h-2.67v2.09c-2.04-.26-3.44-1.31-3.44-2.59 0-.66.53-1.19 1.19-1.19.66 0 1.19.53 1.19 1.19 0 .31-.12.59-.31.8.47.11 1.02.16 1.62.16s1.15-.05 1.62-.16c-.19-.21-.31-.49-.31-.8 0-.66.53-1.19 1.19-1.19.66 0 1.19.53 1.19 1.19 0 1.28-1.4 2.33-3.44 2.59V18.09zM15.5 11.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/>
                          </svg>
                          {funding.message || 'Support'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Track List */}
            {album.tracks.length > 0 && (
              <div id="track-list" className="bg-gray-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Tracks</h2>
                <div className="space-y-2">
                  {album.tracks.map((track: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 rounded-lg transition-colors group"
                      style={{
                        background: 'transparent',
                        '--hover-bg': dominantColors ? `${dominantColors.primary}10` : 'rgb(31, 41, 55)'
                      } as React.CSSProperties}
                      onMouseEnter={(e) => {
                        if (dominantColors) {
                          e.currentTarget.style.background = `${dominantColors.primary}10`;
                        } else {
                          e.currentTarget.style.background = 'rgb(31, 41, 55)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Track artwork or play button */}
                        {track.image ? (
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image 
                              src={track.image} 
                              alt={track.title}
                              width={48}
                              height={48}
                              className="rounded object-cover"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-200 flex items-center justify-center">
                              {currentTrack?.title === track.title && isPlaying ? (
                                <button 
                                  onClick={togglePlayPause}
                                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                  </svg>
                                </button>
                              ) : (
                                <button 
                                  onClick={() => playTrack(track)}
                                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                  disabled={!track.url}
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-8 flex items-center justify-center">
                            {currentTrack?.title === track.title && isPlaying ? (
                              <button 
                                onClick={togglePlayPause}
                                style={{
                                  color: dominantColors ? dominantColors.secondary : '#4ade80'
                                }}
                                className="hover:opacity-80"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                </svg>
                              </button>
                            ) : (
                              <button 
                                onClick={() => playTrack(track)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={!track.url}
                                style={{
                                  color: dominantColors ? dominantColors.primary : '#9ca3af'
                                }}
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </button>
                            )}
                            <span className="text-gray-400 text-sm group-hover:opacity-0 transition-opacity">
                              {track.trackNumber || index + 1}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex-1">
                                                      <p 
                              className="font-medium"
                              style={{
                                color: currentTrack?.title === track.title 
                                  ? dominantColors 
                                    ? dominantColors.secondary
                                    : '#4ade80'
                                  : 'white'
                              }}
                            >
                            {track.title}
                          </p>
                          {track.subtitle && (
                            <p className="text-sm text-gray-500 italic">{track.subtitle}</p>
                          )}
                          {track.keywords && track.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {track.keywords.slice(0, 3).map((keyword: string, idx: number) => (
                                <span key={idx} className="bg-gray-700 text-gray-400 px-1 py-0.5 rounded text-xs">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {track.explicit && (
                          <span className="bg-red-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                            E
                          </span>
                        )}
                        <span className="text-sm text-gray-400">{formatDuration(track.duration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Footer Information */}
            {(album.copyright || album.owner || album.language) && (
              <div className="mt-12 pt-6 border-t border-gray-800">
                <div className="text-xs text-gray-500 space-y-1">
                  {album.copyright && (
                    <p>© {album.copyright}</p>
                  )}
                  {album.owner && (
                    <p>
                      Owner: {album.owner.name}
                      {album.owner.email && (
                        <span> ({album.owner.email})</span>
                      )}
                    </p>
                  )}
                  {album.language && (
                    <p>Language: {album.language}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">No Album Data</h2>
            <p className="text-gray-400">Unable to load album information.</p>
          </div>
        )}
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} />

      {/* Music Player */}
      <div 
        className="fixed bottom-0 left-0 right-0 p-4 z-50 transition-all duration-1000"
        style={{
          background: dominantColors 
            ? `linear-gradient(90deg, ${dominantColors.primary}20, ${dominantColors.secondary}20)`
            : 'rgb(17, 24, 39)',
          borderTop: dominantColors 
            ? `1px solid ${dominantColors.tertiary}40`
            : '1px solid rgb(31, 41, 55)'
        }}
      >
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                {currentTrack && album?.coverArt ? (
                  <Image 
                    src={album.coverArt} 
                    alt={currentTrack.title}
                    width={48}
                    height={48}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3l3.01 2.18L19 3v11.5c-.64-.39-1.4-.55-2.2-.55C15.24 13.95 14 15.19 14 16.75s1.24 2.8 2.8 2.8c1.56 0 2.8-1.24 2.8-2.8V7l-4-2.25v7.5c-.64-.39-1.4-.55-2.2-.55C11.84 11.7 10.6 12.94 10.6 14.5s1.24 2.8 2.8 2.8c1.56 0 2.8-1.24 2.8-2.8V3z"/>
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-medium text-white text-sm">
                    {currentTrack ? currentTrack.title : 'No track selected'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {currentTrack ? album?.artist : 'Choose a track to play'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 flex-1 justify-center">
                <button 
                  onClick={togglePlayPause}
                  disabled={!currentTrack}
                  className={`rounded-full p-2 transition-colors ${
                    currentTrack 
                      ? 'hover:bg-gray-200' 
                      : 'cursor-not-allowed'
                  }`}
                  style={{
                    background: currentTrack 
                      ? dominantColors 
                        ? dominantColors.primary
                        : 'white'
                      : 'rgb(55, 65, 81)',
                    color: currentTrack 
                      ? dominantColors 
                        ? getContrastColor(dominantColors.primary)
                        : 'black'
                      : 'rgb(156, 163, 175)'
                  }}
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className="text-xs text-gray-400">
                  {currentTrack ? formatTime(currentTime) : '0:00'}
                </span>
                                  <div 
                    className="w-24 h-1 rounded-full overflow-hidden relative"
                    style={{ background: dominantColors ? `${dominantColors.tertiary}30` : 'rgb(55, 65, 81)' }}
                  >
                    <div 
                      className="h-full transition-all duration-100"
                      style={{ 
                        width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                        background: dominantColors ? dominantColors.secondary : 'white'
                      }}
                    />
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    disabled={!currentTrack}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {currentTrack ? formatTime(duration) : '0:00'}
                </span>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
} 