'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import ITDV Playlist component
const ITDVPlaylistAlbum = dynamic(() => import('@/components/ITDVPlaylistAlbum'), {
  loading: () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-white">Loading Into The Doerfel-Verse Playlist...</div>
    </div>
  ),
  ssr: false
});

export default function ITDVPlaylistPage() {
  // Use the same background style as album pages
  const backgroundStyle = {
    background: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(https://www.doerfelverse.com/art/itdvchadf.png) center/cover fixed',
    backgroundAttachment: 'fixed'
  };

  return (
    <div 
      className="min-h-screen text-white relative"
      style={backgroundStyle}
    >
      <div className="container mx-auto px-6 py-8 pb-40">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Albums
        </Link>

        {/* Playlist Header - Album Style */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Playlist Art */}
          <div className="relative group mx-auto w-[280px] h-[280px]">
            <img 
              src="https://www.doerfelverse.com/art/itdvchadf.png"
              alt="Into The Doerfel-Verse"
              className="rounded-lg object-cover shadow-2xl w-full h-full"
            />
          </div>
          
          {/* Playlist Info */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">Into The Doerfel-Verse</h1>
            <p className="text-xl text-gray-300">Music Collection</p>
            <p className="text-lg text-gray-300 italic">Episodes 31-56</p>
            
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <span>2024</span>
              <span>122 tracks</span>
              <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">PLAYLIST</span>
            </div>
            
            <p className="text-gray-300 text-center max-w-lg mx-auto leading-relaxed">
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
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">RSS Feed Information</h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400">Feed URL:</span>
              <code className="ml-2 text-blue-300 bg-gray-800/50 px-2 py-1 rounded">
                https://re.podtards.com/api/playlist/itdv-rss
              </code>
            </div>
            <div>
              <span className="text-gray-400">Original Source:</span>
              <span className="ml-2 text-white">https://www.doerfelverse.com/feeds/intothedoerfelverse.xml</span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View RSS Feed
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}