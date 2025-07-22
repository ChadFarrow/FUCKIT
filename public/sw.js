const CACHE_NAME = 'doerfelverse-v1';
const STATIC_CACHE = 'doerfelverse-static-v1';
const DYNAMIC_CACHE = 'doerfelverse-dynamic-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/offline',
  '/manifest.json',
  '/logo.webp',
  '/favicon.ico',
  '/placeholder-episode.jpg',
  '/placeholder-podcast.jpg'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests (RSS feeds)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Default: try network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => {
              cache.put(request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request);
      })
  );
});

// Handle API requests with caching
async function handleApiRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.status === 200) {
      // Cache successful API responses
      const responseClone = response.clone();
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, responseClone);
    }
    
    return response;
  } catch (error) {
    // Fallback to cached API response
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving cached API response');
      return cachedResponse;
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ error: 'Network error and no cached data available' }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle static assets
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const responseClone = response.clone();
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    // Return placeholder for images
    if (request.url.includes('.jpg') || request.url.includes('.png') || request.url.includes('.webp')) {
      return caches.match('/placeholder-podcast.jpg');
    }
    throw error;
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.status === 200) {
      // Cache successful navigation responses
      const responseClone = response.clone();
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, responseClone);
    }
    
    return response;
  } catch (error) {
    // Fallback to cached page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    return caches.match('/offline');
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  return pathname.includes('.js') || 
         pathname.includes('.css') || 
         pathname.includes('.png') || 
         pathname.includes('.jpg') || 
         pathname.includes('.jpeg') || 
         pathname.includes('.gif') || 
         pathname.includes('.svg') || 
         pathname.includes('.webp') || 
         pathname.includes('.woff') || 
         pathname.includes('.woff2') || 
         pathname.includes('.ttf') || 
         pathname.includes('.eot');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Handle background sync
async function doBackgroundSync() {
  try {
    // Sync any pending actions
    console.log('🔄 Performing background sync...');
    
    // You can add offline actions here like:
    // - Sync user preferences
    // - Upload cached data
    // - Sync offline playlists
    
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New music available!',
    icon: '/logo.webp',
    badge: '/logo.webp',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/logo.webp'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo.webp'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('DoerfelVerse', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('🎵 DoerfelVerse Service Worker loaded'); 