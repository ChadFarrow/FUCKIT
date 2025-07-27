#!/usr/bin/env node

/**
 * Clear Cache and Restart Development Server
 * This script helps resolve CDN and service worker issues by clearing caches
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing Cache and Restarting Development Server\n');

function clearNextCache() {
  console.log('🗑️  Clearing Next.js cache...');
  try {
    const nextDir = path.join(process.cwd(), '.next');
    if (fs.existsSync(nextDir)) {
      execSync('rm -rf .next', { stdio: 'inherit' });
      console.log('✅ Next.js cache cleared');
    } else {
      console.log('ℹ️  No .next directory found');
    }
  } catch (error) {
    console.log('⚠️  Error clearing Next.js cache:', error.message);
  }
}

function clearNodeModulesCache() {
  console.log('🗑️  Clearing node_modules cache...');
  try {
    execSync('npm cache clean --force', { stdio: 'inherit' });
    console.log('✅ npm cache cleared');
  } catch (error) {
    console.log('⚠️  Error clearing npm cache:', error.message);
  }
}

function installDependencies() {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.log('❌ Error installing dependencies:', error.message);
    return false;
  }
  return true;
}

function startDevServer() {
  console.log('🚀 Starting development server...');
  try {
    execSync('npm run dev', { stdio: 'inherit' });
  } catch (error) {
    console.log('❌ Error starting development server:', error.message);
  }
}

function main() {
  console.log('🎵 FUCKIT Cache Clear and Restart\n');
  
  // Clear caches
  clearNextCache();
  clearNodeModulesCache();
  
  // Install dependencies
  const installOk = installDependencies();
  
  if (installOk) {
    console.log('\n✅ Cache cleared and dependencies installed');
    console.log('\n📝 Next steps:');
    console.log('1. The development server will start automatically');
    console.log('2. Open your browser and go to http://localhost:3000');
    console.log('3. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('4. Check browser console for any remaining errors');
    console.log('5. If issues persist, try opening in an incognito/private window');
    
    // Start dev server
    startDevServer();
  } else {
    console.log('\n❌ Failed to install dependencies. Please check your npm configuration.');
  }
}

main(); 