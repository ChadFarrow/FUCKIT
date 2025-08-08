'use client';

import { useMemo } from 'react';

interface PlaceholderImageProps {
  width: number;
  height: number;
  className?: string;
  alt?: string;
}

export default function PlaceholderImage({ 
  width, 
  height, 
  className = '', 
  alt = 'Placeholder' 
}: PlaceholderImageProps) {
  // Generate a simple SVG placeholder
  const svgDataUrl = useMemo(() => {
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
  }, [width, height]);

  return (
    <img
      src={svgDataUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
} 