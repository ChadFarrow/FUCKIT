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
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleError = () => {
    console.warn(`Image failed to load (attempt ${retryCount + 1}):`, currentSrc);
    setIsLoading(false);
    setHasError(true);
    
    // Skip external placeholder and go directly to data URL on mobile for reliability
    if (currentSrc === src && retryCount === 0) {
      console.log('Image failed, trying data URL fallback...');
      const dataUrl = `data:image/svg+xml;base64,${btoa(`
        <svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1f2937"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="#9ca3af" font-family="Arial" font-size="32">🎵</text>
        </svg>
      `)}`;
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
    } else {
      console.log('Data URL fallback failed, showing error state');
      onError?.();
    }
  };

  const handleLoad = () => {
    console.log('Image loaded successfully:', currentSrc.includes('data:') ? 'data URL fallback' : currentSrc);
    setIsLoading(false);
    setHasError(false);
    
    // Clear timeout if image loads successfully
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    
    onLoad?.();
  };

  // Reset state when src changes and set up timeout for slow connections
  useEffect(() => {
    setCurrentSrc(src);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    
    // Set timeout for slow loading images (especially on mobile)
    const timeout = setTimeout(() => {
      console.log('Image timeout - falling back to placeholder');
      // Create fallback directly instead of calling handleError to avoid dependency
      const dataUrl = `data:image/svg+xml;base64,${btoa(`
        <svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1f2937"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="#9ca3af" font-family="Arial" font-size="32">🎵</text>
        </svg>
      `)}`;
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
    }, 8000); // 8 second timeout for mobile
    
    setTimeoutId(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [src, width, height]); // Only depend on src and size props

  // Check if we're on mobile to decide which image component to use
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || 
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Extra mobile debugging
  useEffect(() => {
    if (isMobile && retryCount === 0) {
      console.log(`CDNImage mobile: src=${src}, currentSrc=${currentSrc}, isLoading=${isLoading}, hasError=${hasError}`);
    }
  }, [isMobile, src, currentSrc, isLoading, hasError, retryCount]);

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
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
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