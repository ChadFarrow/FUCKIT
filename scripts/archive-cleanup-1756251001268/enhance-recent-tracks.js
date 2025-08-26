const fs = require('fs');
const path = require('path');

async function enhanceRecentTracks() {
  try {
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log('🔍 Enhancing recently added tracks with better metadata...\n');
    
    let enhancedCount = 0;
    const now = new Date().toISOString();
    
    for (const track of musicTracks) {
      // Only enhance tracks that were added in this session (have source with batch info)
      if (track.source && track.source.includes('podcast:remoteItem (Batch') && !track.enhanced) {
        
        // Generate better placeholder title based on itemGuid
        const guidPrefix = track.itemGuid._ ? track.itemGuid._.substring(0, 8) : 'unknown';
        const guidSuffix = track.itemGuid._ ? track.itemGuid._.substring(24, 32) : 'unknown';
        
        // Enhanced placeholder data
        track.title = `Remote Track ${guidPrefix}...${guidSuffix}`;
        track.artist = 'Remote Artist (To Be Resolved)';
        track.album = 'Remote Album (To Be Resolved)';
        
        // Enhanced source tracking
        track.source = track.source.replace('podcast:remoteItem (', 'podcast:remoteItem - ');
        track.sourceType = 'remote-item';
        track.guidFormat = 'wavlake-uuid-v4';
        track.resolutionStatus = 'pending';
        
        // Enhanced timestamps
        if (!track.addedDate) {
          track.addedDate = now;
        }
        track.lastModified = now;
        track.modificationHistory = [
          {
            date: now,
            action: 'enhanced-metadata',
            description: 'Added placeholder titles, artist info, and enhanced tracking'
          }
        ];
        
        // Add resolution notes
        track.resolutionNotes = [
          'Track needs metadata resolution from Wavlake RSS feeds',
          'GUID format: Wavlake-specific UUID v4 (not Podcast Index compatible)',
          'Future resolution: Parse Wavlake RSS feeds for title, artist, duration, artwork'
        ];
        
        // Mark as enhanced
        track.enhanced = true;
        enhancedCount++;
        
        console.log(`  ✅ Enhanced: ${track.itemGuid._}`);
      }
    }
    
    if (enhancedCount > 0) {
      console.log(`\n💾 Saving enhanced database...`);
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      
      // Create backup
      const backupPath = path.join(__dirname, '..', 'data', `music-tracks-enhanced-${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
      
      console.log(`\n🎯 Enhancement Complete:`);
      console.log(`  Enhanced tracks: ${enhancedCount}`);
      console.log(`  Total tracks: ${musicTracks.length}`);
      console.log(`  Backup created: ${backupPath}`);
      
      // Show sample of enhanced track
      const sampleTrack = musicTracks.find(t => t.enhanced);
      if (sampleTrack) {
        console.log(`\n📝 Sample Enhanced Track:`);
        console.log(`  Title: ${sampleTrack.title}`);
        console.log(`  Artist: ${sampleTrack.artist}`);
        console.log(`  Source: ${sampleTrack.source}`);
        console.log(`  Status: ${sampleTrack.resolutionStatus}`);
        console.log(`  Added: ${sampleTrack.addedDate}`);
        console.log(`  Modified: ${sampleTrack.lastModified}`);
      }
    } else {
      console.log('ℹ️  No tracks found that need enhancement');
    }
    
  } catch (error) {
    console.error('❌ Error enhancing tracks:', error.message);
  }
}

enhanceRecentTracks();
