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

console.log('🔍 Starting PodcastIndex API artwork search...');

// Load the main music tracks database
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

// Get tracks without artwork
const tracksWithoutArtwork = musicTracksData.musicTracks.filter(track => 
  !track.artworkUrl || track.artworkUrl.trim() === ''
);

console.log(`📊 Found ${tracksWithoutArtwork.length} tracks without artwork`);

// Function to generate PodcastIndex API signature
function generateSignature(url, timestamp) {
  const data = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp;
  return crypto.createHash('sha1').update(data).digest('hex');
}

// Function to search PodcastIndex for a track
async function searchPodcastIndex(track) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature('', timestamp);
  
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
          'User-Agent': 'FUCKIT-Artwork-Search/1.0',
          'X-Auth-Key': PODCAST_INDEX_API_KEY,
          'X-Auth-Date': timestamp.toString(),
          'Authorization': signature
        }
      });
      
      if (!response.ok) {
        console.log(`⚠️  API request failed for "${query}": ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.status === 'true' && data.feeds && data.feeds.length > 0) {
        // Look for artwork in the feeds
        for (const feed of data.feeds) {
          if (feed.artwork && feed.artwork.trim() !== '') {
            console.log(`✅ Found artwork for "${track.title}" via query "${query}": ${feed.artwork}`);
            return feed.artwork;
          }
        }
      }
      
      // If no artwork in feeds, try episodes
      if (data.status === 'true' && data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (item.feedImage && item.feedImage.trim() !== '') {
            console.log(`✅ Found artwork for "${track.title}" via episode query "${query}": ${feed.artwork}`);
            return item.feedImage;
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️  Error searching for "${query}": ${error.message}`);
    }
    
    // Add delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

// Main function to process all tracks
async function searchAllTracks() {
  const results = {
    tracksUpdated: 0,
    tracksNoArtworkFound: 0,
    artworkUrlsFound: [],
    errors: []
  };
  
  console.log(`\n🔍 Searching PodcastIndex API for ${tracksWithoutArtwork.length} tracks...`);
  
  for (let i = 0; i < tracksWithoutArtwork.length; i++) {
    const track = tracksWithoutArtwork[i];
    console.log(`\n[${i + 1}/${tracksWithoutArtwork.length}] Searching for: "${track.title}" - ${track.artist || 'Unknown Artist'}`);
    
    try {
      const artworkUrl = await searchPodcastIndex(track);
      
      if (artworkUrl) {
        // Update the track in the database
        track.artworkUrl = artworkUrl;
        results.tracksUpdated++;
        results.artworkUrlsFound.push({
          title: track.title,
          artist: track.artist,
          artworkUrl: artworkUrl
        });
        
        console.log(`✅ Updated track "${track.title}" with artwork`);
      } else {
        results.tracksNoArtworkFound++;
        console.log(`❌ No artwork found for "${track.title}"`);
      }
      
    } catch (error) {
      results.errors.push({
        title: track.title,
        error: error.message
      });
      console.log(`⚠️  Error processing "${track.title}": ${error.message}`);
    }
    
    // Progress update every 10 tracks
    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${tracksWithoutArtwork.length} tracks processed`);
      console.log(`✅ Updated: ${results.tracksUpdated}, ❌ Not found: ${results.tracksNoArtworkFound}`);
    }
    
    // Add delay between requests to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

// Run the search
searchAllTracks().then(async (results) => {
  console.log('\n🎯 PodcastIndex API Search Complete!');
  console.log('=' .repeat(50));
  
  // Print summary
  console.log(`📊 Total tracks processed: ${tracksWithoutArtwork.length}`);
  console.log(`✅ Tracks updated with artwork: ${results.tracksUpdated}`);
  console.log(`❌ Tracks with no artwork found: ${results.tracksNoArtworkFound}`);
  console.log(`⚠️  Errors encountered: ${results.errors.length}`);
  
  // Calculate new coverage
  const totalTracks = musicTracksData.musicTracks.length;
  const tracksWithArtwork = totalTracks - results.tracksNoArtworkFound;
  const coveragePercentage = ((tracksWithArtwork / totalTracks) * 100).toFixed(1);
  
  console.log(`\n📈 New artwork coverage: ${tracksWithArtwork}/${totalTracks} (${coveragePercentage}%)`);
  
  // Show some examples of found artwork
  if (results.artworkUrlsFound.length > 0) {
    console.log('\n🎵 Examples of artwork found:');
    results.artworkUrlsFound.slice(0, 5).forEach(item => {
      console.log(`  • "${item.title}" - ${item.artist || 'Unknown Artist'}`);
      console.log(`    ${item.artworkUrl}`);
    });
  }
  
  // Show errors if any
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    results.errors.slice(0, 5).forEach(error => {
      console.log(`  • "${error.title}": ${error.error}`);
    });
  }
  
  // Save the updated database if we found any artwork
  if (results.tracksUpdated > 0) {
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-podcastindex-search-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicTracksData, null, 2));
    console.log(`\n💾 Created backup: ${path.basename(backupPath)}`);
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
    console.log(`💾 Updated main database: ${musicTracksPath}`);
    
    console.log('\n✨ Database updated successfully!');
  } else {
    console.log('\n💡 No new artwork found via PodcastIndex API');
  }
  
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
