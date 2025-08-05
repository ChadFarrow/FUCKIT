'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import ITDV Playlist component
const ITDVPlaylistAlbum = dynamic(() => import('@/components/ITDVPlaylistAlbum'), {
  loading: () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-white">Loading ITDV Playlist...</div>
    </div>
  ),
  ssr: false
});

export default function ITDVPlaylistPage() {
  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: 'url(/stablekraft-rocket.png) center/contain fixed',
          backgroundAttachment: 'fixed',
          opacity: 0.25
        }}
      />
      
      {/* Content overlay */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b backdrop-blur-sm bg-black/30 pt-safe-plus pt-6" style={{borderColor: 'rgba(255, 255, 255, 0.1)'}}>
          <div className="container mx-auto px-6 py-2">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-1">Into The Doerfel-Verse</h1>
              <p className="text-sm text-gray-400 mb-2">Music Playlist - 122 Tracks</p>
              <div className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30 inline-block">
                RSS Feed Available
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-28">
          {/* Breadcrumb */}
          <div className="mb-6">
            <nav className="flex items-center space-x-2 text-sm text-gray-400">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/playlist" className="hover:text-white transition-colors">
                Playlists
              </Link>
              <span>/</span>
              <span className="text-white">Into The Doerfel-Verse</span>
            </nav>
          </div>

          {/* Playlist Info */}
          <div className="mb-8 bg-gray-800/20 rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18V5l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">Into The Doerfel-Verse Music Collection</h2>
                <p className="text-gray-300 mb-3">
                  Every music track played on Into The Doerfel-Verse podcast. This playlist contains 122 tracks 
                  from various episodes, all available as a Podcasting 2.0 compliant RSS feed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30">
                    122 Tracks
                  </span>
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                    RSS Feed
                  </span>
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30">
                    Podcasting 2.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Playlist Component */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Playlist Tracks</h3>
            <ITDVPlaylistAlbum />
          </div>

          {/* RSS Feed Info */}
          <div className="bg-gray-800/20 rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4">RSS Feed Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-400">Feed URL:</span>
                <code className="ml-2 text-blue-300 bg-gray-800/50 px-2 py-1 rounded">
                  https://re.podtards.com/api/playlist/itdv-rss
                </code>
              </div>
              <div>
                <span className="text-gray-400">Format:</span>
                <span className="ml-2 text-white">Podcasting 2.0 RSS with podcast:remoteItem elements</span>
              </div>
              <div>
                <span className="text-gray-400">Compatibility:</span>
                <span className="ml-2 text-white">Works with all Podcasting 2.0 apps</span>
              </div>
              <div className="pt-2">
                <Link 
                  href="/api/playlist/itdv-rss" 
                  target="_blank"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View RSS Feed
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 