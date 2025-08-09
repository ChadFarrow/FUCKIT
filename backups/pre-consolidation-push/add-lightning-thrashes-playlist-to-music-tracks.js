#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

const RSS_FILE_PATH = path.join(__dirname, '../public/lightning-thrashes-playlist.xml');
const MUSIC_TRACKS_PATH = path.join(__dirname, '../public/music-tracks.json');

function parseRSSPlaylist() {
  try {
    console.log('📖 Reading Lightning Thrashes playlist XML...');
    const xmlContent = fs.readFileSync(RSS_FILE_PATH, 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const remoteItems = doc.getElementsByTagName('podcast:remoteItem');
    console.log(`📊 Found ${remoteItems.length} tracks in Lightning Thrashes playlist`);
    
    const tracks = [];
    const timestamp = new Date().toISOString();
    
    for (let i = 0; i < remoteItems.length; i++) {
      const remoteItem = remoteItems[i];
      
      // Extract GUIDs from remoteItem
      const feedGuid = remoteItem.getAttribute('feedGuid') || '';
      const itemGuid = remoteItem.getAttribute('itemGuid') || '';
      
      // Create a combined GUID for the track
      const guid = `${feedGuid}-${itemGuid}`;
      
      // Extract V4V info
      const v4vData = {
        lightningAddress: '',
        suggestedAmount: 0,
        remotePercentage: 90,
        feedGuid: feedGuid,
        itemGuid: itemGuid,
        resolvedTitle: `Lightning Thrashes Track ${i + 1}`,
        resolvedArtist: 'Lightning Thrashes',
        resolvedImage: 'https://cdn.kolomona.com/podcasts/lightning-thrashes/060/060-Lightning-Thrashes-1000.jpg',
        resolvedAudioUrl: '',
        resolved: false,
        lastResolved: null
      };
      
      // Create a placeholder title since we don't have the actual episode data
      const title = `Lightning Thrashes Track ${i + 1}`;
      const description = `Remote track from Lightning Thrashes playlist`;
      
      const track = {
        id: `lightning-thrashes-playlist-${Date.now()}-${i}`,
        title: title,
        artist: 'Lightning Thrashes',
        episodeId: guid,
        episodeTitle: title,
        episodeDate: timestamp,
        startTime: 0,
        endTime: 300,
        duration: 300,
        audioUrl: '',
        source: 'rss-playlist',
        feedUrl: 'https://cdn.kolomona.com/podcasts/lightning-thrashes/playlists/001-to-060-lightning-thrashes-playlist.xml',
        discoveredAt: timestamp,
        valueForValue: v4vData,
        description: `From Lightning Thrashes RSS Playlist - ${description}`,
        extractionMethod: 'rss-playlist-import',
        lastUpdated: timestamp,
        playlistInfo: {
          source: 'Lightning Thrashes RSS Playlist',
          episodeNumber: i + 1,
          trackNumber: i
        }
      };
      
      tracks.push(track);
    }
    
    console.log(`✅ Parsed ${tracks.length} Lightning Thrashes tracks`);
    return tracks;
  } catch (error) {
    console.error('❌ Error parsing Lightning Thrashes playlist:', error);
    return [];
  }
}

function addTracksToDatabase(newTracks) {
  try {
    console.log('📝 Adding Lightning Thrashes tracks to database...');
    
    // Read existing database
    const existingData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
    
    // Filter out any existing Lightning Thrashes tracks to avoid duplicates
    const existingTracks = existingData.musicTracks || [];
    const filteredExistingTracks = existingTracks.filter(track => 
      track.source !== 'rss-playlist' || 
      !track.feedUrl?.includes('lightning-thrashes')
    );
    
    // Add new tracks at the beginning
    const updatedTracks = [...newTracks, ...filteredExistingTracks];
    
    // Update the database
    const updatedDatabase = {
      ...existingData,
      musicTracks: updatedTracks,
      metadata: {
        ...existingData.metadata,
        lastUpdated: new Date().toISOString(),
        totalTracks: updatedTracks.length
      }
    };
    
    // Write back to file
    fs.writeFileSync(MUSIC_TRACKS_PATH, JSON.stringify(updatedDatabase, null, 2));
    
    console.log(`✅ Added ${newTracks.length} Lightning Thrashes tracks to database`);
    console.log(`📊 Total tracks in database: ${updatedTracks.length}`);
    
    return updatedDatabase;
  } catch (error) {
    console.error('❌ Error adding tracks to database:', error);
    return null;
  }
}

function main() {
  console.log('🚀 Starting Lightning Thrashes playlist import...');
  
  const tracks = parseRSSPlaylist();
  if (tracks.length === 0) {
    console.log('❌ No tracks found, exiting');
    return;
  }
  
  const result = addTracksToDatabase(tracks);
  if (result) {
    console.log('🎉 Lightning Thrashes playlist import completed successfully!');
  } else {
    console.log('❌ Lightning Thrashes playlist import failed');
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseRSSPlaylist, addTracksToDatabase }; 