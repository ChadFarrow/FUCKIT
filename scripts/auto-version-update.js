#!/usr/bin/env node

/**
 * Automatic PWA version updater that can be integrated into build/deployment process
 * This script automatically generates a version based on git commit or timestamp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('⚠️ Git not available, using timestamp');
    return null;
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

function generateVersion() {
  const gitHash = getGitCommitHash();
  const branch = getGitBranch();
  const timestamp = Date.now().toString().slice(-6);
  
  if (gitHash) {
    // Use git commit hash for production
    return branch === 'main' ? `1.${gitHash}` : `dev.${gitHash}`;
  } else {
    // Fallback to timestamp
    return `1.0.${timestamp}`;
  }
}

function updateServiceWorkerVersion(newVersion) {
  const swPath = path.join(__dirname, '..', 'public', 'sw.js');
  
  if (!fs.existsSync(swPath)) {
    console.error('❌ Service worker not found at:', swPath);
    process.exit(1);
  }
  
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
    
    console.log(`🚀 PWA version auto-updated: ${currentVersion} → ${newVersion}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update service worker version:', error.message);
    return false;
  }
}

function updatePackageJson(newVersion) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const oldVersion = packageJson.version;
    
    // Update version in package.json
    packageJson.version = newVersion;
    packageJson.buildTime = new Date().toISOString();
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    
    console.log(`📦 Package.json version updated: ${oldVersion} → ${newVersion}`);
    return true;
  } catch (error) {
    console.warn('⚠️ Could not update package.json version:', error.message);
    return false;
  }
}

function main() {
  console.log('🔄 Auto-updating PWA version...');
  
  const newVersion = generateVersion();
  
  // Update service worker
  const swSuccess = updateServiceWorkerVersion(newVersion);
  
  // Update package.json
  const packageSuccess = updatePackageJson(newVersion);
  
  if (swSuccess) {
    console.log('✅ PWA version automation complete!');
    console.log(`📱 New version: ${newVersion}`);
    console.log('🚀 Users will get update notifications within 30 seconds of deployment');
  } else {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateVersion, updateServiceWorkerVersion, updatePackageJson };