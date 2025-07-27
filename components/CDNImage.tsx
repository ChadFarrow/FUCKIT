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
  fallbackSrc?: string;
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
  fallbackSrc,
  ...props
}: CDNImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const getOriginalUrl = (imageUrl: string) => {
    // If it's a CDN URL, try to use the proxy as fallback
    if (imageUrl.includes('.b-cdn.net')) {
      return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    }
    return fallbackSrc || imageUrl;
  };

  const handleError = () => {
    console.warn(`Image failed to load (attempt ${retryCount + 1}):`, currentSrc);
    setIsLoading(false);
    
    if (retryCount === 0 && fallbackSrc && fallbackSrc !== currentSrc) {
      // First failure: try fallbackSrc (original URL) if provided
      console.log('CDN failed, trying fallback URL:', fallbackSrc);
      setCurrentSrc(fallbackSrc);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
      return;
    }
    
    if (retryCount === 0) {
      // No fallbackSrc provided, try to extract from CDN URL
      const originalUrl = getOriginalUrl(currentSrc);
      if (originalUrl && originalUrl !== currentSrc) {
        console.log('CDN failed, trying extracted original URL:', originalUrl);
        setCurrentSrc(originalUrl);
        setHasError(false);
        setIsLoading(true);
        setRetryCount(1);
        return;
      }
    }
    
    if (retryCount <= 2) {
      // Try image proxy as fallback (similar to audio proxy)
      const originalSrc = src; // Use the original src prop
      if (!originalSrc.includes('/api/proxy-image') && !originalSrc.startsWith('data:')) {
        console.log('Trying image proxy fallback:', originalSrc);
        setCurrentSrc(`/api/proxy-image?url=${encodeURIComponent(originalSrc)}`);
        setHasError(false);
        setIsLoading(true);
        setRetryCount(3);
        return;
      }
    }
    
    if (retryCount <= 3) {
      // Try data URL fallback
      console.log('All URLs failed, using placeholder...');
      
      const svgContent = `<svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1f2937"/><circle cx="50%" cy="45%" r="25" fill="#9ca3af"/><text x="50%" y="65%" text-anchor="middle" fill="#9ca3af" font-size="12" font-family="system-ui">♪</text></svg>`;
      
      const encodedSvg = encodeURIComponent(svgContent);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(4);
    } else {
      // Final fallback - show error state but don't hide image
      console.log('All fallbacks failed, showing error state');
      setHasError(true);
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
    
    // Disable timeout for now to let images load naturally
    // const timeout = setTimeout(() => {
    //   console.log('Image timeout - falling back to placeholder');
    //   const svgContent = `<svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1f2937"/><circle cx="50%" cy="50%" r="20" fill="#9ca3af"/></svg>`;
    //   
    //   const encodedSvg = encodeURIComponent(svgContent);
    //   const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
    //   
    //   setCurrentSrc(dataUrl);
    //   setHasError(false);
    //   setIsLoading(true);
    //   setRetryCount(1);
    // }, 8000);
    // 
    // setTimeoutId(timeout);
    
    return () => {
      // if (timeout) clearTimeout(timeout);
    };
  }, [src, width, height]); // Only depend on src and size props

  // Check if we're on mobile
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

  return (
    <div className={`relative ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800/50 animate-pulse rounded flex items-center justify-center">
          <div className="w-6 h-6 bg-white/20 rounded-full"></div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 bg-gray-800/50 rounded flex items-center justify-center">
          <div className="w-6 h-6 bg-white/20 rounded-full"></div>
        </div>
      )}
      
      {isMobile ? (
        // Use regular img tag for mobile
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onError={handleError}
          onLoad={handleLoad}
          loading={priority ? 'eager' : 'lazy'}
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
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
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