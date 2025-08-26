#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function integratePublisherFeeds() {
  console.log('🔗 Integrating Publisher Feeds into Albums...\n');
  
  const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
  const publisherResultsPath = path.join(__dirname, '../data/publisher-feed-results.json');
  const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
  
  // Load all data files
  if (!fs.existsSync(parsedFeedsPath) || !fs.existsSync(publisherResultsPath)) {
    console.error('❌ Required data files not found');
    return;
  }
  
  const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  const publisherData = JSON.parse(fs.readFileSync(publisherResultsPath, 'utf8'));
  let musicData = null;
  
  if (fs.existsSync(musicTracksPath)) {
    musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  }
  
  console.log(`📊 Found ${parsedData.feeds.length} albums and ${publisherData.length} publisher feeds`);
  
  // Create mapping of artist feeds to publisher info
  const publisherMap = new Map();
  
  // First, map by extracting artist GUID from publisher feed URLs
  publisherData.forEach(publisher => {
    const guidMatch = publisher.feed.originalUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
    if (guidMatch) {
      const artistGuid = guidMatch[1];
      const publisherInfo = {
        name: publisher.title?.replace(/<!\\[CDATA\\[|\\]\\]>/g, '') || 'Unknown',
        feedGuid: artistGuid,
        feedUrl: publisher.feed.originalUrl,
        artwork: publisher.itunesImage,
        description: publisher.description?.replace(/<!\\[CDATA\\[|\\]\\]>/g, '') || '',
        remoteItemCount: publisher.remoteItemCount || 0
      };
      publisherMap.set(artistGuid, publisherInfo);
    }
  });
  
  console.log(`🗺️  Created mapping for ${publisherMap.size} publisher feeds`);
  
  // Create a mapping from album feed URLs to artist GUIDs using music tracks
  const albumToArtistMap = new Map();
  
  if (musicData) {
    // Group tracks by feedUrl to find which albums belong to which artists
    const feedUrlGroups = new Map();
    
    musicData.musicTracks.forEach(track => {
      if (track.feedUrl) {
        if (!feedUrlGroups.has(track.feedUrl)) {
          feedUrlGroups.set(track.feedUrl, []);
        }
        feedUrlGroups.get(track.feedUrl).push(track);
      }
    });
    
    // For each feed URL, check if tracks have a feedGuid that maps to a publisher
    feedUrlGroups.forEach((tracks, feedUrl) => {
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        if (firstTrack.feedGuid && publisherMap.has(firstTrack.feedGuid)) {
          albumToArtistMap.set(feedUrl, firstTrack.feedGuid);
        }
      }
    });
  }
  
  console.log(`🎵 Found ${albumToArtistMap.size} album-to-artist mappings from music tracks`);
  
  // Now integrate publisher info into albums
  let integratedCount = 0;
  let skippedCount = 0;
  
  parsedData.feeds.forEach((feed, index) => {
    if (feed.parseStatus === 'success' && feed.parsedData?.album) {
      const album = feed.parsedData.album;
      const albumUrl = feed.originalUrl;
      
      // Check if this album already has publisher info
      if (album.publisher && album.publisher.feedGuid) {
        console.log(`⏭️  Album "${album.title}" already has publisher: ${album.publisher.name}`);
        skippedCount++;
        return;
      }
      
      // Try to find publisher info for this album
      let publisherInfo = null;
      let source = '';
      
      // Method 1: Check if album URL maps to an artist GUID
      if (albumToArtistMap.has(albumUrl)) {
        const artistGuid = albumToArtistMap.get(albumUrl);
        publisherInfo = publisherMap.get(artistGuid);
        source = 'music-tracks';
      }
      
      // Method 2: Direct URL pattern matching (for Wavlake albums)
      if (!publisherInfo && albumUrl.includes('wavlake.com/feed/music/')) {
        // This is a Wavlake album - we might have its artist feed
        // We'd need to check the album's RSS feed for podcast:remoteItem
        // For now, we'll leave this for the discovery script to handle
      }
      
      // Method 3: Artist name matching (exact and fuzzy matching)
      if (!publisherInfo && album.artist) {
        // Try to find a publisher with matching artist name
        for (const [guid, pubInfo] of publisherMap.entries()) {
          // Exact match
          if (pubInfo.name.toLowerCase().trim() === album.artist.toLowerCase().trim()) {
            publisherInfo = pubInfo;
            source = 'exact-name-match';
            break;
          }
          
          // Fuzzy matches for common variations
          const pubName = pubInfo.name.toLowerCase().trim();
          const artistName = album.artist.toLowerCase().trim();
          
          // Check if publisher name contains artist name or vice versa
          if (pubName.includes(artistName) || artistName.includes(pubName)) {
            publisherInfo = pubInfo;
            source = 'fuzzy-name-match';
            break;
          }
          
          // Check for common variations (remove "The", "-", etc.)
          const cleanPubName = pubName.replace(/^the\s+/, '').replace(/[^\w\s]/g, '').trim();
          const cleanArtistName = artistName.replace(/^the\s+/, '').replace(/[^\w\s]/g, '').trim();
          
          if (cleanPubName === cleanArtistName) {
            publisherInfo = pubInfo;
            source = 'cleaned-name-match';
            break;
          }
        }
      }
      
      if (publisherInfo) {
        // Add publisher info to the album
        album.publisher = {
          name: publisherInfo.name,
          feedGuid: publisherInfo.feedGuid,
          feedUrl: publisherInfo.feedUrl,
          artwork: publisherInfo.artwork,
          description: publisherInfo.description,
          albumCount: publisherInfo.remoteItemCount
        };
        
        console.log(`✅ Added publisher to "${album.title}" by ${album.artist}:`);
        console.log(`   📡 Publisher: ${publisherInfo.name}`);
        console.log(`   🔗 Source: ${source}`);
        console.log(`   🎵 Albums: ${publisherInfo.remoteItemCount}`);
        
        integratedCount++;
      } else {
        console.log(`⚠️  No publisher found for "${album.title}" by ${album.artist}`);
      }
    }
  });
  
  // Save updated data
  if (integratedCount > 0) {
    console.log('\\n💾 Saving updated album data with publisher information...');
    
    // Create backup
    const backupPath = parsedFeedsPath + `.backup-publisher-integration-${Date.now()}`;
    fs.writeFileSync(backupPath, JSON.stringify(parsedData, null, 2));
    console.log(`📁 Backup saved: ${path.basename(backupPath)}`);
    
    // Save updated data
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedData, null, 2));
    console.log('✅ Updated parsed-feeds.json with publisher information');
  }
  
  // Final summary
  console.log('\\n' + '=' .repeat(60));
  console.log('🏁 PUBLISHER FEED INTEGRATION COMPLETE');
  console.log('=' .repeat(60));
  console.log(`✅ Albums with publishers added: ${integratedCount}`);
  console.log(`⏭️  Albums already had publishers: ${skippedCount}`);
  console.log(`📊 Total publisher feeds available: ${publisherMap.size}`);
  
  if (integratedCount > 0) {
    console.log('\\n🎉 NEW PUBLISHERS INTEGRATED:');
    console.log('These will now appear in the sidebar "Publisher Feeds" section!');
    
    // Show which publishers were newly integrated
    const integratedPublishers = new Set();
    parsedData.feeds.forEach(feed => {
      if (feed.parsedData?.album?.publisher) {
        integratedPublishers.add(feed.parsedData.album.publisher.name);
      }
    });
    
    Array.from(integratedPublishers).sort().forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });
    
    console.log('\\n💡 Refresh your website to see these publishers in the left sidebar!');
  } else {
    console.log('\\n✅ All albums already have publisher information where available');
  }
  
  return {
    integrated: integratedCount,
    skipped: skippedCount,
    totalPublishers: publisherMap.size
  };
}

if (require.main === module) {
  integratePublisherFeeds().catch(console.error);
}

module.exports = { integratePublisherFeeds };