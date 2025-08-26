const fs = require('fs');
const path = require('path');

async function diagnoseFeedAccessibility() {
  try {
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    // Get all remote item tracks
    const remoteTracks = musicTracks.filter(track => 
      track.itemGuid && track.itemGuid._ && 
      track.resolutionStatus === 'pending'
    );
    
    console.log(`🔍 Diagnosing feed accessibility for ${remoteTracks.length} tracks...\n`);
    
    // Group by feedGuid
    const feedGroups = {};
    remoteTracks.forEach(track => {
      const feedGuid = track.feedGuid;
      if (!feedGroups[feedGuid]) {
        feedGroups[feedGuid] = [];
      }
      feedGroups[feedGuid].push(track);
    });
    
    console.log(`📊 Found ${Object.keys(feedGroups).length} unique feeds to test\n`);
    
    const accessibleFeeds = [];
    const inaccessibleFeeds = [];
    
    // Test each feed
    for (const [feedGuid, tracks] of Object.entries(feedGroups)) {
      const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
      
      try {
        const response = await fetch(feedUrl);
        if (response.ok) {
          accessibleFeeds.push({ feedGuid, trackCount: tracks.length, url: feedUrl });
          console.log(`✅ Accessible: ${feedGuid} (${tracks.length} tracks)`);
        } else {
          inaccessibleFeeds.push({ feedGuid, trackCount: tracks.length, url: feedUrl, status: response.status });
          console.log(`❌ Inaccessible: ${feedGuid} (${tracks.length} tracks) - HTTP ${response.status}`);
        }
      } catch (error) {
        inaccessibleFeeds.push({ feedGuid, trackCount: tracks.length, url: feedUrl, error: error.message });
        console.log(`❌ Error: ${feedGuid} (${tracks.length} tracks) - ${error.message}`);
      }
      
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    console.log(`\n📊 DIAGNOSIS SUMMARY:`);
    console.log(`  Total feeds tested: ${Object.keys(feedGroups).length}`);
    console.log(`  Accessible feeds: ${accessibleFeeds.length}`);
    console.log(`  Inaccessible feeds: ${inaccessibleFeeds.length}`);
    console.log(`  Total tracks in accessible feeds: ${accessibleFeeds.reduce((sum, f) => sum + f.trackCount, 0)}`);
    console.log(`  Total tracks in inaccessible feeds: ${inaccessibleFeeds.reduce((sum, f) => sum + f.trackCount, 0)}`);
    
    if (inaccessibleFeeds.length > 0) {
      console.log(`\n❌ INACCESSIBLE FEEDS:`);
      inaccessibleFeeds.forEach(feed => {
        console.log(`  ${feed.feedGuid} (${feed.trackCount} tracks) - ${feed.status || feed.error}`);
      });
    }
    
    if (accessibleFeeds.length > 0) {
      console.log(`\n✅ ACCESSIBLE FEEDS:`);
      accessibleFeeds.slice(0, 10).forEach(feed => {
        console.log(`  ${feed.feedGuid} (${feed.tracks} tracks)`);
      });
      if (accessibleFeeds.length > 10) {
        console.log(`  ... and ${accessibleFeeds.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in diagnosis:', error.message);
  }
}

diagnoseFeedAccessibility();
