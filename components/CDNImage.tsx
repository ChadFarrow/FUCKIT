'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

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
  const [retryCount, setRetryCount] = useState(0);

  const handleError = () => {
    console.warn(`Image failed to load (attempt ${retryCount + 1}):`, currentSrc);
    setIsLoading(false);
    setHasError(true);
    
    // Try fallback to placeholder if main image fails and we haven't retried yet
    if (currentSrc === src && !src.includes('placeholder.com') && retryCount === 0) {
      console.log('Trying fallback placeholder...');
      const fallbackUrl = `https://via.placeholder.com/${width || 300}x${height || 300}/1f2937/ffffff?text=🎵`;
      setCurrentSrc(fallbackUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
    } else if (retryCount === 1 && !currentSrc.includes('data:image')) {
      // Final fallback to a data URL
      console.log('Trying data URL fallback...');
      const dataUrl = `data:image/svg+xml;base64,${btoa(`
        <svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1f2937"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="#9ca3af" font-family="Arial" font-size="48">🎵</text>
        </svg>
      `)}`;
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(2);
    } else {
      console.log('All fallbacks failed, showing error state');
      onError?.();
    }
  };

  const handleLoad = () => {
    console.log('Image loaded successfully:', currentSrc.includes('data:') ? 'data URL fallback' : currentSrc);
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  // Reset state when src changes
  useEffect(() => {
    setCurrentSrc(src);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
  }, [src]);

  // Check if we're on mobile to decide which image component to use
  const isMobile = typeof window !== 'undefined' && 
    (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

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
      
      {isMobile ? (
        // Use regular img tag for mobile to avoid Next.js Image issues
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${isLoading || hasError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onError={handleError}
          onLoad={handleLoad}
          loading={priority ? 'eager' : 'lazy'}
          style={{ objectFit: 'cover' }}
          {...props}
        />
      ) : (
        // Use Next.js Image for desktop
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
      )}
    </div>
  );
} 