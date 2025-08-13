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

console.log('🔍 Fixing Good Morning album artwork...');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Find the Good Morning album
const goodMorningAlbum = parsedFeedsData.feeds.find(feed => feed.id === 'hgh-good-morning');

if (!goodMorningAlbum) {
  console.error('❌ Good Morning album not found in parsed-feeds.json');
  process.exit(1);
}

console.log('📀 Found Good Morning album');
console.log('   Current artwork:', goodMorningAlbum.parsedData.album.coverArt);
console.log('   Feed GUID:', goodMorningAlbum.parsedData.album.feedGuid);

// Function to generate PodcastIndex API signature
function generateSignature(url, timestamp) {
  const data = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp;
  return crypto.createHash('sha1').update(data).digest('hex');
}

// Search for the correct artwork using the feed GUID
async function findCorrectArtwork() {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature('', timestamp);
  const feedGuid = goodMorningAlbum.parsedData.album.feedGuid;
  
  console.log('\n🔍 Searching PodcastIndex for feed GUID:', feedGuid);
  
  try {
    // First, try to get the feed by GUID
    const searchUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'FUCKIT-Artwork-Fix/1.0',
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': timestamp.toString(),
        'Authorization': signature
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️  API request failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status === 'true' && data.feed) {
      if (data.feed.artwork) {
        console.log('✅ Found correct artwork from PodcastIndex:', data.feed.artwork);
        return data.feed.artwork;
      }
      if (data.feed.image) {
        console.log('✅ Found correct image from PodcastIndex:', data.feed.image);
        return data.feed.image;
      }
    }
    
  } catch (error) {
    console.error('⚠️  Error searching PodcastIndex:', error.message);
  }
  
  // If that doesn't work, try searching by name
  console.log('\n🔍 Searching by album name: "Good Morning"');
  
  try {
    const timestamp2 = Math.floor(Date.now() / 1000);
    const signature2 = generateSignature('', timestamp2);
    const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent('Good Morning band music')}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'FUCKIT-Artwork-Fix/1.0',
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': timestamp2.toString(),
        'Authorization': signature2
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'true' && data.feeds && data.feeds.length > 0) {
        // Look for a feed that matches our GUID or has similar title
        for (const feed of data.feeds) {
          if (feed.podcastGuid === feedGuid || 
              (feed.title && feed.title.toLowerCase() === 'good morning' && 
               feed.artwork && !feed.artwork.includes('good-morning-america'))) {
            console.log('✅ Found matching feed with artwork:', feed.artwork || feed.image);
            return feed.artwork || feed.image;
          }
        }
      }
    }
  } catch (error) {
    console.error('⚠️  Error searching by name:', error.message);
  }
  
  return null;
}

// Main function
async function fixGoodMorningArtwork() {
  const correctArtwork = await findCorrectArtwork();
  
  if (!correctArtwork) {
    console.log('\n⚠️  Could not find correct artwork via PodcastIndex API');
    console.log('💡 Using a generic placeholder for now');
    
    // Use a generic music placeholder
    const placeholderUrl = 'https://cdn.kolomona.com/artwork/placeholder-album-art.jpg';
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-good-morning-fix-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
    console.log(`\n💾 Created backup: ${path.basename(backupPath)}`);
    
    // Update the artwork
    goodMorningAlbum.parsedData.album.coverArt = placeholderUrl;
    
    // Save the updated data
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
    console.log(`💾 Updated parsed-feeds.json with placeholder artwork`);
    
  } else {
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-good-morning-fix-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
    console.log(`\n💾 Created backup: ${path.basename(backupPath)}`);
    
    // Update the artwork
    const oldArtwork = goodMorningAlbum.parsedData.album.coverArt;
    goodMorningAlbum.parsedData.album.coverArt = correctArtwork;
    
    // Save the updated data
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
    
    console.log('\n✨ Successfully fixed Good Morning album artwork!');
    console.log('   Old (incorrect):', oldArtwork);
    console.log('   New (correct):', correctArtwork);
  }
  
  // Check if the album is also in music-tracks.json and update there too
  const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
  if (fs.existsSync(musicTracksPath)) {
    const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    let updated = false;
    
    musicTracksData.musicTracks.forEach(track => {
      if (track.albumTitle === 'Good Morning' || 
          (track.artworkUrl && track.artworkUrl.includes('good-morning-america'))) {
        track.artworkUrl = correctArtwork || 'https://cdn.kolomona.com/artwork/placeholder-album-art.jpg';
        updated = true;
      }
    });
    
    if (updated) {
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
      console.log('💾 Also updated music-tracks.json');
    }
  }
  
  console.log('\n✅ Fix complete!');
}

// Run the fix
fixGoodMorningArtwork().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});