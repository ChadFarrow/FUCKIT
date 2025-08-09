const fs = require('fs');

async function checkHGH1Feed() {
  console.log('🔍 Checking HGH #1 Feed: https://ableandthewolf.com/static/media/feed.xml');
  console.log('=' .repeat(70));
  
  // First, let's find the exact track from HGH #1 that's missing
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  const hgh1Missing = hghSongs.filter(track => 
    (track.title === 'Unknown Feed' || track.title.startsWith('Track ')) &&
    track.feedGuid === 'a0e2112b-1972-4ae2-84b5-c70df89bd909'
  );
  
  console.log(`📊 Found ${hgh1Missing.length} missing tracks from HGH #1:`);
  hgh1Missing.forEach(track => {
    console.log(`   Title: ${track.title}`);
    console.log(`   Feed GUID: ${track.feedGuid}`);
    console.log(`   Item GUID: ${track.itemGuid}`);
    console.log('');
  });
  
  if (hgh1Missing.length === 0) {
    console.log('✅ No missing tracks found from HGH #1');
    return;
  }
  
  // Now fetch the feed from the URL you provided
  console.log('📡 Fetching feed from https://ableandthewolf.com/static/media/feed.xml...');
  
  try {
    const response = await fetch('https://ableandthewolf.com/static/media/feed.xml');
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }
    
    const xml = await response.text();
    console.log(`✅ Feed fetched successfully (${xml.length} characters)`);
    
    // Parse the feed to look for the missing item GUIDs
    console.log('\n🔍 Searching for missing items in the feed...');
    
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const items = xml.match(itemRegex) || [];
    
    console.log(`📊 Found ${items.length} items in the feed`);
    
    hgh1Missing.forEach(missingTrack => {
      console.log(`\n🎯 Looking for Item GUID: ${missingTrack.itemGuid}`);
      
      let found = false;
      
      for (const item of items) {
        // Check if this item has the matching GUID
        const guidMatch = item.match(/<guid[^>]*>([^<]*)<\/guid>/);
        const guid = guidMatch ? guidMatch[1].trim() : null;
        
        if (guid === missingTrack.itemGuid) {
          found = true;
          
          // Extract episode details
          const titleMatch = item.match(/<title>([^<]*)<\/title>/);
          const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
          const imageMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*>/) || 
                             item.match(/<image[^>]*url="([^"]*)"[^>]*>/);
          
          const title = titleMatch ? titleMatch[1].trim() : 'No Title Found';
          const audioUrl = enclosureMatch ? enclosureMatch[1] : 'No Audio URL';
          const artworkUrl = imageMatch ? imageMatch[1] : 'No Artwork';
          
          console.log(`   ✅ FOUND! Title: "${title}"`);
          console.log(`   🎧 Audio URL: ${audioUrl}`);
          console.log(`   🖼️ Artwork: ${artworkUrl}`);
          
          // Check if this matches what we expect
          if (title !== 'No Title Found' && audioUrl !== 'No Audio URL') {
            console.log(`   💡 This track CAN be resolved!`);
            console.log(`   🔧 Should update: "${missingTrack.title}" → "${title}"`);
          }
          
          break;
        }
      }
      
      if (!found) {
        console.log(`   ❌ Item GUID not found in this feed`);
        
        // Let's also check if the feed GUID in our data is correct
        const channelMatch = xml.match(/<podcast:guid[^>]*>([^<]*)<\/podcast:guid>/);
        const feedGuid = channelMatch ? channelMatch[1].trim() : null;
        
        if (feedGuid) {
          console.log(`   📋 Feed's actual GUID: ${feedGuid}`);
          if (feedGuid !== missingTrack.feedGuid) {
            console.log(`   ⚠️ GUID MISMATCH! Expected: ${missingTrack.feedGuid}`);
          }
        } else {
          console.log(`   ⚠️ No podcast:guid found in feed`);
        }
      }
    });
    
    // Also show a sample of what's actually in the feed
    console.log('\n📋 Sample items from the feed:');
    items.slice(0, 5).forEach((item, index) => {
      const titleMatch = item.match(/<title>([^<]*)<\/title>/);
      const guidMatch = item.match(/<guid[^>]*>([^<]*)<\/guid>/);
      
      const title = titleMatch ? titleMatch[1].trim() : 'No Title';
      const guid = guidMatch ? guidMatch[1].trim() : 'No GUID';
      
      console.log(`   ${index + 1}. "${title}"`);
      console.log(`      GUID: ${guid}`);
    });
    
  } catch (error) {
    console.log(`❌ Error fetching feed: ${error.message}`);
  }
}

checkHGH1Feed().catch(console.error);