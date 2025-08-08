'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const [newVersion, setNewVersion] = useState('');

  useEffect(() => {
    // Completely disable Service Worker registration to fix API issues
    console.log('🚫 Service Worker registration completely disabled to fix API issues');
    
    // Clear any existing service worker caches to prevent decoding issues
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('next-js-files') || 
              cacheName.includes('start-url') || 
              cacheName.includes('api-') ||
              cacheName.includes('sw-') ||
              cacheName.includes('service-worker')) {
            caches.delete(cacheName).then(() => {
              console.log(`🗑️ Cleared service worker cache: ${cacheName}`);
            });
          }
        });
      });
    }

    // Unregister any existing service workers
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister().then(() => {
            console.log('🗑️ Unregistered existing service worker');
          });
        });
      });
    }
    
    // TODO: Re-enable service worker when API issues are resolved
    /*
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
            message.includes('ServiceWorker intercepted') ||
            message.includes('Failed to fetch RSC payload')) {
          handleFetchFailure();
        }
      });
    }
    */
  }, []);

  // Don't render anything since service worker is disabled
  return null;
}