#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the RESOLVED_SONGS from ITDVPlaylistAlbum.tsx
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

console.log(`Found ${songs.length} songs to resolve`);

// Function to fetch and parse RSS feed
async function fetchRSSFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'FUCKIT-Music-Resolver/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${feedUrl}:`, error.message);
    return null;
  }
}

// Function to extract audio URL and artwork from RSS XML
function extractMediaData(xmlText, itemGuid) {
  try {
    // Find all <item> blocks
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
    if (!itemMatches) return { audioUrl: null, artworkUrl: null };

    for (const itemBlock of itemMatches) {
      // Check if this item has the target GUID
      const guidMatch = itemBlock.match(/<guid[^>]*>([^<]+)<\/guid>/i);
      if (!guidMatch || guidMatch[1] !== itemGuid) {
        continue;
      }

      // Found the target item, extract enclosure URL
      const enclosureMatch = itemBlock.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
      if (!enclosureMatch) {
        continue;
      }

      const audioUrl = enclosureMatch[1];
      
      // Try to extract artwork URL from various sources
      let artworkUrl = null;
      
      // Try iTunes image first
      const itunesImageMatch = itemBlock.match(/<itunes:image[^>]+href=["']([^"']+)["'][^>]*>/i);
      if (itunesImageMatch) {
        artworkUrl = itunesImageMatch[1];
      }
      
      // Try media:thumbnail or media:content with image type
      if (!artworkUrl) {
        const mediaThumbnailMatch = itemBlock.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i);
        if (mediaThumbnailMatch) {
          artworkUrl = mediaThumbnailMatch[1];
        }
      }
      
      // Try podcast:images
      if (!artworkUrl) {
        const podcastImageMatch = itemBlock.match(/<podcast:images[^>]+srcset=["']([^"']+)["'][^>]*>/i);
        if (podcastImageMatch) {
          // Take the first URL from srcset
          const firstUrl = podcastImageMatch[1].split(',')[0].trim().split(' ')[0];
          artworkUrl = firstUrl;
        }
      }

      return { audioUrl, artworkUrl };
    }
    
    return { audioUrl: null, artworkUrl: null };
  } catch (error) {
    console.error('Error parsing XML:', error);
    return { audioUrl: null, artworkUrl: null };
  }
}

// Main resolution process
async function resolveAllMediaData() {
  const resolvedData = {};
  const feedCache = new Map();
  
  for (const song of songs) {
    if (!song.feedUrl || !song.itemGuid) {
      console.log(`⚠️ Skipping "${song.title}" - missing feedUrl or itemGuid`);
      continue;
    }
    
    console.log(`🔍 Resolving: ${song.title} by ${song.artist}`);
    
    // Check cache for feed
    let xmlContent = feedCache.get(song.feedUrl);
    if (!xmlContent) {
      console.log(`  📡 Fetching feed: ${song.feedUrl}`);
      xmlContent = await fetchRSSFeed(song.feedUrl);
      if (xmlContent) {
        feedCache.set(song.feedUrl, xmlContent);
      }
    }
    
    if (!xmlContent) {
      console.log(`  ❌ Failed to fetch feed`);
      continue;
    }
    
    const mediaData = extractMediaData(xmlContent, song.itemGuid);
    if (mediaData.audioUrl) {
      console.log(`  ✅ Audio: ${mediaData.audioUrl}`);
      if (mediaData.artworkUrl) {
        console.log(`  🎨 Artwork: ${mediaData.artworkUrl}`);
      }
      resolvedData[song.title] = {
        audioUrl: mediaData.audioUrl,
        artworkUrl: mediaData.artworkUrl
      };
    } else {
      console.log(`  ⚠️ No audio URL found in feed`);
    }
    
    // Add small delay to be respectful to servers
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return resolvedData;
}

// Run the resolution
console.log('🚀 Starting media resolution...\n');
resolveAllMediaData().then(resolvedData => {
  const outputPath = path.join(__dirname, '../data/itdv-resolved-media-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(resolvedData, null, 2));
  
  console.log('\n📊 Resolution Summary:');
  console.log(`✅ Resolved: ${Object.keys(resolvedData).length} tracks`);
  console.log(`❌ Failed: ${songs.length - Object.keys(resolvedData).length} tracks`);
  console.log(`🎨 With artwork: ${Object.values(resolvedData).filter(d => d.artworkUrl).length} tracks`);
  console.log(`\n💾 Saved to: ${outputPath}`);
  
  // Generate TypeScript code for the component
  console.log('\n📝 Update ITDVPlaylistAlbum.tsx with these mappings:\n');
  
  console.log('const AUDIO_URL_MAP: { [key: string]: string } = {');
  for (const [title, data] of Object.entries(resolvedData)) {
    if (data.audioUrl) {
      console.log(`  "${title}": "${data.audioUrl}",`);
    }
  }
  console.log('};\n');
  
  console.log('const ARTWORK_URL_MAP: { [key: string]: string } = {');
  for (const [title, data] of Object.entries(resolvedData)) {
    if (data.artworkUrl) {
      console.log(`  "${title}": "${data.artworkUrl}",`);
    }
  }
  console.log('};\n');
}).catch(error => {
  console.error('Resolution failed:', error);
  process.exit(1);
});