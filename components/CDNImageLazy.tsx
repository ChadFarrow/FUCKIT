'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import for the heavy CDNImage component
const CDNImage = dynamic(() => import('./CDNImage'), {
  loading: () => (
    <div className="animate-pulse bg-gray-800/50 rounded flex items-center justify-center">
      <div className="w-6 h-6 bg-white/20 rounded-full animate-spin"></div>
    </div>
  ),
  ssr: false // Image components often need browser APIs
});

interface CDNImageLazyProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'gif' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  onError?: () => void;
  onLoad?: () => void;
  fallbackSrc?: string;
  sizes?: string;
  placeholder?: 'blur' | 'empty';
}

export default function CDNImageLazy(props: CDNImageLazyProps) {
  return (
    <Suspense fallback={
      <div className={`${props.className || ''} animate-pulse bg-gray-800/50 rounded flex items-center justify-center`}>
        <div className="w-6 h-6 bg-white/20 rounded-full animate-spin"></div>
      </div>
    }>
      <CDNImage {...props} />
    </Suspense>
  );
} 