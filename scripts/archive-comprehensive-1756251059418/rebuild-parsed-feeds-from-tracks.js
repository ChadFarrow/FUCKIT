#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Convert individual music tracks into properly structured album data
 * that the albums API expects
 */

async function rebuildParsedFeeds() {
  try {
    console.log('🔄 Rebuilding parsed-feeds.json from music tracks...');
    
    // Load current music tracks
    const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const tracks = musicData.musicTracks;
    
    console.log(`📚 Found ${tracks.length} tracks to process`);
    
    // Group tracks by album (feedGuid + album name)
    const albumGroups = new Map();
    
    tracks.forEach(track => {
      // Use feedGuid + album as the key to group tracks into albums
      const albumKey = `${track.feedGuid}:${track.album || track.feedTitle}`;
      
      if (!albumGroups.has(albumKey)) {
        albumGroups.set(albumKey, {
          feedGuid: track.feedGuid,
          feedUrl: track.feedUrl,
          feedTitle: track.feedTitle,
          albumTitle: track.album || track.feedTitle,
          artist: track.artist,
          tracks: []
        });
      }
      
      albumGroups.get(albumKey).tracks.push(track);
    });
    
    console.log(`🎵 Grouped tracks into ${albumGroups.size} albums`);
    
    // Create feeds structure that the albums API expects
    const feeds = [];
    let feedIndex = 0;
    
    for (const [albumKey, albumData] of albumGroups) {
      feedIndex++;
      
      // Get the first track for album-level metadata
      const firstTrack = albumData.tracks[0];
      
      // Create album tracks in the expected format
      const albumTracks = albumData.tracks.map((track, index) => ({
        title: track.title,
        duration: track.duration || '0:00',
        url: track.enclosureUrl,
        trackNumber: index + 1,
        subtitle: track.title,
        summary: track.description || `${track.title} by ${track.artist}`,
        image: track.image || '',
        explicit: false,
        keywords: []
      }));
      
      // Create the feed entry in the format the albums API expects
      const feedEntry = {
        id: `album-${feedIndex}`,
        originalUrl: albumData.feedUrl,
        type: 'album',
        title: albumData.feedTitle,
        priority: 'generated',
        status: 'active',
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        parseStatus: 'success',  // This is what the API filters for
        lastParsed: new Date().toISOString(),
        parsedData: {  // This is what the API looks for
          album: {
            title: albumData.albumTitle,
            artist: albumData.artist,
            description: albumData.feedTitle,
            coverArt: firstTrack.image || '',
            tracks: albumTracks,
            podroll: null,
            publisher: null,
            funding: firstTrack.value || null
          }
        }
      };
      
      feeds.push(feedEntry);
    }
    
    // Create the final structure
    const parsedFeedsData = {
      feeds: feeds,
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalFeeds: feeds.length,
        generatedFrom: 'music-tracks.json',
        rebuiltAt: new Date().toISOString()
      }
    };
    
    // Save to parsed-feeds.json
    const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
    
    console.log(`✅ Successfully rebuilt parsed-feeds.json with ${feeds.length} albums`);
    console.log('📊 Albums created:');
    feeds.forEach(feed => {
      console.log(`  • "${feed.parsedData.album.title}" by ${feed.parsedData.album.artist} (${feed.parsedData.album.tracks.length} tracks)`);
    });
    
  } catch (error) {
    console.error('❌ Failed to rebuild parsed-feeds.json:', error);
    process.exit(1);
  }
}

// Run the rebuild
rebuildParsedFeeds();