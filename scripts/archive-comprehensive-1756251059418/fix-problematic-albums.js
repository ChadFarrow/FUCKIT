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

console.log('🔍 Checking problematic albums...');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Albums to check/fix
const problematicAlbums = [
  {
    id: 'hgh-himalaya',
    name: 'Himalaya',
    issue: 'Using Himalaya platform logo, inappropriate track titles'
  },
  {
    id: 'hgh-red-wings', 
    name: 'Red Wings',
    issue: 'Inappropriate content, generic podcast artwork'
  }
];

// Function to generate PodcastIndex API signature
function generateSignature(url, timestamp) {
  const data = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + timestamp;
  return crypto.createHash('sha1').update(data).digest('hex');
}

// Search for correct album info
async function searchForCorrectAlbum(albumName, feedGuid) {
  if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
    console.log('⚠️  No API credentials, skipping search');
    return null;
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature('', timestamp);
  
  try {
    // First try by GUID
    const searchUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'FUCKIT-Album-Fix/1.0',
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': timestamp.toString(),
        'Authorization': signature
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'true' && data.feed) {
        // Check if this looks like legitimate music content
        const feed = data.feed;
        const title = feed.title || '';
        const description = feed.description || '';
        
        // Red flags for non-music content
        const redFlags = [
          'podcast', 'talk', 'show', 'news', 'comedy',
          'interview', 'discussion', 'himalaya.com', 'libsyn'
        ];
        
        const looksLikeMusic = !redFlags.some(flag => 
          title.toLowerCase().includes(flag) || 
          description.toLowerCase().includes(flag)
        );
        
        if (looksLikeMusic && feed.categories) {
          // Check if it has music-related categories
          const musicCategories = ['Music', 'Arts'];
          const hasMusicCategory = Object.values(feed.categories || {}).some(cat => 
            musicCategories.includes(cat)
          );
          
          if (hasMusicCategory) {
            return {
              isMusic: true,
              artwork: feed.artwork || feed.image,
              title: feed.title
            };
          }
        }
        
        return {
          isMusic: false,
          reason: 'Not categorized as music'
        };
      }
    }
  } catch (error) {
    console.error('⚠️  Error searching API:', error.message);
  }
  
  return null;
}

// Main function
async function fixProblematicAlbums() {
  console.log('\n📊 Analyzing problematic albums...\n');
  
  const albumsToRemove = [];
  const albumsToFix = [];
  
  for (const problem of problematicAlbums) {
    const album = parsedFeedsData.feeds.find(f => f.id === problem.id);
    
    if (!album) {
      console.log(`❌ ${problem.name}: Not found in database`);
      continue;
    }
    
    console.log(`\n🔍 Checking: ${problem.name}`);
    console.log(`   Issue: ${problem.issue}`);
    console.log(`   Feed GUID: ${album.parsedData.album.feedGuid}`);
    
    // Check track titles for inappropriate content
    const tracks = album.parsedData.album.tracks || [];
    const inappropriateTitles = tracks.filter(t => {
      const title = t.title.toLowerCase();
      // Check for clearly inappropriate content
      return title.includes('pussy') || 
             title.includes('ass') || 
             title.includes('glutton') ||
             title.includes('rough');
    });
    
    if (inappropriateTitles.length > 0) {
      console.log(`   ⚠️  Found ${inappropriateTitles.length} inappropriate track titles`);
      albumsToRemove.push(problem.id);
      continue;
    }
    
    // Try to find correct info via API
    const correctInfo = await searchForCorrectAlbum(
      problem.name, 
      album.parsedData.album.feedGuid
    );
    
    if (correctInfo) {
      if (correctInfo.isMusic) {
        console.log(`   ✅ Found legitimate music content`);
        if (correctInfo.artwork) {
          albumsToFix.push({
            id: problem.id,
            newArtwork: correctInfo.artwork
          });
        }
      } else {
        console.log(`   ❌ Not music content: ${correctInfo.reason}`);
        albumsToRemove.push(problem.id);
      }
    } else {
      // No API info available, make decision based on content
      console.log(`   ⚠️  Could not verify via API, marking for removal due to inappropriate content`);
      albumsToRemove.push(problem.id);
    }
  }
  
  // Create backup
  const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-problematic-fix-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
  console.log(`\n💾 Created backup: ${path.basename(backupPath)}`);
  
  // Remove problematic albums
  if (albumsToRemove.length > 0) {
    console.log(`\n🗑️  Removing ${albumsToRemove.length} problematic albums...`);
    
    parsedFeedsData.feeds = parsedFeedsData.feeds.filter(feed => 
      !albumsToRemove.includes(feed.id)
    );
    
    albumsToRemove.forEach(id => {
      const album = problematicAlbums.find(p => p.id === id);
      console.log(`   • Removed: ${album ? album.name : id}`);
    });
  }
  
  // Fix artwork for salvageable albums
  if (albumsToFix.length > 0) {
    console.log(`\n🎨 Fixing artwork for ${albumsToFix.length} albums...`);
    
    albumsToFix.forEach(fix => {
      const album = parsedFeedsData.feeds.find(f => f.id === fix.id);
      if (album) {
        album.parsedData.album.coverArt = fix.newArtwork;
        const albumInfo = problematicAlbums.find(p => p.id === fix.id);
        console.log(`   • Fixed artwork: ${albumInfo ? albumInfo.name : fix.id}`);
      }
    });
  }
  
  // Save updated data
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
  console.log('\n💾 Updated parsed-feeds.json');
  
  // Also check and clean music-tracks.json
  const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
  if (fs.existsSync(musicTracksPath)) {
    const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const beforeCount = musicTracksData.musicTracks.length;
    
    // Remove tracks from problematic albums
    musicTracksData.musicTracks = musicTracksData.musicTracks.filter(track => {
      const albumTitle = track.albumTitle?.toLowerCase() || '';
      const title = track.title?.toLowerCase() || '';
      
      // Remove if from removed albums or has inappropriate content
      const shouldRemove = 
        albumTitle === 'himalaya' ||
        albumTitle === 'red wings' ||
        title.includes('pussy') ||
        title.includes('glutton') ||
        title.includes('asslip');
      
      return !shouldRemove;
    });
    
    const removedCount = beforeCount - musicTracksData.musicTracks.length;
    if (removedCount > 0) {
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
      console.log(`💾 Removed ${removedCount} problematic tracks from music-tracks.json`);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
  console.log(`   • Albums removed: ${albumsToRemove.length}`);
  console.log(`   • Albums fixed: ${albumsToFix.length}`);
}

// Run the fix
fixProblematicAlbums().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});