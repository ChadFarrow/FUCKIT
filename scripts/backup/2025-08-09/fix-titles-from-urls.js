const fs = require('fs');
const crypto = require('crypto');

// API credentials for getting feed URLs
const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

function createAuthHash(apiKey, apiSecret, authDate) {
  const toHash = apiKey + apiSecret + authDate;
  return crypto.createHash('sha1').update(toHash).digest('hex');
}

// Parse RSS feed directly to find episodes
async function parseRSSFeed(feedUrl, itemGuid) {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      return null;
    }
    
    const xml = await response.text();
    
    // Simple XML parsing to find the episode with matching GUID
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const items = xml.match(itemRegex) || [];
    
    for (const item of items) {
      // Check if this item has the matching GUID
      const guidMatch = item.match(/<guid[^>]*>([^<]*)<\/guid>/);
      const guid = guidMatch ? guidMatch[1].trim() : null;
      
      if (guid === itemGuid) {
        // Extract episode details
        const titleMatch = item.match(/<title>([^<]*)<\/title>/);
        const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
        const imageMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*>/) || 
                           item.match(/<image[^>]*url="([^"]*)"[^>]*>/);
        
        return {
          title: titleMatch ? titleMatch[1].trim() : 'Unknown Title',
          audioUrl: enclosureMatch ? enclosureMatch[1] : null,
          artworkUrl: imageMatch ? imageMatch[1] : null
        };
      }
    }
    
    return null;
  } catch (error) {
    console.log(`   ⚠️ RSS parsing error: ${error.message}`);
    return null;
  }
}

async function fixPlaceholderTitle(track, index, total) {
  try {
    console.log(`🔍 ${index}/${total}: Resolving "${track.title}"`);
    console.log(`   Feed GUID: ${track.feedGuid}`);
    console.log(`   Item GUID: ${track.itemGuid}`);
    
    // First get feed URL from Podcast Index
    const authDate = Math.floor(Date.now() / 1000);
    const hash = createAuthHash(apiKey, apiSecret, authDate);
    
    const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${track.feedGuid}&pretty`;
    
    const feedResponse = await fetch(feedUrl, {
      headers: {
        'X-Auth-Date': authDate.toString(),
        'X-Auth-Key': apiKey,
        'Authorization': hash,
        'User-Agent': 'FUCKIT-Music-Site/1.0'
      }
    });

    if (!feedResponse.ok) {
      console.log(`   ❌ Feed lookup failed: HTTP ${feedResponse.status}`);
      return null;
    }

    const feedData = await feedResponse.json();
    
    if (!feedData.feed || !feedData.feed.url) {
      console.log(`   ❌ No feed URL available`);
      return null;
    }

    console.log(`   ✅ Found RSS feed: ${feedData.feed.url}`);
    console.log(`   📡 Parsing RSS directly...`);

    // Parse the RSS feed directly
    const rssResult = await parseRSSFeed(feedData.feed.url, track.itemGuid);
    
    if (rssResult && rssResult.title !== 'Unknown Title') {
      console.log(`   🎵 FOUND REAL TITLE: "${rssResult.title}"`);
      
      return {
        title: rssResult.title,
        artist: feedData.feed.title || 'HGH Artist',
        feedTitle: feedData.feed.title || 'Unknown Feed',
        duration: 180, // Default duration
        audioUrl: rssResult.audioUrl,
        artworkUrl: rssResult.artworkUrl || feedData.feed.artwork || feedData.feed.image
      };
    } else {
      console.log(`   ❌ Could not resolve title`);
      return null;
    }
    
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 Fix HGH Track Titles - Direct RSS Resolution');
  console.log('=' .repeat(55));
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find placeholder tracks only
  const placeholderTracks = hghSongs.filter(track => track.title.startsWith('Track '));
  
  console.log(`📊 Analysis:`);
  console.log(`   Total tracks: ${hghSongs.length}`);
  console.log(`   Placeholder tracks to fix: ${placeholderTracks.length}`);
  console.log('');
  
  if (placeholderTracks.length === 0) {
    console.log('✅ No placeholder tracks to fix!');
    return;
  }
  
  let fixedCount = 0;
  let updatedSongs = [...hghSongs];
  
  // Process ALL remaining placeholder tracks
  const testTracks = placeholderTracks;
  console.log(`🎯 Fixing titles for ${testTracks.length} placeholder tracks...`);
  
  for (let i = 0; i < testTracks.length; i++) {
    const track = testTracks[i];
    const globalIndex = hghSongs.findIndex(s => s.feedGuid === track.feedGuid && s.itemGuid === track.itemGuid);
    
    const resolved = await fixPlaceholderTitle(track, i + 1, testTracks.length);
    
    if (resolved && globalIndex !== -1) {
      // Update the track title and metadata
      updatedSongs[globalIndex] = {
        ...updatedSongs[globalIndex],
        title: resolved.title,
        artist: resolved.artist,
        feedTitle: resolved.feedTitle,
        duration: resolved.duration
      };
      
      console.log(`   ✅ FIXED: "${track.title}" → "${resolved.title}"`);
      fixedCount++;
    }
    
    console.log(''); // Space between tracks
    
    // Faster rate limiting 
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Save updated data if we fixed anything
  if (fixedCount > 0) {
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    console.log(`\n🎉 Successfully fixed ${fixedCount}/${testTracks.length} track titles!`);
    console.log(`📊 Remaining placeholder tracks: ${placeholderTracks.length - fixedCount}`);
    console.log('\n💡 If test successful, modify script to process all tracks');
  } else {
    console.log('\n❌ No track titles were fixed');
  }
}

main().catch(console.error);