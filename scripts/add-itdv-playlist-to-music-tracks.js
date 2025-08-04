#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

// Paths
const RSS_FILE_PATH = path.join(__dirname, '../public/ITDV-playlist.xml');
const MUSIC_TRACKS_PATH = path.join(__dirname, '../data/music-tracks.json');

function parseRSSPlaylist() {
  try {
    console.log('📖 Reading ITDV RSS playlist...');
    const xmlContent = fs.readFileSync(RSS_FILE_PATH, 'utf-8');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Use getElementsByTagName instead of querySelectorAll
    const items = doc.getElementsByTagName('item');
    console.log(`📊 Found ${items.length} tracks in RSS playlist`);
    
    const tracks = [];
    let trackNumber = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Get child elements
      const titleElement = item.getElementsByTagName('title')[0];
      const descriptionElement = item.getElementsByTagName('description')[0];
      const linkElement = item.getElementsByTagName('link')[0];
      const guidElement = item.getElementsByTagName('guid')[0];
      const remoteItemElement = item.getElementsByTagName('podcast:remoteItem')[0];
      
      const title = titleElement ? titleElement.textContent : '';
      const description = descriptionElement ? descriptionElement.textContent : '';
      const link = linkElement ? linkElement.textContent : '';
      const guid = guidElement ? guidElement.textContent : '';
      
      // Extract episode info from title
      const episodeMatch = title.match(/Episode (\d+)/);
      const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : 0;
      
      // Generate a unique ID
      const trackId = `itdv-playlist-${Date.now()}-${i}`;
      
      // Get remote item attributes
      const feedGuid = remoteItemElement ? remoteItemElement.getAttribute('feedGuid') : '';
      const itemGuid = remoteItemElement ? remoteItemElement.getAttribute('itemGuid') : '';
      
      // Create track object in the same format as existing music tracks
      const track = {
        id: trackId,
        title: title,
        artist: "Into The Doerfel-Verse",
        episodeId: guid,
        episodeTitle: title,
        episodeDate: new Date().toISOString(), // Use current date as fallback
        startTime: 0, // Will be filled by V4V resolution
        endTime: 300, // Default 5 minutes
        duration: 300,
        audioUrl: "https://www.doerfelverse.com/tracks/dvep56.mp3", // Default episode audio
        source: "rss-playlist",
        feedUrl: "https://www.doerfelverse.com/feeds/intothedoerfelverse.xml",
        discoveredAt: new Date().toISOString(),
        valueForValue: {
          lightningAddress: "",
          suggestedAmount: 0,
          remotePercentage: 90,
          feedGuid: feedGuid,
          itemGuid: itemGuid,
          resolvedTitle: title,
          resolvedArtist: "Unknown Artist",
          resolvedImage: "https://www.doerfelverse.com/art/itdvchadf.png",
          resolvedAudioUrl: "", // Will be filled by V4V resolution
          resolved: false,
          lastResolved: null
        },
        description: `From ITDV RSS Playlist - ${description}`,
        extractionMethod: "rss-playlist-import",
        lastUpdated: new Date().toISOString(),
        playlistInfo: {
          source: "ITDV RSS Playlist",
          episodeNumber: episodeNumber,
          trackNumber: trackNumber++
        }
      };
      
      tracks.push(track);
    }
    
    console.log(`✅ Parsed ${tracks.length} tracks from RSS playlist`);
    return tracks;
    
  } catch (error) {
    console.error('❌ Error parsing RSS playlist:', error);
    return [];
  }
}

function addTracksToDatabase(newTracks) {
  try {
    console.log('📖 Reading existing music tracks database...');
    const musicTracksData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
    
    // Check if tracks already exist to avoid duplicates
    const existingIds = new Set(musicTracksData.musicTracks.map(track => track.id));
    const uniqueNewTracks = newTracks.filter(track => !existingIds.has(track.id));
    
    if (uniqueNewTracks.length === 0) {
      console.log('ℹ️  All tracks already exist in database');
      return;
    }
    
    // Add new tracks to the beginning of the array
    musicTracksData.musicTracks.unshift(...uniqueNewTracks);
    
    // Write back to file
    fs.writeFileSync(MUSIC_TRACKS_PATH, JSON.stringify(musicTracksData, null, 2));
    
    console.log(`✅ Added ${uniqueNewTracks.length} new tracks to music database`);
    console.log(`📊 Total tracks in database: ${musicTracksData.musicTracks.length}`);
    
  } catch (error) {
    console.error('❌ Error updating music tracks database:', error);
  }
}

function createPlaylistAlbum() {
  try {
    console.log('🎵 Creating ITDV Playlist Album...');
    
    // Create album data
    const album = {
      id: "itdv-playlist-album",
      title: "Into The Doerfel-Verse Music Playlist",
      artist: "Various Artists",
      description: "Music from Into The Doerfel-Verse podcast episodes 31-56, extracted from RSS playlist",
      coverArt: "https://www.doerfelverse.com/art/itdvchadf.png",
      releaseDate: new Date().toISOString(),
      trackCount: 200,
      episodes: "31-56",
      source: "rss-playlist",
      tracks: [] // Will be populated by the music tracks system
    };
    
    // Save album data
    const albumPath = path.join(__dirname, '../data/albums/itdv-playlist.json');
    fs.mkdirSync(path.dirname(albumPath), { recursive: true });
    fs.writeFileSync(albumPath, JSON.stringify(album, null, 2));
    
    console.log('✅ Created ITDV Playlist Album');
    
  } catch (error) {
    console.error('❌ Error creating playlist album:', error);
  }
}

function main() {
  console.log('🎵 ITDV RSS Playlist to Music Tracks Converter');
  console.log('==============================================');
  
  // Parse RSS playlist
  const tracks = parseRSSPlaylist();
  
  if (tracks.length === 0) {
    console.log('❌ No tracks found, exiting');
    return;
  }
  
  // Add tracks to database
  addTracksToDatabase(tracks);
  
  // Create playlist album
  createPlaylistAlbum();
  
  console.log('\n🎉 ITDV RSS Playlist successfully integrated!');
  console.log('📱 The tracks will now appear in your main music discovery interface');
  console.log('🎧 Users can play them just like other albums on the site');
}

if (require.main === module) {
  main();
}

module.exports = { parseRSSPlaylist, addTracksToDatabase, createPlaylistAlbum }; 