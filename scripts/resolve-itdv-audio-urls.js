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

// Function to extract audio URL from RSS XML
function extractAudioUrl(xmlText, itemGuid) {
  try {
    // Find all <item> blocks
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
    if (!itemMatches) return null;

    for (const itemBlock of itemMatches) {
      // Check if this item has the target GUID
      const guidMatch = itemBlock.match(/<guid[^>]*>([^<]+)<\/guid>/i);
      if (!guidMatch || guidMatch[1] !== itemGuid) {
        continue;
      }

      // Found the target item, extract enclosure URL
      const enclosureMatch = itemBlock.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
      if (enclosureMatch) {
        return enclosureMatch[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing XML:', error);
    return null;
  }
}

// Main resolution process
async function resolveAllAudioUrls() {
  const resolvedUrls = {};
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
    
    const audioUrl = extractAudioUrl(xmlContent, song.itemGuid);
    if (audioUrl) {
      console.log(`  ✅ Found: ${audioUrl}`);
      resolvedUrls[song.title] = audioUrl;
    } else {
      console.log(`  ⚠️ No audio URL found in feed`);
    }
    
    // Add small delay to be respectful to servers
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return resolvedUrls;
}

// Run the resolution
console.log('🚀 Starting audio URL resolution...\n');
resolveAllAudioUrls().then(resolvedUrls => {
  const outputPath = path.join(__dirname, '../data/itdv-resolved-audio-urls.json');
  fs.writeFileSync(outputPath, JSON.stringify(resolvedUrls, null, 2));
  
  console.log('\n📊 Resolution Summary:');
  console.log(`✅ Resolved: ${Object.keys(resolvedUrls).length} tracks`);
  console.log(`❌ Failed: ${songs.length - Object.keys(resolvedUrls).length} tracks`);
  console.log(`\n💾 Saved to: ${outputPath}`);
  
  // Generate TypeScript code for the component
  console.log('\n📝 Update ITDVPlaylistAlbum.tsx with this mapping:\n');
  console.log('const AUDIO_URL_MAP: { [key: string]: string } = {');
  for (const [title, url] of Object.entries(resolvedUrls)) {
    console.log(`  "${title}": "${url}",`);
  }
  console.log('};\n');
}).catch(error => {
  console.error('Resolution failed:', error);
  process.exit(1);
});