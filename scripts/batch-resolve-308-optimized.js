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

// Read remote items from file
function parseRemoteItemsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const remoteItems = [];
  
  for (const line of lines) {
    const feedGuidMatch = line.match(/feedGuid="([^"]+)"/);
    const itemGuidMatch = line.match(/itemGuid="([^"]+)"/);
    
    if (feedGuidMatch && itemGuidMatch) {
      remoteItems.push({
        feedGuid: feedGuidMatch[1],
        itemGuid: itemGuidMatch[1]
      });
    }
  }
  
  return remoteItems;
}

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

// Cache for feed lookups to avoid duplicate API calls
const feedCache = new Map();

// Enhanced feed lookup with better error handling
async function getFeedId(feedGuid) {
  if (feedCache.has(feedGuid)) {
    return feedCache.get(feedGuid);
  }
  
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    let result;
    if (data.status === 'true' && data.feed && data.feed.id) {
      // Check for corrupted feeds (undefined titles, zero episodes)
      if (!data.feed.title || data.feed.title === 'undefined' || data.feed.episodeCount === 0) {
        result = { error: 'Corrupted feed (no title or episodes)' };
      } else {
        result = { 
          feedId: data.feed.id, 
          feedTitle: data.feed.title,
          feedUrl: data.feed.url,
          feedImage: data.feed.image,
          episodeCount: data.feed.episodeCount || 0
        };
      }
    } else {
      result = { error: 'Feed not found' };
    }
    
    feedCache.set(feedGuid, result);
    return result;
  } catch (error) {
    const result = { error: error.message };
    feedCache.set(feedGuid, result);
    return result;
  }
}

// Enhanced episode lookup with retry logic
async function getEpisodeFromFeed(feedId, itemGuid, retryCount = 0) {
  try {
    const headers = createAuthHeaders();
    // Try different max values for edge cases
    const maxEpisodes = retryCount === 0 ? 100 : 200;
    const url = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=${maxEpisodes}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === 'true' && data.items) {
      // Find the episode with matching GUID
      const episode = data.items.find(ep => ep.guid === itemGuid);
      if (episode) {
        return { episode };
      }
      
      // If not found and this is first try, retry with more episodes
      if (retryCount === 0 && data.items.length >= 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return getEpisodeFromFeed(feedId, itemGuid, 1);
      }
    }
    
    return { error: 'Episode not found in feed' };
  } catch (error) {
    return { error: error.message };
  }
}

// Enhanced resolution function with detailed error categorization
async function resolveRemoteItemOptimized(feedGuid, itemGuid) {
  try {
    // Step 1: Get feed ID with corruption detection
    const feedResult = await getFeedId(feedGuid);
    if (feedResult.error) {
      if (feedResult.error.includes('Corrupted')) {
        return { error: 'CORRUPTED_FEED', details: feedResult.error };
      }
      return { error: 'FEED_NOT_FOUND', details: feedResult.error };
    }
    
    // Step 2: Get episode from feed with retry
    const episodeResult = await getEpisodeFromFeed(feedResult.feedId, itemGuid);
    if (episodeResult.error) {
      return { error: 'EPISODE_NOT_FOUND', details: episodeResult.error, feedInfo: feedResult };
    }
    
    // Add feed info to episode
    const episode = episodeResult.episode;
    episode.feedGuid = feedGuid;
    episode.feedUrl = feedResult.feedUrl;
    episode.feedTitle = feedResult.feedTitle;
    episode.feedImage = feedResult.feedImage;
    
    return { episode, feedInfo: feedResult };
    
  } catch (error) {
    return { error: 'API_ERROR', details: error.message };
  }
}

// Load existing music tracks
const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
let musicData = { musicTracks: [], episodes: [], feeds: [] };

if (fs.existsSync(musicTracksPath)) {
  try {
    musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  } catch (error) {
    console.error('Error reading existing music tracks:', error.message);
  }
}

// Check if track already exists
function isTrackDuplicate(episode) {
  return musicData.musicTracks.some(track => 
    track.feedGuid === episode.feedGuid && track.episodeGuid === episode.guid
  );
}

// Convert episode to track format
function convertEpisodeToTrack(episode) {
  const transcript = episode.transcript ? episode.transcript.url : null;
  
  // Parse V4V information
  let v4vInfo = null;
  if (episode.value && episode.value.model && episode.value.destinations) {
    v4vInfo = {
      model: episode.value.model.type || 'lightning',
      suggested: episode.value.model.suggested || 0,
      destinations: episode.value.destinations.map(dest => ({
        name: dest.name || 'Unknown',
        type: dest.type || 'node',
        address: dest.address || '',
        split: dest.split || 0,
        fee: dest.fee || false,
        customKey: dest.customKey || null,
        customValue: dest.customValue || null
      }))
    };
  }

  return {
    guid: crypto.randomUUID(),
    episodeGuid: episode.guid || '',
    feedGuid: episode.feedGuid || '',
    feedUrl: episode.feedUrl || '',
    feedTitle: episode.feedTitle || 'Unknown Feed',
    feedImage: episode.feedImage || episode.image || '',
    title: episode.title || 'Untitled',
    description: episode.description || '',
    datePublished: episode.datePublished || 0,
    datePublishedPretty: episode.datePublishedPretty || '',
    dateCrawled: episode.dateCrawled || 0,
    enclosureUrl: episode.enclosureUrl || '',
    enclosureType: episode.enclosureType || 'audio/mpeg',
    enclosureLength: episode.enclosureLength || 0,
    duration: episode.duration || 0,
    explicit: episode.explicit || 0,
    episode: episode.episode || null,
    episodeType: episode.episodeType || 'full',
    season: episode.season || null,
    image: episode.image || episode.feedImage || '',
    feedItunesId: episode.feedItunesId || null,
    itunesId: episode.itunesId || null,
    link: episode.link || '',
    chapters: episode.chapters ? episode.chapters.url : null,
    transcript: transcript,
    value: v4vInfo,
    persons: episode.persons || [],
    socialInteract: episode.socialInteract || []
  };
}

// Main processing function with detailed reporting
async function processAllItemsOptimized() {
  const inputFile = process.argv[2] || '../batch-items-308.txt';
  
  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const remoteItems = parseRemoteItemsFromFile(inputFile);
  console.log(`🚀 Processing all ${remoteItems.length} remote items with OPTIMIZED approach...`);
  console.log(`📈 Expected success rate: ~93% (based on sample test)\n`);
  
  const batchSize = 8; // Smaller batches for better API stability
  const delay = 200; // ms between requests
  
  let successCount = 0;
  let duplicateCount = 0;
  let errorCounts = {
    'CORRUPTED_FEED': 0,
    'FEED_NOT_FOUND': 0,
    'EPISODE_NOT_FOUND': 0,
    'API_ERROR': 0
  };
  
  const totalBatches = Math.ceil(remoteItems.length / batchSize);
  const startTime = Date.now();
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, remoteItems.length);
    const batch = remoteItems.slice(startIndex, endIndex);
    
    console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);
    
    for (let i = 0; i < batch.length; i++) {
      const { feedGuid, itemGuid } = batch[i];
      const overallIndex = startIndex + i + 1;
      
      try {
        const result = await resolveRemoteItemOptimized(feedGuid, itemGuid);
        
        if (result.error) {
          const errorType = result.error;
          errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
          
          // Different icons for different error types
          const errorIcon = {
            'CORRUPTED_FEED': '🧟',
            'FEED_NOT_FOUND': '❓',
            'EPISODE_NOT_FOUND': '🔍',
            'API_ERROR': '⚠️'
          }[errorType] || '❌';
          
          console.log(`${errorIcon} [${overallIndex}/${remoteItems.length}] ${errorType}: ${result.details?.substring(0, 40) || 'Unknown'}...`);
          
        } else if (result.episode) {
          // Check for duplicates
          if (isTrackDuplicate(result.episode)) {
            console.log(`⏭️  [${overallIndex}/${remoteItems.length}] Duplicate: "${result.episode.title}"`);
            duplicateCount++;
          } else {
            // Convert and add to database
            const track = convertEpisodeToTrack(result.episode);
            musicData.musicTracks.push(track);
            console.log(`✅ [${overallIndex}/${remoteItems.length}] Added: "${result.episode.title}" (${result.feedInfo.feedTitle})`);
            successCount++;
          }
        }
        
        // Add delay between requests
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        errorCounts['API_ERROR']++;
        console.log(`⚠️  [${overallIndex}/${remoteItems.length}] Unexpected error: ${error.message}`);
      }
    }
    
    // Progress update
    const processed = Math.min((batchIndex + 1) * batchSize, remoteItems.length);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = (remoteItems.length - processed) / rate;
    
    console.log(`📊 Progress: ${processed}/${remoteItems.length} (${((processed/remoteItems.length)*100).toFixed(1)}%) | ETA: ${Math.round(remaining)}s\n`);
  }
  
  // Save updated data
  if (successCount > 0) {
    try {
      // Create backup first
      const backupPath = musicTracksPath + `.backup-batch-308-optimized-${Date.now()}`;
      if (fs.existsSync(musicTracksPath)) {
        fs.copyFileSync(musicTracksPath, backupPath);
        console.log(`📁 Backup created: ${path.basename(backupPath)}`);
      }
      
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      console.log(`💾 Saved ${successCount} new tracks to ${musicTracksPath}`);
      
      // Also update public file
      const publicPath = path.join(__dirname, '../public/music-tracks.json');
      fs.writeFileSync(publicPath, JSON.stringify(musicData, null, 2));
      console.log(`💾 Updated public file: ${publicPath}`);
      
    } catch (error) {
      console.error(`❌ Error saving files: ${error.message}`);
    }
  }
  
  // Detailed final report
  const totalFailures = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);
  const totalProcessed = successCount + duplicateCount + totalFailures;
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '=' .repeat(70));
  console.log('🏁 OPTIMIZED BATCH PROCESSING COMPLETE');
  console.log('=' .repeat(70));
  console.log(`⏱️  Processing time: ${processingTime} seconds`);
  console.log(`📊 Total processed: ${totalProcessed}/${remoteItems.length}`);
  console.log(`✅ Successfully added: ${successCount} (${((successCount/remoteItems.length)*100).toFixed(1)}%)`);
  console.log(`⏭️  Duplicates skipped: ${duplicateCount} (${((duplicateCount/remoteItems.length)*100).toFixed(1)}%)`);
  console.log(`❌ Total failures: ${totalFailures} (${((totalFailures/remoteItems.length)*100).toFixed(1)}%)`);
  
  console.log('\n📋 FAILURE BREAKDOWN:');
  Object.entries(errorCounts).forEach(([type, count]) => {
    if (count > 0) {
      const icon = {
        'CORRUPTED_FEED': '🧟',
        'FEED_NOT_FOUND': '❓', 
        'EPISODE_NOT_FOUND': '🔍',
        'API_ERROR': '⚠️'
      }[type] || '❌';
      console.log(`   ${icon} ${type}: ${count}`);
    }
  });
  
  if (successCount > 0) {
    console.log(`\n📈 Database updated: ${musicData.musicTracks.length} total tracks (+${successCount})`);
    console.log(`\n🎉 Next steps:`);
    console.log(`   1. Run "npm run update-music" to process new content`);
    console.log(`   2. Check for complete albums/EPs to fetch`);
    console.log(`   3. Discover publisher feeds for new artists`);
    console.log(`   4. Verify artwork and metadata`);
  }
  
  return {
    success: successCount,
    duplicates: duplicateCount,
    failures: totalFailures,
    errorBreakdown: errorCounts
  };
}

// Run the optimized process
if (require.main === module) {
  processAllItemsOptimized().catch(console.error);
}

module.exports = { processAllItemsOptimized };