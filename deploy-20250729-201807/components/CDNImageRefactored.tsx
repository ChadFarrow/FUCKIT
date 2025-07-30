'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useImageLoader } from '../lib/hooks/useImageLoader';
import { useDeviceDetection } from '../lib/hooks/useDeviceDetection';
import { logger } from '../lib/logger';
import PlaceholderImage from './PlaceholderImage';

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

export default function CDNImageRefactored({
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
  const log = logger.component('CDNImage');
  
  // Device detection
  const { isMobile, isClient } = useDeviceDetection({
    logDeviceInfo: process.env.NODE_ENV === 'development'
  });

  // Image loading state
  const {
    isLoading,
    hasError,
    isLoaded,
    retryCount,
    currentSrc,
    retry
  } = useImageLoader({
    src,
    fallbackSrc,
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 15000,
    onLoad,
    onError: (error) => {
      log.error('Image load error', error);
      onError?.();
    }
  });

  // GIF detection and handling
  const [isGif, setIsGif] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Detect if the image is a GIF
  useEffect(() => {
    const isGifImage = src.toLowerCase().includes('.gif') || 
                      currentSrc.toLowerCase().includes('.gif');
    setIsGif(isGifImage);
    
    if (process.env.NODE_ENV === 'development' && isGifImage) {
      log.debug('GIF detected:', src);
    }
  }, [src, currentSrc, log]);

  // Intersection Observer for GIF lazy loading
  useEffect(() => {
    if (!isGif || !isClient || priority) {
      setShowGif(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShowGif(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => observer.disconnect();
  }, [isGif, isClient, priority]);

  // GIF load handling
  useEffect(() => {
    if (isGif && showGif && isLoaded) {
      setGifLoaded(true);
      log.debug('GIF loaded successfully');
    }
  }, [isGif, showGif, isLoaded, log]);

  // URL optimization functions
  const getOptimizedUrl = (originalUrl: string, targetWidth?: number, targetHeight?: number) => {
    if (!originalUrl) return '';
    
    try {
      const url = new URL(originalUrl);
      
      // Skip optimization for GIFs
      if (originalUrl.toLowerCase().includes('.gif')) {
        return originalUrl;
      }
      
      // Add optimization parameters
      if (targetWidth) url.searchParams.set('w', targetWidth.toString());
      if (targetHeight) url.searchParams.set('h', targetHeight.toString());
      url.searchParams.set('q', quality.toString());
      url.searchParams.set('f', 'auto');
      url.searchParams.set('fit', 'cover');
      
      return url.toString();
    } catch {
      return originalUrl;
    }
  };

  const getResponsiveSizes = () => {
    if (sizes) return sizes;
    
    if (isMobile) {
      return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
    }
    
    return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
  };

  const getImageDimensions = () => {
    if (width && height) {
      return { width, height };
    }
    
    // Default dimensions for different device types
    if (isMobile) {
      return { width: 300, height: 300 };
    }
    
    return { width: 400, height: 400 };
  };

  const getOriginalUrl = (imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      // Remove optimization parameters to get original
      url.searchParams.delete('w');
      url.searchParams.delete('h');
      url.searchParams.delete('q');
      url.searchParams.delete('f');
      url.searchParams.delete('fit');
      return url.toString();
    } catch {
      return imageUrl;
    }
  };

  // Determine image source based on device and state
  const getImageSrc = () => {
    if (hasError && retryCount === 0 && fallbackSrc) {
      log.debug('Using fallback URL:', fallbackSrc);
      return fallbackSrc;
    }

    if (isMobile) {
      // Mobile optimization
      const optimizedUrl = getOptimizedUrl(currentSrc, 300, 300);
      log.debug('Mobile using optimized:', optimizedUrl);
      return optimizedUrl;
    }

    // Desktop optimization
    const optimizedUrl = getOptimizedUrl(currentSrc, width, height);
    return optimizedUrl;
  };

  const imageSrc = getImageSrc();
  const { width: imgWidth, height: imgHeight } = getImageDimensions();

  // Show placeholder while loading or on error
  if (isLoading || hasError) {
    return (
      <div 
        ref={imageRef}
        className={`relative ${className || ''}`}
        style={{ width: imgWidth, height: imgHeight }}
      >
        <PlaceholderImage 
          width={imgWidth} 
          height={imgHeight} 
          alt={alt}
          className="w-full h-full object-cover"
        />
        {hasError && (
          <button
            onClick={retry}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-sm"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Render the image
  return (
    <div 
      ref={imageRef}
      className={`relative ${className || ''}`}
      style={{ width: imgWidth, height: imgHeight }}
    >
      <Image
        src={imageSrc}
        alt={alt}
        width={imgWidth}
        height={imgHeight}
        className="w-full h-full object-cover"
        priority={priority}
        quality={quality}
        sizes={getResponsiveSizes()}
        placeholder={placeholder}
        onLoad={() => {
          log.debug('Image loaded successfully:', imageSrc);
          onLoad?.();
        }}
        onError={() => {
          log.error('Image load error:', imageSrc);
          onError?.();
        }}
        {...props}
      />
      
      {/* GIF loading indicator */}
      {isGif && showGif && !gifLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-sm">Loading GIF...</div>
        </div>
      )}
    </div>
  );
} 