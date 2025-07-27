'use client';

import Image from 'next/image';
import { useState } from 'react';

interface CDNImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'gif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  onError?: () => void;
  onLoad?: () => void;
}

export default function CDNImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 85,
  onError,
  onLoad,
  ...props
}: CDNImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleError = () => {
    console.warn('Image failed to load:', src);
    setIsLoading(false);
    setHasError(true);
    
    // Try fallback to placeholder if main image fails
    if (currentSrc === src && !src.includes('placeholder.com')) {
      const fallbackUrl = `https://via.placeholder.com/${width || 300}x${height || 300}/1f2937/ffffff?text=🎵`;
      setCurrentSrc(fallbackUrl);
      setHasError(false);
      setIsLoading(true);
    } else {
      onError?.();
    }
  };

  const handleLoad = () => {
    console.log('Image loaded successfully:', currentSrc);
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  return (
    <div className={`relative ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800/50 animate-pulse rounded flex items-center justify-center">
          <div className="text-white/50 text-2xl">🎵</div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 bg-gray-800/50 rounded flex items-center justify-center">
          <div className="text-white/50 text-2xl">🎵</div>
        </div>
      )}
      <Image
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${isLoading || hasError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        priority={priority}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={true}
        {...props}
      />
    </div>
  );
} 