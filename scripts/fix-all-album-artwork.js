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

async function getFeedArtwork(feedGuid) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  try {
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === "true" && data.feed) {
      const feed = data.feed;
      // Prefer artwork over image, fallback to image if artwork not available
      return {
        feedTitle: feed.title,
        author: feed.author,
        artwork: feed.artwork || feed.image,
        image: feed.image,
        episodeCount: feed.episodeCount
      };
    }
    return null;
  } catch (error) {
    console.error(`❌ Error getting feed artwork for ${feedGuid}:`, error.message);
    return null;
  }
}

async function fixAllAlbumArtwork() {
  console.log('🎨 Checking and fixing artwork for all albums...\n');
  
  const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
  
  if (!fs.existsSync(parsedFeedsPath)) {
    console.error('❌ parsed-feeds.json not found');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  
  // Find all albums that have feed data (not hardcoded)
  const albumFeeds = data.feeds.filter(feed => 
    feed.parseStatus === 'success' && 
    feed.parsedData?.album &&
    feed.originalUrl && 
    feed.originalUrl.includes('http') // Has a real feed URL
  );
  
  console.log(`📊 Found ${albumFeeds.length} albums to check`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < albumFeeds.length; i++) {
    const albumFeed = albumFeeds[i];
    const album = albumFeed.parsedData.album;
    const albumTitle = album.title;
    
    console.log(`\n[${i + 1}/${albumFeeds.length}] Checking: "${albumTitle}"`);
    
    try {
      // Extract feedGuid from the feed data
      let feedGuid = null;
      
      // Try to find feedGuid from tracks in the album
      if (album.tracks && album.tracks.length > 0) {
        // Look for feedGuid in music tracks data
        const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
        if (fs.existsSync(musicTracksPath)) {
          const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
          const matchingTrack = musicData.musicTracks.find(track => 
            track.album === albumTitle || track.feedTitle === albumTitle
          );
          if (matchingTrack) {
            feedGuid = matchingTrack.feedGuid;
          }
        }
      }
      
      if (!feedGuid) {
        console.log(`⚠️  No feedGuid found for "${albumTitle}" - skipping`);
        skippedCount++;
        continue;
      }
      
      // Skip if not a proper GUID format
      if (!feedGuid.includes('-') || feedGuid.startsWith('http')) {
        console.log(`⚠️  Invalid feedGuid format: ${feedGuid.slice(0, 30)}... - skipping`);
        skippedCount++;
        continue;
      }
      
      console.log(`🔍 Checking feedGuid: ${feedGuid.slice(0, 8)}...`);
      
      const feedInfo = await getFeedArtwork(feedGuid);
      
      if (!feedInfo) {
        console.log(`❌ Could not get feed info`);
        errorCount++;
        continue;
      }
      
      console.log(`📚 Feed: "${feedInfo.feedTitle}" by ${feedInfo.author} (${feedInfo.episodeCount} tracks)`);
      
      const currentArtwork = album.coverArt;
      const newArtwork = feedInfo.artwork;
      
      if (!newArtwork) {
        console.log(`⚠️  No artwork available from feed`);
        skippedCount++;
        continue;
      }
      
      console.log(`🎨 Current: ${currentArtwork ? currentArtwork.slice(-30) : 'None'}`);
      console.log(`🎨 Feed:    ${newArtwork.slice(-30)}`);
      
      if (currentArtwork !== newArtwork) {
        album.coverArt = newArtwork;
        console.log(`✅ Updated artwork for "${albumTitle}"`);
        fixedCount++;
      } else {
        console.log(`✓ Artwork already correct`);
        skippedCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error processing "${albumTitle}":`, error.message);
      errorCount++;
    }
  }
  
  // Save updated data if any changes were made
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated artwork...');
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(data, null, 2));
  }
  
  console.log(`\n🏁 Artwork check complete!`);
  console.log(`✅ Albums fixed: ${fixedCount}`);
  console.log(`⏭️  Already correct/skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total checked: ${albumFeeds.length}`);
}

if (require.main === module) {
  fixAllAlbumArtwork().catch(console.error);
}