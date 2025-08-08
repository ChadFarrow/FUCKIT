#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the ITDVPlaylistAlbum.tsx file to get songs data
const componentPath = path.join(__dirname, '../components/ITDVPlaylistAlbum.tsx');
const componentContent = fs.readFileSync(componentPath, 'utf8');

// Extract RESOLVED_SONGS array
const startIndex = componentContent.indexOf('const RESOLVED_SONGS = [');
const endIndex = componentContent.indexOf('].filter(song => song.title');
const songsArrayStr = componentContent.substring(startIndex, endIndex + 1)
  .replace('const RESOLVED_SONGS = [', '[');

// Parse the songs
let songs;
try {
  eval('songs = ' + songsArrayStr);
} catch (error) {
  console.error('Error parsing songs:', error);
  process.exit(1);
}

console.log(`🎨 Parsing RSS feeds for artwork URLs...\n`);

async function parseRssFeedForArtwork(feedUrl, itemGuid) {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'FUCKIT-RSS-Parser/1.0'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const xmlText = await response.text();
    
    // Split into items
    const items = xmlText.split(/<item[\s>]/i).slice(1);
    
    for (const item of items) {
      // Check if this item matches our GUID
      if (item.includes(itemGuid)) {
        // Look for iTunes image tag
        const iTunesImageMatch = item.match(/<itunes:image[^>]*href="([^"]+)"/i);
        if (iTunesImageMatch) {
          return iTunesImageMatch[1];
        }
        
        // Look for regular image tag
        const imageMatch = item.match(/<image[^>]*>([^<]+)<\/image>/i) || 
                          item.match(/<image[^>]*url="([^"]+)"/i);
        if (imageMatch) {
          return imageMatch[1];
        }
        
        // Look for media:thumbnail
        const mediaThumbnailMatch = item.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
        if (mediaThumbnailMatch) {
          return mediaThumbnailMatch[1];
        }
        
        break;
      }
    }
    
    // If no item-specific image found, check for channel/feed level image
    const channelImageMatch = xmlText.match(/<itunes:image[^>]*href="([^"]+)"/i) ||
                             xmlText.match(/<image[^>]*>([^<]+)<\/image>/i) ||
                             xmlText.match(/<url>([^<]+)<\/url>/i);
    
    return channelImageMatch ? channelImageMatch[1] : null;
    
  } catch (error) {
    console.log(`  Error parsing RSS: ${error.message}`);
    return null;
  }
}

async function resolveArtworkFromRss() {
  const artworkFound = {};
  const failed = [];
  
  // Get unique feed URLs to reduce redundant requests  
  const uniqueFeeds = [...new Set(songs.map(s => s.feedUrl).filter(Boolean))];
  console.log(`📡 Found ${uniqueFeeds.length} unique RSS feeds to parse\n`);
  
  // Parse each feed and match items
  for (const feedUrl of uniqueFeeds) {
    console.log(`Parsing: ${feedUrl}`);
    const songsFromThisFeed = songs.filter(s => s.feedUrl === feedUrl);
    
    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'FUCKIT-RSS-Parser/1.0' }
      });
      
      if (!response.ok) {
        console.log(`  ❌ HTTP ${response.status}`);
        continue;
      }
      
      const xmlText = await response.text();
      let foundForFeed = 0;
      
      for (const song of songsFromThisFeed) {
        const artwork = await parseItemArtwork(xmlText, song.itemGuid);
        if (artwork && !artworkFound[song.title]) {
          artworkFound[song.title] = artwork;
          foundForFeed++;
          console.log(`  ✅ "${song.title}": ${artwork}`);
        }
      }
      
      console.log(`  📊 Found artwork for ${foundForFeed}/${songsFromThisFeed.length} tracks\n`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
    
    // Be respectful with requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n📊 Final Results:`);
  console.log(`✅ Artwork found: ${Object.keys(artworkFound).length}`);
  console.log(`❌ Still missing: ${songs.length - Object.keys(artworkFound).length}`);
  
  if (Object.keys(artworkFound).length > 0) {
    console.log(`\n🎨 Artwork entries to add to ARTWORK_URL_MAP:\n`);
    for (const [title, url] of Object.entries(artworkFound)) {
      console.log(`  "${title}": "${url}",`);
    }
  }
  
  return artworkFound;
}

function parseItemArtwork(xmlText, itemGuid) {
  // Split into items
  const items = xmlText.split(/<item[\s>]/i).slice(1);
  
  for (const item of items) {
    if (item.includes(itemGuid)) {
      // Look for iTunes image tag
      const iTunesImageMatch = item.match(/<itunes:image[^>]*href="([^"]+)"/i);
      if (iTunesImageMatch) {
        return iTunesImageMatch[1];
      }
      
      // Look for media:thumbnail
      const mediaThumbnailMatch = item.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
      if (mediaThumbnailMatch) {
        return mediaThumbnailMatch[1];
      }
      
      // Look for regular image tag in description
      const descImageMatch = item.match(/<img[^>]*src="([^"]+)"/i);
      if (descImageMatch) {
        return descImageMatch[1];
      }
      
      break;
    }
  }
  
  return null;
}

resolveArtworkFromRss().catch(console.error);