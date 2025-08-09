const fs = require('fs');

async function investigateProblematicFeeds() {
  console.log('🔍 Investigating Problematic Feed GUIDs');
  console.log('=' .repeat(60));
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find all remaining unresolved tracks
  const unresolved = hghSongs.filter(track => 
    track.title.startsWith('Track ') || track.title === 'Unknown Feed'
  );
  
  console.log(`📊 Found ${unresolved.length} unresolved tracks`);
  
  // Count frequency of each feed GUID
  const feedGuidCounts = {};
  unresolved.forEach(track => {
    feedGuidCounts[track.feedGuid] = (feedGuidCounts[track.feedGuid] || 0) + 1;
  });
  
  // Sort by frequency
  const sortedFeeds = Object.entries(feedGuidCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 most problematic
  
  console.log('\n🎯 Top 10 Most Problematic Feed GUIDs:');
  console.log('-' .repeat(60));
  
  sortedFeeds.forEach(([feedGuid, count], index) => {
    console.log(`${index + 1}. ${feedGuid} (${count} tracks)`);
  });
  
  console.log('\n🔍 Investigating each problematic feed...\n');
  
  // Known feed URLs we can try based on patterns or common podcast hosting
  const knownFeedPatterns = [
    // RSS Blue feeds
    { pattern: /^[a-f0-9-]+$/, baseUrl: 'https://feeds.rssblue.com/' },
    // Common feed locations
    { pattern: /fc815bcf-3639-5395-ba7d-fa217ec93d32/, url: 'https://music.behindthesch3m3s.com/wp-content/uploads/Delta_OG/Aged_Friends_and_Old_Whiskey/aged_friends_old_whiskey.xml' },
    { pattern: /c989830b-49a1-572f-9f0e-0fec994a6d5a/, url: 'https://static.staticsave.com/mspfiles/waytogo.xml' },
    { pattern: /8b4358f8-1c21-5977-8674-d21113719ccf/, url: 'https://thebearsnare.com/67thunbeat2.xml' },
    { pattern: /659f95a4-1291-5e03-ab86-2deac518f652/, url: 'https://music.behindthesch3m3s.com/wp-content/uploads/TCTC/TCTC_Feed.xml' },
    { pattern: /8b41f7f4-2cc3-5a03-90f5-6c54e92bc96b/, url: 'https://music.behindthesch3m3s.com/wp-content/uploads/OVVRDOS/ovvr_not_under.xml' }
  ];
  
  const investigations = [];
  
  for (const [feedGuid, count] of sortedFeeds) {
    console.log(`🔍 Investigating ${feedGuid} (${count} tracks):`);
    
    // Find a sample track for this feed
    const sampleTrack = unresolved.find(t => t.feedGuid === feedGuid);
    if (!sampleTrack) continue;
    
    let potentialUrls = [];
    
    // Check if we have known patterns
    for (const pattern of knownFeedPatterns) {
      if (pattern.url && pattern.pattern.test(feedGuid)) {
        potentialUrls.push(pattern.url);
      } else if (pattern.baseUrl && pattern.pattern.test(feedGuid)) {
        // For RSS Blue, try common feed name patterns
        potentialUrls.push(`${pattern.baseUrl}feed-${feedGuid.split('-')[0]}`);
        potentialUrls.push(`${pattern.baseUrl}${feedGuid}`);
      }
    }
    
    // Try Podcast Index API to get feed URL
    try {
      console.log(`   📡 Checking Podcast Index API...`);
      const apiKey = 'VPFJTBBSB9KSPUZJZ3TF';
      const apiSecret = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';
      const authDate = Math.floor(Date.now() / 1000);
      const toHash = apiKey + apiSecret + authDate;
      const hash = require('crypto').createHash('sha1').update(toHash).digest('hex');
      
      const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}&pretty`;
      const response = await fetch(feedUrl, {
        headers: {
          'X-Auth-Date': authDate.toString(),
          'X-Auth-Key': apiKey,
          'Authorization': hash,
          'User-Agent': 'FUCKIT-Music-Site/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.feed?.url) {
          potentialUrls.unshift(data.feed.url); // Add to front of list
          console.log(`   ✅ Found via API: ${data.feed.url}`);
          console.log(`   📝 Feed title: ${data.feed.title}`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️ API error: ${error.message}`);
    }
    
    // Test each potential URL
    for (const testUrl of potentialUrls) {
      try {
        console.log(`   🌐 Testing: ${testUrl}`);
        const testResponse = await fetch(testUrl);
        
        if (testResponse.ok) {
          const xml = await testResponse.text();
          
          // Check if it's a valid RSS feed
          if (xml.includes('<rss') || xml.includes('<feed')) {
            // Extract feed GUID
            const feedGuidMatch = xml.match(/<podcast:guid[^>]*>([^<]*)<\/podcast:guid>/);
            const actualFeedGuid = feedGuidMatch ? feedGuidMatch[1].trim() : null;
            
            // Count items
            const itemCount = (xml.match(/<item[^>]*>/g) || []).length;
            
            console.log(`   ✅ WORKING FEED FOUND!`);
            console.log(`      URL: ${testUrl}`);
            console.log(`      Items: ${itemCount}`);
            if (actualFeedGuid) {
              console.log(`      Feed GUID: ${actualFeedGuid}`);
              if (actualFeedGuid !== feedGuid) {
                console.log(`      🔧 GUID MISMATCH - can be corrected!`);
              }
            }
            
            investigations.push({
              oldFeedGuid: feedGuid,
              newFeedGuid: actualFeedGuid || feedGuid,
              feedUrl: testUrl,
              trackCount: count,
              itemCount: itemCount,
              canFix: actualFeedGuid !== feedGuid || itemCount > 0
            });
            
            break; // Found working feed, move to next
          }
        }
      } catch (error) {
        // Ignore fetch errors, continue testing
      }
    }
    
    console.log(''); // Space between investigations
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n📋 INVESTIGATION SUMMARY:');
  console.log('=' .repeat(60));
  
  const fixable = investigations.filter(i => i.canFix);
  const totalFixableTracks = fixable.reduce((sum, inv) => sum + inv.trackCount, 0);
  
  console.log(`Found ${investigations.length} working feeds`);
  console.log(`Fixable feeds: ${fixable.length}`);
  console.log(`Tracks that can be fixed: ${totalFixableTracks}`);
  
  if (fixable.length > 0) {
    console.log('\n🔧 Feeds that can be fixed:');
    fixable.forEach(inv => {
      console.log(`   ${inv.oldFeedGuid} → ${inv.newFeedGuid}`);
      console.log(`      ${inv.trackCount} tracks, ${inv.itemCount} items in feed`);
      console.log(`      ${inv.feedUrl}`);
    });
    
    // Generate correction data for the fix script
    console.log('\n💻 GUID_CORRECTIONS data for fix script:');
    console.log('const GUID_CORRECTIONS = {');
    fixable.forEach(inv => {
      console.log(`  '${inv.oldFeedGuid}': {`);
      console.log(`    correctFeedGuid: '${inv.newFeedGuid}',`);
      console.log(`    feedUrl: '${inv.feedUrl}',`);
      console.log(`    itemMappings: {} // Will need manual mapping`);
      console.log(`  },`);
    });
    console.log('};');
  }
}

investigateProblematicFeeds().catch(console.error);