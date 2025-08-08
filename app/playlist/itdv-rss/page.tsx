'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ITDVPlaylistAlbum from '../../../components/ITDVPlaylistAlbum';
import GlobalNowPlayingBar from '../../../components/GlobalNowPlayingBar';

interface APISong {
  feedGuid: string;
  itemGuid: string;
  title: string | null;
  artist: string | null;
  feedUrl: string | null;
  feedTitle: string | null;
  episodeId?: number;
  feedId?: number;
  albumArtwork?: string;
  artwork?: string;
}

interface ComponentSong {
  id: string;
  title: string;
  artist: string;
  episodeId: string;
  episodeTitle: string;
  episodeDate: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioUrl: string;
  source: string;
  feedUrl: string;
  discoveredAt: string;
  albumArtwork?: string;
  artwork?: string;
  valueForValue: {
    lightningAddress: string;
    suggestedAmount: number;
    remotePercentage: number;
    feedGuid: string;
    itemGuid: string;
    resolvedTitle: string;
    resolvedArtist: string;
    resolvedImage: string;
    resolvedAudioUrl: string;
    resolved: boolean;
    lastResolved: string;
  };
  description: string;
}

interface NowPlayingTrack {
  id: string;
  title: string;
  artist: string;
  albumArtwork?: string;
  artwork?: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
}

export default function ITDVPlaylistPage() {
  const [songs, setSongs] = useState<ComponentSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<NowPlayingTrack | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadSongs() {
      try {
        const response = await fetch('/api/itdv-resolved-songs');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apiSongs: APISong[] = await response.json();
        
        const transformedSongs: ComponentSong[] = apiSongs.map((apiSong, index) => ({
          id: apiSong.itemGuid || `track-${index}`,
          title: apiSong.title || 'Unknown Track',
          artist: apiSong.artist || 'Unknown Artist',
          episodeId: apiSong.episodeId?.toString() || '',
          episodeTitle: apiSong.feedTitle || 'Into The Doerfel-Verse',
          episodeDate: new Date().toISOString(),
          startTime: 0,
          endTime: 180,
          duration: 180,
          audioUrl: '',
          source: 'ITDV RSS',
          feedUrl: apiSong.feedUrl || '',
          discoveredAt: new Date().toISOString(),
          albumArtwork: apiSong.albumArtwork || apiSong.artwork || '',
          artwork: apiSong.artwork || apiSong.albumArtwork || '',
          valueForValue: {
            lightningAddress: '',
            suggestedAmount: 0,
            remotePercentage: 0,
            feedGuid: apiSong.feedGuid || '',
            itemGuid: apiSong.itemGuid || '',
            resolvedTitle: apiSong.title || '',
            resolvedArtist: apiSong.artist || '',
            resolvedImage: apiSong.albumArtwork || apiSong.artwork || '',
            resolvedAudioUrl: '',
            resolved: !!(apiSong.title && apiSong.artist),
            lastResolved: new Date().toISOString()
          },
          description: `Track from ${apiSong.feedTitle || 'Into The Doerfel-Verse'}`
        }));
        
        setSongs(transformedSongs);
      } catch (err) {
        console.error('Error loading songs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load songs');
      } finally {
        setLoading(false);
      }
    }

    loadSongs();
  }, []);

  const resolvedSongs = songs.filter((song: ComponentSong) => song.valueForValue?.resolved);

  // Handle play/pause
  const handlePlayPause = () => {
    if (currentTrack) {
      setCurrentTrack((prev: NowPlayingTrack | null) => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
    }
  };

  // Handle next track
  const handleNext = () => {
    if (currentTrackIndex !== null && currentTrackIndex < songs.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      const nextSong = songs[nextIndex];
      setCurrentTrackIndex(nextIndex);
      setCurrentTrack({
        id: nextSong.id,
        title: nextSong.title,
        artist: nextSong.artist,
        albumArtwork: nextSong.albumArtwork || nextSong.artwork,
        artwork: nextSong.artwork || nextSong.albumArtwork,
        duration: nextSong.duration,
        currentTime: 0,
        isPlaying: true
      });
    }
  };

  // Handle previous track
  const handlePrevious = () => {
    if (currentTrackIndex !== null && currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      const prevSong = songs[prevIndex];
      setCurrentTrackIndex(prevIndex);
      setCurrentTrack({
        id: prevSong.id,
        title: prevSong.title,
        artist: prevSong.artist,
        albumArtwork: prevSong.albumArtwork || prevSong.artwork,
        artwork: prevSong.artwork || prevSong.albumArtwork,
        duration: prevSong.duration,
        currentTime: 0,
        isPlaying: true
      });
    }
  };

  // Handle seek
  const handleSeek = (time: number) => {
    if (currentTrack) {
      setCurrentTrack((prev: NowPlayingTrack | null) => prev ? { ...prev, currentTime: time } : null);
    }
  };

  // Handle track selection
  const handleTrackSelect = (song: ComponentSong, index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTrack({
      id: song.id,
      title: song.title,
      artist: song.artist,
      albumArtwork: song.albumArtwork || song.artwork,
      artwork: song.artwork || song.albumArtwork,
      duration: song.duration,
      currentTime: 0,
      isPlaying: true
    });
  };

  // Use the same background style as album pages
  const backgroundStyle = {
    background: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(https://www.doerfelverse.com/art/itdvchadf.png) top center/cover fixed',
    backgroundAttachment: 'fixed'
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white relative" style={backgroundStyle}>
        <div className="container mx-auto px-4 sm:px-6 pt-16 md:pt-12 pb-40">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Loading Music Collection...</h1>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-white relative" style={backgroundStyle}>
        <div className="container mx-auto px-4 sm:px-6 pt-16 md:pt-12 pb-40">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Error Loading Music Collection</h1>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative" style={backgroundStyle}>
      <div className="container mx-auto px-4 sm:px-6 pt-16 md:pt-12 pb-40">
        <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors">
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Albums
        </Link>

        {/* Playlist Header - Album Style */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Playlist Art */}
          <div className="relative group mx-auto w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] md:w-[280px] md:h-[280px]">
            <img 
              src="https://www.doerfelverse.com/art/itdvchadf.png"
              alt="Into The Doerfel-Verse"
              className="rounded-lg object-cover shadow-2xl w-full h-full"
            />
          </div>
          
          {/* Playlist Info */}
          <div className="text-center space-y-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">Into The Doerfel-Verse</h1>
            <p className="text-lg sm:text-xl text-gray-300">Music Collection</p>
            <p className="text-base sm:text-lg text-gray-300 italic">Episodes 31-56</p>
            
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm text-gray-400">
              <span>2024</span>
              <span>122 tracks</span>
              <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">PLAYLIST</span>
            </div>
            
            <p className="text-gray-300 text-center max-w-xs sm:max-w-lg mx-auto leading-relaxed text-sm sm:text-base px-4">
              Every music track played on Into The Doerfel-Verse podcast from episodes 31-56. 
              This playlist features remote items that reference tracks from the original ITDV feed.
            </p>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30">
                RSS Feed
              </span>
              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30">
                Podcasting 2.0
              </span>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                Remote Items
              </span>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 md:p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Tracks</h2>
          <ITDVPlaylistAlbum />
        </div>

        {/* RSS Feed Info */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 md:p-6">
          <h3 className="text-lg font-semibold text-white mb-4">RSS Feed Information</h3>
          <div className="space-y-3 text-sm">
            <div className="break-words">
              <span className="text-gray-400">Feed URL:</span>
              <code className="block sm:inline sm:ml-2 mt-1 sm:mt-0 text-blue-300 bg-gray-800/50 px-2 py-1 rounded text-xs sm:text-sm">
                https://re.podtards.com/api/playlist/itdv-rss
              </code>
            </div>
            <div className="break-words">
              <span className="text-gray-400">Original Source:</span>
              <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0 text-white text-xs sm:text-sm">https://www.doerfelverse.com/feeds/intothedoerfelverse.xml</span>
            </div>
            <div>
              <span className="text-gray-400">Format:</span>
              <span className="ml-2 text-white">Podcasting 2.0 RSS with podcast:remoteItem elements</span>
            </div>
            <div>
              <span className="text-gray-400">Compatibility:</span>
              <span className="ml-2 text-white">Works with all Podcasting 2.0 apps</span>
            </div>
            <div className="pt-2 space-y-2">
              <Link 
                href="/api/playlist/itdv-rss" 
                target="_blank"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View RSS Feed
              </Link>
              <div>
                <Link 
                  href="/api/itdv-songs-list" 
                  target="_blank"
                  className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Resolved Songs List
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing Bar */}
      <GlobalNowPlayingBar />
    </div>
  );
}
