#!/usr/bin/env node

/**
 * Auto-increment version script
 * This script increments the version by 0.001 and updates the version.ts file
 * Should be called by Git hooks or CI/CD pipeline
 */

const fs = require('fs');
const path = require('path');

const VERSION_FILE_PATH = path.join(__dirname, '../lib/version.ts');

function readVersionFile() {
  const content = fs.readFileSync(VERSION_FILE_PATH, 'utf8');
  return content;
}

function parseVersion(content) {
  const majorMatch = content.match(/major:\s*(\d+)/);
  const minorMatch = content.match(/minor:\s*(\d+)/);
  const patchMatch = content.match(/patch:\s*(\d+)/);
  const buildMatch = content.match(/build:\s*(\d+)/);

  return {
    major: parseInt(majorMatch[1]) || 1,
    minor: parseInt(minorMatch[1]) || 0,
    patch: parseInt(patchMatch[1]) || 0,
    build: parseInt(buildMatch[1]) || 0
  };
}

function incrementVersion(version) {
  let newPatch = version.patch + 1;
  let newMinor = version.minor;
  let newMajor = version.major;

  // Handle rollover: 0.999 -> 1.000
  if (newPatch >= 1000) {
    newPatch = 0;
    newMinor += 1;
    
    if (newMinor >= 10) {
      newMinor = 0;
      newMajor += 1;
    }
  }

  return {
    major: newMajor,
    minor: newMinor,
    patch: newPatch,
    build: version.build + 1
  };
}

function updateVersionFile(content, newVersion) {
  const updatedContent = content
    .replace(/major:\s*\d+/, `major: ${newVersion.major}`)
    .replace(/minor:\s*\d+/, `minor: ${newVersion.minor}`)
    .replace(/patch:\s*\d+/, `patch: ${newVersion.patch}`)
    .replace(/build:\s*\d+/, `build: ${newVersion.build}`);

  return updatedContent;
}

function formatVersion(version) {
  const minorPatch = (version.minor * 100 + version.patch).toString().padStart(3, '0');
  return `${version.major}.${minorPatch}`;
}

function main() {
  try {
    console.log('🔄 Incrementing version...');
    
    // Read current version
    const content = readVersionFile();
    const currentVersion = parseVersion(content);
    
    console.log(`📊 Current version: v${formatVersion(currentVersion)} (build ${currentVersion.build})`);
    
    // Increment version
    const newVersion = incrementVersion(currentVersion);
    
    console.log(`📈 New version: v${formatVersion(newVersion)} (build ${newVersion.build})`);
    
    // Update file
    const updatedContent = updateVersionFile(content, newVersion);
    fs.writeFileSync(VERSION_FILE_PATH, updatedContent, 'utf8');
    
    console.log('✅ Version updated successfully!');
    
    // Return new version for potential use in CI/CD
    return formatVersion(newVersion);
    
  } catch (error) {
    console.error('❌ Error incrementing version:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, incrementVersion, formatVersion };