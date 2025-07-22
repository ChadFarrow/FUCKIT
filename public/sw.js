// Dynamic cache versioning - update this with each deployment
const APP_VERSION = '1.5e772e6'; // TODO: Update this with each deployment
const CACHE_NAME = `doerfelverse-v${APP_VERSION}`;
const STATIC_CACHE = `doerfelverse-static-v${APP_VERSION}`;
const DYNAMIC_CACHE = `doerfelverse-dynamic-v${APP_VERSION}`;

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
        return self.skipWaiting();
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
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
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

// Handle API requests (RSS feeds, etc.)
async function handleApiRequest(request) {
  const cacheKey = `api-${new URL(request.url).pathname}-${new Date().getHours()}`; // Hourly cache
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses for 1 hour
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(cacheKey, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('📶 Network failed for API request, trying cache');
  }

  // Fallback to cache
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // No cache available
  return new Response('Offline - No cached data available', { 
    status: 503, 
    statusText: 'Service Unavailable' 
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

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Preload frequently accessed RSS feeds
    const feedUrls = [
      '/api/fetch-rss?url=https://re-podtards.b-cdn.net/feeds/music-from-the-doerfelverse.xml',
      '/api/fetch-rss?url=https://re-podtards.b-cdn.net/feeds/bloodshot-lies-album.xml'
    ];
    
    const cache = await caches.open(DYNAMIC_CACHE);
    
    for (const url of feedUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log('📦 Background cached:', url);
        }
      } catch (error) {
        console.log('⚠️ Background sync failed for:', url);
      }
    }
  } catch (error) {
    console.error('❌ Background sync error:', error);
  }
}

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