#!/usr/bin/env node

/**
 * Bunny.net Storage Setup Script
 * 
 * This script helps you set up Bunny.net Storage for cache uploads
 * It will guide you through creating storage zones and getting the necessary credentials
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupBunnyStorage() {
  console.log('🚀 Bunny.net Storage Setup for Cache Uploads\n');
  
  console.log('📋 Prerequisites:');
  console.log('1. Bunny.net account (https://bunny.net/)');
  console.log('2. CDN Pull Zone already configured');
  console.log('3. Storage API key from Account Settings > API\n');
  
  console.log('🔧 Setup Steps:');
  console.log('1. Go to https://dash.bunny.net/');
  console.log('2. Navigate to Storage > Storage Zones');
  console.log('3. Click "Add Storage Zone"');
  console.log('4. Name it something like "re-podtards-cache"');
  console.log('5. Choose a region close to your users');
  console.log('6. Get your Storage API key from Account Settings > API\n');
  
  const useDefaults = await question('Use default settings for re.podtards.com cache? (y/n): ');
  
  let storageZone, storageApiKey, region;
  
  if (useDefaults.toLowerCase() === 'y' || useDefaults.toLowerCase() === 'yes') {
    storageZone = 're-podtards-cache';
    region = 'NY'; // New York
    storageApiKey = await question('Enter your Bunny.net Storage API key: ');
  } else {
    storageZone = await question('Enter your Storage Zone name (e.g., re-podtards-cache): ');
    region = await question('Enter your Storage Zone region (e.g., NY, LA, DE): ');
    storageApiKey = await question('Enter your Bunny.net Storage API key: ');
  }
  
  // Read existing .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = '';
  
  try {
    envContent = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    console.log('📝 Creating new .env.local file...');
  }
  
  // Add storage configuration
  const storageConfig = `
# Bunny.net Storage Configuration for Cache
BUNNY_STORAGE_ZONE=${storageZone}
BUNNY_STORAGE_REGION=${region}
BUNNY_STORAGE_API_KEY=${storageApiKey}

# Storage URLs
BUNNY_STORAGE_URL=https://${region.toLowerCase()}.storage.bunnycdn.com/${storageZone}
`;
  
  // Append storage config to existing content
  const updatedEnvContent = envContent + storageConfig;
  
  try {
    await fs.writeFile(envPath, updatedEnvContent);
    console.log('\n✅ Updated .env.local file with Storage configuration!');
    
    console.log('\n📊 Configuration Summary:');
    console.log(`   Storage Zone: ${storageZone}`);
    console.log(`   Region: ${region}`);
    console.log(`   Storage URL: https://${region.toLowerCase()}.storage.bunnycdn.com/${storageZone}`);
    console.log(`   API Key: ${storageApiKey ? '✅ Set' : '❌ Missing'}`);
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Test storage access with: node scripts/test-storage-access.js');
    console.log('2. Upload cache with: node scripts/upload-cache-to-bunny.js');
    console.log('3. Create a Pull Zone to serve cached files via CDN');
    
    console.log('\n🔗 Create Pull Zone for Cache:');
    console.log('1. Go to CDN > Pull Zones');
    console.log('2. Click "Add Pull Zone"');
    console.log('3. Configure:');
    console.log(`   - Name: ${storageZone}-cdn`);
    console.log(`   - Origin Type: Storage Zone`);
    console.log(`   - Origin URL: ${storageZone}`);
    console.log('4. Enable cache optimization settings');
    
  } catch (error) {
    console.error('❌ Error updating .env.local file:', error.message);
  }
  
  rl.close();
}

// Run the script
setupBunnyStorage().catch(console.error); 