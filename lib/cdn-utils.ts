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
  if (!originalUrl) {
    return getPlaceholderImageUrl(size);
  }
  
  // Ensure HTTPS for all URLs
  if (originalUrl.startsWith('http://')) {
    originalUrl = originalUrl.replace('http://', 'https://');
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
  
  // Generate a local SVG placeholder to avoid external service issues
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1f2937;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#374151;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.1}" 
            fill="#ffffff" text-anchor="middle" dy="0.35em">Music</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Get track artwork URL - returns original URL
 * @param originalUrl - The original artwork URL
 * @returns The original artwork URL or empty string
 */
export function getTrackArtworkUrl(originalUrl: string): string {
  return originalUrl || '';
} 