#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Clearing service worker cache and rebuilding...');

// Remove the .next directory to clear all cached files
const nextDir = path.join(__dirname, '../.next');
if (fs.existsSync(nextDir)) {
  console.log('🗑️ Removing .next directory...');
  fs.rmSync(nextDir, { recursive: true, force: true });
}

// Remove the public/sw.js file to force regeneration
const swFile = path.join(__dirname, '../public/sw.js');
if (fs.existsSync(swFile)) {
  console.log('🗑️ Removing service worker file...');
  fs.unlinkSync(swFile);
}

// Remove workbox file if it exists
const workboxFile = path.join(__dirname, '../public/workbox-*.js');
try {
  const workboxFiles = fs.readdirSync(path.join(__dirname, '../public')).filter(file => file.startsWith('workbox-'));
  workboxFiles.forEach(file => {
    fs.unlinkSync(path.join(__dirname, '../public', file));
    console.log(`🗑️ Removed workbox file: ${file}`);
  });
} catch (error) {
  // Ignore if no workbox files exist
}

// Rebuild the application
console.log('🔨 Rebuilding application...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Rebuild complete!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

console.log('🎉 Service worker cache cleared and application rebuilt successfully!');
console.log('💡 You may need to hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R) to see the changes.'); 