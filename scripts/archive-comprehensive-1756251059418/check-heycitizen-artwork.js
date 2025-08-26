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

async function checkHeyCitizenArtwork() {
  const feedGuid = "a2d2e313-9cbd-5169-b89c-ab07b33ecc33"; // The Heycitizen Experience
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  try {
    // Get feed information
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
    
    console.log('🔍 Checking feed artwork for The Heycitizen Experience...');
    
    const response = await fetch(feedUrl, { headers });
    const data = await response.json();
    
    if (data.status === "true" && data.feed) {
      const feed = data.feed;
      console.log(`\n📚 Feed: "${feed.title}" by ${feed.author}`);
      console.log(`🎨 Feed Image: ${feed.image}`);
      console.log(`🖼️  Feed Artwork: ${feed.artwork}`);
      
      // Get some episodes to see their artwork
      const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feed.id}&max=5`;
      const episodesResponse = await fetch(episodesUrl, { headers });
      const episodesData = await episodesResponse.json();
      
      if (episodesData.status === "true" && episodesData.items) {
        console.log(`\n🎵 Episode Artwork Examples:`);
        episodesData.items.slice(0, 3).forEach((episode, index) => {
          console.log(`  ${index + 1}. "${episode.title}"`);
          console.log(`     Episode Image: ${episode.image || 'None'}`);
          console.log(`     Feed Image: ${episode.feedImage || 'None'}`);
        });
      }
      
      // Suggest best artwork
      const bestArtwork = feed.artwork || feed.image;
      console.log(`\n✨ Recommended album artwork: ${bestArtwork}`);
      
      return {
        feedImage: feed.image,
        feedArtwork: feed.artwork,
        recommended: bestArtwork
      };
    }
    
  } catch (error) {
    console.error('❌ Error checking artwork:', error.message);
  }
}

async function updateAlbumArtwork() {
  try {
    const result = await checkHeyCitizenArtwork();
    
    if (!result || !result.recommended) {
      console.log('❌ No better artwork found');
      return;
    }
    
    const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
    const data = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find and update The Heycitizen Experience album
    const albumFeed = data.feeds.find(feed => 
      feed.parseStatus === 'success' && 
      feed.parsedData?.album?.title === 'The Heycitizen Experience'
    );
    
    if (albumFeed) {
      const currentArtwork = albumFeed.parsedData.album.coverArt;
      console.log(`\n🔄 Current artwork: ${currentArtwork}`);
      console.log(`🎨 New artwork: ${result.recommended}`);
      
      if (currentArtwork !== result.recommended) {
        albumFeed.parsedData.album.coverArt = result.recommended;
        
        // Save updated data
        fs.writeFileSync(parsedFeedsPath, JSON.stringify(data, null, 2));
        console.log('✅ Album artwork updated!');
        
        return true;
      } else {
        console.log('ℹ️  Artwork is already correct');
        return false;
      }
    } else {
      console.log('❌ Could not find The Heycitizen Experience album');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error updating artwork:', error.message);
    return false;
  }
}

if (require.main === module) {
  updateAlbumArtwork().catch(console.error);
}