'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import for the heavy AlbumCard component
const AlbumCard = dynamic(() => import('./AlbumCard'), {
  loading: () => (
    <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 animate-pulse">
      <div className="aspect-square bg-gray-800/50 rounded-lg mb-3"></div>
      <div className="h-4 bg-gray-700/50 rounded mb-2"></div>
      <div className="h-3 bg-gray-700/50 rounded w-2/3"></div>
    </div>
  ),
  ssr: true // Album cards can be server-side rendered
});

interface AlbumCardLazyProps {
  album: any;
  onPlay: (album: any, e: any) => void;
}

export default function AlbumCardLazy(props: AlbumCardLazyProps) {
  return (
    <Suspense fallback={
      <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 animate-pulse">
        <div className="aspect-square bg-gray-800/50 rounded-lg mb-3"></div>
        <div className="h-4 bg-gray-700/50 rounded mb-2"></div>
        <div className="h-3 bg-gray-700/50 rounded w-2/3"></div>
      </div>
    }>
      <AlbumCard {...props} />
    </Suspense>
  );
} 