#!/usr/bin/env node

/**
 * Clear Production Cache Script
 * 
 * This script clears various caches that might be causing the recursion errors
 * in production. It's designed to be run when deploying fixes for production issues.
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing production caches...');

// Clear Next.js build cache
const nextCacheDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextCacheDir)) {
  console.log('🗑️  Clearing .next cache...');
  fs.rmSync(nextCacheDir, { recursive: true, force: true });
}

// Clear node_modules/.cache if it exists
const nodeCacheDir = path.join(process.cwd(), 'node_modules', '.cache');
if (fs.existsSync(nodeCacheDir)) {
  console.log('🗑️  Clearing node_modules/.cache...');
  fs.rmSync(nodeCacheDir, { recursive: true, force: true });
}

// Clear any local storage cache files
const cacheFiles = [
  'cachedAlbums',
  'albumsCacheTimestamp',
  'audioPlayerState'
];

console.log('🗑️  Clearing localStorage cache keys...');
console.log('   Note: These will be cleared on next page load');

// Create a cache clearing script for the browser
const cacheClearScript = `
// Cache clearing script for production
if (typeof window !== 'undefined') {
  console.log('🧹 Clearing production caches...');
  
  // Clear localStorage
  localStorage.removeItem('cachedAlbums');
  localStorage.removeItem('albumsCacheTimestamp');
  localStorage.removeItem('audioPlayerState');
  
  // Clear service worker cache
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        console.log('🗑️  Deleting cache:', cacheName);
        caches.delete(cacheName);
      });
    });
  }
  
  // Force service worker update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
        console.log('🔄 Service worker unregistered');
      });
    });
  }
  
  console.log('✅ Production caches cleared');
}
`;

// Write the cache clearing script
const scriptPath = path.join(process.cwd(), 'public', 'clear-cache.js');
fs.writeFileSync(scriptPath, cacheClearScript);
console.log('📝 Created cache clearing script at public/clear-cache.js');

console.log('✅ Cache clearing complete!');
console.log('');
console.log('Next steps:');
console.log('1. Run: npm run build');
console.log('2. Deploy the new build');
console.log('3. Users can visit /clear-cache.js to clear their browser cache'); 