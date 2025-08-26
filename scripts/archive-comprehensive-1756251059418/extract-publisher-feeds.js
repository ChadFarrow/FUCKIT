#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Parse XML to extract publisher feed info
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

// Extract publisher feed from album RSS
async function extractPublisherFromAlbumFeed(feedUrl) {
  try {
    console.log(`📡 Fetching: ${feedUrl}`);
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.log(`❌ Failed to fetch ${feedUrl}: ${response.status}`);
      return null;
    }
    
    const xmlText = await response.text();
    const parsed = await parseXMLString(xmlText);
    
    // Look for podcast:remoteItem with medium="publisher"
    if (parsed?.rss?.channel?.remoteitem) {
      const remoteItems = Array.isArray(parsed.rss.channel.remoteitem) 
        ? parsed.rss.channel.remoteitem 
        : [parsed.rss.channel.remoteitem];
        
      const publisherItem = remoteItems.find(item => item.medium === 'publisher');
      
      if (publisherItem) {
        return {
          feedGuid: publisherItem.feedguid || publisherItem.feedGuid,
          feedUrl: publisherItem.feedurl || publisherItem.feedUrl,
          albumTitle: parsed.rss.channel.title || '',
          albumGuid: feedUrl.split('/').pop()
        };
      }
    }
    
    console.log(`⚠️  No publisher feed found in ${feedUrl}`);
    return null;
  } catch (error) {
    console.error(`❌ Error processing ${feedUrl}:`, error.message);
    return null;
  }
}

// Main function to update music tracks with publisher info
async function updateMusicTracksWithPublisherInfo() {
  const dbPath = path.join(__dirname, '../data/music-tracks.json');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ music-tracks.json not found');
    return;
  }
  
  console.log('📚 Loading music tracks database...');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const musicTracks = data.musicTracks || [];
  
  // Group tracks by feedUrl to get unique album feeds
  const uniqueAlbumFeeds = new Map();
  musicTracks.forEach(track => {
    if (track.feedUrl && !uniqueAlbumFeeds.has(track.feedUrl)) {
      uniqueAlbumFeeds.set(track.feedUrl, {
        feedUrl: track.feedUrl,
        feedGuid: track.feedGuid,
        feedTitle: track.feedTitle,
        tracks: []
      });
    }
    if (track.feedUrl) {
      uniqueAlbumFeeds.get(track.feedUrl).tracks.push(track);
    }
  });
  
  console.log(`📊 Found ${uniqueAlbumFeeds.size} unique album feeds to process`);
  
  // Extract publisher info for each album
  const publisherMappings = new Map();
  let processed = 0;
  
  for (const [feedUrl, albumInfo] of uniqueAlbumFeeds) {
    processed++;
    console.log(`\n[${processed}/${uniqueAlbumFeeds.size}] Processing: ${albumInfo.feedTitle || feedUrl}`);
    
    const publisherInfo = await extractPublisherFromAlbumFeed(feedUrl);
    
    if (publisherInfo) {
      publisherMappings.set(feedUrl, publisherInfo);
      console.log(`✅ Found publisher: ${publisherInfo.feedGuid}`);
      
      // Update all tracks from this album with publisher info
      albumInfo.tracks.forEach(track => {
        const trackIndex = musicTracks.findIndex(t => 
          t.feedUrl === track.feedUrl && 
          t.itemGuid === track.itemGuid
        );
        
        if (trackIndex !== -1) {
          musicTracks[trackIndex].publisherFeedGuid = publisherInfo.feedGuid;
          musicTracks[trackIndex].publisherFeedUrl = publisherInfo.feedUrl;
        }
      });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save updated data
  data.musicTracks = musicTracks;
  data.metadata = {
    ...data.metadata,
    lastPublisherUpdate: new Date().toISOString(),
    publisherMappingsFound: publisherMappings.size
  };
  
  // Backup existing file
  const backupPath = dbPath + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(dbPath));
  console.log(`\n💾 Backed up to: ${backupPath}`);
  
  // Save updated data
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Updated ${publisherMappings.size} albums with publisher feed information`);
  
  // Also save a publisher feeds index
  const publisherIndexPath = path.join(__dirname, '../data/publisher-feeds-index.json');
  const publisherIndex = Array.from(publisherMappings.entries()).map(([albumFeedUrl, info]) => ({
    albumFeedUrl,
    albumGuid: info.albumGuid,
    albumTitle: info.albumTitle,
    publisherFeedGuid: info.feedGuid,
    publisherFeedUrl: info.feedUrl
  }));
  
  fs.writeFileSync(publisherIndexPath, JSON.stringify(publisherIndex, null, 2));
  console.log(`📇 Saved publisher index to: ${publisherIndexPath}`);
  
  // Create a summary of unique publishers
  const uniquePublishers = new Map();
  publisherMappings.forEach(info => {
    if (!uniquePublishers.has(info.feedGuid)) {
      uniquePublishers.set(info.feedGuid, {
        feedGuid: info.feedGuid,
        feedUrl: info.feedUrl,
        albumCount: 0,
        albums: []
      });
    }
    uniquePublishers.get(info.feedGuid).albumCount++;
    uniquePublishers.get(info.feedGuid).albums.push(info.albumTitle);
  });
  
  console.log(`\n📊 Summary: Found ${uniquePublishers.size} unique publishers`);
  uniquePublishers.forEach((publisher, guid) => {
    console.log(`  - ${guid}: ${publisher.albumCount} albums`);
  });
}

// Run the script
if (require.main === module) {
  updateMusicTracksWithPublisherInfo().catch(console.error);
}

module.exports = { extractPublisherFromAlbumFeed };