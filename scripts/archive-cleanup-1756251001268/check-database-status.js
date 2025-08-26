const fs = require('fs');
const path = require('path');

try {
  const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
  const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  const musicTracks = musicData.musicTracks || musicData;
  
  console.log('📊 Database Status:');
  console.log(`Total tracks: ${musicTracks.length}`);
  console.log(`Tracks with podcast:remoteItem format: ${musicTracks.filter(t => t.itemGuid && t.itemGuid._).length}`);
  console.log(`Tracks with placeholder status: ${musicTracks.filter(t => t.note && t.note.includes('placeholder')).length}`);
  console.log(`Tracks with resolved metadata: ${musicTracks.filter(t => t.title && t.artist && t.duration).length}`);
  
  // Check for the specific track from the example feed
  const exampleTrack = musicTracks.find(t => 
    t.itemGuid && t.itemGuid._ === 'c51ecaa4-f237-4707-9c62-2de611820e4b'
  );
  
  if (exampleTrack) {
    console.log('\n✅ Example track found:');
    console.log(`  Title: ${exampleTrack.title || 'N/A'}`);
    console.log(`  Artist: ${exampleTrack.artist || 'N/A'}`);
    console.log(`  Duration: ${exampleTrack.duration || 'N/A'}`);
    console.log(`  Status: ${exampleTrack.note ? 'Placeholder' : 'Resolved'}`);
  } else {
    console.log('\n❌ Example track not found');
  }
  
} catch (error) {
  console.error('❌ Error checking database status:', error.message);
}
