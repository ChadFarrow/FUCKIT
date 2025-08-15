#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const xml2js = require('xml2js');

// Read the albums missing artwork
const albumsFile = path.join(__dirname, '..', 'data', 'albums-missing-artwork.json');
const musicTracksFile = path.join(__dirname, '..', 'data', 'music-tracks.json');

// Function to fetch RSS feed
async function fetchRSSFeed(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
      });
    });
    
    request.on('error', (err) => {
      console.error(`Error fetching ${url}:`, err.message);
      resolve(null);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      console.error(`Timeout fetching ${url}`);
      resolve(null);
    });
  });
}

// Function to extract artwork from RSS feed
async function extractArtworkFromFeed(feedContent) {
  if (!feedContent) return null;
  
  try {
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(feedContent);
    
    // Check various possible locations for artwork
    if (result.rss && result.rss.channel && result.rss.channel[0]) {
      const channel = result.rss.channel[0];
      
      // Try iTunes image first
      if (channel['itunes:image'] && channel['itunes:image'][0]) {
        const href = channel['itunes:image'][0].$.href;
        if (href) return href;
      }
      
      // Try regular image tag
      if (channel.image && channel.image[0]) {
        if (channel.image[0].url && channel.image[0].url[0]) {
          return channel.image[0].url[0];
        }
      }
      
      // Try podcast:images
      if (channel['podcast:images'] && channel['podcast:images'][0]) {
        const srcset = channel['podcast:images'][0].$.srcset;
        if (srcset) {
          // Extract the first URL from srcset
          const firstUrl = srcset.split(',')[0].trim().split(' ')[0];
          if (firstUrl) return firstUrl;
        }
      }
    }
  } catch (err) {
    console.error('Error parsing RSS feed:', err.message);
  }
  
  return null;
}

// Main function
async function fixMissingArtwork() {
  console.log('🎨 Starting artwork fix process...\n');
  
  // Read the missing artwork albums
  const missingAlbums = JSON.parse(fs.readFileSync(albumsFile, 'utf8'));
  console.log(`📊 Found ${missingAlbums.length} albums missing artwork\n`);
  
  // Read music tracks
  const musicTracksData = JSON.parse(fs.readFileSync(musicTracksFile, 'utf8'));
  
  const artworkUpdates = [];
  let successCount = 0;
  let failCount = 0;
  
  // Process each album
  for (let i = 0; i < missingAlbums.length; i++) {
    const album = missingAlbums[i];
    console.log(`\n[${i + 1}/${missingAlbums.length}] Processing: ${album.feedTitle}`);
    console.log(`  Feed URL: ${album.feedUrl}`);
    
    // Fetch the RSS feed
    const feedContent = await fetchRSSFeed(album.feedUrl);
    
    if (feedContent) {
      const artworkUrl = await extractArtworkFromFeed(feedContent);
      
      if (artworkUrl) {
        console.log(`  ✅ Found artwork: ${artworkUrl}`);
        artworkUpdates.push({
          feedTitle: album.feedTitle,
          feedGuid: album.feedGuid,
          artworkUrl: artworkUrl
        });
        successCount++;
      } else {
        console.log(`  ❌ No artwork found in RSS feed`);
        failCount++;
      }
    } else {
      console.log(`  ❌ Failed to fetch RSS feed`);
      failCount++;
    }
    
    // Add a small delay to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results:`);
  console.log(`  ✅ Found artwork for ${successCount} albums`);
  console.log(`  ❌ Failed to find artwork for ${failCount} albums`);
  
  if (artworkUpdates.length > 0) {
    // Save the updates to a file for review
    const updatesFile = path.join(__dirname, '..', 'data', 'artwork-updates.json');
    fs.writeFileSync(updatesFile, JSON.stringify(artworkUpdates, null, 2));
    console.log(`\n💾 Saved ${artworkUpdates.length} artwork updates to: data/artwork-updates.json`);
    
    console.log('\n🔄 Applying updates to music-tracks.json...');
    
    // Apply updates to music tracks
    let updateCount = 0;
    musicTracksData.musicTracks = musicTracksData.musicTracks.map(track => {
      const update = artworkUpdates.find(u => 
        u.feedTitle === track.feedTitle && 
        u.feedGuid === track.feedGuid
      );
      
      if (update) {
        track.feedImage = update.artworkUrl;
        if (!track.image || track.image === null || track.image === '') {
          track.image = update.artworkUrl;
        }
        updateCount++;
      }
      
      return track;
    });
    
    // Save the updated music tracks
    fs.writeFileSync(musicTracksFile, JSON.stringify(musicTracksData, null, 2));
    console.log(`✅ Updated ${updateCount} tracks in music-tracks.json`);
    
    // Also copy to public directory
    const publicMusicTracksFile = path.join(__dirname, '..', 'public', 'music-tracks.json');
    fs.writeFileSync(publicMusicTracksFile, JSON.stringify(musicTracksData, null, 2));
    console.log('✅ Copied to public/music-tracks.json');
    
    console.log('\n🎉 Artwork fix complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Review the changes');
    console.log('  2. Test locally with: npm run dev');
    console.log('  3. Commit with: git add -A && git commit -m "fix: add missing artwork for multiple albums"');
    console.log('  4. Push with: git push origin main');
  } else {
    console.log('\n⚠️  No artwork updates were found');
  }
}

// Check if xml2js is installed
try {
  require.resolve('xml2js');
  // Run the fix
  fixMissingArtwork().catch(console.error);
} catch(e) {
  console.log('📦 Installing required dependency: xml2js');
  const { execSync } = require('child_process');
  execSync('npm install xml2js', { stdio: 'inherit' });
  console.log('✅ Dependency installed. Please run the script again.');
}