/**
 * Bunny.net CDN Utilities
 * Smart CDN usage that only optimizes when beneficial
 */

export interface CDNConfig {
  hostname: string;
  zone: string;
  apiKey?: string;
}

// Default CDN configuration
const defaultCDNConfig: CDNConfig = {
  hostname: process.env.BUNNY_CDN_HOSTNAME || 're-podtards.b-cdn.net',
  zone: process.env.BUNNY_CDN_ZONE || 're-podtards',
  apiKey: process.env.BUNNY_CDN_API_KEY,
};

// Performance thresholds for CDN usage
const CDN_THRESHOLDS = {
  // Only use CDN for images larger than this (bytes)
  MIN_IMAGE_SIZE: 50 * 1024, // 50KB
  // Only use CDN for external domains (not local/relative URLs)
  EXTERNAL_DOMAINS_ONLY: true,
  // Domains that are already fast (don't need CDN)
  FAST_DOMAINS: [
    're-podtards.b-cdn.net', // Our primary CDN
    'localhost',
    '127.0.0.1',
    'vercel.app',
    'vercel.com',
  ],
  // Domains that are slow and benefit from CDN
  // Note: Only include domains that are properly configured in the CDN Pull Zone
  SLOW_DOMAINS: [
    'doerfelverse.com',
    'sirtjthewrathful.com',
    'thisisjdog.com',
    'wavlake.com',
    // 'ableandthewolf.com', // Temporarily disabled - CDN not configured for this domain
  ]
};

/**
 * Check if a URL should use CDN based on performance analysis
 * @param url - The URL to analyze
 * @returns Whether CDN would improve performance
 */
export function shouldUseCDN(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    // Don't use CDN if not configured
    if (defaultCDNConfig.hostname === 'your-zone.b-cdn.net') {
      return false;
    }

    // CDN CORS headers are now properly configured
    // Re-enabled CDN processing after confirming CORS setup

    // Don't re-process URLs that are already on our CDN
    if (domain === 're-podtards.b-cdn.net') {
      return false;
    }

    // Don't use CDN for already fast domains
    if (CDN_THRESHOLDS.FAST_DOMAINS.some(fast => domain.includes(fast))) {
      return false;
    }

    // Don't use CDN for local/relative URLs
    if (CDN_THRESHOLDS.EXTERNAL_DOMAINS_ONLY && 
        (domain === 'localhost' || domain === '127.0.0.1' || url.startsWith('/'))) {
      return false;
    }

    // Use CDN for known slow domains
    if (CDN_THRESHOLDS.SLOW_DOMAINS.some(slow => domain.includes(slow))) {
      return true;
    }

    // For other domains, be conservative - only use CDN if explicitly beneficial
    return false;

  } catch (error) {
    // If URL parsing fails, don't use CDN
    return false;
  }
}

/**
 * Smart CDN URL generator - only optimizes when beneficial
 * @param originalUrl - The original image URL
 * @param options - CDN optimization options
 * @returns The optimized URL (CDN or original)
 */
export function getSmartCDNUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'gif';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    forceCDN?: boolean; // Override performance check
  } = {}
): string {
  if (!originalUrl) return originalUrl;

  // Check if CDN would actually improve performance
  if (!options.forceCDN && !shouldUseCDN(originalUrl)) {
    return originalUrl;
  }

  // If no CDN hostname is configured, return original URL
  if (defaultCDNConfig.hostname === 'your-zone.b-cdn.net') {
    return originalUrl;
  }

  // If URL is already on our CDN, return as-is unless forceCDN is true
  if (!options.forceCDN && originalUrl.includes('re-podtards.b-cdn.net')) {
    return originalUrl;
  }

  try {
    const url = new URL(originalUrl);
    
    // Build CDN URL
    let cdnUrl = `https://${defaultCDNConfig.hostname}${url.pathname}`;
    
    // Add optimization parameters
    const params = new URLSearchParams();
    
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    if (options.format) params.append('f', options.format);
    if (options.fit) params.append('fit', options.fit);
    
    // Add query parameters if any
    if (params.toString()) {
      cdnUrl += `?${params.toString()}`;
    }
    
    return cdnUrl;
  } catch (error) {
    console.warn('Invalid URL for CDN processing:', originalUrl);
    return originalUrl;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getSmartCDNUrl instead
 */
export function getCDNUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'gif';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  } = {}
): string {
  return getSmartCDNUrl(originalUrl, options);
}

/**
 * Smart album artwork URL - only uses CDN when beneficial
 * @param originalUrl - The original artwork URL
 * @param size - The desired size (e.g., 'thumbnail', 'medium', 'large')
 * @returns The optimized artwork URL
 */
export function getAlbumArtworkUrl(originalUrl: string, size: 'thumbnail' | 'medium' | 'large' = 'medium'): string {
  // If no URL provided, return a placeholder
  if (!originalUrl) {
    return getPlaceholderImageUrl(size);
  }

  const sizeMap = {
    thumbnail: { width: 150, height: 150, quality: 80 },
    medium: { width: 300, height: 300, quality: 85 },
    large: { width: 600, height: 600, quality: 90 },
  };

  // CDN CORS headers are now properly configured
  // Re-enabled CDN processing with image optimization

  return getSmartCDNUrl(originalUrl, {
    ...sizeMap[size],
    format: 'webp',
    fit: 'cover',
  });
}

/**
 * Get a placeholder image URL for missing artwork
 * @param size - The desired size
 * @returns A placeholder image URL
 */
export function getPlaceholderImageUrl(size: 'thumbnail' | 'medium' | 'large' = 'medium'): string {
  const sizeMap = {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 },
  };

  const { width, height } = sizeMap[size];
  
  // Use a gradient placeholder that looks like a music album
  return `https://via.placeholder.com/${width}x${height}/1f2937/ffffff?text=🎵`;
}

/**
 * Smart track artwork URL - only uses CDN when beneficial
 * @param originalUrl - The original artwork URL
 * @returns The optimized track artwork URL
 */
export function getTrackArtworkUrl(originalUrl: string): string {
  return getSmartCDNUrl(originalUrl, {
    width: 200,
    height: 200,
    quality: 85,
    format: 'webp',
    fit: 'cover',
  });
}

/**
 * Get CDN configuration
 * @returns The current CDN configuration
 */
export function getCDNConfig(): CDNConfig {
  return { ...defaultCDNConfig };
}

/**
 * Purge CDN cache for a specific URL
 * @param url - The URL to purge from cache
 * @returns Promise that resolves when purge is complete
 */
export async function purgeCDNCache(url: string): Promise<boolean> {
  if (!defaultCDNConfig.apiKey || !defaultCDNConfig.zone) {
    console.warn('CDN API key or zone not configured for purging');
    return false;
  }

  try {
    const response = await fetch(`https://api.bunny.net/pullzone/${defaultCDNConfig.zone}/purgeCache`, {
      method: 'POST',
      headers: {
        'AccessKey': defaultCDNConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url
      })
    });

    if (response.ok) {
      console.log(`✅ CDN cache purged for: ${url}`);
      return true;
    } else {
      console.error(`❌ Failed to purge CDN cache: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('Error purging CDN cache:', error);
    return false;
  }
}

/**
 * Purge entire CDN cache
 * @returns Promise that resolves when purge is complete
 */
export async function purgeEntireCDNCache(): Promise<boolean> {
  if (!defaultCDNConfig.apiKey || !defaultCDNConfig.zone) {
    console.warn('CDN API key or zone not configured for purging');
    return false;
  }

  try {
    const response = await fetch(`https://api.bunny.net/pullzone/${defaultCDNConfig.zone}/purgeCache`, {
      method: 'POST',
      headers: {
        'AccessKey': defaultCDNConfig.apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      console.log('✅ Entire CDN cache purged');
      return true;
    } else {
      console.error(`❌ Failed to purge entire CDN cache: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('Error purging entire CDN cache:', error);
    return false;
  }
} 