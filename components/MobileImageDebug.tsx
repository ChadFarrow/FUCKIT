'use client';

import { useState, useEffect } from 'react';
import CDNImage from './CDNImage';

interface MobileImageDebugProps {
  src: string;
  alt: string;
}

export default function MobileImageDebug({ src, alt }: MobileImageDebugProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [userAgent, setUserAgent] = useState('');
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [imageLoadStatus, setImageLoadStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ua = navigator.userAgent;
      
      setIsMobile(width <= 768);
      setUserAgent(ua);
      setScreenSize({ width, height });
      
      console.log('📱 Mobile Debug Info:', {
        isMobile: width <= 768,
        width,
        height,
        userAgent: ua,
        platform: navigator.platform,
        vendor: navigator.vendor
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleImageLoad = () => {
    console.log('✅ Mobile image loaded successfully:', src);
    setImageLoadStatus('success');
  };

  const handleImageError = () => {
    console.error('❌ Mobile image failed to load:', src);
    setImageLoadStatus('error');
    setErrorDetails('Image failed to load');
  };

  return (
    <div className="border-2 border-red-500 p-2 m-2">
      <h3 className="text-red-500 font-bold">Mobile Debug Component</h3>
      
      <div className="text-xs text-gray-400 mb-2">
        <div>Mobile: {isMobile ? 'Yes' : 'No'}</div>
        <div>Screen: {screenSize.width}x{screenSize.height}</div>
        <div>User Agent: {userAgent.substring(0, 50)}...</div>
        <div>Image URL: {src}</div>
        <div>Status: {imageLoadStatus}</div>
        {errorDetails && <div>Error: {errorDetails}</div>}
      </div>

      <CDNImage
        src={src}
        alt={alt}
        width={200}
        height={200}
        className="w-full h-48 object-cover"
        onLoad={handleImageLoad}
        onError={handleImageError}
        priority={true}
      />
    </div>
  );
} 