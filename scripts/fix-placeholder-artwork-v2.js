#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
  console.error('❌ Missing PodcastIndex API credentials in .env.local');
  process.exit(1);
}

console.log('🎨 Fixing placeholder artwork using feed GUIDs...\n');

// Function to generate PodcastIndex API signature
function generateSignature(timestamp) {
  const data = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp;
  return crypto.createHash('sha1').update(data).digest('hex');
}

// Function to get feed info from PodcastIndex API using feed GUID
async function getFeedInfo(feedGuid) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature(timestamp);
    
    const response = await fetch(`https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${feedGuid}`, {
      headers: {
        'User-Agent': 'FUCKIT-Placeholder-Fixer-v2/1.0',
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': timestamp.toString(),
        'Authorization': signature
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'true' && data.feeds && data.feeds.length > 0) {
      const feed = data.feeds[0];
      if (feed.artwork && feed.artwork.trim() !== '' && !feed.artwork.includes('placeholder')) {
        return feed.artwork;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`   ❌ Error fetching feed info for ${feedGuid}:`, error.message);
    return null;
  }
}

// Function to search PodcastIndex for artwork by title/artist
async function searchPodcastIndex(track) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(timestamp);
  
  // Try different search strategies
  const searchQueries = [
    track.title,
    track.artist ? `${track.title} ${track.artist}` : track.title,
    track.artist ? `${track.artist} ${track.title}` : track.title
  ];
  
  for (const query of searchQueries) {
    try {
      const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'FUCKIT-Placeholder-Fixer-v2/1.0',
          'X-Auth-Key': PODCAST_INDEX_API_KEY,
          'X-Auth-Date': timestamp.toString(),
          'Authorization': signature
        }
      });
      
      if (!response.ok) {
        console.log(`   ⚠️  API request failed for "${query}": ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.status === 'true' && data.feeds && data.feeds.length > 0) {
        // Look for artwork in the feeds
        for (const feed of data.feeds) {
          if (feed.artwork && feed.artwork.trim() !== '' && !feed.artwork.includes('placeholder')) {
            console.log(`   ✅ Found artwork via search query "${query}": ${feed.artwork}`);
            return feed.artwork;
          }
        }
      }
      
      // If no artwork in feeds, try episodes
      if (data.status === 'true' && data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (item.feedImage && item.feedImage.trim() !== '' && !item.feedImage.includes('placeholder')) {
            console.log(`   ✅ Found artwork via episode search "${query}": ${item.feedImage}`);
            return item.feedImage;
          }
        }
      }
      
    } catch (error) {
      console.log(`   ⚠️  Error searching for "${query}": ${error.message}`);
    }
    
    // Add delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return null;
}

async function main() {
  try {
    // Load the music tracks data
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    console.log(`📊 Total tracks: ${musicTracksData.musicTracks.length}`);
    
    // Find tracks with placeholder artwork
    const tracksWithPlaceholders = musicTracksData.musicTracks.filter(track => 
      track.artworkUrl && track.artworkUrl.includes('via.placeholder.com')
    );
    
    console.log(`🎭 Tracks with placeholder artwork: ${tracksWithPlaceholders.length}\n`);
    
    if (tracksWithPlaceholders.length === 0) {
      console.log('✅ No placeholder artwork found!');
      return;
    }
    
    // Process each track
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < tracksWithPlaceholders.length; i++) {
      const track = tracksWithPlaceholders[i];
      console.log(`🎵 [${i + 1}/${tracksWithPlaceholders.length}] Processing: "${track.title}" - ${track.artist || 'Unknown Artist'}`);
      
      let artworkUrl = null;
      
      // First, try to get artwork using the feed GUID if available
      if (track.valueForValue && track.valueForValue.feedGuid) {
        console.log(`   🔍 Found feed GUID: ${track.valueForValue.feedGuid}`);
        artworkUrl = await getFeedInfo(track.valueForValue.feedGuid);
        
        if (artworkUrl) {
          console.log(`   ✅ Found artwork via feed GUID: ${artworkUrl}`);
        }
      }
      
      // If no artwork found via feed GUID, try searching by title/artist
      if (!artworkUrl) {
        console.log(`   🔍 Searching by title/artist...`);
        artworkUrl = await searchPodcastIndex(track);
      }
      
      if (artworkUrl) {
        // Update the track artwork
        track.artworkUrl = artworkUrl;
        fixedCount++;
        console.log(`   ✅ Updated artwork: ${artworkUrl}`);
      } else {
        console.log(`   ⚠️  No real artwork found, keeping placeholder`);
        skippedCount++;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
    
    console.log(`\n🎉 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount} tracks`);
    console.log(`   ⚠️  Skipped: ${skippedCount} tracks`);
    console.log(`   📝 Data saved to: ${musicTracksPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
