#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing all albums with podcast platform artwork...\n');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Create backup
const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-mass-artwork-fix-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
console.log(`💾 Created backup: ${path.basename(backupPath)}\n`);

// Generic placeholder artwork for music albums
const PLACEHOLDER_ARTWORK = 'https://cdn.kolomona.com/artwork/placeholder-album-art.jpg';

// Albums to remove entirely (not music)
const albumsToRemove = [
  'hgh-various-artists', // Church of the Redeemer with generic track names
  'hgh-bowl-after-bowl'  // Episode title
];

// Albums that need artwork replacement (legitimate music with wrong art)
const albumsToFixArtwork = [
  'hgh-these-days',
  'hgh-gay',
  'hgh-true-blue',
  'hgh-the-lightning',
  'hgh-kick-it',
  'hgh-no-return',
  'hgh-new-religion',
  'hgh-youre-ok-single',
  'hgh-rainmaker',
  'hgh-stuck-in-the-middle',
  'hgh-consequence',
  'hgh-underground',
  'hgh-nocturnal',
  'hgh-vices',
  'hgh-giving-up-the-ghost',
  'hgh-red-light',
  'hgh-doomsday',
  'hgh-big-day',
  'hgh-blueprint',
  'hgh-push',
  'hgh-catacomb',
  'hgh-deep-end',
  'hgh-rockstar',
  'hgh-gone',
  'hgh-the-everyday',
  'hgh-on-my-way',
  'hgh-hidden-hand'
];

// Remove problematic albums
console.log('🗑️  Removing non-music albums...');
let removedCount = 0;
parsedFeedsData.feeds = parsedFeedsData.feeds.filter(feed => {
  if (albumsToRemove.includes(feed.id)) {
    console.log(`   • Removed: ${feed.parsedData?.album?.title || feed.id}`);
    removedCount++;
    return false;
  }
  return true;
});
console.log(`   Total removed: ${removedCount}\n`);

// Fix artwork for legitimate music albums
console.log('🎨 Replacing podcast artwork with placeholder for music albums...');
let fixedCount = 0;
parsedFeedsData.feeds.forEach(feed => {
  if (albumsToFixArtwork.includes(feed.id) && feed.parsedData?.album) {
    const oldArtwork = feed.parsedData.album.coverArt;
    feed.parsedData.album.coverArt = PLACEHOLDER_ARTWORK;
    
    // Also update track images if they exist
    if (feed.parsedData.album.tracks) {
      feed.parsedData.album.tracks.forEach(track => {
        if (track.image && track.image === oldArtwork) {
          track.image = PLACEHOLDER_ARTWORK;
        }
      });
    }
    
    console.log(`   • Fixed: ${feed.parsedData.album.title}`);
    fixedCount++;
  }
});
console.log(`   Total fixed: ${fixedCount}\n`);

// Save updated parsed-feeds.json
fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
console.log('💾 Updated parsed-feeds.json\n');

// Also update music-tracks.json
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
if (fs.existsSync(musicTracksPath)) {
  const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  
  // Create backup
  const mtBackupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-mass-fix-${Date.now()}.json`);
  fs.writeFileSync(mtBackupPath, JSON.stringify(musicTracksData, null, 2));
  console.log(`💾 Created music-tracks backup: ${path.basename(mtBackupPath)}\n`);
  
  let tracksRemoved = 0;
  let tracksFixed = 0;
  
  // Remove tracks from removed albums
  const removedAlbumTitles = ['Church of the Redeemer', 'Bowl After Bowl', 'Various Artists'];
  musicTracksData.musicTracks = musicTracksData.musicTracks.filter(track => {
    if (removedAlbumTitles.includes(track.albumTitle)) {
      tracksRemoved++;
      return false;
    }
    return true;
  });
  
  // Fix artwork for tracks from fixed albums
  const fixedAlbumTitles = [
    'These Days', 'Gay?', 'True Blue', 'The Lightning', 'Kick It',
    'no return', 'New Religion', "You're OK (single)", 'Rainmaker',
    'Stuck in the Middle', 'Consequence', 'Underground', 'Nocturnal',
    'Vices', 'Giving Up The Ghost', 'Red Light', 'Doomsday', 'Big Day',
    'Blueprint', 'Push', 'Catacomb', 'DEEP END', 'Rockstar', 'Gone',
    'The Everyday', 'On My Way', 'Hidden Hand'
  ];
  
  musicTracksData.musicTracks.forEach(track => {
    if (fixedAlbumTitles.includes(track.albumTitle)) {
      // Check if artwork looks like podcast platform
      if (track.artworkUrl && (
        track.artworkUrl.includes('podbean.com') ||
        track.artworkUrl.includes('libsyn.com') ||
        track.artworkUrl.includes('megaphone.imgix.net') ||
        track.artworkUrl.includes('fusebox.fm') ||
        track.artworkUrl.includes('buzzsprout.com') ||
        track.artworkUrl.includes('spreaker.com') ||
        track.artworkUrl.includes('captivate.fm') ||
        track.artworkUrl.includes('rss.com') ||
        track.artworkUrl.includes('owltail.com')
      )) {
        track.artworkUrl = PLACEHOLDER_ARTWORK;
        tracksFixed++;
      }
    }
  });
  
  fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
  console.log('📊 music-tracks.json updates:');
  console.log(`   • Tracks removed: ${tracksRemoved}`);
  console.log(`   • Track artwork fixed: ${tracksFixed}`);
  console.log('💾 Updated music-tracks.json\n');
}

console.log('✅ Mass artwork fix complete!');
console.log(`   • Albums removed: ${removedCount}`);
console.log(`   • Album artwork fixed: ${fixedCount}`);
console.log(`   • All podcast platform artwork replaced with placeholder`);
console.log('\n💡 Note: Placeholder artwork is temporary. Real artwork can be');
console.log('   fetched later using PodcastIndex API or other sources.');