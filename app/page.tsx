'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { RSSParser, RSSAlbum, RSSTrack } from '@/lib/rss-parser';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [album, setAlbum] = useState<RSSAlbum | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<RSSTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
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
      <div className="container mx-auto px-6 py-8">
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
            <div className="flex flex-col md:flex-row gap-8 mb-8">
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
                {album.description && (
                  <p className="text-gray-300 mb-6">{album.description}</p>
                )}
                <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
                  <span>{album.tracks.length} tracks</span>
                  <span>{new Date(album.releaseDate).getFullYear()}</span>
                </div>
                
                <Link 
                  href={`/album/bloodshot-lies`}
                  className="bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors inline-block"
                >
                  View Album
                </Link>
              </div>
            </div>

            {/* Track List */}
            {album.tracks.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Tracks</h2>
                <div className="space-y-2">
                  {album.tracks.map((track: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-lg transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-8 flex items-center justify-center">
                          {currentTrack?.title === track.title && isPlaying ? (
                            <button 
                              onClick={togglePlayPause}
                              className="text-green-400 hover:text-green-300"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                              </svg>
                            </button>
                          ) : (
                            <button 
                              onClick={() => playTrack(track)}
                              className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={!track.url}
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
                        <div>
                          <p className={`font-medium ${currentTrack?.title === track.title ? 'text-green-400' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <p className="text-sm text-gray-400">{album.artist}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">{formatDuration(track.duration)}</span>
                    </div>
                  ))}
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
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                {album?.coverArt && (
                  <Image 
                    src={album.coverArt} 
                    alt={currentTrack.title}
                    width={48}
                    height={48}
                    className="rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-white text-sm">{currentTrack.title}</p>
                  <p className="text-gray-400 text-xs">{album?.artist}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 flex-1 justify-center">
                <button 
                  onClick={togglePlayPause}
                  className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
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
                <span className="text-xs text-gray-400">{formatTime(currentTime)}</span>
                <div className="w-24 h-1 bg-gray-700 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-white transition-all duration-100"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-xs text-gray-400">{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 