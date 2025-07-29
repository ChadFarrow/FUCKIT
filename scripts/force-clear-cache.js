#!/usr/bin/env node

/**
 * Force Clear Cache Script
 * 
 * This script aggressively clears all caches that might be causing production issues
 * including recursion errors and album loading problems.
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 FORCE CLEARING ALL CACHES...');

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

// Clear any other potential cache directories
const cacheDirs = [
  '.cache',
  'cache',
  'dist',
  'build',
  'out'
];

cacheDirs.forEach(dir => {
  const cachePath = path.join(process.cwd(), dir);
  if (fs.existsSync(cachePath)) {
    console.log(`🗑️  Clearing ${dir} cache...`);
    fs.rmSync(cachePath, { recursive: true, force: true });
  }
});

// Create a comprehensive cache clearing script for the browser
const cacheClearScript = `
// Comprehensive cache clearing script for production
if (typeof window !== 'undefined') {
  console.log('🧹 FORCE CLEARING ALL PRODUCTION CACHES...');
  
  // Clear localStorage
  localStorage.clear();
  console.log('🗑️  localStorage cleared');
  
  // Clear sessionStorage
  sessionStorage.clear();
  console.log('🗑️  sessionStorage cleared');
  
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      console.log('🗑️  Found caches:', cacheNames);
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
  
  // Clear IndexedDB
  if ('indexedDB' in window) {
    indexedDB.databases().then(databases => {
      databases.forEach(db => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          console.log('🗑️  IndexedDB deleted:', db.name);
        }
      });
    });
  }
  
  // Force page reload after clearing
  setTimeout(() => {
    console.log('🔄 Reloading page after cache clear...');
    window.location.reload(true);
  }, 1000);
  
  console.log('✅ All production caches cleared');
}
`;

// Write the cache clearing script
const scriptPath = path.join(process.cwd(), 'public', 'force-clear-cache.js');
fs.writeFileSync(scriptPath, cacheClearScript);
console.log('📝 Created force cache clearing script at public/force-clear-cache.js');

// Create a cache clearing HTML page
const cacheClearHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Clear Cache - DoerfelVerse</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            text-align: center;
            background: rgba(0,0,0,0.3);
            padding: 2rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 0.5rem;
            font-size: 1.1rem;
            cursor: pointer;
            margin: 1rem;
        }
        button:hover { background: #45a049; }
        .status { margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧹 Clear Production Cache</h1>
        <p>This will clear all browser caches and reload the page.</p>
        <button onclick="clearAllCaches()">Clear All Caches</button>
        <div id="status" class="status"></div>
    </div>
    
    <script>
        function clearAllCaches() {
            const status = document.getElementById('status');
            status.innerHTML = 'Clearing caches...';
            
            // Clear localStorage
            localStorage.clear();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Clear all caches
            if ('caches' in window) {
                caches.keys().then(cacheNames => {
                    cacheNames.forEach(cacheName => {
                        caches.delete(cacheName);
                    });
                });
            }
            
            // Force service worker update
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => {
                        registration.unregister();
                    });
                });
            }
            
            status.innerHTML = 'Caches cleared! Reloading page...';
            
            // Force page reload
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    </script>
</body>
</html>
`;

// Write the cache clearing HTML page
const htmlPath = path.join(process.cwd(), 'public', 'clear-cache.html');
fs.writeFileSync(htmlPath, cacheClearHTML);
console.log('📝 Created cache clearing HTML page at public/clear-cache.html');

console.log('✅ FORCE CACHE CLEARING COMPLETE!');
console.log('');
console.log('Next steps:');
console.log('1. Run: npm run build');
console.log('2. Deploy the new build');
console.log('3. Users can visit /clear-cache.html to clear their browser cache');
console.log('4. Or users can visit /force-clear-cache.js to run the script directly'); 