'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FeedCache } from '@/lib/feed-cache';

interface CachedImageProps {
  src: string;
  alt: string;
  albumId: string;
  trackNumber?: number;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  fallbackSrc?: string;
  onError?: () => void;
  onLoad?: () => void;
}

export default function CachedImage({
  src,
  alt,
  albumId,
  trackNumber,
  width,
  height,
  className,
  priority = false,
  quality = 85,
  fallbackSrc,
  onError,
  onLoad,
  ...props
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [useCache, setUseCache] = useState(false);

  useEffect(() => {
    // Check if we have a cached version
    const checkCache = async () => {
      try {
        // For now, we'll use a simple approach
        // In a real implementation, you'd call the cache API
        const cachedUrl = `/api/cache/artwork/${encodeURIComponent(src)}`;
        
        // Test if cached version exists
        const response = await fetch(cachedUrl, { method: 'HEAD' });
        if (response.ok) {
          setImageSrc(cachedUrl);
          setUseCache(true);
        } else {
          setImageSrc(src);
          setUseCache(false);
        }
      } catch (error) {
        // Fallback to original source
        setImageSrc(src);
        setUseCache(false);
      }
    };

    checkCache();
  }, [src, albumId, trackNumber]);

  const handleError = () => {
    setIsLoading(false);
    
    // Try fallback if available
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setIsLoading(true);
    } else {
      onError?.();
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  return (
    <div className={`relative ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded flex items-center justify-center">
          <span className="text-gray-500 text-sm">
            {useCache ? '🖼️ Loading cached image...' : '📡 Loading image...'}
          </span>
        </div>
      )}
      
      {useCache && (
        <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded">
          Cached
        </div>
      )}
      
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        priority={priority}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={true}
        {...props}
      />
    </div>
  );
} 