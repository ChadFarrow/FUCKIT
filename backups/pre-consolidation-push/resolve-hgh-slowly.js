#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Missing Podcast Index API credentials in .env.local');
  process.exit(1);
}

// Generate auth headers for Podcast Index API
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
    'User-Agent': 'PodcastMusicSite/1.0'
  };
}

async function resolveTrackWithRetry(track, index, total) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 [${index + 1}/${total}] Attempt ${attempt}: Resolving ${track.feedGuid.substring(0, 8)}...`);
      
      // Step 1: Resolve feed
      const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${track.feedGuid}`;
      const feedHeaders = generateAuthHeaders();
      
      const feedResponse = await fetch(feedUrl, { headers: feedHeaders });
      
      if (feedResponse.status === 429) {
        console.log(`⏳ [${index + 1}/${total}] Rate limited, waiting 10 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        continue;
      }
      
      if (!feedResponse.ok) {
        throw new Error(`Feed lookup failed: ${feedResponse.status} ${feedResponse.statusText}`);
      }
      
      const feedData = await feedResponse.json();
      
      if (feedData.status !== 'true' || !feedData.feed) {
        throw new Error(`Feed not found: ${feedData.description || 'Unknown error'}`);
      }
      
      console.log(`🎙️ [${index + 1}/${total}] Found feed: ${feedData.feed.title}`);
      
      // Step 2: Resolve episode
      const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${track.itemGuid}&feedid=${feedData.feed.id}`;
      const episodeHeaders = generateAuthHeaders();
      
      // Wait a bit between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const episodeResponse = await fetch(episodeUrl, { headers: episodeHeaders });
      
      if (episodeResponse.status === 429) {
        console.log(`⏳ [${index + 1}/${total}] Rate limited on episode, waiting 10 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        continue;
      }
      
      if (!episodeResponse.ok) {
        throw new Error(`Episode lookup failed: ${episodeResponse.status} ${episodeResponse.statusText}`);
      }
      
      const episodeData = await episodeResponse.json();
      
      if (episodeData.status !== 'true' || !episodeData.episode) {
        throw new Error(`Episode not found: ${episodeData.description || 'Unknown error'}`);
      }
      
      console.log(`🎵 [${index + 1}/${total}] ✅ Found: ${episodeData.episode.title}`);
      
      // Extract artist from title
      const title = episodeData.episode.title;
      let artist = 'Unknown Artist';
      
      if (title && title.includes(' - ')) {
        artist = title.split(' - ')[0].trim();
      } else if (feedData.feed.title) {
        artist = feedData.feed.title;
      }
      
      return {
        feedGuid: track.feedGuid,
        itemGuid: track.itemGuid,
        title: title,
        artist: artist,
        feedUrl: feedData.feed.url,
        feedTitle: feedData.feed.title,
        duration: episodeData.episode.duration,
        audioUrl: episodeData.episode.enclosureUrl,
        artworkUrl: episodeData.episode.image,
        episodeId: episodeData.episode.id,
        feedId: feedData.feed.id,
        datePublished: episodeData.episode.datePublished
      };
      
    } catch (error) {
      console.error(`❌ [${index + 1}/${total}] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        return {
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid,
          title: `Track ${index + 1}`,
          artist: 'Unknown Artist',
          feedTitle: 'Unknown Feed',
          duration: 180,
          audioUrl: '',
          artworkUrl: ''
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function main() {
  console.log('🎵 Starting careful HGH tracks resolution with rate limiting...');
  
  const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  const resolvedSongs = JSON.parse(fs.readFileSync(resolvedSongsPath, 'utf8'));
  
  console.log(`📋 Found ${resolvedSongs.length} tracks to resolve`);
  console.log('⏱️ This will take a while due to rate limiting...');
  
  const resolvedTracks = [];
  const audioUrlMap = {};
  const artworkUrlMap = {};
  
  let successCount = 0;
  let failCount = 0;
  
  // Process only first 10 tracks as a test
  const testCount = Math.min(10, resolvedSongs.length);
  console.log(`🧪 Testing with first ${testCount} tracks`);
  
  for (let i = 0; i < testCount; i++) {
    const track = resolvedSongs[i];
    
    try {
      const resolvedTrack = await resolveTrackWithRetry(track, i, testCount);
      
      resolvedTracks.push(resolvedTrack);
      
      if (resolvedTrack.audioUrl) {
        audioUrlMap[resolvedTrack.title] = resolvedTrack.audioUrl;
        successCount++;
      } else {
        failCount++;
      }
      
      if (resolvedTrack.artworkUrl) {
        artworkUrlMap[resolvedTrack.title] = resolvedTrack.artworkUrl;
      }
      
      // Extra delay between tracks to be very respectful of rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`💥 [${i + 1}/${testCount}] Unexpected error: ${error.message}`);
      failCount++;
    }
  }
  
  // Save results
  console.log('\n💾 Saving test results...');
  
  const testResultsPath = path.join(__dirname, '..', 'data', 'hgh-test-results.json');
  fs.writeFileSync(testResultsPath, JSON.stringify(resolvedTracks, null, 2));
  
  console.log(`\n🎉 Test completed!`);
  console.log(`✅ Successfully resolved: ${successCount} tracks`);
  console.log(`❌ Failed to resolve: ${failCount} tracks`);
  console.log(`🎵 Total tracks with audio: ${Object.keys(audioUrlMap).length}`);
  console.log(`🖼️ Total tracks with artwork: ${Object.keys(artworkUrlMap).length}`);
  console.log(`\n📁 Test results saved to: ${testResultsPath}`);
  
  if (successCount > 0) {
    console.log('\n✨ Some tracks resolved successfully! The API works, just need to process all tracks slowly.');
  }
}

main().catch(console.error);