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

async function getFeedInfo(feedGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  try {
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === "true" && data.feed) {
      return data.feed;
    }
    return null;
  } catch (error) {
    console.error(`❌ Error getting feed info for ${feedGuid}:`, error.message);
    return null;
  }
}

async function getAllEpisodesInFeed(feedId) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  try {
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    const url = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=100`; // Get up to 100 episodes
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === "true" && data.items) {
      return data.items;
    }
    return [];
  } catch (error) {
    console.error(`❌ Error getting episodes for feed ${feedId}:`, error.message);
    return [];
  }
}

async function processTrackForCompleteAlbum(track) {
  console.log(`\n🔍 Checking if "${track.title}" is part of a complete album...`);
  
  // Get feed information
  const feedInfo = await getFeedInfo(track.feedGuid);
  if (!feedInfo) {
    console.log(`❌ Could not get feed info for ${track.feedGuid}`);
    return [track]; // Return just the single track
  }
  
  console.log(`📚 Feed: "${feedInfo.title}" by ${feedInfo.author} (${feedInfo.episodeCount} episodes)`);
  
  // Determine if this looks like an album/EP feed
  const isAlbumFeed = (
    feedInfo.medium === 'music' || 
    feedInfo.title.toLowerCase().includes('album') ||
    feedInfo.title.toLowerCase().includes(' ep') ||
    feedInfo.title.toLowerCase().includes('ep ') ||
    feedInfo.episodeCount <= 20 // Likely an album if 20 or fewer tracks
  );
  
  if (!isAlbumFeed) {
    console.log(`ℹ️  Feed doesn't appear to be an album (${feedInfo.episodeCount} episodes, medium: ${feedInfo.medium})`);
    return [track]; // Return just the single track
  }
  
  console.log(`🎵 This appears to be an album/EP feed! Fetching all ${feedInfo.episodeCount} tracks...`);
  
  // Get all episodes/tracks in the feed
  const allEpisodes = await getAllEpisodesInFeed(feedInfo.id);
  
  if (allEpisodes.length === 0) {
    console.log(`❌ No episodes found in feed`);
    return [track];
  }
  
  console.log(`📊 Found ${allEpisodes.length} tracks in the album`);
  
  // Convert episodes to track format
  const albumTracks = allEpisodes.map(episode => ({
    feedGuid: track.feedGuid,
    itemGuid: episode.guid,
    feedUrl: episode.feedUrl || track.feedUrl,
    feedTitle: episode.feedTitle || feedInfo.title,
    title: episode.title || '',
    artist: feedInfo.author || episode.feedTitle?.replace(/\s*(podcast|music|songs?|tracks?|album).*$/i, '').trim() || '',
    album: feedInfo.title || episode.feedTitle || '',
    description: episode.description || '',
    duration: episode.duration || episode.length || '0',
    enclosureUrl: episode.enclosureUrl || '',
    enclosureType: episode.enclosureType || 'audio/mpeg',
    pubDate: episode.datePublished || new Date().toISOString(),
    image: episode.image || episode.feedImage || feedInfo.image || feedInfo.artwork || '',
    value: episode.value || null,
    resolvedFrom: 'complete-album-fetch',
    resolvedAt: new Date().toISOString()
  }));
  
  console.log(`✅ Successfully fetched complete album: "${feedInfo.title}" with ${albumTracks.length} tracks`);
  
  return albumTracks;
}

async function saveToDatabase(tracks) {
  try {
    const dbPath = path.join(__dirname, '../data/music-tracks.json');
    
    // Read existing data
    let data = { musicTracks: [], episodes: [], feeds: [], valueTimeSplits: [], valueRecipients: [], boostagrams: [], funding: [], extractions: [], analytics: [], metadata: {} };
    
    if (fs.existsSync(dbPath)) {
      const existingData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      data = existingData;
    }
    
    let addedCount = 0;
    let duplicateCount = 0;
    
    for (const track of tracks) {
      // Check for duplicates
      const exists = data.musicTracks.find(t => t.feedGuid === track.feedGuid && t.itemGuid === track.itemGuid);
      if (exists) {
        duplicateCount++;
        continue;
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
      addedCount++;
    }
    
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
    
    console.log(`💾 Saved ${addedCount} new tracks to database (${duplicateCount} duplicates skipped)`);
    
    return { added: addedCount, duplicates: duplicateCount };
  } catch (error) {
    console.error('❌ Error saving to database:', error);
    throw error;
  }
}

async function processExistingTracks() {
  console.log('🚀 Processing existing tracks to find complete albums...\n');
  
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ music-tracks.json not found');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const existingTracks = data.musicTracks || [];
  
  console.log(`📊 Found ${existingTracks.length} existing tracks`);
  
  // Group tracks by feedGuid to avoid processing the same feed multiple times
  const feedGuids = [...new Set(existingTracks.map(track => track.feedGuid))];
  console.log(`📚 Found ${feedGuids.length} unique feeds to check`);
  
  let totalAdded = 0;
  let totalDuplicates = 0;
  
  for (let i = 0; i < feedGuids.length; i++) {
    const feedGuid = feedGuids[i];
    console.log(`\n[${i + 1}/${feedGuids.length}] Processing feed: ${feedGuid.slice(0, 8)}...`);
    
    // Get one track from this feed as a representative
    const representativeTrack = existingTracks.find(track => track.feedGuid === feedGuid);
    
    try {
      const completeAlbumTracks = await processTrackForCompleteAlbum(representativeTrack);
      
      if (completeAlbumTracks.length > 1) {
        const result = await saveToDatabase(completeAlbumTracks);
        totalAdded += result.added;
        totalDuplicates += result.duplicates;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing feed ${feedGuid}:`, error.message);
    }
  }
  
  console.log(`\n🏁 Processing complete!`);
  console.log(`✅ Total tracks added: ${totalAdded}`);
  console.log(`⏭️  Total duplicates skipped: ${totalDuplicates}`);
  
  if (totalAdded > 0) {
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
  processExistingTracks().catch(console.error);
}