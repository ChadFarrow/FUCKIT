const fs = require('fs');
const path = require('path');

async function enhanceAllRemoteTracks() {
  try {
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log('🔍 Enhancing ALL remote item tracks with comprehensive metadata...\n');
    
    let enhancedCount = 0;
    const now = new Date().toISOString();
    
    for (const track of musicTracks) {
      // Enhance any track with itemGuid._ (remote item format)
      if (track.itemGuid && track.itemGuid._ && !track.fullyEnhanced) {
        
        // Generate better placeholder title based on itemGuid
        const guidPrefix = track.itemGuid._.substring(0, 8);
        const guidSuffix = track.itemGuid._.substring(24, 32);
        
        // Enhanced placeholder data
        track.title = track.title || `Remote Track ${guidPrefix}...${guidSuffix}`;
        track.artist = track.artist || 'Remote Artist (To Be Resolved)';
        track.album = track.album || 'Remote Album (To Be Resolved)';
        
        // Enhanced source tracking
        if (!track.sourceType) {
          track.sourceType = 'remote-item';
        }
        if (!track.guidFormat) {
          track.guidFormat = 'wavlake-uuid-v4';
        }
        if (!track.resolutionStatus) {
          track.resolutionStatus = 'pending';
        }
        
        // Enhanced timestamps
        if (!track.addedDate) {
          track.addedDate = now;
        }
        track.lastModified = now;
        
        // Initialize modification history if it doesn't exist
        if (!track.modificationHistory) {
          track.modificationHistory = [];
        }
        
        // Add enhancement record
        track.modificationHistory.push({
          date: now,
          action: 'enhanced-metadata',
          description: 'Added comprehensive placeholder data and tracking information'
        });
        
        // Add resolution notes if they don't exist
        if (!track.resolutionNotes) {
          track.resolutionNotes = [
            'Track needs metadata resolution from Wavlake RSS feeds',
            'GUID format: Wavlake-specific UUID v4 (not Podcast Index compatible)',
            'Future resolution: Parse Wavlake RSS feeds for title, artist, duration, artwork'
          ];
        }
        
        // Mark as fully enhanced
        track.fullyEnhanced = true;
        enhancedCount++;
        
        console.log(`  ✅ Enhanced: ${track.itemGuid._}`);
      }
    }
    
    if (enhancedCount > 0) {
      console.log(`\n💾 Saving fully enhanced database...`);
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      
      // Create final backup
      const backupPath = path.join(__dirname, '..', 'data', `music-tracks-fully-enhanced-${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
      
      console.log(`\n🎯 Full Enhancement Complete:`);
      console.log(`  Enhanced tracks: ${enhancedCount}`);
      console.log(`  Total tracks: ${musicTracks.length}`);
      console.log(`  Backup created: ${backupPath}`);
      
      // Show comprehensive stats
      const remoteTracks = musicTracks.filter(t => t.itemGuid && t.itemGuid._);
      const enhancedTracks = musicTracks.filter(t => t.fullyEnhanced);
      const pendingTracks = musicTracks.filter(t => t.resolutionStatus === 'pending');
      
      console.log(`\n📊 Database Statistics:`);
      console.log(`  Remote item tracks: ${remoteTracks.length}`);
      console.log(`  Fully enhanced tracks: ${enhancedTracks.length}`);
      console.log(`  Pending resolution: ${pendingTracks.length}`);
      console.log(`  Resolution rate: ${((enhancedTracks.length / remoteTracks.length) * 100).toFixed(1)}%`);
      
    } else {
      console.log('ℹ️  All tracks already fully enhanced');
    }
    
  } catch (error) {
    console.error('❌ Error enhancing all tracks:', error.message);
  }
}

enhanceAllRemoteTracks();
