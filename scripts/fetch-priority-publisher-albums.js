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

// Load missing publishers analysis
function loadMissingPublishersAnalysis() {
  const analysisPath = path.join(__dirname, '../data/missing-publishers-analysis.json');
  if (!fs.existsSync(analysisPath)) {
    console.error('❌ Missing publishers analysis not found. Run find-missing-publisher-albums.js first.');
    return null;
  }
  
  return JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
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

// Fetch publisher feed to get list of albums
async function fetchPublisherFeed(publisherUrl) {
  try {
    console.log(`📡 Fetching publisher feed: ${publisherUrl}`);
    const response = await fetch(publisherUrl);
    if (!response.ok) {
      console.log(`❌ Failed to fetch ${publisherUrl}: ${response.status}`);
      return null;
    }
    
    const xmlText = await response.text();
    const parsed = await parseXMLString(xmlText);
    
    if (!parsed?.rss?.channel?.remoteitem) {
      console.log(`⚠️  No remote items found in publisher feed`);
      return null;
    }
    
    const remoteItems = Array.isArray(parsed.rss.channel.remoteitem) 
      ? parsed.rss.channel.remoteitem 
      : [parsed.rss.channel.remoteitem];
    
    // Extract album GUIDs from remote items
    const albumGuids = remoteItems
      .filter(item => item.medium === 'music' || !item.medium) // Filter for music items
      .map(item => {
        const feedUrl = item.feedurl || item.feedUrl || '';
        const guid = item.feedguid || item.feedGuid || feedUrl.split('/').pop();
        return {
          guid: guid,
          feedUrl: feedUrl,
          title: item.title || '',
          albumTitle: item.title || ''
        };
      })
      .filter(item => item.guid && item.guid.length > 0);
    
    console.log(`✅ Found ${albumGuids.length} albums in publisher feed`);
    return albumGuids;
    
  } catch (error) {
    console.error(`❌ Error processing publisher feed:`, error.message);
    return null;
  }
}

// Fetch and parse individual album feed
async function fetchAlbumFeed(albumInfo) {
  const feedUrl = albumInfo.feedUrl || `https://wavlake.com/feed/music/${albumInfo.guid}`;
  
  try {
    console.log(`📡 Fetching album: ${albumInfo.albumTitle} (${albumInfo.guid})`);
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.log(`❌ Failed to fetch ${feedUrl}: ${response.status}`);
      return null;
    }
    
    const xmlText = await response.text();
    const parsed = await parseXMLString(xmlText);
    
    if (!parsed?.rss?.channel) {
      console.log(`⚠️  Invalid RSS structure for ${albumInfo.guid}`);
      return null;
    }
    
    const channel = parsed.rss.channel;
    const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
    
    const tracks = items.map((item, index) => ({
      title: item.title || '',
      subtitle: item.subtitle || '',
      summary: item.summary || item.description || '',
      itemGuid: item.guid || '',
      feedGuid: albumInfo.guid,
      feedUrl: feedUrl,
      feedTitle: channel.title || albumInfo.albumTitle,
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
      albumTitle: channel.title || albumInfo.albumTitle,
      artist: item.itunesAuthor || channel.itunesAuthor || '',
      isMusic: true
    }));
    
    console.log(`✅ Found ${tracks.length} tracks in "${channel.title}"`);
    return tracks;
    
  } catch (error) {
    console.error(`❌ Error processing ${albumInfo.guid}:`, error.message);
    return null;
  }
}

// Main function to fetch missing albums for priority publishers
async function fetchPriorityPublisherAlbums(maxPublishers = 3, maxAlbumsPerPublisher = 10) {
  const analysis = loadMissingPublishersAnalysis();
  if (!analysis) return;
  
  const existingTracks = loadExistingTracks();
  const existingAlbumGuids = new Set(existingTracks.map(track => track.feedGuid));
  
  console.log(`🎯 Fetching albums for top ${maxPublishers} priority publishers`);
  console.log(`📊 Already have ${existingAlbumGuids.size} albums in database\n`);
  
  const topPublishers = analysis.publishers.slice(0, maxPublishers);
  const allNewTracks = [];
  
  for (let i = 0; i < topPublishers.length; i++) {
    const publisher = topPublishers[i];
    console.log(`\n[${i + 1}/${topPublishers.length}] Processing: ${publisher.name}`);
    console.log(`Expected: ${publisher.expectedCount} albums, Missing: ${publisher.missingCount}`);
    
    // Fetch publisher feed to get album list
    const albumList = await fetchPublisherFeed(publisher.feedUrl);
    if (!albumList || albumList.length === 0) {
      console.log(`❌ Could not fetch album list for ${publisher.name}`);
      continue;
    }
    
    // Filter out albums we already have
    const missingAlbums = albumList.filter(album => !existingAlbumGuids.has(album.guid));
    console.log(`🔍 Found ${missingAlbums.length} missing albums to fetch`);
    
    // Limit albums per publisher to avoid overwhelming
    const albumsToFetch = missingAlbums.slice(0, maxAlbumsPerPublisher);
    if (albumsToFetch.length < missingAlbums.length) {
      console.log(`📝 Limiting to first ${maxAlbumsPerPublisher} albums`);
    }
    
    // Fetch each missing album
    let processed = 0;
    for (const albumInfo of albumsToFetch) {
      processed++;
      console.log(`  [${processed}/${albumsToFetch.length}] ${albumInfo.albumTitle}`);
      
      const tracks = await fetchAlbumFeed(albumInfo);
      if (tracks && tracks.length > 0) {
        allNewTracks.push(...tracks);
        console.log(`  ✅ Added ${tracks.length} tracks`);
      }
      
      // Rate limiting
      if (processed < albumsToFetch.length) {
        console.log('  ⏱️  Waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`📊 Total tracks added for ${publisher.name}: ${allNewTracks.filter(track => track.feedArtist === publisher.name || track.artist === publisher.name).length}`);
  }
  
  if (allNewTracks.length === 0) {
    console.log('\n❌ No new tracks found');
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
  data.musicTracks.push(...allNewTracks);
  
  // Update metadata
  data.metadata = {
    ...data.metadata,
    lastPriorityPublishersUpdate: new Date().toISOString(),
    priorityPublishersTracksAdded: allNewTracks.length,
    totalTracks: data.musicTracks.length
  };
  
  // Save updated data
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Added ${allNewTracks.length} new tracks to music database`);
  console.log(`📊 Total tracks in database: ${data.musicTracks.length}`);
  
  // Summary of albums added by publisher
  const albumsByPublisher = new Map();
  allNewTracks.forEach(track => {
    const artist = track.feedArtist || track.artist;
    if (!albumsByPublisher.has(artist)) {
      albumsByPublisher.set(artist, new Set());
    }
    albumsByPublisher.get(artist).add(track.feedTitle);
  });
  
  console.log(`\n📖 Summary by Publisher:`);
  albumsByPublisher.forEach((albums, artist) => {
    const trackCount = allNewTracks.filter(track => 
      (track.feedArtist === artist || track.artist === artist)
    ).length;
    console.log(`  ${artist}: ${albums.size} albums, ${trackCount} tracks`);
  });
}

// Run the script
if (require.main === module) {
  const maxPublishers = process.argv[2] ? parseInt(process.argv[2]) : 3;
  const maxAlbumsPerPublisher = process.argv[3] ? parseInt(process.argv[3]) : 10;
  
  console.log(`🚀 Starting fetch for top ${maxPublishers} publishers, max ${maxAlbumsPerPublisher} albums each\n`);
  fetchPriorityPublisherAlbums(maxPublishers, maxAlbumsPerPublisher).catch(console.error);
}

module.exports = { fetchPriorityPublisherAlbums };