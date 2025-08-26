#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Reparsing HGH feeds to refresh data...\n');

// Load current parsed feeds
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Create backup
const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-before-reparse-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(parsedFeedsData, null, 2));
console.log(`💾 Created backup: ${path.basename(backupPath)}\n`);

// Count current state
const hghFeeds = parsedFeedsData.feeds.filter(f => f.id.startsWith('hgh-'));
console.log(`📊 Current state:`);
console.log(`   • Total feeds: ${parsedFeedsData.feeds.length}`);
console.log(`   • HGH feeds: ${hghFeeds.length}`);
console.log(`   • Non-HGH feeds: ${parsedFeedsData.feeds.length - hghFeeds.length}\n`);

// Load the HGH resolved songs to rebuild feed data
const hghResolvedPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
const hghResolvedData = JSON.parse(fs.readFileSync(hghResolvedPath, 'utf8'));

console.log(`🎵 Found ${hghResolvedData.length} HGH tracks to organize into albums\n`);

// Group tracks by feed GUID to rebuild albums
const albumsByGuid = {};
hghResolvedData.forEach(track => {
  if (!albumsByGuid[track.feedGuid]) {
    albumsByGuid[track.feedGuid] = {
      feedGuid: track.feedGuid,
      feedTitle: track.feedTitle,
      feedUrl: track.feedUrl,
      tracks: []
    };
  }
  albumsByGuid[track.feedGuid].tracks.push(track);
});

console.log(`📀 Organized into ${Object.keys(albumsByGuid).length} albums\n`);

// Update or add HGH albums in parsed feeds
let updatedCount = 0;
let addedCount = 0;

Object.values(albumsByGuid).forEach(albumData => {
  // Create feed ID from title
  const feedId = `hgh-${albumData.feedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  
  // Find existing feed
  let existingFeed = parsedFeedsData.feeds.find(f => f.id === feedId || f.parsedData?.album?.feedGuid === albumData.feedGuid);
  
  if (existingFeed) {
    // Update existing feed with fresh track data
    console.log(`🔄 Updating: ${albumData.feedTitle}`);
    
    // Keep the fixed artwork if it was already fixed
    const currentArtwork = existingFeed.parsedData?.album?.coverArt;
    const isPlaceholder = currentArtwork && currentArtwork.includes('placeholder');
    
    existingFeed.lastParsed = new Date().toISOString();
    existingFeed.parsedData = existingFeed.parsedData || {};
    existingFeed.parsedData.album = {
      ...existingFeed.parsedData.album,
      title: albumData.feedTitle,
      artist: albumData.feedTitle,
      feedGuid: albumData.feedGuid,
      feedTitle: albumData.feedTitle,
      tracks: albumData.tracks.map((track, index) => ({
        title: track.title,
        artist: track.artist || albumData.feedTitle,
        duration: formatDuration(track.duration),
        trackNumber: index + 1,
        itemGuid: track.itemGuid,
        url: '', // Will be resolved separately
        image: isPlaceholder ? currentArtwork : existingFeed.parsedData?.album?.coverArt
      }))
    };
    
    // Keep placeholder artwork if it was set
    if (isPlaceholder) {
      existingFeed.parsedData.album.coverArt = currentArtwork;
    }
    
    updatedCount++;
  } else {
    // Add new feed
    console.log(`➕ Adding new: ${albumData.feedTitle}`);
    
    const newFeed = {
      id: feedId,
      originalUrl: albumData.feedUrl,
      lastParsed: new Date().toISOString(),
      parseStatus: 'success',
      parsedData: {
        album: {
          title: albumData.feedTitle,
          artist: albumData.feedTitle,
          description: `${albumData.feedTitle} by ${albumData.feedTitle}`,
          summary: '',
          subtitle: '',
          coverArt: 'https://cdn.kolomona.com/artwork/placeholder-album-art.jpg',
          releaseDate: new Date().toISOString(),
          explicit: false,
          tracks: albumData.tracks.map((track, index) => ({
            title: track.title,
            artist: track.artist || albumData.feedTitle,
            duration: formatDuration(track.duration),
            trackNumber: index + 1,
            itemGuid: track.itemGuid,
            url: '',
            image: 'https://cdn.kolomona.com/artwork/placeholder-album-art.jpg'
          })),
          feedGuid: albumData.feedGuid,
          feedTitle: albumData.feedTitle,
          publisher: {
            name: 'Home Grown Hits Playlist',
            url: 'https://podcastindex.org',
            feedUrl: albumData.feedUrl
          }
        }
      }
    };
    
    parsedFeedsData.feeds.push(newFeed);
    addedCount++;
  }
});

// Helper function to format duration
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Save updated data
fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));

console.log('\n✅ Reparse complete!');
console.log(`   • Albums updated: ${updatedCount}`);
console.log(`   • Albums added: ${addedCount}`);
console.log(`   • Total feeds now: ${parsedFeedsData.feeds.length}`);
console.log('\n💾 Updated parsed-feeds.json');
console.log('📝 Note: Artwork placeholders are maintained for albums that had podcast platform logos');