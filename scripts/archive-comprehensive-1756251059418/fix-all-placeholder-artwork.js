#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

console.log('🎨 Fixing all placeholder artwork...\n');

async function generateAuthHeader() {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp);
  const hash4 = hash.digest('hex');
  
  return {
    'User-Agent': 'PodtardsArtworkFixer/1.0',
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash4
  };
}

async function getFeedInfo(feedGuid) {
  try {
    const headers = await generateAuthHeader();
    const response = await fetch(`https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${feedGuid}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.feeds?.[0] || null;
  } catch (error) {
    console.error(`❌ Error fetching feed info for ${feedGuid}:`, error.message);
    return null;
  }
}

async function main() {
  try {
    // Load the parsed feeds data
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    console.log(`📊 Total feeds: ${feedsData.feeds.length}`);
    
    // Find feeds with placeholder artwork
    const feedsWithPlaceholders = feedsData.feeds.filter(feed => 
      feed.parsedData?.album?.coverArt && feed.parsedData.album.coverArt.includes('via.placeholder.com')
    );
    
    console.log(`🎭 Feeds with placeholder artwork: ${feedsWithPlaceholders.length}\n`);
    
    if (feedsWithPlaceholders.length === 0) {
      console.log('✅ No placeholder artwork found!');
      return;
    }
    
    // Process each feed
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const feed of feedsWithPlaceholders) {
      console.log(`🎵 Processing: ${feed.parsedData?.album?.title || 'Unknown'}`);
      
      if (!feed.parsedData?.album?.feedGuid) {
        console.log(`   ⚠️  No feed GUID found, skipping...`);
        skippedCount++;
        continue;
      }
      
      console.log(`   🔍 Feed GUID: ${feed.parsedData.album.feedGuid}`);
      
      // Get feed info from PodcastIndex
      const feedInfo = await getFeedInfo(feed.parsedData.album.feedGuid);
      
      if (!feedInfo) {
        console.log(`   ❌ Could not fetch feed info, skipping...`);
        skippedCount++;
        continue;
      }
      
      if (feedInfo.artwork) {
        console.log(`   🎨 Found artwork: ${feedInfo.artwork}`);
        
        // Update the album artwork
        feed.parsedData.album.coverArt = feedInfo.artwork;
        
        // Update all track artwork
        if (feed.parsedData.album.tracks) {
          feed.parsedData.album.tracks.forEach(track => {
            if (track.artwork && track.artwork.includes('via.placeholder.com')) {
              track.artwork = feedInfo.artwork;
            }
          });
        }
        
        fixedCount++;
        console.log(`   ✅ Updated artwork for album and tracks`);
      } else {
        console.log(`   ⚠️  No artwork found in feed, keeping placeholder`);
        skippedCount++;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save the updated data
    fs.writeFileSync(feedsPath, JSON.stringify(feedsData, null, 2));
    
    console.log(`\n🎉 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount} albums`);
    console.log(`   ⚠️  Skipped: ${skippedCount} albums`);
    console.log(`   📝 Data saved to: ${feedsPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
