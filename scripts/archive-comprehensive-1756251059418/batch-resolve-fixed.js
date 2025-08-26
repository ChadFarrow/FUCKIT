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

// List of remote items to resolve
const remoteItems = [
  { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "e046f9dd-aca3-4c7a-b396-2148a90ac0f2" },
  { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" },
  { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "24f655ae-8918-4089-8f2c-4c5ef612088b" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "24d8aa8b-317c-4f03-86d2-65c454370fb8" }
];

async function generateAuthHeaders(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(apiKey + apiSecret + timestamp).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Music-Discovery/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash
  };
}

async function resolveRemoteItem(feedGuid, itemGuid, index, total) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('Missing PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET in environment');
  }

  try {
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    
    // FIXED: Use podcastguid instead of feedguid parameter
    const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}&podcastguid=${encodeURIComponent(feedGuid)}`;
    
    console.log(`🔍 [${index}/${total}] Resolving: ${feedGuid.slice(0, 8)}.../${itemGuid.slice(0, 8)}...`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${index}/${total}] API Error ${response.status}: ${errorText.slice(0, 100)}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.episode) {
      console.log(`❌ [${index}/${total}] No episode found`);
      return null;
    }
    
    const episode = data.episode;
    
    // Extract music track data
    const track = {
      feedGuid: feedGuid,
      itemGuid: itemGuid,
      feedUrl: episode.feedUrl || '',
      feedTitle: episode.feedTitle || '',
      title: episode.title || '',
      artist: episode.feedTitle?.replace(/\s*(podcast|music|songs?|tracks?|album).*$/i, '').trim() || '',
      album: episode.feedTitle || '',
      description: episode.description || '',
      duration: episode.duration || episode.length || '0',
      enclosureUrl: episode.enclosureUrl || '',
      enclosureType: episode.enclosureType || 'audio/mpeg',
      pubDate: episode.datePublished || new Date().toISOString(),
      image: episode.image || episode.feedImage || '',
      value: episode.value || null,
      resolvedFrom: 'direct-feed-fetch',
      resolvedAt: new Date().toISOString()
    };
    
    console.log(`✅ [${index}/${total}] Resolved: "${track.title}" by ${track.artist}`);
    return track;
    
  } catch (error) {
    console.error(`❌ [${index}/${total}] Error: ${error.message}`);
    return null;
  }
}

async function saveToDatabase(track) {
  try {
    const dbPath = path.join(__dirname, '../data/music-tracks.json');
    
    // Read existing data
    let data = { musicTracks: [], episodes: [], feeds: [], valueTimeSplits: [], valueRecipients: [], boostagrams: [], funding: [], extractions: [], analytics: [], metadata: {} };
    
    if (fs.existsSync(dbPath)) {
      const existingData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      data = existingData;
    }
    
    // Check for duplicates
    const exists = data.musicTracks.find(t => t.feedGuid === track.feedGuid && t.itemGuid === track.itemGuid);
    if (exists) {
      console.log(`⏭️  Skipping duplicate: "${track.title}"`);
      return exists;
    }
    
    // Generate unique ID
    const existingIds = new Set(data.musicTracks.map(t => t.id));
    let trackId = `track-${data.musicTracks.length + 1}`;
    let counter = data.musicTracks.length + 1;
    while (existingIds.has(trackId)) {
      counter++;
      trackId = `track-${counter}`;
    }
    
    // Add track with ID and timestamp
    const trackWithId = {
      id: trackId,
      ...track,
      addedAt: new Date().toISOString()
    };
    
    data.musicTracks.push(trackWithId);
    
    // Update metadata
    data.metadata = {
      ...data.metadata,
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalTracks: data.musicTracks.length,
      totalEpisodes: data.episodes.length,
      totalFeeds: data.feeds.length,
      totalExtractions: data.extractions.length,
      cleanSlate: true
    };
    
    // Save updated data
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved track ${trackId}: "${track.title}" to database`);
    
    return trackWithId;
  } catch (error) {
    console.error('❌ Error saving to database:', error);
    throw error;
  }
}

// Test with first few items using correct parameter
async function main() {
  console.log(`🚀 Testing fixed API call with first 5 items...`);
  
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < remoteItems.length; i++) {
    const item = remoteItems[i];
    
    try {
      const track = await resolveRemoteItem(item.feedGuid, item.itemGuid, i + 1, remoteItems.length);
      
      if (track) {
        await saveToDatabase(track);
        successful++;
      } else {
        failed++;
      }
      
      // Small delay between requests
      if (i < remoteItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(`❌ Failed to process item ${i + 1}:`, error.message);
      failed++;
    }
  }
  
  console.log(`\n🏁 Test complete!`);
  console.log(`✅ Successfully resolved: ${successful}`);
  console.log(`❌ Failed to resolve: ${failed}`);
  
  if (successful > 0) {
    // Run the conversion script to update parsed-feeds.json
    console.log('\n🔄 Running conversion script to update albums...');
    try {
      const { execSync } = require('child_process');
      execSync('node scripts/rebuild-parsed-feeds-from-tracks.js', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('✅ Albums conversion completed');
    } catch (error) {
      console.error('❌ Error running conversion script:', error.message);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}