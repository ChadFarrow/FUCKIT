#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

// Podcast Index API authentication
function createAuthHeaders() {
  const unixTime = Math.floor(Date.now() / 1000);
  const data4Hash = API_KEY + API_SECRET + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': API_KEY,
    'Authorization': hash,
    'User-Agent': 'FUCKIT-Music-App/1.0'
  };
}

// The two failed GUIDs from our sample test
const failedItems = [
  {
    feedGuid: "38f290e4-e6d6-52d0-a52b-9fd9948e7dc8",
    itemGuid: "c2eeed20-1c5e-4e05-a4a9-30e8521207db",
    position: 21
  },
  {
    feedGuid: "d46367eb-be3c-548a-9c27-fbf1dcf27f30", 
    itemGuid: "c7003607-233e-40e8-b2fa-6465127d0076",
    position: 27
  }
];

async function investigateFailure(feedGuid, itemGuid, position) {
  console.log(`🔍 INVESTIGATING FAILURE #${position}`);
  console.log(`   feedGuid: ${feedGuid}`);
  console.log(`   itemGuid: ${itemGuid}\n`);
  
  const headers = createAuthHeaders();
  
  // Test 1: Check if feed exists at all
  console.log('📡 TEST 1: Check if feed exists (podcasts/byguid)');
  try {
    const url1 = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    const response1 = await fetch(url1, { headers });
    const data1 = await response1.json();
    
    console.log(`   Status: ${response1.status}`);
    console.log(`   API Status: ${data1.status}`);
    
    if (data1.status === 'true' && data1.feed) {
      console.log(`   ✅ Feed EXISTS!`);
      console.log(`   📚 Title: "${data1.feed.title}"`);
      console.log(`   🆔 Feed ID: ${data1.feed.id}`);
      console.log(`   🔗 URL: ${data1.feed.url}`);
      console.log(`   🏷️  Medium: ${data1.feed.medium || 'unknown'}`);
      console.log(`   📊 Episode Count: ${data1.feed.episodeCount || 0}`);
      
      // If feed exists, check episodes
      console.log('\n📡 TEST 2: Check episodes in this feed');
      const url2 = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${data1.feed.id}&max=10`;
      const response2 = await fetch(url2, { headers });
      const data2 = await response2.json();
      
      console.log(`   Status: ${response2.status}`);
      console.log(`   Episodes found: ${data2.items ? data2.items.length : 0}`);
      
      if (data2.items && data2.items.length > 0) {
        console.log(`   📋 Episode GUIDs in feed:`);
        data2.items.forEach((ep, i) => {
          const isTarget = ep.guid === itemGuid;
          const marker = isTarget ? '🎯 TARGET' : '  ';
          console.log(`     ${marker} ${i+1}. ${ep.guid || 'No GUID'} - "${ep.title || 'No Title'}"`);
        });
        
        const targetEpisode = data2.items.find(ep => ep.guid === itemGuid);
        if (targetEpisode) {
          console.log(`   ✅ TARGET EPISODE FOUND!`);
          console.log(`      This should have worked... 🤔`);
        } else {
          console.log(`   ❌ Target episode GUID not found in feed`);
          console.log(`   💡 Episode might be in a different page or deleted`);
        }
      } else {
        console.log(`   ❌ No episodes found in feed`);
      }
      
    } else {
      console.log(`   ❌ Feed NOT FOUND`);
      console.log(`   📄 Response: ${JSON.stringify(data1).substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 3: Try different search methods
  console.log('\n📡 TEST 3: Try searching by title/URL patterns');
  try {
    // Try searching for feeds with similar patterns
    const url3 = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(feedGuid.substring(0, 8))}&max=5`;
    const response3 = await fetch(url3, { headers });
    const data3 = await response3.json();
    
    console.log(`   Status: ${response3.status}`);
    console.log(`   Search results: ${data3.feeds ? data3.feeds.length : 0}`);
    
    if (data3.feeds && data3.feeds.length > 0) {
      console.log(`   🔍 Similar feeds found:`);
      data3.feeds.slice(0, 3).forEach((feed, i) => {
        console.log(`     ${i+1}. "${feed.title}" (${feed.podcastGuid})`);
      });
    }
    
  } catch (error) {
    console.log(`   ❌ Search error: ${error.message}`);
  }
  
  // Test 4: Check if this is a V4V/Music specific issue
  console.log('\n📡 TEST 4: Check if this has V4V info');
  try {
    const url4 = `https://api.podcastindex.org/api/1.0/value/byguid?guid=${encodeURIComponent(feedGuid)}`;
    const response4 = await fetch(url4, { headers });
    
    if (response4.ok) {
      const data4 = await response4.json();
      console.log(`   Status: ${response4.status}`);
      console.log(`   V4V Info: ${data4.value ? 'Yes' : 'No'}`);
    } else {
      console.log(`   Status: ${response4.status} (might not support V4V endpoint)`);
    }
    
  } catch (error) {
    console.log(`   ❌ V4V check error: ${error.message}`);
  }
  
  console.log('\n' + '=' .repeat(60) + '\n');
}

async function investigateAllFailures() {
  console.log('🔬 INVESTIGATING FAILURES FROM SAMPLE TEST\n');
  console.log(`Found ${failedItems.length} failures to investigate...\n`);
  
  for (let i = 0; i < failedItems.length; i++) {
    const item = failedItems[i];
    await investigateFailure(item.feedGuid, item.itemGuid, item.position);
    
    // Small delay between investigations
    if (i < failedItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('🎯 FAILURE INVESTIGATION COMPLETE');
  console.log('\n💡 ANALYSIS & RECOMMENDATIONS:');
  console.log('   1. Check if feeds were recently deleted/moved');
  console.log('   2. Verify if these are temporary API issues');
  console.log('   3. Consider retry logic for failed items');
  console.log('   4. Document failure patterns for future batches');
}

investigateAllFailures().catch(console.error);