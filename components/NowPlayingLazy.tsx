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
  currentTime?: number;
  volume?: number;
  onSeek?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onClose?: () => void;
}

export default function NowPlayingLazy(props: NowPlayingLazyProps) {
  // Transform props to match NowPlaying component interface
  const nowPlayingProps = {
    track: {
      title: props.currentTrack?.title || 'Unknown Track',
      artist: props.album?.artist || 'Unknown Artist',
      albumTitle: props.album?.title || 'Unknown Album',
      duration: props.duration || 0,
      albumArt: props.album?.coverArt || props.currentTrack?.image
    },
    isPlaying: props.isPlaying,
    currentTime: props.currentTime || props.progress || 0,
    volume: props.volume || 1,
    onPlayPause: props.isPlaying ? props.onPause : props.onPlay,
    onPrevious: props.onPrevious,
    onNext: props.onNext,
    onSeek: props.onSeek || (() => {}),
    onVolumeChange: props.onVolumeChange || (() => {}),
    onClose: props.onClose || (() => {})
  };

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
      <NowPlaying {...nowPlayingProps} />
    </Suspense>
  );
} 