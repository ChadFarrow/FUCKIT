#!/usr/bin/env node

/**
 * Add ITDV Playlist Tracks to Main Music Database
 * 
 * This script adds all resolved ITDV playlist tracks to the main music database,
 * making them searchable and playable alongside regular albums.
 */

const fs = require('fs');
const path = require('path');

// File paths
const ITDV_RESOLVED_SONGS = path.join(__dirname, '..', 'data', 'itdv-resolved-songs.json');
const ITDV_AUDIO_URLS = path.join(__dirname, '..', 'data', 'itdv-audio-urls.ts');
const ITDV_ARTWORK_URLS = path.join(__dirname, '..', 'data', 'itdv-artwork-urls.ts');
const MUSIC_TRACKS_DB = path.join(__dirname, '..', 'data', 'music-tracks.json');

console.log('🎵 ITDV Tracks → Main Music Database Integration');
console.log('='.repeat(60));

// Load ITDV audio URL map
function loadAudioUrlMap() {
  try {
    console.log('📖 Loading ITDV audio URL map...');
    const audioModule = fs.readFileSync(ITDV_AUDIO_URLS, 'utf8');
    const audioMatch = audioModule.match(/export const ITDV_AUDIO_URL_MAP[^{]*{([^}]*)}/s);
    
    if (!audioMatch) {
      console.log('⚠️ No audio URL map found, using empty map');
      return {};
    }
    
    const audioUrlMap = {};
    const entries = audioMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
    
    if (entries) {
      entries.forEach(entry => {
        const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
        audioUrlMap[title] = url;
      });
    }
    
    console.log(`✅ Loaded ${Object.keys(audioUrlMap).length} audio URLs`);
    return audioUrlMap;
  } catch (error) {
    console.log(`⚠️ Error loading audio URLs: ${error.message}`);
    return {};
  }
}

// Load ITDV artwork URL map
function loadArtworkUrlMap() {
  try {
    console.log('📖 Loading ITDV artwork URL map...');
    const artworkModule = fs.readFileSync(ITDV_ARTWORK_URLS, 'utf8');
    const artworkMatch = artworkModule.match(/export const ITDV_ARTWORK_URL_MAP[^{]*{([^}]*)}/s);
    
    if (!artworkMatch) {
      console.log('⚠️ No artwork URL map found, using empty map');
      return {};
    }
    
    const artworkUrlMap = {};
    const entries = artworkMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
    
    if (entries) {
      entries.forEach(entry => {
        const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
        artworkUrlMap[title] = url;
      });
    }
    
    console.log(`✅ Loaded ${Object.keys(artworkUrlMap).length} artwork URLs`);
    return artworkUrlMap;
  } catch (error) {
    console.log(`⚠️ Error loading artwork URLs: ${error.message}`);
    return {};
  }
}

// Load ITDV resolved songs
function loadItdvResolvedSongs() {
  try {
    console.log('📖 Loading ITDV resolved songs...');
    const resolvedSongs = JSON.parse(fs.readFileSync(ITDV_RESOLVED_SONGS, 'utf8'));
    console.log(`✅ Loaded ${resolvedSongs.length} resolved ITDV songs`);
    return resolvedSongs;
  } catch (error) {
    console.error(`❌ Error loading ITDV resolved songs: ${error.message}`);
    return [];
  }
}

// Load existing music database
function loadMusicDatabase() {
  try {
    console.log('📖 Loading main music database...');
    const musicDb = JSON.parse(fs.readFileSync(MUSIC_TRACKS_DB, 'utf8'));
    console.log(`✅ Loaded music database with ${musicDb.musicTracks ? musicDb.musicTracks.length : 0} tracks`);
    return musicDb;
  } catch (error) {
    console.log(`⚠️ Error loading music database: ${error.message}`);
    console.log('📝 Creating new database structure...');
    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      totalTracks: 0,
      musicTracks: []
    };
  }
}

// Convert ITDV track to music database format
function convertItdvTrackToMusicTrack(itdvTrack, audioUrl, artworkUrl, index) {
  const timestamp = new Date().toISOString();
  const trackId = `itdv-${itdvTrack.feedGuid?.substring(0, 8) || 'unknown'}-${itdvTrack.itemGuid?.substring(0, 8) || index}`;
  
  return {
    // Core track identification
    id: trackId,
    title: itdvTrack.title || `ITDV Track ${index + 1}`,
    artist: itdvTrack.artist || 'Into The Doerfel-Verse',
    
    // Episode and source info
    episodeId: itdvTrack.episodeId || null,
    episodeTitle: `ITDV: ${itdvTrack.title || `Track ${index + 1}`}`,
    episodeDate: timestamp,
    
    // Timing info
    startTime: 0,
    endTime: itdvTrack.duration || 300,
    duration: itdvTrack.duration || 300,
    
    // Media URLs
    audioUrl: audioUrl || '',
    artworkUrl: artworkUrl || 'https://www.doerfelverse.com/art/itdvchadf.png',
    
    // Source and discovery info
    source: "itdv-playlist",
    feedUrl: itdvTrack.feedUrl || "https://www.doerfelverse.com/feeds/intothedoerfelverse.xml",
    discoveredAt: timestamp,
    
    // Value for Value data
    valueForValue: {
      lightningAddress: "",
      suggestedAmount: 21,
      remotePercentage: 90,
      feedGuid: itdvTrack.feedGuid || '',
      itemGuid: itdvTrack.itemGuid || '',
      resolvedTitle: itdvTrack.title || '',
      resolvedArtist: itdvTrack.artist || '',
      resolvedImage: artworkUrl || 'https://www.doerfelverse.com/art/itdvchadf.png',
      resolvedAudioUrl: audioUrl || '',
      resolved: true,
      lastResolved: timestamp
    },
    
    // Metadata
    description: `Music from Into The Doerfel-Verse playlist - ${itdvTrack.feedTitle || 'Various Artists'}`,
    extractionMethod: "itdv-playlist-resolved",
    lastUpdated: timestamp,
    
    // Playlist context
    playlistInfo: {
      source: "ITDV RSS Playlist",
      feedTitle: itdvTrack.feedTitle || "Various Artists",
      originalFeedUrl: itdvTrack.feedUrl || "",
      trackNumber: index + 1,
      isRemoteItem: true
    },
    
    // Additional music track fields
    tags: ["itdv", "playlist", "podcast-music", "value4value"],
    categories: ["podcast-music", "independent"],
    language: "en",
    explicit: false
  };
}

// Add tracks to database
function addTracksToDatabase(musicDb, newTracks) {
  console.log('\n📊 Processing tracks for database integration...');
  
  // Check for existing ITDV tracks to avoid duplicates
  const existingItdvTracks = musicDb.musicTracks.filter(track => 
    track.source === 'itdv-playlist' || track.tags?.includes('itdv')
  );
  
  console.log(`📝 Found ${existingItdvTracks.length} existing ITDV tracks in database`);
  
  if (existingItdvTracks.length > 0) {
    console.log('🔄 Removing existing ITDV tracks to prevent duplicates...');
    musicDb.musicTracks = musicDb.musicTracks.filter(track => 
      track.source !== 'itdv-playlist' && !track.tags?.includes('itdv')
    );
  }
  
  // Add new tracks
  console.log(`➕ Adding ${newTracks.length} ITDV tracks to database...`);
  musicDb.musicTracks.unshift(...newTracks);
  
  // Update database metadata
  musicDb.totalTracks = musicDb.musicTracks.length;
  musicDb.lastUpdated = new Date().toISOString();
  
  console.log(`✅ Database updated: ${musicDb.totalTracks} total tracks`);
  
  return musicDb;
}

// Save database
function saveMusicDatabase(musicDb) {
  try {
    console.log('\n💾 Saving updated music database...');
    
    // Create backup first
    const backupPath = MUSIC_TRACKS_DB.replace('.json', `-backup-${Date.now()}.json`);
    if (fs.existsSync(MUSIC_TRACKS_DB)) {
      fs.copyFileSync(MUSIC_TRACKS_DB, backupPath);
      console.log(`📋 Backup created: ${path.basename(backupPath)}`);
    }
    
    // Save updated database
    fs.writeFileSync(MUSIC_TRACKS_DB, JSON.stringify(musicDb, null, 2));
    console.log(`✅ Database saved: ${MUSIC_TRACKS_DB}`);
    
  } catch (error) {
    console.error(`❌ Error saving database: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    // Load all required data
    const itdvResolvedSongs = loadItdvResolvedSongs();
    const audioUrlMap = loadAudioUrlMap();
    const artworkUrlMap = loadArtworkUrlMap();
    const musicDb = loadMusicDatabase();
    
    if (itdvResolvedSongs.length === 0) {
      console.log('❌ No ITDV songs found, exiting');
      return;
    }
    
    console.log('\n🔄 Converting ITDV tracks to music database format...');
    
    // Convert all ITDV tracks
    const musicTracks = itdvResolvedSongs.map((itdvTrack, index) => {
      const audioUrl = audioUrlMap[itdvTrack.title] || '';
      const artworkUrl = artworkUrlMap[itdvTrack.title] || '';
      
      return convertItdvTrackToMusicTrack(itdvTrack, audioUrl, artworkUrl, index);
    });
    
    // Calculate statistics
    const tracksWithAudio = musicTracks.filter(track => track.audioUrl).length;
    const tracksWithArtwork = musicTracks.filter(track => 
      track.artworkUrl && track.artworkUrl !== 'https://www.doerfelverse.com/art/itdvchadf.png'
    ).length;
    
    console.log(`📊 Conversion complete:`);
    console.log(`   Total tracks: ${musicTracks.length}`);
    console.log(`   With audio: ${tracksWithAudio} (${((tracksWithAudio/musicTracks.length)*100).toFixed(1)}%)`);
    console.log(`   With artwork: ${tracksWithArtwork} (${((tracksWithArtwork/musicTracks.length)*100).toFixed(1)}%)`);
    
    // Add to database
    const updatedDb = addTracksToDatabase(musicDb, musicTracks);
    
    // Save database
    saveMusicDatabase(updatedDb);
    
    console.log('\n🎉 ITDV Integration Complete!');
    console.log('📱 All ITDV tracks are now available in the main music database');
    console.log('🎧 Users can discover and play them alongside regular albums');
    console.log('🔍 Tracks are searchable by title, artist, and tags');
    
    // Show sample track for verification
    if (musicTracks.length > 0) {
      const sampleTrack = musicTracks[0];
      console.log('\n📝 Sample track added:');
      console.log(`   Title: "${sampleTrack.title}"`);
      console.log(`   Artist: "${sampleTrack.artist}"`);
      console.log(`   Has Audio: ${sampleTrack.audioUrl ? 'Yes' : 'No'}`);
      console.log(`   Has Artwork: ${sampleTrack.artworkUrl !== 'https://www.doerfelverse.com/art/itdvchadf.png' ? 'Yes' : 'No'}`);
      console.log(`   ID: ${sampleTrack.id}`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  loadItdvResolvedSongs, 
  loadAudioUrlMap, 
  loadArtworkUrlMap,
  convertItdvTrackToMusicTrack,
  addTracksToDatabase 
};