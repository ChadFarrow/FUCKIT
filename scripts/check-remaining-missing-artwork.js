#!/usr/bin/env node

// Use CommonJS
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

console.log('🔍 Checking for remaining albums with missing artwork...\n');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Find albums still missing artwork
const stillMissing = [];
const stillPlaceholder = [];

parsedFeedsData.feeds.forEach(feed => {
  const album = feed.parsedData?.album;
  if (!album) return;
  
  if (!album.coverArt || album.coverArt === '') {
    stillMissing.push({
      id: feed.id,
      title: album.title,
      artist: album.artist,
      feedGuid: album.feedGuid
    });
  } else if (album.coverArt.includes('placeholder') || album.coverArt.includes('kolomona.com')) {
    stillPlaceholder.push({
      id: feed.id,
      title: album.title,
      artist: album.artist,
      feedGuid: album.feedGuid,
      currentArt: album.coverArt
    });
  }
});

console.log('📊 Remaining Artwork Issues:');
console.log(`   • Still completely missing: ${stillMissing.length}`);
console.log(`   • Still using placeholders: ${stillPlaceholder.length}`);

if (stillMissing.length > 0) {
  console.log('\n❌ Albums still missing artwork:');
  stillMissing.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.title} (${item.id})`);
    console.log(`      Artist: ${item.artist}`);
    console.log(`      Feed GUID: ${item.feedGuid || 'N/A'}`);
  });
}

if (stillPlaceholder.length > 0) {
  console.log('\n🎨 Albums still using placeholder artwork:');
  stillPlaceholder.slice(0, 10).forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.title} (${item.id})`);
  });
  if (stillPlaceholder.length > 10) {
    console.log(`   ... and ${stillPlaceholder.length - 10} more`);
  }
}

// If we have API access, try to search for the completely missing ones
if (PODCAST_INDEX_API_KEY && PODCAST_INDEX_API_SECRET && stillMissing.length > 0) {
  console.log('\n🔍 Searching for completely missing artwork...\n');
  
  function generateSignature(url, timestamp) {
    const data = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp;
    return crypto.createHash('sha1').update(data).digest('hex');
  }
  
  async function searchForMissing() {
    let foundCount = 0;
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-missing-search-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
    console.log(`💾 Created backup: ${path.basename(backupPath)}\n`);
    
    for (const missing of stillMissing.slice(0, 20)) { // Limit to 20 to avoid rate limits
      console.log(`🔍 Searching: ${missing.title}`);
      
      if (missing.feedGuid) {
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          const signature = generateSignature('', timestamp);
          const searchUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${missing.feedGuid}`;
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'FUCKIT-Missing-Artwork-Search/1.0',
              'X-Auth-Key': PODCAST_INDEX_API_KEY,
              'X-Auth-Date': timestamp.toString(),
              'Authorization': signature
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'true' && data.feed) {
              const artwork = data.feed.artwork || data.feed.image || data.feed.itunesImage;
              
              if (artwork && !artwork.includes('placeholder')) {
                console.log(`   ✅ Found: ${artwork.substring(0, 60)}...`);
                
                // Update the feed
                const feed = parsedFeedsData.feeds.find(f => f.id === missing.id);
                if (feed?.parsedData?.album) {
                  feed.parsedData.album.coverArt = artwork;
                  if (feed.parsedData.album.tracks) {
                    feed.parsedData.album.tracks.forEach(track => {
                      if (!track.image || track.image.includes('placeholder')) {
                        track.image = artwork;
                      }
                    });
                  }
                  foundCount++;
                }
              } else {
                console.log(`   ❌ No artwork in PodcastIndex`);
              }
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Error: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  No feed GUID to search with`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (foundCount > 0) {
      fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
      console.log(`\n✅ Found and updated ${foundCount} more albums with artwork`);
      console.log('💾 Updated parsed-feeds.json');
    } else {
      console.log('\n❌ No additional artwork found');
    }
  }
  
  await searchForMissing().catch(console.error);
}

// Summary
const totalFeeds = parsedFeedsData.feeds.length;
const withArtwork = totalFeeds - stillMissing.length - stillPlaceholder.length;
const coverage = ((withArtwork / totalFeeds) * 100).toFixed(1);

console.log('\n📊 Final Artwork Coverage:');
console.log('=' .repeat(40));
console.log(`Total albums: ${totalFeeds}`);
console.log(`With real artwork: ${withArtwork} (${coverage}%)`);
console.log(`With placeholders: ${stillPlaceholder.length}`);
console.log(`Completely missing: ${stillMissing.length}`);

console.log('\n✅ Artwork search complete!');