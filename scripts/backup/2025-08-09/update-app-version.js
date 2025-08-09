#!/usr/bin/env node

/**
 * Script to update the app version in service worker for faster PWA updates
 * Usage: node scripts/update-app-version.js [version]
 */

const fs = require('fs');
const path = require('path');

// Get version from command line or generate timestamp version
const newVersion = process.argv[2] || `1.0.${Date.now().toString().slice(-6)}`;

const swPath = path.join(__dirname, '..', 'public', 'sw.js');

try {
  // Read the service worker file
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Extract current version
  const currentVersionMatch = swContent.match(/const APP_VERSION = '([^']+)'/);
  const currentVersion = currentVersionMatch ? currentVersionMatch[1] : 'unknown';
  
  // Replace the version
  swContent = swContent.replace(
    /const APP_VERSION = '[^']+'/,
    `const APP_VERSION = '${newVersion}'`
  );
  
  // Write back to file
  fs.writeFileSync(swPath, swContent, 'utf8');
  
  console.log(`🚀 PWA version updated: ${currentVersion} → ${newVersion}`);
  console.log('📱 Users will get update notifications within 30 seconds');
  console.log('🔄 PWA will auto-update on next visit or reload');
  
} catch (error) {
  console.error('❌ Failed to update version:', error.message);
  process.exit(1);
}