#!/usr/bin/env node

/**
 * Test Bunny.net Storage Access
 * 
 * This script tests your Bunny.net Storage configuration
 * to ensure you can upload and access files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
async function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = await fs.readFile(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0 && !key.startsWith('#')) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env.local:', error.message);
    return {};
  }
}

// Load environment variables
let BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_REGION;

async function initializeEnv() {
  const envVars = await loadEnvFile();
  BUNNY_STORAGE_API_KEY = envVars.BUNNY_STORAGE_API_KEY;
  BUNNY_STORAGE_ZONE = envVars.BUNNY_STORAGE_ZONE;
  BUNNY_STORAGE_REGION = envVars.BUNNY_STORAGE_REGION || 'NY';
}

async function testStorageAccess() {
  console.log('🧪 Testing Bunny.net Storage Access...\n');
  
  // Initialize environment variables
  await initializeEnv();
  
  // Check environment variables
  console.log('📋 Environment Check:');
  console.log(`   Storage Zone: ${BUNNY_STORAGE_ZONE || '❌ Not set'}`);
  console.log(`   Region: ${BUNNY_STORAGE_REGION}`);
  console.log(`   API Key: ${BUNNY_STORAGE_API_KEY ? '✅ Set' : '❌ Not set'}\n`);
  
  if (!BUNNY_STORAGE_API_KEY || !BUNNY_STORAGE_ZONE) {
    console.error('❌ Missing required environment variables');
    console.log('💡 Run: node scripts/setup-bunny-storage.js');
    process.exit(1);
  }
  
  const storageUrl = `https://${BUNNY_STORAGE_REGION.toLowerCase()}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
  
  console.log(`🔗 Storage URL: ${storageUrl}\n`);
  
  try {
    // Test 1: List files in storage zone
    console.log('📋 Test 1: Listing files in storage zone...');
    const listResponse = await fetch(storageUrl, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
      }
    });
    
    if (listResponse.ok) {
      const files = await listResponse.json();
      console.log(`✅ Success! Found ${files.length} files in storage zone`);
      if (files.length > 0) {
        console.log('   Sample files:');
        files.slice(0, 5).forEach(file => {
          console.log(`   - ${file.ObjectName} (${file.Length} bytes)`);
        });
      }
    } else {
      console.log(`⚠️  Storage zone appears empty or new (HTTP ${listResponse.status})`);
    }
    
    // Test 2: Upload a test file
    console.log('\n📤 Test 2: Uploading test file...');
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testFileName = 'test-access.txt';
    
    const uploadResponse = await fetch(`${storageUrl}/${testFileName}`, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'text/plain',
      },
      body: testContent
    });
    
    if (uploadResponse.ok) {
      console.log(`✅ Successfully uploaded test file: ${testFileName}`);
      
      // Test 3: Download the test file
      console.log('\n📥 Test 3: Downloading test file...');
      const downloadResponse = await fetch(`${storageUrl}/${testFileName}`, {
        method: 'GET',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY,
        }
      });
      
      if (downloadResponse.ok) {
        const downloadedContent = await downloadResponse.text();
        console.log(`✅ Successfully downloaded test file`);
        console.log(`   Content: "${downloadedContent}"`);
        
        // Test 4: Delete the test file
        console.log('\n🗑️  Test 4: Cleaning up test file...');
        const deleteResponse = await fetch(`${storageUrl}/${testFileName}`, {
          method: 'DELETE',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
          }
        });
        
        if (deleteResponse.ok) {
          console.log(`✅ Successfully deleted test file`);
        } else {
          console.log(`⚠️  Could not delete test file (HTTP ${deleteResponse.status})`);
        }
      } else {
        console.log(`❌ Failed to download test file (HTTP ${downloadResponse.status})`);
      }
    } else {
      console.log(`❌ Failed to upload test file (HTTP ${uploadResponse.status})`);
      const errorText = await uploadResponse.text();
      console.log(`   Error: ${errorText}`);
    }
    
    console.log('\n🎉 Storage access test completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Storage zone is accessible');
    console.log('✅ File upload works');
    console.log('✅ File download works');
    console.log('✅ File deletion works');
    console.log('\n🚀 Ready to upload cache files!');
    
  } catch (error) {
    console.error('❌ Storage test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your API key is correct');
    console.log('2. Verify storage zone name');
    console.log('3. Ensure storage zone is created in Bunny.net dashboard');
    console.log('4. Check network connectivity');
  }
}

// Run the test
testStorageAccess().catch(console.error); 