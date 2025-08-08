import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../logger';
import { withRetry } from '../error-utils';

interface ImageLoadState {
  isLoading: boolean;
  hasError: boolean;
  isLoaded: boolean;
  retryCount: number;
}

interface UseImageLoaderOptions {
  src: string;
  fallbackSrc?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function useImageLoader({
  src,
  fallbackSrc,
  maxRetries = 3,
  retryDelay = 1000,
  timeout = 15000,
  onLoad,
  onError
}: UseImageLoaderOptions) {
  const [state, setState] = useState<ImageLoadState>({
    isLoading: true,
    hasError: false,
    isLoaded: false,
    retryCount: 0
  });
  
  const [currentSrc, setCurrentSrc] = useState(src);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  const log = logger.component('useImageLoader');

  const clearImageTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const loadImage = useCallback(async (imageSrc: string, attempt: number = 0): Promise<void> => {
    return withRetry(
      () => new Promise<void>((resolve, reject) => {
        log.debug(`Loading image: ${imageSrc} (attempt ${attempt + 1})`);
        
        const img = new Image();
        imgRef.current = img;
        
        // Set timeout
        timeoutRef.current = setTimeout(() => {
          log.warn(`Image load timeout: ${imageSrc}`);
          reject(new Error('Image load timeout'));
        }, timeout);
        
        img.onload = () => {
          clearImageTimeout();
          log.debug(`Image loaded successfully: ${imageSrc}`);
          setState(prev => ({
            ...prev,
            isLoading: false,
            hasError: false,
            isLoaded: true,
            retryCount: attempt
          }));
          setCurrentSrc(imageSrc);
          onLoad?.();
          resolve();
        };
        
        img.onerror = (error) => {
          clearImageTimeout();
          log.error(`Image load failed: ${imageSrc}`, error);
          reject(new Error(`Failed to load image: ${imageSrc}`));
        };
        
        img.src = imageSrc;
      }),
      {
        maxRetries: attempt === 0 ? maxRetries : 0, // Only retry on first attempt
        delay: retryDelay,
        context: 'useImageLoader'
      }
    );
  }, [src, maxRetries, retryDelay, timeout, onLoad, log, clearTimeout]);

  const retry = useCallback(async () => {
    log.debug(`Retrying image load, current retry count: ${state.retryCount}`);
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      hasError: false,
      retryCount: prev.retryCount + 1
    }));
    
    try {
      // Try fallback if available and we haven't tried it yet
      if (fallbackSrc && currentSrc !== fallbackSrc && state.retryCount === 0) {
        await loadImage(fallbackSrc, 1);
      } else {
        await loadImage(currentSrc, state.retryCount + 1);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true
      }));
      onError?.(error as Error);
    }
  }, [currentSrc, fallbackSrc, state.retryCount, loadImage, onError, log]);

  // Load image when src changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      hasError: false,
      isLoaded: false,
      retryCount: 0
    }));
    setCurrentSrc(src);
    
    loadImage(src).catch((error) => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true
      }));
      onError?.(error);
    });
    
    return clearImageTimeout;
  }, [src, loadImage, onError, clearImageTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearImageTimeout();
      if (imgRef.current) {
        imgRef.current.onload = null;
        imgRef.current.onerror = null;
      }
    };
  }, [clearImageTimeout]);

  return {
    ...state,
    currentSrc,
    retry,
    imgRef
  };
} 