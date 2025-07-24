// Dynamic cache versioning - update this with each deployment
const APP_VERSION = '1.6.0'; // TODO: Update this with each deployment
const CACHE_NAME = `doerfelverse-v${APP_VERSION}`;
const STATIC_CACHE = `doerfelverse-static-v${APP_VERSION}`;
const DYNAMIC_CACHE = `doerfelverse-dynamic-v${APP_VERSION}`;
const API_CACHE = `doerfelverse-api-v${APP_VERSION}`;

// Cache expiration times
const CACHE_EXPIRATION = {
  api: 5 * 60 * 1000, // 5 minutes for API calls
  static: 24 * 60 * 60 * 1000, // 24 hours for static assets
  dynamic: 60 * 60 * 1000 // 1 hour for dynamic content
};

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/placeholder-episode.jpg',
  '/placeholder-podcast.jpg'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log(`🔄 Service Worker v${APP_VERSION} installing...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log(`✅ Service Worker v${APP_VERSION} installed`);
        // Force immediate activation of new service worker
        // Don't skip waiting - let the user control when to update
        console.log('⏳ Waiting for all tabs to close before activating...');
        return Promise.resolve();
      })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log(`🚀 Service Worker v${APP_VERSION} activating...`);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete all caches that don't belong to current version
            if (!cacheName.includes(APP_VERSION)) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Don't claim immediately - wait for page reload
      console.log('✅ Service Worker activated, will control pages on reload')
    ]).then(() => {
      console.log(`✅ Service Worker v${APP_VERSION} activated and controlling all pages`);
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ 
            type: 'SW_UPDATED', 
            version: APP_VERSION,
            message: 'App updated! New features available.'
          });
        });
      });
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - network first with short cache fallback
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$/)) {
    // Static assets - cache first
    event.respondWith(handleStaticAsset(request));
  } else {
    // HTML pages - network first with cache fallback
    event.respondWith(handlePageRequest(request));
  }
});

// Handle API requests (RSS feeds, etc.) - Network first with smart caching
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cacheKey = request.url;
  
  try {
    // Always try network first for API requests
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Only cache successful responses
      const cache = await caches.open(API_CACHE);
      const responseToCache = networkResponse.clone();
      
      // Add timestamp to cached response
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', new Date().toISOString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(cacheKey, cachedResponse);
      return networkResponse;
    }
  } catch (error) {
    console.log('📶 Network failed for API request, checking cache');
  }

  // Check cache with expiration
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(cacheKey);
  
  if (cachedResponse) {
    const cachedAt = cachedResponse.headers.get('sw-cached-at');
    if (cachedAt) {
      const age = Date.now() - new Date(cachedAt).getTime();
      if (age < CACHE_EXPIRATION.api) {
        console.log('📦 Serving from cache (age:', Math.round(age / 1000), 'seconds)');
        return cachedResponse;
      } else {
        console.log('🗑️ Cache expired, removing old entry');
        cache.delete(cacheKey);
      }
    }
  }

  // No valid cache available
  return new Response(JSON.stringify({ error: 'Offline - No cached data available' }), { 
    status: 503, 
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle static assets
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  // Try cache first
  let response = await cache.match(request);
  if (response) {
    // Update cache in background
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
    }).catch(() => {}); // Ignore network errors for background updates
    
    return response;
  }

  // Fallback to network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('📶 Network failed for static asset');
  }

  // Return offline fallback for images
  if (request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    const fallbackResponse = await cache.match('/placeholder-podcast.jpg');
    if (fallbackResponse) {
      return fallbackResponse;
    }
  }

  return new Response('Asset not available offline', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// Handle page requests
async function handlePageRequest(request) {
  try {
    // Try network first for pages
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful page responses
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('📶 Network failed for page request, trying cache');
  }

  // Fallback to cache
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Ultimate fallback to offline page
  const offlineResponse = await cache.match('/offline');
  if (offlineResponse) {
    return offlineResponse;
  }

  return new Response('Offline', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// Background sync disabled to prevent conflicts
// Background sync can cause race conditions with foreground requests

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('📩 Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/favicon-32x32.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon-32x32.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('DoerfelVerse Update', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log(`🎵 DoerfelVerse Service Worker v${APP_VERSION} loaded`);