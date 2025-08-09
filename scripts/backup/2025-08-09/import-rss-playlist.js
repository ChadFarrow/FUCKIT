#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

// Configuration
const CONFIG = {
  feedUrl: '',
  playlistName: '',
  shortName: '',
  append: false,
  dryRun: false
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    switch(key) {
      case '--feed':
        CONFIG.feedUrl = value;
        break;
      case '--name':
        CONFIG.playlistName = value;
        break;
      case '--short-name':
        CONFIG.shortName = value;
        break;
      case '--append':
        CONFIG.append = true;
        break;
      case '--dry-run':
        CONFIG.dryRun = true;
        break;
    }
  });
  
  // Validate required fields
  if (!CONFIG.feedUrl) {
    console.error('❌ Error: --feed is required');
    showHelp();
    process.exit(1);
  }
  
  if (!CONFIG.playlistName) {
    console.error('❌ Error: --name is required');
    showHelp();
    process.exit(1);
  }
  
  if (!CONFIG.shortName) {
    CONFIG.shortName = CONFIG.playlistName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
}

function showHelp() {
  console.log(`
🎵 Import RSS Playlist

Usage: node import-rss-playlist.js [options]

Required options:
  --feed=<url>           RSS feed URL or local XML file path
  --name=<name>          Playlist name (e.g., "Lightning Thrashes RSS Playlist")

Optional options:
  --short-name=<name>    Short name for IDs (default: generated from name)
  --append               Append to existing tracks instead of replacing
  --dry-run              Show what would be imported without saving

Examples:
  # Import from URL
  node import-rss-playlist.js \\
    --feed="https://cdn.kolomona.com/podcasts/lightning-thrashes/playlists/001-to-060-lightning-thrashes-playlist.xml" \\
    --name="Lightning Thrashes RSS Playlist" \\
    --append

  # Import from local file
  node import-rss-playlist.js \\
    --feed="./public/ITDV-playlist.xml" \\
    --name="ITDV RSS Playlist" \\
    --short-name="itdv"
`);
}

// Parse RSS/XML content
async function parseRSSContent(content) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  
  const channel = doc.getElementsByTagName('channel')[0];
  const items = doc.getElementsByTagName('item');
  
  console.log(`📊 Found ${items.length} items in RSS feed`);
  
  const tracks = [];
  const timestamp = new Date().toISOString();
  const timestampId = Date.now();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Extract basic info
    const title = item.getElementsByTagName('title')[0]?.textContent || `${CONFIG.playlistName} Track ${i + 1}`;
    const description = item.getElementsByTagName('description')[0]?.textContent || '';
    const guid = item.getElementsByTagName('guid')[0]?.textContent || `${CONFIG.shortName}-${timestampId}-${i}`;
    const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || timestamp;
    
    // Check for remote item (Podcasting 2.0)
    const remoteItem = item.getElementsByTagName('podcast:remoteItem')[0];
    const feedGuid = remoteItem?.getAttribute('feedGuid') || '';
    const itemGuid = remoteItem?.getAttribute('itemGuid') || '';
    
    // Extract episode number from title if available
    const episodeMatch = title.match(/Episode (\d+)|Track (\d+)/i);
    const episodeNumber = episodeMatch ? parseInt(episodeMatch[1] || episodeMatch[2]) : i + 1;
    
    // Create track object
    const track = {
      id: `${CONFIG.shortName}-playlist-${timestampId}-${i}`,
      title: title,
      artist: CONFIG.playlistName.replace(' RSS Playlist', '').replace(' Playlist', ''),
      episodeId: `${feedGuid}-${itemGuid}`,
      episodeTitle: title,
      episodeDate: new Date(pubDate).toISOString(),
      startTime: 0,
      endTime: 300, // Default 5 minutes
      duration: 300,
      audioUrl: '', // Will be resolved via V4V
      source: 'rss-playlist',
      feedUrl: CONFIG.feedUrl,
      discoveredAt: timestamp,
      valueForValue: {
        lightningAddress: '',
        suggestedAmount: 0,
        remotePercentage: 90,
        feedGuid: feedGuid,
        itemGuid: itemGuid,
        resolvedTitle: title,
        resolvedArtist: CONFIG.playlistName.replace(' RSS Playlist', '').replace(' Playlist', ''),
        resolvedImage: '',
        resolvedAudioUrl: '',
        resolved: false,
        lastResolved: null
      },
      description: `From ${CONFIG.playlistName} - ${description || 'Remote track from playlist'}`,
      extractionMethod: 'rss-playlist-import',
      lastUpdated: timestamp,
      playlistInfo: {
        source: CONFIG.playlistName,
        episodeNumber: episodeNumber,
        trackNumber: i
      }
    };
    
    tracks.push(track);
  }
  
  return tracks;
}

// Load RSS content
async function loadRSSContent() {
  try {
    console.log('📖 Loading RSS content...');
    
    // Check if it's a local file or URL
    if (CONFIG.feedUrl.startsWith('http://') || CONFIG.feedUrl.startsWith('https://')) {
      // Fetch from URL
      const response = await fetch(CONFIG.feedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } else {
      // Read from local file
      const filePath = path.resolve(CONFIG.feedUrl);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error('❌ Error loading RSS content:', error.message);
    throw error;
  }
}

// Update music tracks database
function updateMusicTracks(newTracks) {
  const dataPath = path.join(__dirname, '..', 'public', 'music-tracks.json');
  
  try {
    // Read existing data
    let existingData = { musicTracks: [] };
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf-8');
      existingData = JSON.parse(content);
    }
    
    console.log(`📊 Existing tracks: ${existingData.musicTracks.length}`);
    
    let updatedTracks;
    if (CONFIG.append) {
      // Append new tracks
      updatedTracks = [...existingData.musicTracks, ...newTracks];
      console.log(`📝 Appending ${newTracks.length} tracks`);
    } else {
      // Replace tracks from same source
      const filteredTracks = existingData.musicTracks.filter(track => 
        track.playlistInfo?.source !== CONFIG.playlistName
      );
      updatedTracks = [...filteredTracks, ...newTracks];
      console.log(`📝 Replacing ${existingData.musicTracks.length - filteredTracks.length} existing tracks`);
      console.log(`📝 Adding ${newTracks.length} new tracks`);
    }
    
    // Update data
    const updatedData = {
      musicTracks: updatedTracks
    };
    
    if (!CONFIG.dryRun) {
      fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
      console.log(`✅ Saved ${updatedTracks.length} total tracks to music-tracks.json`);
    } else {
      console.log(`🔍 DRY RUN: Would save ${updatedTracks.length} total tracks`);
    }
    
    return updatedTracks.length;
    
  } catch (error) {
    console.error('❌ Error updating music tracks:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    parseArgs();
    
    console.log(`🎵 Importing RSS Playlist: ${CONFIG.playlistName}`);
    console.log(`📡 Feed: ${CONFIG.feedUrl}`);
    
    // Load and parse RSS
    const rssContent = await loadRSSContent();
    const tracks = await parseRSSContent(rssContent);
    
    console.log(`✅ Parsed ${tracks.length} tracks`);
    
    if (CONFIG.dryRun) {
      console.log('\n🔍 DRY RUN - Sample tracks:');
      tracks.slice(0, 5).forEach((track, index) => {
        console.log(`\n  Track ${index + 1}:`);
        console.log(`    Title: ${track.title}`);
        console.log(`    Artist: ${track.artist}`);
        console.log(`    Feed GUID: ${track.valueForValue.feedGuid}`);
        console.log(`    Item GUID: ${track.valueForValue.itemGuid}`);
      });
    }
    
    // Update database
    const totalTracks = updateMusicTracks(tracks);
    
    if (!CONFIG.dryRun) {
      console.log(`\n🎉 Import completed successfully!`);
      console.log(`📊 Total tracks in database: ${totalTracks}`);
      console.log(`\n📝 Next steps:`);
      console.log(`1. Run V4V resolution: node scripts/resolve-v4v-tracks.js --source="${CONFIG.playlistName}"`);
      console.log(`2. Create playlist page: node scripts/create-playlist-from-rss.js --feed="${CONFIG.feedUrl}" --short-name="${CONFIG.shortName}"`);
    }
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

main();