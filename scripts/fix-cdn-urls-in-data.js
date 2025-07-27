#!/usr/bin/env node

/**
 * Fix CDN URLs in Data Files
 * This script replaces all instances of the old CDN hostname with the correct one
 */

const fs = require('fs');
const path = require('path');

// CDN hostname mapping - handle both uppercase and lowercase
const OLD_HOSTNAMES = ['FUCKIT.b-cdn.net', 'fuckit.b-cdn.net'];
const NEW_HOSTNAME = 're-podtards-cdn.b-cdn.net';

console.log('🔧 Fixing CDN URLs in Data Files\n');

function fixCdnUrlsInFile(filePath) {
  console.log(`📁 Processing: ${path.basename(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Count total old occurrences
    let totalOldCount = 0;
    for (const oldHostname of OLD_HOSTNAMES) {
      const count = (content.match(new RegExp(oldHostname.replace(/\./g, '\\.'), 'g')) || []).length;
      totalOldCount += count;
      if (count > 0) {
        console.log(`🔍 Found ${count} instances of ${oldHostname}`);
      }
    }
    
    if (totalOldCount === 0) {
      console.log(`✅ No old CDN URLs found in ${path.basename(filePath)}`);
      return true;
    }
    
    // Replace all occurrences of each old hostname
    for (const oldHostname of OLD_HOSTNAMES) {
      const regex = new RegExp(oldHostname.replace(/\./g, '\\.'), 'g');
      content = content.replace(regex, NEW_HOSTNAME);
    }
    
    // Count new occurrences
    const newCount = (content.match(new RegExp(NEW_HOSTNAME.replace(/\./g, '\\.'), 'g')) || []).length;
    
    // Create backup
    const backupPath = `${filePath}.backup-${Date.now()}`;
    fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    
    // Write the fixed content
    fs.writeFileSync(filePath, content);
    
    console.log(`✅ Fixed ${totalOldCount} CDN URLs in ${path.basename(filePath)}`);
    console.log(`📊 Old hostname count: ${totalOldCount} → New hostname count: ${newCount}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

function main() {
  const dataDir = path.join(process.cwd(), 'data');
  const filesToProcess = [
    path.join(dataDir, 'parsed-feeds.json'),
    path.join(dataDir, 'feeds.json')
  ];
  
  let successCount = 0;
  let totalCount = filesToProcess.length;
  
  console.log(`🎯 Found ${totalCount} files to process\n`);
  
  for (const filePath of filesToProcess) {
    if (fixCdnUrlsInFile(filePath)) {
      successCount++;
    }
    console.log(''); // Add spacing between files
  }
  
  console.log('📋 Summary:');
  console.log(`✅ Successfully processed: ${successCount}/${totalCount} files`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 All CDN URLs have been fixed!');
    console.log('🔄 Please restart your development server to see the changes.');
  } else {
    console.log('\n⚠️  Some files could not be processed. Check the errors above.');
  }
}

// Run the script
main(); 