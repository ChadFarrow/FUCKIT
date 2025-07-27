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
    // Check for both old and new CDN hostnames
    if (cdnUrl.includes('FUCKIT.b-cdn.net/cache/artwork/') || cdnUrl.includes('re-podtards-cdn.b-cdn.net/cache/artwork/')) {
      // Extract the filename from the CDN URL
      const filename = cdnUrl.split('/').pop();
      if (filename) {
        // The filename format is: artwork-{name}-{base64-encoded-original-url}.{ext}
        // Extract the base64 part and decode it to get the original URL
        const match = filename.match(/artwork-.*?-([A-Za-z0-9+/=]+)\.(jpg|jpeg|png|gif)$/);
        if (match) {
          try {
            const base64Part = match[1];
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
        }
      }
    }
    return fallbackSrc || cdnUrl;
  };

  const handleError = () => {
    console.warn(`Image failed to load (attempt ${retryCount + 1}):`, currentSrc);
    setIsLoading(false);
    setHasError(true);
    
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
      }
    }
    
    if (retryCount === 1) {
      // Second failure: try data URL fallback
      console.log('Original URL failed, trying data URL fallback...');
      
      const svgContent = `
        <svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1f2937"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="#9ca3af" font-family="Arial" font-size="32">🎵</text>
        </svg>
      `;
      
      const encodedSvg = encodeURIComponent(svgContent);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
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
      const svgContent = `
        <svg width="${width || 300}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1f2937"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="#9ca3af" font-family="Arial" font-size="32">🎵</text>
        </svg>
      `;
      
      const encodedSvg = encodeURIComponent(svgContent);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
      setCurrentSrc(dataUrl);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
    }, 3000); // 3 second timeout for faster fallback
    
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
          crossOrigin="anonymous"
          {...props}
        />
      )}
    </div>
  );
} 