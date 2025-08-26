#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function migrateHGHToDatabase() {
  console.log('🔄 Migrating HGH tracks to main database...');
  
  // Load existing database
  const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
  
  if (!fs.existsSync(parsedFeedsPath)) {
    console.error('❌ Main database not found at:', parsedFeedsPath);
    return;
  }
  
  const mainDb = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  console.log(`📋 Found ${mainDb.feeds.length} existing feeds in main database`);
  
  // Load HGH data
  const hghResolvedPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
  const hghAudioUrlsPath = path.join(__dirname, '..', 'data', 'hgh-audio-urls.ts');
  const hghArtworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
  
  if (!fs.existsSync(hghResolvedPath)) {
    console.error('❌ HGH resolved songs not found at:', hghResolvedPath);
    return;
  }
  
  const hghTracks = JSON.parse(fs.readFileSync(hghResolvedPath, 'utf8'));
  console.log(`📋 Found ${hghTracks.length} HGH tracks to migrate`);
  
  // Parse audio URLs from TypeScript file
  const audioUrlsContent = fs.readFileSync(hghAudioUrlsPath, 'utf8');
  const audioUrlsMatch = audioUrlsContent.match(/export const HGH_AUDIO_URL_MAP[^=]*=\s*({[^}]*});/s);
  let audioUrls = {};
  if (audioUrlsMatch) {
    try {
      // Clean the object string and parse as JSON
      const cleanedObject = audioUrlsMatch[1].replace(/"/g, '"').replace(/'/g, '"');
      audioUrls = JSON.parse(cleanedObject);
      console.log(`📋 Loaded ${Object.keys(audioUrls).length} audio URLs`);
    } catch (error) {
      console.warn('⚠️ Could not parse audio URLs:', error.message);
    }
  }
  
  // Parse artwork URLs from TypeScript file  
  const artworkUrlsContent = fs.readFileSync(hghArtworkUrlsPath, 'utf8');
  const artworkUrlsMatch = artworkUrlsContent.match(/export const HGH_ARTWORK_URL_MAP[^=]*=\s*({[^}]*});/s);
  let artworkUrls = {};
  if (artworkUrlsMatch) {
    try {
      const cleanedObject = artworkUrlsMatch[1].replace(/"/g, '"').replace(/'/g, '"');
      artworkUrls = JSON.parse(cleanedObject);
      console.log(`📋 Loaded ${Object.keys(artworkUrls).length} artwork URLs`);
    } catch (error) {
      console.warn('⚠️ Could not parse artwork URLs:', error.message);
    }
  }
  
  // Check if HGH feed already exists
  const existingHGHIndex = mainDb.feeds.findIndex(feed => feed.id === 'homegrown-hits-playlist');
  
  // Create HGH feed entry in the same format as main database
  const hghFeedEntry = {
    id: 'homegrown-hits-playlist',
    originalUrl: 'https://feed.homegrownhits.xyz/feed.xml',
    type: 'album',
    title: 'Homegrown Hits Playlist',
    priority: 'playlist',
    status: 'active',
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    parseStatus: 'success',
    lastParsed: new Date().toISOString(),
    parsedData: {
      album: {
        title: 'Homegrown Hits Playlist',
        artist: 'Various Artists',
        description: 'Every music reference from the Homegrown Hits podcast as remote items. This playlist contains tracks from various independent music feeds referenced throughout the podcast episodes.',
        coverArt: 'https://raw.githubusercontent.com/ChadFarrow/ITDV-music-playlist/refs/heads/main/docs/HGH-playlist-art.webp',
        tracks: hghTracks.map((track, index) => {
          const trackTitle = track.title || `Track ${index + 1}`;
          const audioUrl = audioUrls[trackTitle] || '';
          const artworkUrl = artworkUrls[trackTitle] || '';
          
          // Convert duration from seconds to MM:SS format
          let durationFormatted = '3:00'; // Default
          if (track.duration && typeof track.duration === 'number') {
            const minutes = Math.floor(track.duration / 60);
            const seconds = track.duration % 60;
            durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
          
          return {
            title: trackTitle,
            duration: durationFormatted,
            url: audioUrl,
            trackNumber: index + 1,
            subtitle: trackTitle,
            summary: `${trackTitle} by ${track.artist || 'Unknown Artist'} from ${track.feedTitle || 'Homegrown Hits'}`,
            image: artworkUrl || 'https://raw.githubusercontent.com/ChadFarrow/ITDV-music-playlist/refs/heads/main/docs/HGH-playlist-art.webp',
            explicit: false,
            keywords: ['homegrown-hits', 'playlist', 'podcasting-2.0', 'remote-items', 'independent-music']
          };
        }),
        podroll: null,
        publisher: 'Homegrown Hits Podcast',
        funding: null
      }
    }
  };
  
  // Add or update HGH feed in main database
  if (existingHGHIndex >= 0) {
    console.log('🔄 Updating existing HGH feed entry...');
    mainDb.feeds[existingHGHIndex] = hghFeedEntry;
  } else {
    console.log('➕ Adding new HGH feed entry...');
    mainDb.feeds.push(hghFeedEntry);
  }
  
  // Save updated database
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(mainDb, null, 2));
  console.log(`💾 Updated main database with HGH playlist`);
  
  // Statistics
  const tracksWithAudio = hghFeedEntry.parsedData.album.tracks.filter(t => t.url).length;
  const tracksWithArtwork = hghFeedEntry.parsedData.album.tracks.filter(t => t.image && t.image !== hghFeedEntry.parsedData.album.coverArt).length;
  
  console.log('\n🎉 HGH migration completed!');
  console.log(`📊 Stats:`);
  console.log(`  - Total tracks: ${hghTracks.length}`);
  console.log(`  - Tracks with audio: ${tracksWithAudio}`);
  console.log(`  - Tracks with custom artwork: ${tracksWithArtwork}`);
  console.log(`  - Feed ID: homegrown-hits-playlist`);
  console.log('\n🌐 HGH tracks will now appear in the main album grid!');
  console.log('📱 Album will be accessible at: /album/homegrown-hits-playlist');
}

// Also create a similar migration for ITDV tracks
function migrateITDVToDatabase() {
  console.log('\n🔄 Migrating ITDV tracks to main database...');
  
  // Load main database
  const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
  const mainDb = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  
  // Load ITDV data
  const itdvResolvedPath = path.join(__dirname, '..', 'data', 'itdv-resolved-songs.json');
  const itdvAudioUrlsPath = path.join(__dirname, '..', 'data', 'itdv-audio-urls.ts');
  const itdvArtworkUrlsPath = path.join(__dirname, '..', 'data', 'itdv-artwork-urls.ts');
  
  if (!fs.existsSync(itdvResolvedPath)) {
    console.log('⚠️ ITDV resolved songs not found - skipping ITDV migration');
    return;
  }
  
  const itdvTracks = JSON.parse(fs.readFileSync(itdvResolvedPath, 'utf8'));
  console.log(`📋 Found ${itdvTracks.length} ITDV tracks to migrate`);
  
  // Parse ITDV audio URLs
  const audioUrlsContent = fs.readFileSync(itdvAudioUrlsPath, 'utf8');
  const audioUrlsMatch = audioUrlsContent.match(/export const ITDV_AUDIO_URL_MAP[^=]*=\s*({[^}]*});/s);
  let audioUrls = {};
  if (audioUrlsMatch) {
    try {
      const cleanedObject = audioUrlsMatch[1].replace(/"/g, '"').replace(/'/g, '"');
      audioUrls = JSON.parse(cleanedObject);
      console.log(`📋 Loaded ${Object.keys(audioUrls).length} ITDV audio URLs`);
    } catch (error) {
      console.warn('⚠️ Could not parse ITDV audio URLs:', error.message);
    }
  }
  
  // Check if ITDV feed already exists
  const existingITDVIndex = mainDb.feeds.findIndex(feed => feed.id === 'into-the-doerfelverse-playlist');
  
  // Create ITDV feed entry
  const itdvFeedEntry = {
    id: 'into-the-doerfelverse-playlist',
    originalUrl: 'https://www.doerfelverse.com/itdv/itdv-music-playlist.xml',
    type: 'album',
    title: 'Into The Doerfel-Verse Playlist',
    priority: 'playlist',
    status: 'active',
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    parseStatus: 'success',
    lastParsed: new Date().toISOString(),
    parsedData: {
      album: {
        title: 'Into The Doerfel-Verse Playlist',
        artist: 'Various Artists',
        description: 'Every music reference from the Into The Doerfel-Verse podcast. This collection features tracks discovered and discussed throughout the podcast episodes.',
        coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
        tracks: itdvTracks.map((track, index) => {
          const audioUrl = audioUrls[track.title] || '';
          
          return {
            title: track.title,
            duration: '3:00', // Default since ITDV doesn't have duration data
            url: audioUrl,
            trackNumber: index + 1,
            subtitle: track.title,
            summary: `${track.title} by ${track.artist} from ${track.feedTitle}`,
            image: 'https://www.doerfelverse.com/art/itdvchadf.png',
            explicit: false,
            keywords: ['doerfelverse', 'playlist', 'podcasting-2.0', 'into-the-doerfelverse']
          };
        }),
        podroll: null,
        publisher: 'Into The Doerfel-Verse Podcast',
        funding: null
      }
    }
  };
  
  // Add or update ITDV feed
  if (existingITDVIndex >= 0) {
    console.log('🔄 Updating existing ITDV feed entry...');
    mainDb.feeds[existingITDVIndex] = itdvFeedEntry;
  } else {
    console.log('➕ Adding new ITDV feed entry...');
    mainDb.feeds.push(itdvFeedEntry);
  }
  
  // Save updated database
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(mainDb, null, 2));
  console.log(`💾 Updated main database with ITDV playlist`);
  
  console.log(`📊 ITDV Stats: ${itdvTracks.length} tracks, ${Object.keys(audioUrls).length} with audio`);
}

// Run both migrations
console.log('🚀 Starting playlist migration to main database...\n');
migrateHGHToDatabase();
migrateITDVToDatabase();
console.log('\n🎉 All playlist migrations completed!');
console.log('🔄 Restart the dev server to see playlists in the main album grid');