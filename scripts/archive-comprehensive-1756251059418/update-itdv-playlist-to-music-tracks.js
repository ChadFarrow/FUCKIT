#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

const RSS_FILE_PATH = path.join(__dirname, '../public/ITDV-playlist.xml');
const MUSIC_TRACKS_PATH = path.join(__dirname, '../public/music-tracks.json');

function parseRSSPlaylist() {
  try {
    console.log('📖 Reading updated ITDV playlist XML...');
    const xmlContent = fs.readFileSync(RSS_FILE_PATH, 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const items = doc.getElementsByTagName('item');
    console.log(`📊 Found ${items.length} tracks in updated ITDV playlist`);
    
    const tracks = [];
    const timestamp = new Date().toISOString();
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Extract basic info
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';
      const guid = item.getElementsByTagName('guid')[0]?.textContent || '';
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
      
      // Extract remote item info
      const remoteItem = item.getElementsByTagName('podcast:remoteItem')[0];
      const feedGuid = remoteItem?.getAttribute('feedGuid') || '';
      const itemGuid = remoteItem?.getAttribute('itemGuid') || '';
      
      // Create V4V data
      const v4vData = {
        lightningAddress: '',
        suggestedAmount: 0,
        remotePercentage: 90,
        feedGuid: feedGuid,
        itemGuid: itemGuid,
        resolvedTitle: title,
        resolvedArtist: 'Into The Doerfel-Verse',
        resolvedImage: 'https://www.doerfelverse.com/art/itdvchadf.png',
        resolvedAudioUrl: '',
        resolved: false,
        lastResolved: null
      };
      
      // Extract track number from title
      const trackMatch = title.match(/Music Track (\d+)/);
      const trackNumber = trackMatch ? parseInt(trackMatch[1]) : i + 1;
      
      const track = {
        id: `itdv-playlist-${Date.now()}-${i}`,
        title: title,
        artist: 'Into The Doerfel-Verse',
        episodeId: guid,
        episodeTitle: title,
        episodeDate: new Date(pubDate).toISOString(),
        startTime: 0,
        endTime: 300,
        duration: 300,
        audioUrl: '',
        source: 'rss-playlist',
        feedUrl: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
        discoveredAt: timestamp,
        valueForValue: v4vData,
        description: `From ITDV RSS Playlist - ${description}`,
        extractionMethod: 'rss-playlist-import',
        lastUpdated: timestamp,
        playlistInfo: {
          source: 'ITDV RSS Playlist',
          episodeNumber: trackNumber,
          trackNumber: i
        }
      };
      
      tracks.push(track);
    }
    
    console.log(`✅ Parsed ${tracks.length} updated ITDV tracks`);
    return tracks;
  } catch (error) {
    console.error('❌ Error parsing updated ITDV playlist:', error);
    return [];
  }
}

function updateTracksInDatabase(newTracks) {
  try {
    console.log('📝 Updating ITDV tracks in database...');
    
    // Read existing database
    const existingData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
    
    // Filter out any existing ITDV tracks to replace them
    const existingTracks = existingData.musicTracks || [];
    const filteredExistingTracks = existingTracks.filter(track => 
      track.source !== 'rss-playlist' || 
      !track.feedUrl?.includes('intothedoerfelverse') ||
      !track.playlistInfo?.source?.includes('ITDV')
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
    
    console.log(`✅ Updated ${newTracks.length} ITDV tracks in database`);
    console.log(`📊 Total tracks in database: ${updatedTracks.length}`);
    
    return updatedDatabase;
  } catch (error) {
    console.error('❌ Error updating tracks in database:', error);
    return null;
  }
}

function main() {
  console.log('🚀 Starting ITDV playlist update...');
  
  const tracks = parseRSSPlaylist();
  if (tracks.length === 0) {
    console.log('❌ No tracks found, exiting');
    return;
  }
  
  const result = updateTracksInDatabase(tracks);
  if (result) {
    console.log('🎉 ITDV playlist update completed successfully!');
  } else {
    console.log('❌ ITDV playlist update failed');
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseRSSPlaylist, updateTracksInDatabase }; 