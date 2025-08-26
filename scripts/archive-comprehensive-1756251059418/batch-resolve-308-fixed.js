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

// Get feed ID from GUID
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
      result = { 
        feedId: data.feed.id, 
        feedTitle: data.feed.title,
        feedUrl: data.feed.url,
        feedImage: data.feed.image
      };
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

// Get episode from feed using feedId and episode GUID
async function getEpisodeFromFeed(feedId, itemGuid) {
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=100`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === 'true' && data.items) {
      // Find the episode with matching GUID
      const episode = data.items.find(ep => ep.guid === itemGuid);
      if (episode) {
        return { episode };
      }
    }
    
    return { error: 'Episode not found in feed' };
  } catch (error) {
    return { error: error.message };
  }
}

// Main resolution function
async function resolveRemoteItemFixed(feedGuid, itemGuid) {
  try {
    // Step 1: Get feed ID
    const feedResult = await getFeedId(feedGuid);
    if (feedResult.error) {
      return { error: `Feed lookup failed: ${feedResult.error}` };
    }
    
    // Step 2: Get episode from feed
    const episodeResult = await getEpisodeFromFeed(feedResult.feedId, itemGuid);
    if (episodeResult.error) {
      return { error: `Episode lookup failed: ${episodeResult.error}` };
    }
    
    // Add feed info to episode
    const episode = episodeResult.episode;
    episode.feedGuid = feedGuid;
    episode.feedUrl = feedResult.feedUrl;
    episode.feedTitle = feedResult.feedTitle;
    episode.feedImage = feedResult.feedImage;
    
    return { episode };
    
  } catch (error) {
    return { error: error.message };
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

// Main processing function
async function processAllItems() {
  const inputFile = process.argv[2] || '../batch-items-308.txt';
  
  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const remoteItems = parseRemoteItemsFromFile(inputFile);
  console.log(`🚀 Processing all ${remoteItems.length} remote items with FIXED approach...`);
  
  const batchSize = 10;
  const delay = 150; // ms between requests
  
  let successCount = 0;
  let duplicateCount = 0;
  let failureCount = 0;
  
  const totalBatches = Math.ceil(remoteItems.length / batchSize);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, remoteItems.length);
    const batch = remoteItems.slice(startIndex, endIndex);
    
    console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);
    
    for (let i = 0; i < batch.length; i++) {
      const { feedGuid, itemGuid } = batch[i];
      const overallIndex = startIndex + i + 1;
      
      try {
        const result = await resolveRemoteItemFixed(feedGuid, itemGuid);
        
        if (result.error) {
          console.log(`❌ [${overallIndex}/${remoteItems.length}] ${result.error.substring(0, 50)}`);
          failureCount++;
        } else if (result.episode) {
          // Check for duplicates
          if (isTrackDuplicate(result.episode)) {
            console.log(`⏭️  [${overallIndex}/${remoteItems.length}] Duplicate: "${result.episode.title}"`);
            duplicateCount++;
          } else {
            // Convert and add to database
            const track = convertEpisodeToTrack(result.episode);
            musicData.musicTracks.push(track);
            console.log(`✅ [${overallIndex}/${remoteItems.length}] Added: "${result.episode.title}"`);
            successCount++;
          }
        }
        
        // Add delay between requests
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.log(`❌ [${overallIndex}/${remoteItems.length}] Error: ${error.message}`);
        failureCount++;
      }
    }
  }
  
  // Save updated data
  if (successCount > 0) {
    try {
      // Create backup first
      const backupPath = musicTracksPath + `.backup-batch-308-${Date.now()}`;
      if (fs.existsSync(musicTracksPath)) {
        fs.copyFileSync(musicTracksPath, backupPath);
        console.log(`\n📁 Backup created: ${path.basename(backupPath)}`);
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
  
  console.log('\n🏁 Processing complete!');
  console.log(`✅ Successfully resolved and saved: ${successCount}`);
  console.log(`⏭️  Duplicates skipped: ${duplicateCount}`);
  console.log(`❌ Failed to resolve: ${failureCount}`);
  console.log(`📊 Total processed: ${successCount + duplicateCount + failureCount}/${remoteItems.length}`);
  
  if (successCount > 0) {
    console.log(`\n📈 Database now contains ${musicData.musicTracks.length} total tracks`);
    console.log(`\n🎉 Success! Run "npm run update-music" to process these new additions.`);
  }
}

// Run the process
processAllItems().catch(console.error);