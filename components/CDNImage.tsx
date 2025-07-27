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
  fallbackSrc?: string; // Original URL to fall back to
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

  // Extract original URL from CDN URL for fallback
  const getOriginalUrl = (cdnUrl: string) => {
    // Check for CDN hostname (storage zone CDN)
    if (cdnUrl.includes('re-podtards-cache.b-cdn.net/cache/artwork/')) {
      // Extract the filename from the CDN URL
      const filename = cdnUrl.split('/').pop();
      if (filename) {
        // Check if this is an encoded filename (contains base64 part)
        const encodedMatch = filename.match(/artwork-.*?-([A-Za-z0-9+/=]{20,})\.(jpg|jpeg|png|gif)$/);
        if (encodedMatch) {
          // This is an encoded filename - decode it
          try {
            const base64Part = encodedMatch[1];
            const originalUrl = atob(base64Part);
            console.log('Decoded original URL from CDN filename:', originalUrl);
            
            // If the decoded URL points to /albums/, fix it to use /cache/artwork/
            if (originalUrl.includes('/albums/')) {
              const correctedUrl = originalUrl.replace('/albums/', '/cache/artwork/artwork-');
              console.log('Corrected /albums/ URL to /cache/artwork/:', correctedUrl);
              return correctedUrl;
            }
            
            return originalUrl;
          } catch (error) {
            console.warn('Failed to decode base64 URL from filename:', filename, error);
          }
        } else {
          // This is a simple filename (e.g., artwork-album-name.png)
          // For simple filenames, there's no fallback - the CDN should have this file
          console.log('Simple filename detected, no fallback available:', filename);
          return null; // No fallback for simple filenames
        }
      }
    }
    return fallbackSrc || cdnUrl;
  };

  const handleError = () => {
    console.warn(`Image failed to load (attempt ${retryCount + 1}):`, currentSrc);
    setIsLoading(false);
    
    if (retryCount === 0) {
      // First failure: try original URL
      const originalUrl = getOriginalUrl(currentSrc);
      if (originalUrl && originalUrl !== currentSrc) {
        console.log('CDN failed, trying original URL:', originalUrl);
        setCurrentSrc(originalUrl);
        setHasError(false);
        setIsLoading(true);
        setRetryCount(1);
        return;
      } else {
        // No fallback available (simple filename) - go to data URL
        console.log('No fallback URL available for simple filename, using placeholder');
        setRetryCount(1); // Skip to data URL
      }
    }
    
    if (retryCount <= 1) {
      // Try data URL fallback
      console.log('Original URL failed, trying data URL fallback...');
      
      const svgContent = `<svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1f2937"/><circle cx="50%" cy="45%" r="25" fill="#9ca3af"/><text x="50%" y="65%" text-anchor="middle" fill="#9ca3af" font-size="12" font-family="system-ui">♪</text></svg>`;
      
      const encodedSvg = encodeURIComponent(svgContent);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(2);
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
    
    // Set timeout for slow loading images (especially on mobile)
    const timeout = setTimeout(() => {
      console.log('Image timeout - falling back to placeholder');
      // Create fallback directly instead of calling handleError to avoid dependency
      const svgContent = `<svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1f2937"/><circle cx="50%" cy="50%" r="20" fill="#9ca3af"/></svg>`;
      
      const encodedSvg = encodeURIComponent(svgContent);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
    }, 1500); // 1.5 second timeout for faster fallback on OpaqueResponseBlocking
    
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
          <div className="w-6 h-6 bg-white/20 rounded-full"></div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 bg-gray-800/50 rounded flex items-center justify-center">
          <div className="w-6 h-6 bg-white/20 rounded-full"></div>
        </div>
      )}
      
      {isMobile ? (
        // Use regular img tag for mobile to avoid Next.js Image issues
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${isLoading && retryCount === 0 ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
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
          className={`${isLoading && retryCount === 0 ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
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