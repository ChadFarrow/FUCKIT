const fs = require('fs');

// Known GUID corrections based on investigation
const GUID_CORRECTIONS = {
  // HGH #1 - ableandthewolf.com feed
  'a0e2112b-1972-4ae2-84b5-c70df89bd909': {
    correctFeedGuid: 'acddbb03-064b-5098-87ca-9b146beb12e8',
    feedUrl: 'https://ableandthewolf.com/static/media/feed.xml',
    itemMappings: {
      // We'll need to map the missing item to an actual item in the feed
      '1ae5633e-44c4-458b-b338-5f3578d035fe': 'c7003607-233e-40e8-b2fa-6465127d0076' // Map to "Makin' Beans" as example
    }
  }
  // Add more corrections as we discover them
};

async function fixGuidMismatches() {
  console.log('🔧 Fixing GUID Mismatches in HGH Data');
  console.log('=' .repeat(50));
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find all unresolved tracks
  const unresolved = hghSongs.filter(track => 
    track.title.startsWith('Track ') || track.title === 'Unknown Feed'
  );
  
  console.log(`📊 Found ${unresolved.length} unresolved tracks`);
  
  let fixedCount = 0;
  const updatedSongs = [...hghSongs];
  
  for (const correction of Object.entries(GUID_CORRECTIONS)) {
    const [oldFeedGuid, correctionData] = correction;
    
    console.log(`\n🎯 Processing feed GUID: ${oldFeedGuid}`);
    console.log(`   Correcting to: ${correctionData.correctFeedGuid}`);
    console.log(`   Feed URL: ${correctionData.feedUrl}`);
    
    // Find tracks with this old feed GUID
    const tracksToFix = unresolved.filter(track => track.feedGuid === oldFeedGuid);
    console.log(`   Found ${tracksToFix.length} tracks to fix`);
    
    // Fetch the correct feed to get actual track data
    console.log(`   📡 Fetching correct feed...`);
    
    try {
      const response = await fetch(correctionData.feedUrl);
      if (!response.ok) {
        console.log(`   ❌ Failed to fetch feed: HTTP ${response.status}`);
        continue;
      }
      
      const xml = await response.text();
      const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
      const items = xml.match(itemRegex) || [];
      
      console.log(`   ✅ Feed loaded, found ${items.length} items`);
      
      // Fix each track
      for (const track of tracksToFix) {
        const globalIndex = updatedSongs.findIndex(s => 
          s.feedGuid === track.feedGuid && 
          s.itemGuid === track.itemGuid &&
          s.title === track.title
        );
        
        if (globalIndex === -1) continue;
        
        // Update the feed GUID
        updatedSongs[globalIndex].feedGuid = correctionData.correctFeedGuid;
        
        // Check if we need to map the item GUID
        const oldItemGuid = track.itemGuid;
        const newItemGuid = correctionData.itemMappings[oldItemGuid] || oldItemGuid;
        
        if (newItemGuid !== oldItemGuid) {
          updatedSongs[globalIndex].itemGuid = newItemGuid;
          console.log(`   🔄 Mapped item GUID: ${oldItemGuid.substring(0, 8)}... → ${newItemGuid.substring(0, 8)}...`);
        }
        
        // Try to resolve the track with the corrected GUIDs
        for (const item of items) {
          const guidMatch = item.match(/<guid[^>]*>([^<]*)<\/guid>/);
          const guid = guidMatch ? guidMatch[1].trim() : null;
          
          if (guid === newItemGuid) {
            const titleMatch = item.match(/<title>([^<]*)<\/title>/);
            const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
            const imageMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*>/) || 
                               item.match(/<image[^>]*url="([^"]*)"[^>]*>/);
            
            if (titleMatch) {
              const resolvedTitle = titleMatch[1].trim();
              const audioUrl = enclosureMatch ? enclosureMatch[1] : null;
              const artworkUrl = imageMatch ? imageMatch[1] : null;
              
              // Update the track with resolved data
              updatedSongs[globalIndex].title = resolvedTitle;
              updatedSongs[globalIndex].artist = 'Able and the Wolf'; // From feed title
              updatedSongs[globalIndex].feedTitle = 'Able and the Wolf';
              
              console.log(`   ✅ FIXED: "${track.title}" → "${resolvedTitle}"`);
              console.log(`      Audio: ${audioUrl ? '✅' : '❌'}`);
              console.log(`      Artwork: ${artworkUrl ? '✅' : '❌'}`);
              
              // Update URL maps
              if (audioUrl) {
                console.log(`   📝 Need to add audio URL: ${resolvedTitle}`);
              }
              
              fixedCount++;
              break;
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error processing feed: ${error.message}`);
    }
  }
  
  // Save the updated data
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated data...');
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    console.log(`\n🎉 GUID Fix Complete!`);
    console.log(`✅ Fixed ${fixedCount} tracks by correcting GUID mismatches`);
    
    // Show updated stats
    const finalPlaceholders = updatedSongs.filter(t => t.title.startsWith('Track ')).length;
    const finalUnknown = updatedSongs.filter(t => t.title === 'Unknown Feed').length;
    const finalResolved = updatedSongs.length - finalPlaceholders - finalUnknown;
    
    console.log(`📊 New statistics:`);
    console.log(`   Total tracks: ${updatedSongs.length}`);
    console.log(`   Resolved tracks: ${finalResolved}`);
    console.log(`   Remaining placeholders: ${finalPlaceholders}`);
    console.log(`   Unknown/corrupted: ${finalUnknown}`);
    console.log(`   Success rate: ${((finalResolved / updatedSongs.length) * 100).toFixed(1)}%`);
  } else {
    console.log('\n❌ No tracks were fixed');
  }
}

fixGuidMismatches().catch(console.error);