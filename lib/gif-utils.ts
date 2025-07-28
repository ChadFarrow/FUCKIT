/**
 * GIF-specific utilities for performance optimization
 */

export interface GifOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  priority?: boolean;
  lazyLoad?: boolean;
}

/**
 * Check if a URL points to a GIF image
 */
export function isGifUrl(url: string): boolean {
  return url.toLowerCase().includes('.gif');
}

/**
 * Get optimized dimensions for GIFs based on device and context
 */
export function getGifDimensions(device: 'mobile' | 'tablet' | 'desktop', context: 'thumbnail' | 'album' | 'background' = 'album'): { width: number; height: number } {
  const dimensions = {
    mobile: {
      thumbnail: { width: 150, height: 150 },
      album: { width: 200, height: 200 },
      background: { width: 300, height: 300 }
    },
    tablet: {
      thumbnail: { width: 200, height: 200 },
      album: { width: 300, height: 300 },
      background: { width: 400, height: 400 }
    },
    desktop: {
      thumbnail: { width: 250, height: 250 },
      album: { width: 400, height: 400 },
      background: { width: 500, height: 500 }
    }
  };

  return dimensions[device][context];
}

/**
 * Get responsive sizes for GIFs to improve performance
 */
export function getGifResponsiveSizes(device: 'mobile' | 'tablet' | 'desktop'): string {
  const sizes = {
    mobile: '(max-width: 768px) 200px, (max-width: 1024px) 300px, 400px',
    tablet: '(max-width: 1024px) 300px, 400px',
    desktop: '(max-width: 768px) 200px, (max-width: 1024px) 300px, 400px'
  };

  return sizes[device];
}

/**
 * Get timeout values for GIF loading (shorter than regular images)
 */
export function getGifTimeout(attempt: number): number {
  const timeouts: { [key: number]: number } = {
    0: 8000,   // Initial load: 8 seconds
    1: 10000,  // Fallback: 10 seconds
    2: 12000,  // Proxy: 12 seconds
    3: 15000   // Original: 15 seconds
  };

  return timeouts[attempt] || 15000;
}

/**
 * Check if GIF should be lazy loaded based on context
 */
export function shouldLazyLoadGif(priority: boolean, isVisible: boolean, device: 'mobile' | 'tablet' | 'desktop'): boolean {
  // Always load immediately if priority is set
  if (priority) return false;
  
  // On mobile, be more aggressive with lazy loading
  if (device === 'mobile') return true;
  
  // On desktop, only lazy load if not immediately visible
  return !isVisible;
}

/**
 * Get loading strategy for GIFs
 */
export function getGifLoadingStrategy(device: 'mobile' | 'tablet' | 'desktop', priority: boolean): 'eager' | 'lazy' {
  if (priority) return 'eager';
  
  // On mobile, use lazy loading for better performance
  if (device === 'mobile') return 'lazy';
  
  // On desktop, use eager loading for better UX
  return 'eager';
}

/**
 * Get quality settings for GIFs (typically lower than static images)
 */
export function getGifQuality(device: 'mobile' | 'tablet' | 'desktop'): number {
  const quality = {
    mobile: 70,   // Lower quality on mobile for faster loading
    tablet: 80,   // Medium quality on tablet
    desktop: 85   // Higher quality on desktop
  };

  return quality[device];
}

/**
 * Check if device has slow connection
 */
export function hasSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const connection = (navigator as any).connection;
  if (!connection) return false;
  
  const slowConnections = ['slow-2g', '2g', '3g'];
  return slowConnections.includes(connection.effectiveType);
}

/**
 * Get optimized loading strategy for slow connections
 */
export function getSlowConnectionStrategy(): GifOptimizationOptions {
  return {
    maxWidth: 200,
    maxHeight: 200,
    quality: 60,
    priority: false,
    lazyLoad: true
  };
}

/**
 * Log GIF performance metrics
 */
export function logGifPerformance(url: string, loadTime: number, device: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🎬 GIF Performance - ${url}:`, {
      loadTime: `${loadTime}ms`,
      device,
      slowConnection: hasSlowConnection()
    });
  }
} 