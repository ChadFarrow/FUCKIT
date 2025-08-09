#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Update the resolved songs JSON with our successfully resolved track data
function updateResolvedSongs() {
  console.log('🔄 Updating hgh-resolved-songs.json with real resolved track data...');
  
  const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  const resolvedSongs = JSON.parse(fs.readFileSync(resolvedSongsPath, 'utf8'));
  
  console.log(`📋 Found ${resolvedSongs.length} tracks in resolved songs JSON`);
  
  // Update the first 2 tracks with our resolved data
  const updates = [
    {
      index: 0,
      title: "The Great Disappointment",
      artist: "Early Demos I",
      feedTitle: "Early Demos I",
      duration: 213
    },
    {
      index: 1,
      title: "NOW! That's What I Call Value!",
      artist: "The Tjukebox",
      feedTitle: "The Tjukebox",
      duration: 180 // Default since it was Unknown
    }
  ];
  
  updates.forEach(update => {
    if (resolvedSongs[update.index]) {
      resolvedSongs[update.index].title = update.title;
      resolvedSongs[update.index].artist = update.artist;
      resolvedSongs[update.index].feedTitle = update.feedTitle;
      resolvedSongs[update.index].duration = update.duration;
      console.log(`✅ Updated track ${update.index + 1}: ${update.title}`);
    }
  });
  
  // Save updated file
  fs.writeFileSync(resolvedSongsPath, JSON.stringify(resolvedSongs, null, 2));
  console.log(`💾 Updated ${resolvedSongsPath}`);
  
  console.log('\n🎉 HGH resolved songs updated!');
  console.log('🌐 Refresh the playlist page to see the real track titles');
}

updateResolvedSongs();