#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

const crypto = require('crypto');

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

// Get the input file from command line arguments
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node batch-resolve-from-file.js <input-file>');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const remoteItems = parseRemoteItemsFromFile(inputFile);
console.log(`🚀 Processing all ${remoteItems.length} remote items from ${inputFile}...`);

// Check API keys
if (!process.env.PODCAST_INDEX_API_KEY || !process.env.PODCAST_INDEX_API_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   PODCAST_INDEX_API_KEY');
  console.error('   PODCAST_INDEX_API_SECRET');
  console.error('   These should be in .env.local file');
  process.exit(1);
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

// Function to resolve a single remote item
async function resolveRemoteItem(feedGuid, itemGuid) {
  try {
    const headers = createAuthHeaders();
    const url = `https://api.podcastindex.org/api/1.0/episodes/bypodcastguid?podcastguid=${encodeURIComponent(feedGuid)}&guid=${encodeURIComponent(itemGuid)}`;
    
    const response = await fetch(url, { 
      method: 'GET',
      headers: headers 
    });
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const data = await response.json();
    
    if (!data.status || data.status === 'false') {
      return { error: `API returned false status: ${JSON.stringify(data).substring(0, 100)}` };
    }
    
    if (!data.episode) {
      return { error: 'No episode data in response' };
    }
    
    return { episode: data.episode };
    
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
async function processRemoteItems() {
  const batchSize = 15;
  const delay = 100; // ms between requests
  
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
        const result = await resolveRemoteItem(feedGuid, itemGuid);
        
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
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      console.log(`\n💾 Saved ${successCount} new tracks to ${musicTracksPath}`);
      
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
  }
}

// Run the process
processRemoteItems().catch(console.error);