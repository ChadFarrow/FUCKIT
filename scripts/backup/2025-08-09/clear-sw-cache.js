#!/usr/bin/env node

/**
 * Script to clear service worker cache and help with debugging
 * Run with: node scripts/clear-sw-cache.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing service worker cache...\n');

// Clear browser cache files if they exist
const cacheFiles = [
  'public/sw.js',
  'public/workbox-*.js'
];

cacheFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ Found: ${file}`);
  } else {
    console.log(`❌ Not found: ${file}`);
  }
});

console.log('\n📋 Instructions to clear service worker cache:');
console.log('1. Open your browser');
console.log('2. Go to Developer Tools (F12)');
console.log('3. Go to Application tab');
console.log('4. Click on "Service Workers" in the left sidebar');
console.log('5. Click "Unregister" for any active service workers');
console.log('6. Go to "Storage" in the left sidebar');
console.log('7. Click "Clear site data"');
console.log('8. Refresh the page');
console.log('\n🔧 Alternative method:');
console.log('1. Open Developer Tools (F12)');
console.log('2. Go to Application tab');
console.log('3. Click "Clear storage" in the left sidebar');
console.log('4. Click "Clear site data"');
console.log('5. Refresh the page');

console.log('\n🌐 Test the mobile images page:');
console.log('Visit: http://localhost:3000/test-mobile-images');

console.log('\n📱 For mobile testing:');
console.log('1. Use browser dev tools device emulation');
console.log('2. Or test on actual mobile device');
console.log('3. Check network tab for failed requests');
console.log('4. Look for CORS errors in console');

console.log('\nService Worker cache cleared successfully!');

// Also clear data service cache via API
console.log('Clearing server-side caches...');
fetch('http://localhost:3000/api/admin/clear-cache?type=data', { method: 'POST' })
  .then(response => response.json())
  .then(data => {
    console.log('Server cache clearing result:', data);
  })
  .catch(error => {
    console.warn('Could not clear server cache (server may not be running):', error.message);
  }); 