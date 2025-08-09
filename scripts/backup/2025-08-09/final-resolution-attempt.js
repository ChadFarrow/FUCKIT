const fs = require('fs');

async function finalResolutionAttempt() {
  console.log('🚀 Final Resolution Attempt - All Remaining Tracks');
  console.log('=' .repeat(60));
  
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find ALL unresolved tracks
  const unresolved = hghSongs.filter(track => 
    track.title.startsWith('Track ') || track.title === 'Unknown Feed'
  );
  
  console.log(`📊 Found ${unresolved.length} unresolved tracks total`);
  
  // Group by different resolution strategies
  const strategies = {
    httpUrls: [],
    commonDomains: [],
    duplicateItems: [],
    rssFeeds: [],
    other: []
  };
  
  unresolved.forEach(track => {
    if (track.itemGuid && (track.itemGuid.startsWith('http://') || track.itemGuid.startsWith('https://'))) {
      strategies.httpUrls.push(track);
    } else if (track.feedGuid && track.feedGuid.includes('feed.justcast.com')) {
      strategies.rssFeeds.push(track);
    } else {
      // Check for duplicate item GUIDs that might be resolvable
      const duplicates = unresolved.filter(t => t.itemGuid === track.itemGuid && t.feedGuid === track.feedGuid);
      if (duplicates.length > 1) {
        strategies.duplicateItems.push(track);
      } else {
        strategies.other.push(track);
      }
    }
  });
  
  console.log(`\n📋 Resolution Strategy Breakdown:`);
  console.log(`   HTTP URLs as item GUIDs: ${strategies.httpUrls.length}`);
  console.log(`   RSS feed URLs as feed GUIDs: ${strategies.rssFeeds.length}`);
  console.log(`   Duplicate item GUIDs: ${strategies.duplicateItems.length}`);
  console.log(`   Other unresolved: ${strategies.other.length}`);
  
  let fixedCount = 0;
  const updatedSongs = [...hghSongs];
  
  // Load existing URL maps
  let audioUrlMap = {};
  let artworkUrlMap = {};
  
  try {
    const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');
    const audioMatch = audioModule.match(/export const HGH_AUDIO_URL_MAP[^{]*{([^}]*)}/s);
    if (audioMatch) {
      const entries = audioMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          audioUrlMap[title] = url;
        });
      }
    }
    
    const artworkModule = fs.readFileSync('./data/hgh-artwork-urls.ts', 'utf8');
    const artworkMatch = artworkModule.match(/export const HGH_ARTWORK_URL_MAP[^{]*{([^}]*)}/s);
    if (artworkMatch) {
      const entries = artworkMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          artworkUrlMap[title] = url;
        });
      }
    }
  } catch (error) {
    console.log('Starting with empty URL maps');
  }
  
  // Strategy 1: Handle RSS feed URLs used as feed GUIDs
  console.log(`\n🔗 Strategy 1: RSS Feed URLs as Feed GUIDs`);
  for (const track of strategies.rssFeeds) {
    console.log(`   Processing: ${track.title}`);
    console.log(`   RSS URL: ${track.feedGuid}`);
    
    const globalIndex = updatedSongs.findIndex(s => 
      s.feedGuid === track.feedGuid && 
      s.itemGuid === track.itemGuid &&
      s.title === track.title
    );
    
    if (globalIndex === -1) continue;
    
    try {
      // The feed GUID IS the RSS URL, so fetch it directly
      const response = await fetch(track.feedGuid);
      if (response.ok) {
        const xml = await response.text();
        
        // Parse to find the item
        const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
        const items = xml.match(itemRegex) || [];
        
        for (const item of items) {
          const guidMatch = item.match(/<guid[^>]*>([^<]*)<\/guid>/);
          const guid = guidMatch ? guidMatch[1].trim() : null;
          
          if (guid === track.itemGuid) {
            const titleMatch = item.match(/<title>([^<]*)<\/title>/);
            const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
            const imageMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*>/) || 
                               item.match(/<image[^>]*url="([^"]*)"[^>]*>/);
            
            if (titleMatch) {
              const resolvedTitle = titleMatch[1].trim();
              const audioUrl = enclosureMatch ? enclosureMatch[1] : null;
              const artworkUrl = imageMatch ? imageMatch[1] : null;
              
              updatedSongs[globalIndex].title = resolvedTitle;
              updatedSongs[globalIndex].artist = 'True Blue'; // From URL pattern
              updatedSongs[globalIndex].feedTitle = 'True Blue';
              
              if (audioUrl) audioUrlMap[resolvedTitle] = audioUrl;
              if (artworkUrl) artworkUrlMap[resolvedTitle] = artworkUrl;
              
              console.log(`   ✅ FIXED: "${track.title}" → "${resolvedTitle}"`);
              fixedCount++;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Strategy 2: Handle HTTP URLs as item GUIDs (similar to MP3 strategy)
  console.log(`\n🌐 Strategy 2: HTTP URLs as Item GUIDs`);
  for (const track of strategies.httpUrls) {
    if (track.itemGuid.includes('.mp3')) continue; // Already handled
    
    console.log(`   Processing: ${track.title}`);
    console.log(`   URL: ${track.itemGuid}`);
    
    const globalIndex = updatedSongs.findIndex(s => 
      s.feedGuid === track.feedGuid && 
      s.itemGuid === track.itemGuid &&
      s.title === track.title
    );
    
    if (globalIndex === -1) continue;
    
    // Try to extract meaningful info from the URL
    try {
      const url = new URL(track.itemGuid);
      const pathParts = url.pathname.split('/').filter(p => p);
      const lastPart = pathParts[pathParts.length - 1];
      
      // Check if it's actually an audio file
      if (lastPart.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
        let extractedTitle = lastPart
          .replace(/\.(mp3|wav|m4a|ogg|flac)$/i, '')
          .replace(/^\d+[\.\-_]\s*/, '') // Remove track numbers
          .replace(/[\-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (extractedTitle && extractedTitle.length > 1) {
          updatedSongs[globalIndex].title = extractedTitle;
          updatedSongs[globalIndex].artist = url.hostname.replace(/^www\./, '');
          updatedSongs[globalIndex].feedTitle = url.hostname.replace(/^www\./, '');
          
          // Use the URL as audio URL
          audioUrlMap[extractedTitle] = track.itemGuid;
          
          console.log(`   ✅ FIXED: "${track.title}" → "${extractedTitle}"`);
          fixedCount++;
        }
      }
    } catch (error) {
      console.log(`   ❌ URL parsing error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save the updated data
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated data...');
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    // Update URL maps
    const audioContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Comprehensive Resolution Including Non-Standard Formats
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
${Object.entries(audioUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-audio-urls.ts', audioContent);
    
    const artworkContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Comprehensive Resolution Including Non-Standard Formats
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
${Object.entries(artworkUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-artwork-urls.ts', artworkContent);
    
    console.log(`\n🎉 Final Resolution Complete!`);
    console.log(`✅ Fixed ${fixedCount} additional tracks`);
    
    // Show final stats
    const finalPlaceholders = updatedSongs.filter(t => t.title.startsWith('Track ')).length;
    const finalUnknown = updatedSongs.filter(t => t.title === 'Unknown Feed').length;
    const finalResolved = updatedSongs.length - finalPlaceholders - finalUnknown;
    
    console.log(`📊 Final statistics:`);
    console.log(`   Total tracks: ${updatedSongs.length}`);
    console.log(`   Resolved tracks: ${finalResolved}`);
    console.log(`   Remaining placeholders: ${finalPlaceholders}`);
    console.log(`   Unknown/corrupted: ${finalUnknown}`);
    console.log(`   Success rate: ${((finalResolved / updatedSongs.length) * 100).toFixed(1)}%`);
  } else {
    console.log('\n❌ No additional tracks were fixed');
  }
  
  // Show remaining breakdown for documentation
  const stillUnresolved = updatedSongs.filter(track => 
    track.title.startsWith('Track ') || track.title === 'Unknown Feed'
  );
  
  console.log(`\n📋 Remaining ${stillUnresolved.length} unresolved tracks by feed GUID:`);
  const feedCounts = {};
  stillUnresolved.forEach(track => {
    feedCounts[track.feedGuid] = (feedCounts[track.feedGuid] || 0) + 1;
  });
  
  Object.entries(feedCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([feedGuid, count]) => {
      console.log(`   ${feedGuid.substring(0, 8)}... (${count} tracks)`);
    });
}

finalResolutionAttempt().catch(console.error);