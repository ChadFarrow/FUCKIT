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
  format?: 'webp' | 'jpeg' | 'png' | 'gif' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  onError?: () => void;
  onLoad?: () => void;
  fallbackSrc?: string;
  sizes?: string;
  placeholder?: 'blur' | 'empty';
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
  sizes,
  placeholder = 'empty',
  ...props
}: CDNImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Check if we're on mobile
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Generate optimized image URL
  const getOptimizedUrl = (originalUrl: string, targetWidth?: number, targetHeight?: number) => {
    // If it's already an optimized URL, return as is
    if (originalUrl.includes('/api/optimized-images/')) {
      return originalUrl;
    }
    
    // For large images, use optimized endpoint
    const largeImages = [
      'you-are-my-world.gif',
      'HowBoutYou.gif', 
      'autumn.gif',
      'WIldandfreecover-copy-2.png',
      'alandace.gif',
      'doerfel-verse-idea-9.png',
      'SatoshiStreamer-track-1-album-art.png',
      'dvep15-art.png',
      'disco-swag.png',
      'first-christmas-art.jpg',
      'let-go-art.png'
    ];
    
    const filename = originalUrl.split('/').pop();
    if (filename && largeImages.some(img => filename.includes(img.replace(/\.(png|jpg|gif)$/, '')))) {
      const optimizedFilename = largeImages.find(img => filename.includes(img.replace(/\.(png|jpg|gif)$/, '')));
      if (optimizedFilename) {
        let optimizedUrl = `https://re.podtards.com/api/optimized-images/${optimizedFilename}`;
        
        // Add size parameters for responsive loading
        if (targetWidth || targetHeight) {
          const params = new URLSearchParams();
          if (targetWidth) params.set('w', targetWidth.toString());
          if (targetHeight) params.set('h', targetHeight.toString());
          params.set('q', quality.toString());
          
          // Use WebP for better compression if supported
          if (typeof window !== 'undefined' && window.navigator.userAgent.includes('Chrome')) {
            params.set('f', 'webp');
          }
          
          optimizedUrl += `?${params.toString()}`;
        }
        
        return optimizedUrl;
      }
    }
    
    return originalUrl;
  };

  // Get responsive image sizes
  const getResponsiveSizes = () => {
    if (sizes) return sizes;
    
    if (isMobile) {
      return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
    } else if (isTablet) {
      return '(max-width: 1024px) 50vw, 33vw';
    } else {
      return '(max-width: 1200px) 33vw, 25vw';
    }
  };

  // Get appropriate image dimensions
  const getImageDimensions = () => {
    if (width && height) return { width, height };
    
    // Default responsive sizes
    if (isMobile) {
      return { width: 300, height: 300 };
    } else if (isTablet) {
      return { width: 400, height: 400 };
    } else {
      return { width: 500, height: 500 };
    }
  };

  const getOriginalUrl = (imageUrl: string) => {
    return fallbackSrc || imageUrl;
  };

  const handleError = () => {
    console.warn(`Image failed to load (attempt ${retryCount + 1}):`, currentSrc);
    setIsLoading(false);
    
    if (retryCount === 0 && fallbackSrc && fallbackSrc !== currentSrc) {
      console.log('Optimized image failed, trying fallback URL:', fallbackSrc);
      setCurrentSrc(fallbackSrc);
      setHasError(false);
      setIsLoading(true);
      setRetryCount(1);
      return;
    }
    
    if (retryCount === 0) {
      const originalUrl = getOriginalUrl(currentSrc);
      if (originalUrl && originalUrl !== currentSrc) {
        console.log('Optimized image failed, trying original URL:', originalUrl);
        setCurrentSrc(originalUrl);
        setHasError(false);
        setIsLoading(true);
        setRetryCount(1);
        return;
      }
    }
    
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  // Reset state when src changes
  useEffect(() => {
    const dims = getImageDimensions();
    let imageSrc = src;
    
    // For mobile, prefer direct URLs over optimized ones for better compatibility
    if (isMobile && !src.includes('/api/optimized-images/')) {
      imageSrc = src;
    } else {
      imageSrc = getOptimizedUrl(src, dims.width, dims.height);
    }
    
    setCurrentSrc(imageSrc);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [src, width, height, isMobile, isTablet]);

  const dims = getImageDimensions();

  return (
    <div className={`relative ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800/50 animate-pulse rounded flex items-center justify-center">
          <div className="w-6 h-6 bg-white/20 rounded-full animate-spin"></div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 bg-gray-800/50 rounded flex items-center justify-center">
          <div className="text-white/60 text-sm">Image unavailable</div>
        </div>
      )}
      
      {isMobile ? (
        // Use regular img tag for mobile with optimized loading
        <img
          src={currentSrc}
          alt={alt}
          width={dims.width}
          height={dims.height}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 ${className || ''}`}
          onError={handleError}
          onLoad={handleLoad}
          loading={priority ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          style={{ 
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            display: 'block'
          }}
          {...props}
        />
      ) : (
        // Use Next.js Image for desktop with full optimization
        <Image
          src={currentSrc}
          alt={alt}
          width={dims.width}
          height={dims.height}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          priority={priority}
          quality={quality}
          sizes={getResponsiveSizes()}
          onError={handleError}
          onLoad={handleLoad}
          placeholder={placeholder}
          unoptimized={currentSrc.includes('/api/optimized-images/')} // Don't double-optimize
          {...props}
        />
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded opacity-0 hover:opacity-100 transition-opacity">
          {currentSrc.includes('/api/optimized-images/') ? '🖼️ Optimized' : '📡 Original'}
        </div>
      )}
    </div>
  );
} 