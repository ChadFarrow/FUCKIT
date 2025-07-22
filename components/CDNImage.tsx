'use client';

import Image from 'next/image';
import { getCDNUrl, shouldUseCDN } from '@/lib/cdn-utils';
import { useState } from 'react';

interface CDNImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'gif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  onError?: () => void;
  onLoad?: () => void;
}

export default function CDNImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 85,
  format = 'webp',
  fit = 'cover',
  onError,
  onLoad,
  ...props
}: CDNImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Use CDN URL if configured and appropriate
  const finalSrc = shouldUseCDN(imageSrc) 
    ? getCDNUrl(imageSrc, { width, height, quality, format, fit })
    : imageSrc;

  const handleError = () => {
    if (!hasError && shouldUseCDN(imageSrc)) {
      // Fallback to original URL if CDN fails
      setImageSrc(src);
      setHasError(true);
    } else {
      onError?.();
    }
  };

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      onError={handleError}
      onLoad={onLoad}
      unoptimized={!shouldUseCDN(imageSrc)} // Only optimize through CDN
      {...props}
    />
  );
} 