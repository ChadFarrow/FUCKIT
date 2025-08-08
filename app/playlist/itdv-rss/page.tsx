import Link from 'next/link';
import { Suspense } from 'react';
import PlaylistAlbumStateless from '@/components/PlaylistAlbumStateless';
import { PlaylistConfig } from '@/components/PlaylistAlbum';
import { ITDV_AUDIO_URL_MAP } from '@/data/itdv-audio-urls';
import { ITDV_ARTWORK_URL_MAP } from '@/data/itdv-artwork-urls';
import resolvedSongsData from '@/data/itdv-resolved-songs.json';

// TODO: Add metadata back after optimizing component structure

// Pre-process tracks at build time for better performance - using Map for O(1) lookups
const audioUrlMap = new Map(Object.entries(ITDV_AUDIO_URL_MAP));
const artworkUrlMap = new Map(Object.entries(ITDV_ARTWORK_URL_MAP));

const config: PlaylistConfig = {
  name: 'Into The Doerfel-Verse',
  description: 'Every music reference from Into The Doerfel-Verse podcast',
  coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
  resolveAudioUrls: false, // We already have resolved URLs in the data
  showResolutionStatus: false
};

// Pre-process tracks into the exact format needed by the stateless component
const processedTracks = resolvedSongsData
  .filter(song => song && song.feedGuid && song.itemGuid)
  .map((song: any, index) => ({
    id: `${config.name.toLowerCase().replace(/\s+/g, '-')}-${index + 1}-${song.feedGuid?.substring(0, 8) || 'unknown'}`,
    title: song.title || `Track ${index + 1}`,
    artist: song.artist || 'Unknown Artist',
    episodeTitle: song.feedTitle || config.name,
    duration: song.duration || 180, // Default 3 minutes
    audioUrl: audioUrlMap.get(song.title) || '',
    artworkUrl: artworkUrlMap.get(song.title) || config.coverArt,
  }));

// Pre-calculate statistics at build time
const stats = {
  total: processedTracks.length,
  withAudio: processedTracks.filter(t => t.audioUrl).length,
  withArtwork: processedTracks.filter(t => t.artworkUrl && t.artworkUrl !== config.coverArt).length,
  get playablePercentage() { 
    return this.total > 0 ? Math.round((this.withAudio / this.total) * 100) : 0;
  }
};

export default function ITDVPlaylistPage() {
  // Use the same background style as album pages
  const backgroundStyle = {
    background: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(https://www.doerfelverse.com/art/itdvchadf.png) top center/cover fixed',
    backgroundAttachment: 'fixed'
  };

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
          <Suspense fallback={<div className="text-white animate-pulse">Loading tracks...</div>}>
            <PlaylistAlbumStateless
              config={config}
              tracks={processedTracks}
              stats={stats}
            />
          </Suspense>
          
          <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">About This Playlist</h3>
            <p className="text-sm text-gray-300 mb-3">
              This playlist contains every music reference from the Into The Doerfel-Verse podcast, featuring {stats.total} tracks with audio and artwork.
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Total Tracks:</span>
                <span className="ml-2 text-white">{stats.total} songs</span>
              </div>
              <div>
                <span className="text-gray-400">Tracks with Audio:</span>
                <span className="ml-2 text-green-400">{stats.withAudio} playable</span>
              </div>
              <div>
                <span className="text-gray-400">Tracks with Artwork:</span>
                <span className="ml-2 text-blue-400">{stats.withArtwork} with covers</span>
              </div>
              <div>
                <span className="text-gray-400">Source:</span>
                <span className="ml-2 text-white">Episodes 31-56</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Into The Doerfel-Verse playlist powered by Podcasting 2.0 and Value for Value. 
              <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
                Visit Doerfel-Verse →
              </a>
            </p>
          </div>
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
    </div>
  );
}
