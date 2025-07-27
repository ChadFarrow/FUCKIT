/**
 * Image Utilities
 * Simple image serving utilities without CDN dependencies
 */

/**
 * Get album artwork URL with fallback to placeholder
 * @param originalUrl - The original artwork URL
 * @param size - The desired size for placeholder
 * @returns The original artwork URL or placeholder
 */
export function getAlbumArtworkUrl(originalUrl: string, size: 'thumbnail' | 'medium' | 'large' = 'medium'): string {
  return originalUrl || getPlaceholderImageUrl(size);
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
 * @returns The original artwork URL or empty string
 */
export function getTrackArtworkUrl(originalUrl: string): string {
  return originalUrl || '';
} 