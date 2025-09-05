#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;
const fs = require('fs').promises;
const path = require('path');

// Configuration - Small test batch
const HGH_REMOTE_ITEMS_FILE = 'data/hgh-analysis/hgh-remote-items.json';
const OUTPUT_DIR = 'data/hgh-resolved-tracks';
const TEST_SIZE = 5; // Only test first 5 tracks

function generateAuthHeaders() {
  const apiKey = PODCAST_INDEX_API_KEY;
  const apiSecret = PODCAST_INDEX_API_SECRET;
  const unixTime = Math.floor(Date.now() / 1000);
  
  const crypto = require('crypto');
  const data4Hash = apiKey + apiSecret + unixTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');
  
  return {
    'X-Auth-Date': unixTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'FUCKIT/1.0'
  };
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupTrack(feedGuid, itemGuid) {
  const headers = generateAuthHeaders();
  
  try {
    console.log(`  🔍 Looking up podcast: ${feedGuid.substring(0, 8)}...`);
    
    // First, try to find the podcast by feedGuid
    const podcastUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
    const podcastResponse = await fetch(podcastUrl, { headers });
    
    if (!podcastResponse.ok) {
      return { 
        status: 'podcast_not_found', 
        error: `Podcast lookup failed: ${podcastResponse.status}`,
        feedGuid,
        itemGuid
      };
    }
    
    const podcastData = await podcastResponse.json();
    
    if (!podcastData.feed || !podcastData.feed.id) {
      return { 
        status: 'podcast_no_feed_id', 
        error: 'Podcast found but no feed ID',
        feedGuid,
        itemGuid,
        podcastData
      };
    }
    
    console.log(`  📡 Found podcast: ${podcastData.feed.title} (ID: ${podcastData.feed.id})`);
    
    // Now try to get episodes from the feed
    const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${podcastData.feed.id}&max=200`;
    const episodesResponse = await fetch(episodesUrl, { headers });
    
    if (!episodesResponse.ok) {
      return { 
        status: 'episodes_fetch_failed', 
        error: `Episodes fetch failed: ${episodesResponse.status}`,
        feedGuid,
        itemGuid,
        podcastData
      };
    }
    
    const episodesData = await episodesResponse.json();
    console.log(`  📋 Found ${episodesData.items?.length || 0} episodes in feed`);
    
    // Look for our specific itemGuid
    const targetEpisode = episodesData.items?.find(ep => ep.guid === itemGuid);
    
    if (!targetEpisode) {
      return { 
        status: 'episode_not_found', 
        error: 'Episode not found in feed',
        feedGuid,
        itemGuid,
        podcastData,
        episodesCount: episodesData.items?.length || 0
      };
    }
    
    console.log(`  🎯 Found target episode: ${targetEpisode.title}`);
    
    // Success! Return the resolved track data
    return {
      status: 'resolved',
      feedGuid,
      itemGuid,
      podcast: podcastData.feed,
      episode: targetEpisode,
      resolvedAt: new Date().toISOString()
    };
    
  } catch (error) {
    return { 
      status: 'error', 
      error: error.message,
      feedGuid,
      itemGuid
    };
  }
}

async function main() {
  console.log('🧪 Testing bulk resolution with first 5 HGH tracks...\n');
  
  // Check if output directory exists, create if not
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
  
  // Load HGH remote items
  console.log('📖 Loading HGH remote items...');
  const hghData = JSON.parse(await fs.readFile(HGH_REMOTE_ITEMS_FILE, 'utf8'));
  const allTracks = hghData.remoteItems || hghData;
  
  // Take only first TEST_SIZE tracks
  const tracks = allTracks.slice(0, TEST_SIZE);
  
  console.log(`📊 Testing with first ${tracks.length} tracks (out of ${allTracks.length} total)\n`);
  
  const results = [];
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    console.log(`\n🔍 [${i + 1}/${tracks.length}] Processing track:`);
    console.log(`   feedGuid: ${track.feedGuid}`);
    console.log(`   itemGuid: ${track.itemGuid}`);
    
    const result = await lookupTrack(track.feedGuid, track.itemGuid);
    results.push(result);
    
    // Log the result
    if (result.status === 'resolved') {
      console.log(`   ✅ SUCCESS: ${result.episode.title}`);
      console.log(`      Duration: ${result.episode.duration}s`);
      console.log(`      Audio: ${result.episode.enclosureUrl}`);
    } else {
      console.log(`   ❌ FAILED: ${result.status} - ${result.error}`);
    }
    
    // Add delay between requests
    if (i < tracks.length - 1) {
      console.log(`   ⏳ Waiting 1 second...`);
      await delay(1000);
    }
  }
  
  // Create summary
  const summary = {
    totalTracks: tracks.length,
    resolved: results.filter(r => r.status === 'resolved').length,
    failed: results.filter(r => r.status !== 'resolved').length,
    statusBreakdown: {}
  };
  
  // Count by status
  results.forEach(result => {
    summary.statusBreakdown[result.status] = (summary.statusBreakdown[result.status] || 0) + 1;
  });
  
  // Save results
  const testResultsFile = path.join(OUTPUT_DIR, 'test-results-small-batch.json');
  await fs.writeFile(testResultsFile, JSON.stringify({
    summary,
    results,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log('\n📊 Test Results Summary:');
  console.log(`Total Tracks: ${summary.totalTracks}`);
  console.log(`✅ Resolved: ${summary.resolved}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`\n📁 Results saved to: ${testResultsFile}`);
  
  if (summary.resolved > 0) {
    console.log('\n🎉 Test successful! You can now run the full bulk resolution script.');
    console.log('💡 Run: node scripts/bulk-resolve-hgh-tracks.js');
  } else {
    console.log('\n⚠️  Test failed - no tracks were resolved. Check the errors above.');
  }
}

main().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
