// Simple service worker for FUCKIT app
// This prevents 404 errors for sw.js requests

self.addEventListener('install', (event) => {
  console.log('FUCKIT Service Worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('FUCKIT Service Worker activated');
});

self.addEventListener('fetch', (event) => {
  // Handle fetch events if needed
  event.respondWith(fetch(event.request));
}); 