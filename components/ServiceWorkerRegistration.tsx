'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const [newVersion, setNewVersion] = useState('');

  useEffect(() => {
    // Temporarily disable Service Worker registration to fix API issues
    console.log('🚫 Service Worker registration temporarily disabled to fix API issues');
    return;
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      let registration: ServiceWorkerRegistration;

      // Register service worker with cache busting
      const swUrl = `/sw.js?v=${Date.now()}`;
      navigator.serviceWorker
        .register(swUrl, {
          scope: '/',
          updateViaCache: 'none' // Don't cache the service worker itself
        })
        .then((reg) => {
          registration = reg;
          console.log('✅ Service Worker registered successfully:', reg);
          
          // Check for updates immediately
          reg.update();
          
          // Check for updates every 30 seconds when app is active
          const updateInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
              reg.update();
            }
          }, 30000);

          // Clean up interval
          return () => clearInterval(updateInterval);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
          // Don't throw - allow the app to continue without service worker
        });

      // Listen for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed - reloading page');
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from Service Worker:', event.data);
        
        if (event.data.type === 'SW_UPDATED') {
          setNewVersion(event.data.version);
          setUpdateReady(true);
          
          // Auto-reload after a short delay if no user interaction
          setTimeout(() => {
            console.log('🔄 Auto-reloading for update...');
            window.location.reload();
          }, 3000);
        }
      });

      // Handle API and RSC fetch failures
      const handleFetchFailure = () => {
        console.warn('🔄 API/RSC fetch failed, attempting to clear service worker cache...');
        
        // Clear service worker cache for problematic files
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              if (cacheName.includes('next-js-files') || cacheName.includes('start-url') || cacheName.includes('api-')) {
                caches.delete(cacheName).then(() => {
                  console.log(`🗑️ Cleared cache: ${cacheName}`);
                });
              }
            });
          });
        }
      };

      // Listen for fetch errors
      window.addEventListener('error', (event) => {
        const message = event.message || '';
        if (message.includes('Failed to fetch RSC payload') || 
            message.includes('Decoding failed') || 
            message.includes('ServiceWorker intercepted')) {
          handleFetchFailure();
        }
      });

      // Listen for unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || '';
        if (message.includes('Decoding failed') || 
            message.includes('ServiceWorker intercepted')) {
          console.warn('🔄 Unhandled promise rejection related to Service Worker:', event.reason);
          handleFetchFailure();
        }
      });

      // Check for waiting service worker on load
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          console.log('🔄 Update available on page load');
        }

        // Listen for waiting service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('🔄 New service worker found');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available
                  console.log('🆕 New content available - update ready');
                  setUpdateReady(true);
                } else {
                  // First time installation
                  console.log('🎉 App installed for offline use');
                }
              }
            });
          }
        });
      });
    }
  }, []); // Remove updateReady from dependencies to prevent infinite loop

  const handleUpdate = () => {
    if (updateReady) {
      // Tell the service worker to skip waiting and take control
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
      
      // Reload will happen automatically via controllerchange event
    }
  };

  const dismissUpdate = () => {
    setUpdateReady(false);
  };

  // Show update notification
  if (updateReady && newVersion) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm bg-blue-600 text-white rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-in-out">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium">App Updated!</h3>
            <p className="text-xs text-blue-100 mt-1">
              Version {newVersion} is ready. Reload to get the latest features.
            </p>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={handleUpdate}
                className="bg-blue-500 hover:bg-blue-400 text-white text-xs px-3 py-1 rounded transition-colors"
              >
                Reload Now
              </button>
              <button
                onClick={dismissUpdate}
                className="bg-transparent hover:bg-blue-500 text-blue-200 hover:text-white text-xs px-3 py-1 rounded border border-blue-400 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="flex-shrink-0 ml-2 text-blue-200 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Update available notification removed - task 13

  return null; // This component doesn't render anything when no updates
}