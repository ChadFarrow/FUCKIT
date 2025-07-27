#!/usr/bin/env node

/**
 * Fix CDN Configuration Issues
 * This script helps resolve the CDN hostname mismatch and configuration problems
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Correct CDN configuration
const CORRECT_CDN_HOSTNAME = 're-podtards-cdn.b-cdn.net';
const CORRECT_CDN_ZONE = 're-podtards-cdn';

console.log('🔧 Fixing CDN Configuration Issues\n');

// Check current environment file
const envPath = path.join(process.cwd(), '.env.local');
const envExamplePath = path.join(process.cwd(), 'env.example');

function checkEnvironmentFile() {
  console.log('📋 Checking environment configuration...');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ .env.local file exists');
    
    // Check for incorrect CDN hostname
    if (envContent.includes('FUCKIT.b-cdn.net')) {
      console.log('⚠️  Found incorrect CDN hostname: FUCKIT.b-cdn.net');
      console.log('   Should be: re-podtards-cdn.b-cdn.net');
      return false;
    }
    
    if (envContent.includes(CORRECT_CDN_HOSTNAME)) {
      console.log('✅ Correct CDN hostname found in .env.local');
      return true;
    }
  } else {
    console.log('❌ .env.local file not found');
    console.log('   Please copy env.example to .env.local and configure your API keys');
    return false;
  }
  
  return true;
}

function testCDNConnection() {
  return new Promise((resolve) => {
    console.log('\n🌐 Testing CDN connection...');
    
    const testUrl = `https://${CORRECT_CDN_HOSTNAME}`;
    
    https.get(testUrl, (res) => {
      console.log(`✅ CDN is accessible: ${res.statusCode}`);
      resolve(true);
    }).on('error', (err) => {
      console.log(`❌ CDN connection failed: ${err.message}`);
      resolve(false);
    });
  });
}

function testImageLoading() {
  return new Promise((resolve) => {
    console.log('\n🖼️  Testing image loading...');
    
    // Test a sample image URL
    const testImageUrl = `https://${CORRECT_CDN_HOSTNAME}/albums/ben-doerfel-artwork.png`;
    
    https.get(testImageUrl, (res) => {
      console.log(`✅ Sample image accessible: ${res.statusCode}`);
      resolve(true);
    }).on('error', (err) => {
      console.log(`❌ Sample image failed: ${err.message}`);
      resolve(false);
    });
  });
}

function updateEnvironmentFile() {
  console.log('\n📝 Updating environment configuration...');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found. Please create it first:');
    console.log('   cp env.example .env.local');
    console.log('   Then edit .env.local with your API keys');
    return false;
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace incorrect CDN hostname
  if (envContent.includes('FUCKIT.b-cdn.net')) {
    envContent = envContent.replace(/FUCKIT\.b-cdn\.net/g, CORRECT_CDN_HOSTNAME);
    console.log('✅ Updated CDN hostname in .env.local');
  }
  
  // Update CDN zone if needed
  if (envContent.includes('BUNNY_CDN_ZONE=re-podtards')) {
    envContent = envContent.replace(/BUNNY_CDN_ZONE=re-podtards/g, `BUNNY_CDN_ZONE=${CORRECT_CDN_ZONE}`);
    console.log('✅ Updated CDN zone in .env.local');
  }
  
  // Update CDN URL
  if (envContent.includes('NEXT_PUBLIC_CDN_URL=https://FUCKIT.b-cdn.net')) {
    envContent = envContent.replace(/NEXT_PUBLIC_CDN_URL=https:\/\/FUCKIT\.b-cdn\.net/g, `NEXT_PUBLIC_CDN_URL=https://${CORRECT_CDN_HOSTNAME}`);
    console.log('✅ Updated CDN URL in .env.local');
  }
  
  // Write back to file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Environment file updated');
  
  return true;
}

function generateCorrectEnvTemplate() {
  console.log('\n📋 Correct .env.local template:');
  console.log(`
# Bunny.net CDN Configuration
BUNNY_CDN_HOSTNAME=${CORRECT_CDN_HOSTNAME}
BUNNY_CDN_ZONE=${CORRECT_CDN_ZONE}
BUNNY_CDN_API_KEY=your-cdn-api-key-here

# Bunny.net Storage Configuration
BUNNY_STORAGE_API_KEY=your-storage-api-key-here
BUNNY_STORAGE_HOSTNAME=ny.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=re-podtards-storage

# CDN URLs
NEXT_PUBLIC_CDN_URL=https://${CORRECT_CDN_HOSTNAME}

# Site Configuration  
NEXT_PUBLIC_SITE_URL=https://re.podtards.com
NEXT_PUBLIC_API_URL=https://re.podtards.com/api

# Environment
NODE_ENV=development

# Optional: Custom Domain for Images
NEXT_PUBLIC_IMAGE_DOMAIN=re.podtards.com
`);
}

async function main() {
  console.log('🎵 FUCKIT CDN Configuration Fix\n');
  
  // Check environment
  const envOk = checkEnvironmentFile();
  
  if (!envOk) {
    console.log('\n🔧 Fixing environment configuration...');
    updateEnvironmentFile();
  }
  
  // Test CDN connection
  const cdnOk = await testCDNConnection();
  
  // Test image loading
  const imageOk = await testImageLoading();
  
  console.log('\n📊 Summary:');
  console.log(`Environment: ${envOk ? '✅' : '❌'}`);
  console.log(`CDN Connection: ${cdnOk ? '✅' : '❌'}`);
  console.log(`Image Loading: ${imageOk ? '✅' : '❌'}`);
  
  if (!envOk || !cdnOk || !imageOk) {
    console.log('\n🚨 Issues detected. Please:');
    console.log('1. Check your .env.local file has correct CDN hostname');
    console.log('2. Verify your Bunny.net CDN zone is active');
    console.log('3. Ensure your API keys are valid');
    console.log('4. Restart your development server after changes');
    
    generateCorrectEnvTemplate();
  } else {
    console.log('\n🎉 All CDN configuration issues resolved!');
    console.log('   Your site should now load images correctly.');
  }
  
  console.log('\n📝 Next steps:');
  console.log('1. Restart your development server: npm run dev');
  console.log('2. Clear browser cache and reload the page');
  console.log('3. Check browser console for any remaining errors');
}

main().catch(console.error); 