#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const xml2js = require('xml2js');

// Read the music tracks data
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

// Function to extract artist from RSS feed
async function extractArtistFromFeed(feedContent) {
  if (!feedContent) return null;
  
  try {
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(feedContent);
    
    if (result.rss && result.rss.channel && result.rss.channel[0]) {
      const channel = result.rss.channel[0];
      
      // Try iTunes author first
      if (channel['itunes:author'] && channel['itunes:author'][0]) {
        return channel['itunes:author'][0].trim();
      }
      
      // Try author tag
      if (channel.author && channel.author[0]) {
        return channel.author[0].trim();
      }
      
      // Try DC creator
      if (channel['dc:creator'] && channel['dc:creator'][0]) {
        return channel['dc:creator'][0].trim();
      }
      
      // Try podcast value recipient name
      if (channel['podcast:value'] && channel['podcast:value'][0] && 
          channel['podcast:value'][0]['podcast:valueRecipient']) {
        const recipients = channel['podcast:value'][0]['podcast:valueRecipient'];
        if (recipients && recipients[0] && recipients[0].$.name) {
          return recipients[0].$.name.trim();
        }
      }
      
      // Try managingEditor
      if (channel.managingEditor && channel.managingEditor[0]) {
        return channel.managingEditor[0].trim();
      }
    }
  } catch (err) {
    console.error('Error parsing RSS feed:', err.message);
  }
  
  return null;
}

// Main function
async function fixMissingArtists() {
  console.log('🎵 Starting artist fix process...\n');
  
  // Read music tracks
  const musicTracksData = JSON.parse(fs.readFileSync(musicTracksFile, 'utf8'));
  console.log(`📊 Found ${musicTracksData.musicTracks.length} total tracks\n`);
  
  // Group by feedTitle to get unique albums
  const albumGroups = new Map();
  musicTracksData.musicTracks.forEach(track => {
    const key = track.feedTitle || 'Unknown';
    if (!albumGroups.has(key)) {
      albumGroups.set(key, {
        feedTitle: track.feedTitle,
        feedUrl: track.feedUrl,
        feedGuid: track.feedGuid,
        currentArtist: track.artist,
        tracks: []
      });
    }
    albumGroups.get(key).tracks.push(track);
  });
  
  console.log(`📀 Found ${albumGroups.size} unique albums\n`);
  
  // Find albums that need artist fixes (null artist or artist == album title)
  const albumsToFix = Array.from(albumGroups.values()).filter(album => {
    return !album.currentArtist || 
           album.currentArtist === album.feedTitle ||
           album.currentArtist.trim() === '';
  });
  
  console.log(`🔧 Found ${albumsToFix.length} albums needing artist fixes\n`);
  
  const artistUpdates = [];
  let successCount = 0;
  let failCount = 0;
  
  // Process each album that needs fixing
  for (let i = 0; i < albumsToFix.length; i++) {
    const album = albumsToFix[i];
    console.log(`\n[${i + 1}/${albumsToFix.length}] Processing: ${album.feedTitle}`);
    console.log(`  Current artist: ${album.currentArtist || 'null'}`);
    console.log(`  Feed URL: ${album.feedUrl}`);
    
    if (!album.feedUrl) {
      console.log(`  ❌ No feed URL available`);
      failCount++;
      continue;
    }
    
    // Fetch the RSS feed
    const feedContent = await fetchRSSFeed(album.feedUrl);
    
    if (feedContent) {
      const artistName = await extractArtistFromFeed(feedContent);
      
      if (artistName && artistName !== album.feedTitle) {
        console.log(`  ✅ Found artist: ${artistName}`);
        artistUpdates.push({
          feedTitle: album.feedTitle,
          feedGuid: album.feedGuid,
          feedUrl: album.feedUrl,
          oldArtist: album.currentArtist,
          newArtist: artistName
        });
        successCount++;
      } else if (artistName === album.feedTitle) {
        console.log(`  ⚠️  Artist same as album title: ${artistName}`);
        failCount++;
      } else {
        console.log(`  ❌ No artist found in RSS feed`);
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
  console.log(`  ✅ Found artists for ${successCount} albums`);
  console.log(`  ❌ Failed to find artists for ${failCount} albums`);
  
  if (artistUpdates.length > 0) {
    // Save the updates to a file for review
    const updatesFile = path.join(__dirname, '..', 'data', 'artist-updates.json');
    fs.writeFileSync(updatesFile, JSON.stringify(artistUpdates, null, 2));
    console.log(`\n💾 Saved ${artistUpdates.length} artist updates to: data/artist-updates.json`);
    
    console.log('\n🔄 Applying updates to music-tracks.json...');
    
    // Apply updates to music tracks
    let updateCount = 0;
    musicTracksData.musicTracks = musicTracksData.musicTracks.map(track => {
      const update = artistUpdates.find(u => 
        u.feedTitle === track.feedTitle && 
        u.feedGuid === track.feedGuid
      );
      
      if (update) {
        track.artist = update.newArtist;
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
    
    console.log('\n🎉 Artist fix complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Review the changes');
    console.log('  2. Test locally with: npm run dev');
    console.log('  3. Commit with: git add -A && git commit -m "fix: add missing artist data for albums"');
    console.log('  4. Push with: git push origin main');
  } else {
    console.log('\n⚠️  No artist updates were found');
  }
}

// Check if xml2js is installed
try {
  require.resolve('xml2js');
  // Run the fix
  fixMissingArtists().catch(console.error);
} catch(e) {
  console.log('📦 Installing required dependency: xml2js');
  const { execSync } = require('child_process');
  execSync('npm install xml2js', { stdio: 'inherit' });
  console.log('✅ Dependency installed. Please run the script again.');
}