const fs = require('fs');
const path = require('path');

console.log('🎨 Fixing artwork for HGH albums...');

// Read the current parsed feeds
const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
const musicTracksPath = path.join(process.cwd(), 'data', 'music-tracks.json');

if (!fs.existsSync(parsedFeedsPath)) {
  console.error('❌ parsed-feeds.json not found');
  process.exit(1);
}

if (!fs.existsSync(musicTracksPath)) {
  console.error('❌ music-tracks.json not found');
  process.exit(1);
}

const parsedFeeds = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
const musicTracks = musicTracksData.musicTracks || [];

console.log(`📊 Found ${parsedFeeds.feeds.length} feeds and ${musicTracks.length} music tracks`);

let updatedCount = 0;

// Process each feed
parsedFeeds.feeds.forEach(feed => {
  if (!feed.parsedData?.album || feed.parsedData.album.coverArt) {
    // Skip if no album data or already has artwork
    return;
  }

  const album = feed.parsedData.album;
  
  // Skip if album already has artwork
  if (album.coverArt && album.coverArt.trim() !== '') {
    return;
  }

  // Try to find artwork from the album's tracks by matching with music tracks
  let foundArtwork = null;
  
  if (album.tracks && album.tracks.length > 0) {
    for (const track of album.tracks) {
      // Look for a matching track in music-tracks.json
      const matchingMusicTrack = musicTracks.find(musicTrack => {
        const titleMatch = musicTrack.title && track.title && 
          musicTrack.title.toLowerCase().trim() === track.title.toLowerCase().trim();
        
        const artistMatch = musicTrack.artist && album.artist &&
          musicTrack.artist.toLowerCase().includes(album.artist.toLowerCase()) ||
          album.artist.toLowerCase().includes(musicTrack.artist.toLowerCase());

        return titleMatch && artistMatch && musicTrack.artworkUrl && musicTrack.artworkUrl.trim() !== '';
      });

      if (matchingMusicTrack) {
        foundArtwork = matchingMusicTrack.artworkUrl;
        console.log(`✅ Found artwork for "${album.title}" via track "${track.title}": ${foundArtwork}`);
        break;
      }
    }
  }

  // If no exact track match, try to find artwork by artist name
  if (!foundArtwork) {
    const artistMatch = musicTracks.find(musicTrack => {
      return musicTrack.artist && album.artist &&
        (musicTrack.artist.toLowerCase().includes(album.artist.toLowerCase()) ||
         album.artist.toLowerCase().includes(musicTrack.artist.toLowerCase())) &&
        musicTrack.artworkUrl && musicTrack.artworkUrl.trim() !== '';
    });

    if (artistMatch) {
      foundArtwork = artistMatch.artworkUrl;
      console.log(`🎨 Found artwork for "${album.title}" via artist "${album.artist}": ${foundArtwork}`);
    }
  }

  // Update the album with the found artwork
  if (foundArtwork) {
    album.coverArt = foundArtwork;
    updatedCount++;
  } else {
    console.log(`❌ No artwork found for "${album.title}" by "${album.artist}"`);
  }
});

console.log(`\n📊 Updated ${updatedCount} albums with artwork`);

// Create backup
const backupPath = `${parsedFeedsPath}.backup-artwork-fix-${Date.now()}`;
fs.writeFileSync(backupPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`💾 Created backup at: ${backupPath}`);

// Write updated data
fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeeds, null, 2));
console.log(`✅ Updated parsed-feeds.json with ${updatedCount} artwork fixes`);

console.log('\n🎉 Artwork fix complete! Now refresh your browser to see the updated artwork.');