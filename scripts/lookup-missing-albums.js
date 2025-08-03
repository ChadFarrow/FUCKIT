#!/usr/bin/env node

/**
 * Script to look up missing album GUIDs using existing Podcast Index API
 * This will help us identify the real album names and feed URLs
 * for the tracks found in V4V time splits
 */

const missingGuids = [
  { guid: 'bba99401-378c-5540-bf95-c456b3d4de26', timeRange: '11:06-14:27' },
  { guid: '69c634ad-afea-5826-ad9a-8e1f06d6470b', timeRange: '19:02-23:33' },
  { guid: '1e7ed1fa-0456-5860-9b34-825d1335d8f8', timeRange: '55:44-59:30' },
  { guid: 'c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b', timeRange: '1:04:00-1:07:12' },
];

async function lookupMissingAlbums() {
  console.log('🔍 Looking up missing album GUIDs in Podcast Index...\n');
  
  const results = [];
  
  for (const { guid, timeRange } of missingGuids) {
    try {
      console.log(`Looking up GUID: ${guid} (Time: ${timeRange})`);
      
      // Use your existing Podcast Index API endpoint
      const response = await fetch(`http://localhost:3001/api/podcastindex?guid=${guid}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Found: ${data.title || 'Unknown Title'}`);
        console.log(`  🔗 Feed URL: ${data.feedUrl || 'Unknown URL'}`);
        console.log(`  📖 Artist: ${data.artist || 'Unknown Artist'}`);
        console.log(`  ⏰ Duration: ${data.duration || 'Unknown'}`);
        console.log('');
        
        results.push({
          guid,
          timeRange,
          title: data.title || 'Unknown Title',
          feedUrl: data.feedUrl || 'Unknown URL',
          artist: data.artist || 'Unknown Artist',
          duration: data.duration || 'Unknown'
        });
      } else {
        console.log(`  ❌ Not found in Podcast Index`);
        console.log(`  📝 Placeholder: Unknown Album (${guid.slice(0, 8)})`);
        console.log(`  🔗 Feed URL: https://www.doerfelverse.com/feeds/unknown-${guid.slice(0, 8)}.xml`);
        console.log('');
        
        results.push({
          guid,
          timeRange,
          title: `Unknown Album (${guid.slice(0, 8)})`,
          feedUrl: `https://www.doerfelverse.com/feeds/unknown-${guid.slice(0, 8)}.xml`,
          artist: 'Unknown Artist',
          duration: 'Unknown'
        });
      }
      
    } catch (error) {
      console.error(`❌ Error looking up GUID ${guid}:`, error.message);
      results.push({
        guid,
        timeRange,
        title: `Error: ${error.message}`,
        feedUrl: 'Error',
        artist: 'Error',
        duration: 'Error'
      });
    }
  }
  
  console.log('📋 Summary of missing albums:');
  console.log('=====================================');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   Time: ${result.timeRange}`);
    console.log(`   Artist: ${result.artist}`);
    console.log(`   Feed URL: ${result.feedUrl}`);
    console.log(`   GUID: ${result.guid}`);
    console.log('');
  });
  
  console.log('📝 Next steps:');
  console.log('1. Update the doerfels-pubfeed route with the correct information above');
  console.log('2. Add the albums to your local catalog for full integration');
  console.log('3. Update the album mapping in AlbumDetailClient.tsx');
  console.log('4. Test the integration on your site');
  
  return results;
}

// Run the lookup
lookupMissingAlbums().catch(console.error); 