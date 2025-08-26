const fs = require('fs');
const path = require('path');

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      } else if (response.status === 404) {
        console.log(`  ⚠️  Feed not found (404): ${url}`);
        return null;
      } else if (response.status === 429) {
        console.log(`  ⏳ Rate limited (429), waiting ${RETRY_DELAY}ms...`);
        await delay(RETRY_DELAY);
        continue;
      } else {
        console.log(`  ❌ HTTP ${response.status}: ${url}`);
        return null;
      }
    } catch (error) {
      if (attempt === retries) {
        console.log(`  ❌ Failed after ${retries} attempts: ${error.message}`);
        return null;
      }
      console.log(`  ⚠️  Attempt ${attempt} failed, retrying...`);
      await delay(RETRY_DELAY);
    }
  }
  return null;
}

function parseRSSFeed(xmlContent) {
  try {
    // Simple XML parsing for RSS feeds
    const titleMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    const artistMatch = xmlContent.match(/<itunes:author[^>]*>([^<]+)<\/itunes:author>/i);
    const albumMatch = xmlContent.match(/<itunes:subtitle[^>]*>([^<]+)<\/itunes:subtitle>/i);
    const durationMatch = xmlContent.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/i);
    const artworkMatch = xmlContent.match(/<itunes:image[^>]*href="([^"]+)"/i);
    const audioMatch = xmlContent.match(/<enclosure[^>]*url="([^"]+\.(?:mp3|wav|m4a|ogg))"/i);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      artist: artistMatch ? artistMatch[1].trim() : null,
      album: albumMatch ? albumMatch[1].trim() : null,
      duration: durationMatch ? durationMatch[1].trim() : null,
      artworkUrl: artworkMatch ? artworkMatch[1].trim() : null,
      audioUrl: audioMatch ? audioMatch[1].trim() : null
    };
  } catch (error) {
    console.log(`  ❌ Error parsing RSS: ${error.message}`);
    return null;
  }
}

async function resolveMetadataForTrack(track, feedGuid) {
  try {
    // Construct Wavlake RSS feed URL
    const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
    
    console.log(`  🔍 Fetching: ${feedGuid}`);
    const xmlContent = await fetchWithRetry(feedUrl);
    
    if (!xmlContent) {
      return { resolved: false, reason: 'Feed not accessible' };
    }
    
    const metadata = parseRSSFeed(xmlContent);
    
    if (!metadata.title && !metadata.artist) {
      return { resolved: false, reason: 'No metadata found in feed' };
    }
    
    // Update track with resolved metadata
    if (metadata.title) track.title = metadata.title;
    if (metadata.artist) track.artist = metadata.artist;
    if (metadata.album) track.album = metadata.album;
    if (metadata.duration) track.duration = metadata.duration;
    if (metadata.artworkUrl) track.artworkUrl = metadata.artworkUrl;
    if (metadata.audioUrl) track.audioUrl = metadata.audioUrl;
    
    // Update tracking information
    track.resolutionStatus = 'resolved';
    track.lastModified = new Date().toISOString();
    track.modificationHistory.push({
      date: new Date().toISOString(),
      action: 'metadata-resolved',
      description: `Resolved from Wavlake RSS feed: ${feedUrl}`,
      source: 'wavlake-rss'
    });
    
    return { resolved: true, metadata };
    
  } catch (error) {
    console.log(`  ❌ Error resolving metadata: ${error.message}`);
    return { resolved: false, reason: error.message };
  }
}

async function resolveAllMetadata() {
  try {
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    // Get all remote item tracks that need resolution
    const tracksToResolve = musicTracks.filter(track => 
      track.itemGuid && track.itemGuid._ && 
      track.resolutionStatus === 'pending'
    );
    
    console.log(`🔍 Starting metadata resolution for ${tracksToResolve.length} tracks...\n`);
    
    let resolvedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    
    // Group tracks by feedGuid to minimize API calls
    const feedGroups = {};
    tracksToResolve.forEach(track => {
      const feedGuid = track.feedGuid;
      if (!feedGroups[feedGuid]) {
        feedGroups[feedGuid] = [];
      }
      feedGroups[feedGuid].push(track);
    });
    
    console.log(`📊 Found ${Object.keys(feedGroups).length} unique feeds to process\n`);
    
    for (const [feedGuid, tracks] of Object.entries(feedGroups)) {
      console.log(`\n�� Processing feed: ${feedGuid} (${tracks.length} tracks)`);
      
      // Fetch feed metadata once for all tracks in this feed
      const feedUrl = `https://wavlake.com/feed/music/${feedGuid}`;
      const xmlContent = await fetchWithRetry(feedUrl);
      
      if (!xmlContent) {
        console.log(`  ❌ Failed to fetch feed, marking ${tracks.length} tracks as failed`);
        tracks.forEach(track => {
          track.resolutionStatus = 'failed';
          track.lastModified = new Date().toISOString();
          track.modificationHistory.push({
            date: new Date().toISOString(),
            action: 'resolution-failed',
            description: `Failed to fetch feed: ${feedUrl}`,
            reason: 'Feed not accessible'
          });
        });
        failedCount += tracks.length;
        continue;
      }
      
      // Parse feed metadata
      const feedMetadata = parseRSSFeed(xmlContent);
      
      if (!feedMetadata.title && !feedMetadata.artist) {
        console.log(`  ⚠️  No metadata found in feed, marking ${tracks.length} tracks as failed`);
        tracks.forEach(track => {
          track.resolutionStatus = 'failed';
          track.lastModified = new Date().toISOString();
          track.modificationHistory.push({
            date: new Date().toISOString(),
            action: 'resolution-failed',
            description: `No metadata found in feed: ${feedUrl}`,
            reason: 'Empty feed'
          });
        });
        failedCount += tracks.length;
        continue;
      }
      
      // Apply feed metadata to all tracks in this feed
      for (const track of tracks) {
        // Update track with resolved metadata
        if (feedMetadata.title) track.title = feedMetadata.title;
        if (feedMetadata.artist) track.artist = feedMetadata.artist;
        if (feedMetadata.album) track.album = feedMetadata.album;
        if (feedMetadata.duration) track.duration = feedMetadata.duration;
        if (feedMetadata.artworkUrl) track.artworkUrl = feedMetadata.artworkUrl;
        if (feedMetadata.audioUrl) track.audioUrl = feedMetadata.audioUrl;
        
        // Update tracking information
        track.resolutionStatus = 'resolved';
        track.lastModified = new Date().toISOString();
        track.modificationHistory.push({
          date: new Date().toISOString(),
          action: 'metadata-resolved',
          description: `Resolved from Wavlake RSS feed: ${feedUrl}`,
          source: 'wavlake-rss',
          metadata: feedMetadata
        });
        
        resolvedCount++;
        console.log(`  ✅ Resolved: ${track.itemGuid._}`);
      }
      
      // Rate limiting between feeds
      if (Object.keys(feedGroups).length > 1) {
        console.log(`  ⏳ Waiting ${DELAY_BETWEEN_REQUESTS}ms before next feed...`);
        await delay(DELAY_BETWEEN_REQUESTS);
      }
    }
    
    // Save updated database
    console.log(`\n💾 Saving resolved database...`);
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `music-tracks-resolved-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
    
    // Final statistics
    const finalStats = {
      total: musicTracks.length,
      remoteTracks: musicTracks.filter(t => t.itemGuid && t.itemGuid._).length,
      resolved: musicTracks.filter(t => t.resolutionStatus === 'resolved').length,
      pending: musicTracks.filter(t => t.resolutionStatus === 'pending').length,
      failed: musicTracks.filter(t => t.resolutionStatus === 'failed').length
    };
    
    console.log(`\n🎯 Resolution Complete:`);
    console.log(`  Resolved tracks: ${resolvedCount}`);
    console.log(`  Failed tracks: ${failedCount}`);
    console.log(`  Skipped tracks: ${skippedCount}`);
    console.log(`  Backup created: ${backupPath}`);
    
    console.log(`\n📊 Final Database Statistics:`);
    console.log(`  Total tracks: ${finalStats.total}`);
    console.log(`  Remote item tracks: ${finalStats.remoteTracks}`);
    console.log(`  Resolved: ${finalStats.resolved}`);
    console.log(`  Pending: ${finalStats.pending}`);
    console.log(`  Failed: ${finalStats.failed}`);
    console.log(`  Resolution rate: ${((finalStats.resolved / finalStats.remoteTracks) * 100).toFixed(1)}%`);
    
    // Show sample resolved track
    const sampleResolved = musicTracks.find(t => t.resolutionStatus === 'resolved');
    if (sampleResolved) {
      console.log(`\n📝 Sample Resolved Track:`);
      console.log(`  Title: ${sampleResolved.title}`);
      console.log(`  Artist: ${sampleResolved.artist}`);
      console.log(`  Album: ${sampleResolved.album || 'N/A'}`);
      console.log(`  Duration: ${sampleResolved.duration || 'N/A'}`);
      console.log(`  Artwork: ${sampleResolved.artworkUrl ? 'Yes' : 'No'}`);
      console.log(`  Audio: ${sampleResolved.audioUrl ? 'Yes' : 'No'}`);
    }
    
  } catch (error) {
    console.error('❌ Error in metadata resolution:', error.message);
  }
}

resolveAllMetadata();
