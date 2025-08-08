#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the ITDVPlaylistAlbum.tsx file
const componentPath = path.join(__dirname, '../components/ITDVPlaylistAlbum.tsx');
const componentContent = fs.readFileSync(componentPath, 'utf8');

// Extract RESOLVED_SONGS array
const startIndex = componentContent.indexOf('const RESOLVED_SONGS = [');
const endIndex = componentContent.indexOf('].filter(song => song.title');
const songsArrayStr = componentContent.substring(startIndex, endIndex + 1)
  .replace('const RESOLVED_SONGS = [', '[');

let songs;
try {
  eval('songs = ' + songsArrayStr);
} catch (error) {
  console.error('Error parsing songs:', error);
  process.exit(1);
}

// Extract current ARTWORK_URL_MAP
const artworkStartIndex = componentContent.indexOf('const ARTWORK_URL_MAP: { [key: string]: string } = {');
const artworkEndIndex = componentContent.indexOf('};', artworkStartIndex) + 2;
const artworkMapStr = componentContent.substring(artworkStartIndex, artworkEndIndex)
  .replace('const ARTWORK_URL_MAP: { [key: string]: string } = ', '');

let artworkMap;
try {
  eval('artworkMap = ' + artworkMapStr);
} catch (error) {
  console.error('Error parsing artwork map:', error);
  process.exit(1);
}

// Find tracks without custom artwork
const tracksWithoutArtwork = songs.filter(song => !artworkMap[song.title]);

console.log(`🎨 Found ${tracksWithoutArtwork.length} tracks still needing artwork\n`);

// Group by feed URL to understand patterns
const byFeed = {};
tracksWithoutArtwork.forEach(track => {
  const feedUrl = track.feedUrl || 'Unknown';
  if (!byFeed[feedUrl]) byFeed[feedUrl] = [];
  byFeed[feedUrl].push(track);
});

console.log('📊 Tracks missing artwork by RSS feed:\n');
for (const [feedUrl, tracks] of Object.entries(byFeed)) {
  console.log(`🔗 ${feedUrl}`);
  console.log(`   ${tracks.length} tracks missing artwork:`);
  tracks.slice(0, 5).forEach(track => {
    console.log(`   - "${track.title}" by ${track.artist}`);
  });
  if (tracks.length > 5) {
    console.log(`   ... and ${tracks.length - 5} more`);
  }
  console.log('');
}

// Strategy: For tracks without custom artwork, try to find feed-level artwork
async function getFeedLevelArtwork(feedUrl) {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'FUCKIT-Feed-Parser/1.0' }
    });
    
    if (!response.ok) return null;
    
    const xmlText = await response.text();
    
    // Look for channel-level artwork
    const channelImage = xmlText.match(/<itunes:image[^>]*href="([^"]+)"/i) ||
                        xmlText.match(/<image[^>]*><url>([^<]+)<\/url>/i) ||
                        xmlText.match(/<url>([^<]+)<\/url>/i);
    
    return channelImage ? channelImage[1] : null;
  } catch (error) {
    return null;
  }
}

async function resolveFeedArtwork() {
  console.log('🔍 Attempting to resolve feed-level artwork for remaining tracks...\n');
  
  const feedArtwork = {};
  const newTrackArtwork = {};
  
  // Get unique feed URLs
  const uniqueFeeds = [...new Set(tracksWithoutArtwork.map(t => t.feedUrl).filter(Boolean))];
  
  for (const feedUrl of uniqueFeeds.slice(0, 20)) { // Limit to avoid rate limiting
    console.log(`Checking feed: ${feedUrl.substring(0, 60)}...`);
    
    const artwork = await getFeedLevelArtwork(feedUrl);
    if (artwork) {
      feedArtwork[feedUrl] = artwork;
      console.log(`  ✅ Found: ${artwork}`);
      
      // Apply this artwork to all tracks from this feed
      const feedTracks = tracksWithoutArtwork.filter(t => t.feedUrl === feedUrl);
      feedTracks.forEach(track => {
        newTrackArtwork[track.title] = artwork;
      });
      
    } else {
      console.log(`  ❌ No artwork found`);
    }
    
    // Be respectful
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 Results:`);
  console.log(`✅ Feeds with artwork: ${Object.keys(feedArtwork).length}`);
  console.log(`✅ Additional tracks covered: ${Object.keys(newTrackArtwork).length}`);
  
  if (Object.keys(newTrackArtwork).length > 0) {
    console.log(`\n🎨 Additional artwork entries (feed-level):\n`);
    
    // Group by artwork URL to avoid duplicates
    const byArtwork = {};
    for (const [title, url] of Object.entries(newTrackArtwork)) {
      if (!byArtwork[url]) byArtwork[url] = [];
      byArtwork[url].push(title);
    }
    
    for (const [url, titles] of Object.entries(byArtwork)) {
      console.log(`// ${titles.length} tracks from same feed/album:`);
      titles.forEach(title => {
        console.log(`  "${title}": "${url}",`);
      });
      console.log('');
    }
  }
  
  const totalCoverage = Object.keys(artworkMap).length + Object.keys(newTrackArtwork).length;
  console.log(`\n📈 Total potential coverage: ${totalCoverage}/111 tracks (${Math.round((totalCoverage/111) * 100)}%)`);
  
  return newTrackArtwork;
}

resolveFeedArtwork().catch(console.error);