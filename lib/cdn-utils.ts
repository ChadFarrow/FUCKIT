/**
 * Image Utilities
 * Direct image serving without CDN dependencies
 */

/**
 * Check if a URL should use CDN - disabled, using direct image serving
 * @param url - The URL to analyze
 * @returns Always false - CDN disabled
 */
export function shouldUseCDN(url: string): boolean {
  // Check if we're in production and the URL is from an external source
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Only use CDN for external images, not for local assets
    return Boolean(url && !url.startsWith('/') && !url.startsWith('data:'));
  }
  return false;
}

/**
 * Get image URL - returns original URL directly
 * @param originalUrl - The original image URL
 * @param options - Image options (unused)
 * @returns The original URL
 */
export function getSmartCDNUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'gif';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    forceCDN?: boolean;
  } = {}
): string {
  return originalUrl || '';
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
  return originalUrl || '';
}

/**
 * Get album artwork URL - returns original URL or placeholder
 * @param originalUrl - The original artwork URL
 * @param size - The desired size (unused)
 * @returns The original artwork URL or placeholder
 */
export function getAlbumArtworkUrl(originalUrl: string, size: 'thumbnail' | 'medium' | 'large' = 'medium'): string {
  // If no URL provided, return a placeholder
  if (!originalUrl) {
    return getPlaceholderImageUrl(size);
  }
  
  return originalUrl;
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
 * Get track artwork URL - returns original URL
 * @param originalUrl - The original artwork URL
 * @returns The original artwork URL
 */
export function getTrackArtworkUrl(originalUrl: string): string {
  return originalUrl || '';
}

/**
 * Get image URL - returns original URL (no mapping)
 * @param originalUrl - The original image URL
 * @returns The original URL
 */
export function getMappedCDNUrl(originalUrl: string): string {
  return originalUrl || '';
} 