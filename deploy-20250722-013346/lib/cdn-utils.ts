/**
 * Bunny.net CDN Utilities
 * Handles CDN URL generation and optimization
 */

export interface CDNConfig {
  hostname: string;
  zone: string;
  apiKey?: string;
}

// Default CDN configuration
const defaultCDNConfig: CDNConfig = {
  hostname: process.env.BUNNY_CDN_HOSTNAME || 'your-zone.b-cdn.net',
  zone: process.env.BUNNY_CDN_ZONE || 'your-zone',
  apiKey: process.env.BUNNY_CDN_API_KEY,
};

/**
 * Generate a CDN URL for an image
 * @param originalUrl - The original image URL
 * @param options - CDN optimization options
 * @returns The CDN-optimized URL
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
  if (!originalUrl) return originalUrl;

  // If no CDN hostname is configured, return original URL
  if (defaultCDNConfig.hostname === 'your-zone.b-cdn.net') {
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
 * Generate a CDN URL for album artwork with optimal settings
 * @param originalUrl - The original artwork URL
 * @param size - The desired size (e.g., 'thumbnail', 'medium', 'large')
 * @returns The CDN-optimized artwork URL
 */
export function getAlbumArtworkUrl(originalUrl: string, size: 'thumbnail' | 'medium' | 'large' = 'medium'): string {
  const sizeMap = {
    thumbnail: { width: 150, height: 150, quality: 80 },
    medium: { width: 300, height: 300, quality: 85 },
    large: { width: 600, height: 600, quality: 90 },
  };

  return getCDNUrl(originalUrl, {
    ...sizeMap[size],
    format: 'webp',
    fit: 'cover',
  });
}

/**
 * Generate a CDN URL for track artwork
 * @param originalUrl - The original artwork URL
 * @returns The CDN-optimized track artwork URL
 */
export function getTrackArtworkUrl(originalUrl: string): string {
  return getCDNUrl(originalUrl, {
    width: 200,
    height: 200,
    quality: 85,
    format: 'webp',
    fit: 'cover',
  });
}

/**
 * Check if a URL should be processed through CDN
 * @param url - The URL to check
 * @returns Whether the URL should use CDN
 */
export function shouldUseCDN(url: string): boolean {
  if (!url) return false;
  
  // Don't process if CDN is not configured
  if (defaultCDNConfig.hostname === 'your-zone.b-cdn.net') {
    return false;
  }
  
  // Only process image URLs
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const hasImageExtension = imageExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  return hasImageExtension;
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