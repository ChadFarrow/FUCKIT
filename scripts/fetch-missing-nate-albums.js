#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Load existing music tracks to check what we already have
function loadExistingTracks() {
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  if (!fs.existsSync(dbPath)) {
    return [];
  }
  
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  return data.musicTracks || [];
}

// Parse XML to extract track info
async function parseXMLString(xmlString) {
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalizeTags: true,
    tagNameProcessors: [xml2js.processors.stripPrefix]
  });
  
  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Fetch and parse album feed
async function fetchAlbumFeed(albumGuid) {
  const feedUrl = `https://wavlake.com/feed/music/${albumGuid}`;
  
  try {
    console.log(`📡 Fetching: ${feedUrl}`);
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.log(`❌ Failed to fetch ${feedUrl}: ${response.status}`);
      return null;
    }
    
    const xmlText = await response.text();
    const parsed = await parseXMLString(xmlText);
    
    if (!parsed?.rss?.channel) {
      console.log(`⚠️  Invalid RSS structure for ${albumGuid}`);
      return null;
    }
    
    const channel = parsed.rss.channel;
    const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
    
    const tracks = items.map((item, index) => ({
      title: item.title || '',
      subtitle: item.subtitle || '',
      summary: item.summary || item.description || '',
      itemGuid: item.guid || '',
      feedGuid: albumGuid,
      feedUrl: feedUrl,
      feedTitle: channel.title || '',
      feedDescription: channel.description || '',
      feedImage: channel.image?.url || channel.itunesImage || '',
      feedArtist: channel.itunesAuthor || '',
      published: item.pubdate || '',
      duration: item.itunesduration || '',
      explicit: item.itunesexplicit === 'yes',
      keywords: item.ituneskeywords ? item.ituneskeywords.split(',').map(k => k.trim()) : [],
      categories: channel.category ? (Array.isArray(channel.category) ? channel.category : [channel.category]) : [],
      enclosureUrl: item.enclosure?.url || '',
      enclosureType: item.enclosure?.type || '',
      enclosureLength: item.enclosure?.length || '',
      image: item.itunesImage || channel.itunesImage || '',
      trackNumber: index + 1,
      albumTitle: channel.title || '',
      artist: item.itunesAuthor || channel.itunesAuthor || '',
      isMusic: true
    }));
    
    console.log(`✅ Found ${tracks.length} tracks in "${channel.title}"`);
    return tracks;
    
  } catch (error) {
    console.error(`❌ Error processing ${albumGuid}:`, error.message);
    return null;
  }
}

// Main function to fetch missing Nate Johnivan albums
async function fetchMissingNateAlbums() {
  // Load manual mappings
  const mappingsPath = path.join(__dirname, '../data/publisher-mappings-manual.json');
  if (!fs.existsSync(mappingsPath)) {
    console.error('❌ Manual mappings file not found');
    return;
  }
  
  const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
  const nateData = mappings['aa909244-7555-4b52-ad88-7233860c6fb4'];
  
  if (!nateData) {
    console.error('❌ Nate Johnivan data not found in mappings');
    return;
  }
  
  console.log(`📚 Found ${nateData.albumGuids.length} Nate Johnivan albums to check`);
  
  // Load existing tracks
  const existingTracks = loadExistingTracks();
  const existingAlbumGuids = new Set(existingTracks.map(track => track.feedGuid));
  
  console.log(`📊 Already have ${existingAlbumGuids.size} albums in database`);
  
  // Find missing albums
  const missingAlbumGuids = nateData.albumGuids.filter(guid => !existingAlbumGuids.has(guid));
  console.log(`🔍 Found ${missingAlbumGuids.length} missing albums to fetch`);
  
  if (missingAlbumGuids.length === 0) {
    console.log('✅ All albums already in database');
    return;
  }
  
  // Fetch missing albums
  const newTracks = [];
  let processed = 0;
  
  for (const albumGuid of missingAlbumGuids) {
    processed++;
    console.log(`\n[${processed}/${missingAlbumGuids.length}] Processing album: ${albumGuid}`);
    
    const tracks = await fetchAlbumFeed(albumGuid);
    
    if (tracks && tracks.length > 0) {
      newTracks.push(...tracks);
      console.log(`✅ Added ${tracks.length} tracks from "${tracks[0].feedTitle}"`);
    }
    
    // Rate limiting to avoid hitting Wavlake limits
    if (processed < missingAlbumGuids.length) {
      console.log('⏱️  Waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (newTracks.length === 0) {
    console.log('❌ No new tracks found');
    return;
  }
  
  // Update music tracks database
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  // Backup existing file
  const backupPath = dbPath + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(dbPath));
  console.log(`\n💾 Backed up to: ${backupPath}`);
  
  // Add new tracks
  data.musicTracks.push(...newTracks);
  
  // Update metadata
  data.metadata = {
    ...data.metadata,
    lastNateAlbumUpdate: new Date().toISOString(),
    nateAlbumsAdded: newTracks.length,
    totalTracks: data.musicTracks.length
  };
  
  // Save updated data
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Added ${newTracks.length} new tracks to music database`);
  console.log(`📊 Total tracks in database: ${data.musicTracks.length}`);
  
  // Summary of albums added
  const albumsAdded = new Set(newTracks.map(track => track.feedTitle));
  console.log(`\n📖 Albums added:`);
  albumsAdded.forEach(albumTitle => {
    const trackCount = newTracks.filter(track => track.feedTitle === albumTitle).length;
    console.log(`  - ${albumTitle}: ${trackCount} tracks`);
  });
}

// Run the script
if (require.main === module) {
  fetchMissingNateAlbums().catch(console.error);
}

module.exports = { fetchMissingNateAlbums };