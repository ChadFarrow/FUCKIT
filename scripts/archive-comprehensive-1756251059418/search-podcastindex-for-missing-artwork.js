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

console.log('🔍 Searching PodcastIndex for missing artwork...\n');

// Load data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

const needsFixPath = path.join(__dirname, '..', 'data', 'feeds-needing-fixes.json');
const needsFix = JSON.parse(fs.readFileSync(needsFixPath, 'utf8'));

console.log(`📊 Found ${needsFix.needingArtwork.length} albums needing artwork\n`);

// Function to generate PodcastIndex API signature
function generateSignature(url, timestamp) {
  const data = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp;
  return crypto.createHash('sha1').update(data).digest('hex');
}

// Search for artwork by feed GUID
async function searchByGuid(feed) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature('', timestamp);
  
  try {
    const searchUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feed.feedGuid}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'FUCKIT-Artwork-Search/1.0',
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': timestamp.toString(),
        'Authorization': signature
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'true' && data.feed) {
        // Check for various artwork fields
        const artwork = data.feed.artwork || 
                       data.feed.image || 
                       data.feed.itunesImage ||
                       data.feed.imageUrl;
        
        if (artwork && !artwork.includes('placeholder')) {
          return artwork;
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error searching by GUID: ${error.message}`);
  }
  
  return null;
}

// Search for artwork by title/artist
async function searchByTitle(title, artist) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature('', timestamp);
  
  // Try different search combinations
  const queries = [
    `${title} ${artist}`,
    title,
    artist
  ].filter(q => q && q.trim());
  
  for (const query of queries) {
    try {
      const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'FUCKIT-Artwork-Search/1.0',
          'X-Auth-Key': PODCAST_INDEX_API_KEY,
          'X-Auth-Date': timestamp.toString(),
          'Authorization': signature
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'true' && data.feeds && data.feeds.length > 0) {
          // Look for exact or close match
          for (const feed of data.feeds) {
            const feedTitle = (feed.title || '').toLowerCase();
            const searchTitle = title.toLowerCase();
            
            // Check for exact match or close match
            if (feedTitle === searchTitle || 
                feedTitle.includes(searchTitle) || 
                searchTitle.includes(feedTitle)) {
              
              const artwork = feed.artwork || feed.image || feed.itunesImage;
              if (artwork && !artwork.includes('placeholder')) {
                return artwork;
              }
            }
          }
        }
      }
    } catch (error) {
      // Continue to next query
    }
    
    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

// Main search function
async function searchForArtwork() {
  const results = {
    found: [],
    notFound: [],
    errors: []
  };
  
  // Create backup
  const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-artwork-search-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
  console.log(`💾 Created backup: ${path.basename(backupPath)}\n`);
  
  let processed = 0;
  const total = needsFix.needingArtwork.length;
  
  for (const needsArt of needsFix.needingArtwork) {
    processed++;
    console.log(`[${processed}/${total}] Searching: ${needsArt.title}`);
    
    // Find the feed in parsed data
    const feed = parsedFeedsData.feeds.find(f => f.id === needsArt.id);
    if (!feed || !feed.parsedData?.album) {
      console.log(`   ❌ Feed not found in database`);
      continue;
    }
    
    const album = feed.parsedData.album;
    let foundArtwork = null;
    
    // Try searching by GUID first if available
    if (album.feedGuid) {
      console.log(`   🔍 Searching by GUID: ${album.feedGuid}`);
      foundArtwork = await searchByGuid(album);
    }
    
    // If not found, try searching by title
    if (!foundArtwork) {
      console.log(`   🔍 Searching by title: "${needsArt.title}"`);
      foundArtwork = await searchByTitle(needsArt.title, needsArt.artist);
    }
    
    if (foundArtwork) {
      console.log(`   ✅ Found artwork: ${foundArtwork.substring(0, 60)}...`);
      
      // Update the album artwork
      album.coverArt = foundArtwork;
      
      // Update track images if they use placeholder
      if (album.tracks) {
        album.tracks.forEach(track => {
          if (track.image && (track.image.includes('placeholder') || track.image.includes('kolomona'))) {
            track.image = foundArtwork;
          }
        });
      }
      
      results.found.push({
        id: needsArt.id,
        title: needsArt.title,
        artwork: foundArtwork
      });
    } else {
      console.log(`   ❌ No artwork found`);
      results.notFound.push({
        id: needsArt.id,
        title: needsArt.title
      });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Progress update
    if (processed % 10 === 0) {
      console.log(`\n📊 Progress: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
      console.log(`   ✅ Found: ${results.found.length}`);
      console.log(`   ❌ Not found: ${results.notFound.length}\n`);
    }
  }
  
  // Save updated data
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
  
  // Display results
  console.log('\n🎯 Search Complete!');
  console.log('=' .repeat(50));
  console.log(`✅ Found artwork for: ${results.found.length} albums`);
  console.log(`❌ No artwork found for: ${results.notFound.length} albums`);
  
  if (results.found.length > 0) {
    console.log('\n🎨 Examples of found artwork:');
    results.found.slice(0, 5).forEach(item => {
      console.log(`   • ${item.title}`);
      console.log(`     ${item.artwork.substring(0, 70)}...`);
    });
  }
  
  if (results.notFound.length > 0) {
    console.log('\n❌ Still need artwork:');
    results.notFound.slice(0, 10).forEach(item => {
      console.log(`   • ${item.title} (${item.id})`);
    });
  }
  
  console.log('\n💾 Updated parsed-feeds.json');
  
  // Save results report
  const reportPath = path.join(__dirname, '..', 'data', `artwork-search-results-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${path.basename(reportPath)}`);
}

// Run the search
searchForArtwork().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});