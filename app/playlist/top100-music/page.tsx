'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import Top 100 Music Playlist component
const Top100MusicPlaylist = dynamic(() => import('@/components/Top100MusicPlaylist'), {
  loading: () => (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 border border-gray-200 shadow-lg">
      <div className="text-gray-900">Loading Top 100 Music Playlist...</div>
    </div>
  ),
  ssr: false
});

export default function Top100MusicPage() {
  return (
    <div className="min-h-screen text-gray-900 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/stablekraft-rocket.webp)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Light overlay for better readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-white/40 to-white/50" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 sm:px-6 pt-16 md:pt-12 pb-40">
          {/* Back button */}
          <Link 
            href="/" 
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Albums
          </Link>

          {/* Playlist Header */}
          <div className="flex flex-col gap-6 mb-8">
            {/* Playlist Art */}
            <div className="relative group mx-auto w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] md:w-[280px] md:h-[280px]">
              <div className="rounded-lg object-cover shadow-2xl w-full h-full bg-gradient-to-br from-stablekraft-yellow via-stablekraft-orange to-stablekraft-teal flex items-center justify-center">
                <div className="text-center text-white">
                  <svg className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                  </svg>
                  <div className="text-lg font-bold">TOP 100</div>
                </div>
              </div>
            </div>
            
            {/* Playlist Info */}
            <div className="text-center space-y-4">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-gray-900">Top 100 Music</h1>
              <p className="text-lg sm:text-xl text-gray-600">Value for Value Music Charts</p>
              <p className="text-base sm:text-lg text-gray-600 italic">By Podcast Index</p>
              
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm text-gray-500">
                <span>Updated Daily</span>
                <span>100 tracks</span>
                <span className="bg-stablekraft-teal text-white px-2 py-1 rounded text-xs">V4V CHART</span>
              </div>
              
              <p className="text-gray-600 text-center max-w-xs sm:max-w-lg mx-auto leading-relaxed text-sm sm:text-base px-4">
                The top 100 music tracks by value received in sats (satoshis), showcasing the most supported Value for Value music content.
              </p>

              {/* Badges */}
              <div className="flex flex-wrap justify-center gap-2">
                <span className="text-xs bg-stablekraft-yellow/20 text-stablekraft-yellow border border-stablekraft-yellow/30 px-2 py-1 rounded">
                  Podcast Index
                </span>
                <span className="text-xs bg-stablekraft-teal/20 text-stablekraft-teal border border-stablekraft-teal/30 px-2 py-1 rounded">
                  Value for Value
                </span>
                <span className="text-xs bg-stablekraft-orange/20 text-stablekraft-orange border border-stablekraft-orange/30 px-2 py-1 rounded">
                  Bitcoin Lightning
                </span>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 md:p-6 mb-8 border border-gray-200 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Top 100 Tracks</h2>
            <Top100MusicPlaylist />
          </div>

          {/* Info Section */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 md:p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">About Value for Value Music</h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                This chart represents the top 100 music tracks by value received through the Bitcoin Lightning Network, 
                showcasing the most supported content in the Value for Value (V4V) ecosystem.
              </p>
              <div>
                <span className="font-medium">Data Source:</span>
                <span className="ml-2">Podcast Index API</span>
              </div>
              <div>
                <span className="font-medium">Update Frequency:</span>
                <span className="ml-2">Daily</span>
              </div>
              <div>
                <span className="font-medium">Currency:</span>
                <span className="ml-2">Bitcoin (satoshis)</span>
              </div>
              <div className="pt-2">
                <a 
                  href="https://github.com/Podcastindex-org/top100_music" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-stablekraft-teal hover:text-stablekraft-orange transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}