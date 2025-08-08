const fetch = require('node-fetch');

async function testMusicExtraction() {
  console.log('🎵 Testing Music Track Extraction...\n');
  
  const testUrl = 'http://localhost:3000/api/music-tracks?feedUrl=https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';
  
  try {
    console.log('📡 Fetching from:', testUrl);
    const response = await fetch(testUrl);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('📊 Extraction Stats:');
      console.log(`   Total Tracks: ${data.data.extractionStats.totalTracks}`);
      console.log(`   From Chapters: ${data.data.extractionStats.tracksFromChapters}`);
      console.log(`   From Value Splits: ${data.data.extractionStats.tracksFromValueSplits}`);
      console.log(`   From Description: ${data.data.extractionStats.tracksFromDescription}`);
      console.log(`   Related Feeds: ${data.data.extractionStats.relatedFeedsFound}`);
      console.log(`   Extraction Time: ${data.data.extractionStats.extractionTime}ms`);
      
      console.log('\n🎵 Discovered Tracks:');
      data.data.tracks.forEach((track, index) => {
        console.log(`   ${index + 1}. ${track.title} (${track.source})`);
        console.log(`      Artist: ${track.artist}`);
        console.log(`      Episode: ${track.episodeTitle}`);
        if (track.startTime > 0) {
          console.log(`      Time: ${track.startTime}s - ${track.endTime}s`);
        }
        console.log('');
      });
      
      if (data.data.relatedFeeds.length > 0) {
        console.log('🔗 Related Feeds:');
        data.data.relatedFeeds.forEach((feed, index) => {
          console.log(`   ${index + 1}. ${feed.title}`);
          console.log(`      URL: ${feed.feedUrl}`);
          console.log(`      Relationship: ${feed.relationship}`);
          console.log('');
        });
      }
      
    } else {
      console.log('❌ Error:', data.error);
      console.log('Details:', data.details);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Wait a moment for the server to start, then test
setTimeout(testMusicExtraction, 3000); 