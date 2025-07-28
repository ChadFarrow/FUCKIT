'use client';

import { useState, useEffect } from 'react';
import MobileImageDebug from '@/components/MobileImageDebug';
import CDNImage from '@/components/CDNImage';

export default function TestMobileImagesPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [userAgent, setUserAgent] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [serviceWorkerActive, setServiceWorkerActive] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const ua = navigator.userAgent;
      setIsMobile(width <= 768);
      setUserAgent(ua);
    };

    const checkOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        setServiceWorkerActive(!!registration?.active);
      }
    };

    checkMobile();
    checkOnlineStatus();
    checkServiceWorker();

    window.addEventListener('resize', checkMobile);
    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('online', checkOnlineStatus);
      window.removeEventListener('offline', checkOnlineStatus);
    };
  }, []);

  // Test images with different sources
  const testImages = [
    {
      src: 'https://www.doerfelverse.com/wp-content/uploads/2024/01/you-are-my-world.gif',
      alt: 'Test Image 1 - Doerfelverse'
    },
    {
      src: 'https://re.podtards.com/api/optimized-images/you-are-my-world.gif',
      alt: 'Test Image 2 - Optimized'
    },
    {
      src: 'https://www.wavlake.com/artwork/123456.jpg',
      alt: 'Test Image 3 - Wavlake'
    },
    {
      src: 'https://f4.bcbits.com/img/a1234567890_10.jpg',
      alt: 'Test Image 4 - Bandcamp'
    }
  ];

  // If offline, show a simple message
  if (!isOnline) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">You&apos;re Offline</h1>
          <p className="text-gray-400 mb-4">This test page requires an internet connection.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-4">Mobile Image Loading Test</h1>
      
      <div className="bg-gray-800 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold mb-2">Device Information</h2>
        <div className="text-sm space-y-1">
          <div>Mobile: {isMobile ? 'Yes' : 'No'}</div>
          <div>Screen Width: {typeof window !== 'undefined' ? window.innerWidth : 'Unknown'}</div>
          <div>User Agent: {userAgent.substring(0, 100)}...</div>
          <div>Platform: {typeof navigator !== 'undefined' ? navigator.platform : 'Unknown'}</div>
          <div>Vendor: {typeof navigator !== 'undefined' ? navigator.vendor : 'Unknown'}</div>
          <div>Online: {isOnline ? 'Yes' : 'No'}</div>
          <div>Service Worker Active: {serviceWorkerActive ? 'Yes' : 'No'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testImages.map((image, index) => (
          <div key={index} className="bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Test Image {index + 1}</h3>
            <p className="text-sm text-gray-400 mb-2">{image.alt}</p>
            <p className="text-xs text-gray-500 mb-4 break-all">{image.src}</p>
            
            <MobileImageDebug 
              src={image.src} 
              alt={image.alt} 
            />
            
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Regular CDNImage Component:</h4>
              <CDNImage
                src={image.src}
                alt={image.alt}
                width={200}
                height={200}
                className="w-full h-48 object-cover rounded"
                priority={true}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gray-800 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        <ul className="text-sm space-y-1">
          <li>• Open browser developer tools</li>
          <li>• Check the Console tab for debug messages</li>
          <li>• Check the Network tab for failed image requests</li>
          <li>• Test on different mobile devices/browsers</li>
          <li>• Look for CORS errors or timeout issues</li>
          <li>• If you see &apos;offline&apos;, check your internet connection</li>
        </ul>
      </div>

      <div className="mt-4 bg-yellow-900/20 border border-yellow-600 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2 text-yellow-400">Troubleshooting</h3>
        <p className="text-sm text-yellow-200 mb-2">
          If you&apos;re seeing &quot;offline&quot; instead of this page:
        </p>
        <ul className="text-sm text-yellow-200 space-y-1">
          <li>• Check your internet connection</li>
          <li>• Try refreshing the page</li>
          <li>• Clear browser cache and reload</li>
          <li>• Disable service worker temporarily in dev tools</li>
        </ul>
      </div>
    </div>
  );
} 