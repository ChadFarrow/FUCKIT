'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import for the heavy NowPlaying component
const NowPlaying = dynamic(() => import('./NowPlaying'), {
  loading: () => (
    <div className="flex items-center gap-3 p-3 bg-gray-800/20 rounded-lg animate-pulse">
      <div className="w-12 h-12 bg-gray-700/50 rounded"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-700/50 rounded mb-1"></div>
        <div className="h-3 bg-gray-700/50 rounded w-2/3"></div>
      </div>
      <div className="w-8 h-8 bg-gray-700/50 rounded"></div>
    </div>
  ),
  ssr: false // Audio components need browser APIs
});

interface NowPlayingLazyProps {
  album: any;
  currentTrack: any;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  progress: number;
  duration: number;
}

export default function NowPlayingLazy(props: NowPlayingLazyProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-3 p-3 bg-gray-800/20 rounded-lg animate-pulse">
        <div className="w-12 h-12 bg-gray-700/50 rounded"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-700/50 rounded mb-1"></div>
          <div className="h-3 bg-gray-700/50 rounded w-2/3"></div>
        </div>
        <div className="w-8 h-8 bg-gray-700/50 rounded"></div>
      </div>
    }>
      <NowPlaying {...props} />
    </Suspense>
  );
} 