#!/usr/bin/env node

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.BUNNY_CDN_API_KEY;
const PULL_ZONE_ID = process.env.BUNNY_CDN_ZONE_ID || '4228588';

if (!API_KEY) {
  console.error('❌ BUNNY_CDN_API_KEY not found in environment variables');
  process.exit(1);
}

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bunny.net',
      port: 443,
      path: path,
      method: method,
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function configureCORS() {
  console.log('🔧 Configuring CORS for Bunny CDN Pull Zone...\n');

  try {
    // Get current pull zone configuration
    console.log('📊 Fetching current Pull Zone configuration...');
    const pullZone = await makeRequest('GET', `/pullzone/${PULL_ZONE_ID}`);
    console.log('✅ Current configuration retrieved');
    console.log(`   - Name: ${pullZone.Name}`);
    console.log(`   - Hostname: ${pullZone.Hostnames[0]?.Value || 'Not set'}`);
    console.log(`   - Origin URL: ${pullZone.OriginUrl}`);

    // Update pull zone with CORS headers
    console.log('\n🔄 Updating Pull Zone with CORS configuration...');
    
    const updateData = {
      // Enable CORS
      AddCanonicalHeader: false,
      CorsEnabled: true,
      // Add custom headers
      BunnyAiImageBlueprints: [],
      EdgeRules: [
        {
          Guid: "cors-allow-all",
          ActionType: 2, // SetResponseHeader
          ActionParameter1: "Access-Control-Allow-Origin",
          ActionParameter2: "*",
          Triggers: [
            {
              Type: 0, // RequestUrl
              PatternMatches: ["*"]
            }
          ],
          TriggerMatchingType: 0,
          Description: "Allow CORS for all origins",
          Enabled: true
        },
        {
          Guid: "cors-allow-methods",
          ActionType: 2, // SetResponseHeader
          ActionParameter1: "Access-Control-Allow-Methods",
          ActionParameter2: "GET, HEAD, OPTIONS",
          Triggers: [
            {
              Type: 0, // RequestUrl
              PatternMatches: ["*"]
            }
          ],
          TriggerMatchingType: 0,
          Description: "Allow GET, HEAD, OPTIONS methods",
          Enabled: true
        },
        {
          Guid: "cors-allow-headers",
          ActionType: 2, // SetResponseHeader
          ActionParameter1: "Access-Control-Allow-Headers",
          ActionParameter2: "Origin, X-Requested-With, Content-Type, Accept, Range",
          Triggers: [
            {
              Type: 0, // RequestUrl
              PatternMatches: ["*"]
            }
          ],
          TriggerMatchingType: 0,
          Description: "Allow common headers",
          Enabled: true
        }
      ]
    };

    await makeRequest('POST', `/pullzone/${PULL_ZONE_ID}`, updateData);
    console.log('✅ CORS configuration updated successfully!');

    // Purge cache to apply changes immediately
    console.log('\n🧹 Purging CDN cache to apply changes...');
    await makeRequest('POST', `/pullzone/${PULL_ZONE_ID}/purgeCache`);
    console.log('✅ CDN cache purged successfully!');

    console.log('\n✅ CORS configuration complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Wait 2-3 minutes for changes to propagate');
    console.log('2. Test an image URL to verify CORS headers are working');
    console.log('3. If issues persist, check Bunny.net dashboard for Storage Zone permissions');

  } catch (error) {
    console.error('❌ Error configuring CORS:', error.message);
    console.log('\n📝 Manual configuration required:');
    console.log('1. Login to https://dash.bunny.net/');
    console.log('2. Go to CDN → Pull Zones → re-podtards-cdn');
    console.log('3. Go to "Headers" section');
    console.log('4. Add these response headers:');
    console.log('   - Access-Control-Allow-Origin: *');
    console.log('   - Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    console.log('   - Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Range');
    console.log('5. Save changes and purge cache');
  }
}

// Run the configuration
configureCORS();