#!/usr/bin/env node

/**
 * Test Feed GUIDs
 * 
 * This script tests which feed GUIDs from the database are valid in Podcast Index
 */

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

if (!API_KEY || !API_SECRET) {
  console.error('❌ Missing Podcast Index API credentials in .env.local');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '../data');
const MUSIC_TRACKS_PATH = path.join(DATA_DIR, 'music-tracks.json');

console.log('🧪 Testing Feed GUIDs in Podcast Index\n');

// Read music tracks
let musicData;
try {
  musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
  const musicTracks = musicData.musicTracks || musicData;
  console.log(`📀 Loaded ${musicTracks.length} tracks`);
} catch (error) {
  console.error('❌ Error reading music-tracks.json:', error.message);
  process.exit(1);
}

const musicTracks = musicData.musicTracks || musicData;

// Extract unique feed GUIDs
const uniqueFeedGuids = [...new Set(musicTracks.map(track => track.feedGuid).filter(Boolean))];
console.log(`🔍 Found ${uniqueFeedGuids.length} unique feed GUIDs`);

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

// Test a feed GUID
async function testFeedGuid(feedGuid) {
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === 'true' && data.feed && data.feed.id) {
      return {
        valid: true,
        feedId: data.feed.id,
        title: data.feed.title,
        url: data.feed.url,
        episodeCount: data.feed.episodeCount || 0
      };
    } else {
      return {
        valid: false,
        error: data.description || 'Feed not found'
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

// Test a sample of GUIDs
async function testSampleGuids(guids, sampleSize = 10) {
  const sample = guids.slice(0, sampleSize);
  console.log(`\n🧪 Testing ${sample.length} sample GUIDs...`);
  
  const results = {
    valid: [],
    invalid: []
  };
  
  for (const guid of sample) {
    console.log(`\n🔍 Testing: ${guid}`);
    const result = await testFeedGuid(guid);
    
    if (result.valid) {
      console.log(`   ✅ VALID: ${result.title}`);
      console.log(`      Feed ID: ${result.feedId}`);
      console.log(`      Episodes: ${result.episodeCount}`);
      console.log(`      URL: ${result.url}`);
      results.valid.push({ guid, ...result });
    } else {
      console.log(`   ❌ INVALID: ${result.error}`);
      results.invalid.push({ guid, error: result.error });
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

// Main execution
async function main() {
  try {
    const results = await testSampleGuids(uniqueFeedGuids);
    
    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Valid GUIDs: ${results.valid.length}`);
    console.log(`   ❌ Invalid GUIDs: ${results.invalid.length}`);
    
    if (results.valid.length > 0) {
      console.log(`\n✅ Valid Feeds Found:`);
      results.valid.forEach(feed => {
        console.log(`   • ${feed.title} (${feed.episodeCount} episodes)`);
      });
    }
    
    if (results.invalid.length > 0) {
      console.log(`\n❌ Invalid GUIDs:`);
      results.invalid.forEach(feed => {
        console.log(`   • ${feed.guid}: ${feed.error}`);
      });
    }
    
    // Calculate success rate
    const successRate = (results.valid.length / (results.valid.length + results.invalid.length)) * 100;
    console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate < 50) {
      console.log(`\n⚠️  Low success rate suggests:`);
      console.log(`   • GUIDs may not be from Podcast Index`);
      console.log(`   • GUIDs may be from a different system`);
      console.log(`   • GUIDs may be corrupted during import`);
      console.log(`   • Need to investigate data source`);
    }
    
    // Save test results
    const reportPath = path.join(DATA_DIR, `feed-guid-test-report-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      totalGuids: uniqueFeedGuids.length,
      testedGuids: results.valid.length + results.invalid.length,
      results: results,
      successRate: successRate
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📋 Test report saved to ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
