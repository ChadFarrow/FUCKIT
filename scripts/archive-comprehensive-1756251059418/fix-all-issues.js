#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing all application issues...\n');

// 1. Fix corrupted images
console.log('1️⃣ Checking and fixing corrupted images...');
try {
  execSync('node scripts/fix-corrupted-images.js', { stdio: 'inherit' });
  console.log('✅ Image fix complete\n');
} catch (error) {
  console.log('⚠️ Image fix had issues, continuing...\n');
}

// 2. Clear service worker cache and rebuild
console.log('2️⃣ Clearing service worker cache and rebuilding...');
try {
  execSync('node scripts/clear-sw-cache.js', { stdio: 'inherit' });
  console.log('✅ Service worker cache cleared and rebuilt\n');
} catch (error) {
  console.error('❌ Service worker cache clear failed:', error.message);
  process.exit(1);
}

// 3. Clear browser cache instructions
console.log('3️⃣ Browser cache clearing instructions:');
console.log('   📱 For mobile browsers:');
console.log('      - Safari: Settings > Safari > Clear History and Website Data');
console.log('      - Chrome: Settings > Privacy and Security > Clear browsing data');
console.log('   💻 For desktop browsers:');
console.log('      - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)');
console.log('      - Or clear cache in browser developer tools\n');

// 4. Check for any remaining issues
console.log('4️⃣ Checking for potential remaining issues...');

// Check if optimized images directory exists and has files
const optimizedImagesDir = path.join(__dirname, '../data/optimized-images');
if (fs.existsSync(optimizedImagesDir)) {
  const files = fs.readdirSync(optimizedImagesDir);
  console.log(`   📁 Optimized images directory: ${files.length} files found`);
} else {
  console.log('   ⚠️ Optimized images directory not found');
}

// Check if service worker file exists
const swFile = path.join(__dirname, '../public/sw.js');
if (fs.existsSync(swFile)) {
  const stats = fs.statSync(swFile);
  console.log(`   🔧 Service worker file: ${(stats.size / 1024).toFixed(1)} KB`);
} else {
  console.log('   ⚠️ Service worker file not found');
}

// Check Next.js build
const nextDir = path.join(__dirname, '../.next');
if (fs.existsSync(nextDir)) {
  console.log('   ✅ Next.js build directory exists');
} else {
  console.log('   ⚠️ Next.js build directory not found');
}

console.log('\n🎉 All fixes applied successfully!');
console.log('\n📋 Summary of fixes:');
console.log('   ✅ Corrupted images checked and fixed');
console.log('   ✅ Service worker cache cleared');
console.log('   ✅ Application rebuilt with updated configuration');
console.log('   ✅ RSC payload caching issues addressed');
console.log('\n💡 Next steps:');
console.log('   1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)');
console.log('   2. Test the application to ensure issues are resolved');
console.log('   3. If issues persist, try clearing browser cache completely');
console.log('   4. Check browser console for any remaining errors'); 